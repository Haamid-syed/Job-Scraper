import json
import time
from typing import Dict

import google.generativeai as genai
from tenacity import retry, stop_after_attempt, wait_exponential
from loguru import logger

from intelligence.rate_limiter import get_rate_limiter

DRAFT_PROMPT = """Write a concise, specific cold outreach email for Haamid applying to this job.

DEVELOPER CONTEXT:
- Haamid, B.Tech CS student at VIIT (graduating 2027), ~1 year experience
- Notable projects:
  * Social Square: real-time social platform using WebRTC + LiveKit SFU for video/audio
  * Carbonly: full-stack carbon footprint tracker (Next.js + FastAPI + PostgreSQL)
  * Built WebSocket-based collaborative tools with sub-100ms latency
- Previous internship: Software Developer at Oolive (Apr–Dec 2025)
- Freelance client work (Jan–Mar 2026)

JOB DETAILS:
Company: {company}
Role: {title}
Key requirements from listing: {requirements_excerpt}
Apply URL: {apply_url}

RULES:
- Maximum 4 sentences in the body (not counting subject)
- Reference ONE specific project that is most relevant to this role
- Mention ONE specific thing about this company (infer from the listing/company name)
- End with a clear, low-pressure CTA
- Do NOT use: "passionate", "eager to learn", "team player", "I believe", "I am writing to"
- Make it sound like a human wrote it quickly and confidently

Return JSON only:
{{"subject": "...", "body": "..."}}
"""


class QuotaExceededError(Exception):
    """Raised when a Gemini model hits a rate limit or quota restriction."""
    pass


class EmailDrafter:
    def __init__(self, config):
        genai.configure(api_key=config.llm.api_key)
        self.config = config
        
        # Define default fallback chain
        default_chain = ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-3-flash-preview", "gemini-2.0-flash"]
        
        primary_model = config.llm.model
        if primary_model and primary_model not in default_chain:
            self.models_chain = [primary_model] + default_chain
        else:
            self.models_chain = default_chain
            if primary_model in default_chain:
                idx = default_chain.index(primary_model)
                self.models_chain = default_chain[idx:] + default_chain[:idx]
        
        self.rate_limiter = get_rate_limiter("gemini", calls_per_minute=10)
        logger.info(f"[drafter] Initialized with fallback chain: {self.models_chain}")

    def _call_gemini_api_with_retry(self, model_name: str, prompt: str) -> str:
        """Call Gemini API for email drafting with simple retry for transient issues."""
        max_attempts = self.config.llm.max_retries or 3
        delay = self.config.llm.retry_delay_seconds or 5

        for attempt in range(max_attempts):
            try:
                self.rate_limiter.acquire()
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                self.rate_limiter.report_success()
                return response.text.strip()
            except TimeoutError:
                raise QuotaExceededError(f"Rate limiter timeout for {model_name}")
            except Exception as e:
                err_str = str(e).lower()
                err_name = e.__class__.__name__.lower()
                
                # Check for rate-limiting or quota errors
                is_quota_err = (
                    "resourceexhausted" in err_str or 
                    "resourceexhausted" in err_name or 
                    "quota" in err_str or 
                    "limit" in err_str or 
                    "429" in err_str
                )
                
                if is_quota_err:
                    self.rate_limiter.report_429()
                    raise QuotaExceededError(f"Quota exceeded for {model_name}: {e}")
                
                logger.warning(
                    f"[drafter] Model {model_name} failed (attempt {attempt + 1}/{max_attempts}): {e}. "
                    f"Retrying in {delay}s..."
                )
                if attempt < max_attempts - 1:
                    time.sleep(delay)
                else:
                    raise e

    def draft(self, job: dict) -> Dict[str, str]:
        """
        Generate a cold outreach email draft for a job.
        Automatically falls back to next models in chain on failure.
        
        Args:
            job: Job dict from the database (must have title, company, description, apply_url)
        
        Returns:
            {"subject": "...", "body": "..."}
        """
        description = job.get("description") or ""
        requirements_excerpt = description[:800]

        prompt = DRAFT_PROMPT.format(
            company=job.get("company", "the company"),
            title=job.get("title", "Software Engineer"),
            requirements_excerpt=requirements_excerpt,
            apply_url=job.get("apply_url", ""),
        )

        for model_name in self.models_chain:
            logger.info(f"[drafter] Attempting email draft for '{job.get('title')}' @ '{job.get('company')}' using {model_name}...")
            try:
                text = self._call_gemini_api_with_retry(model_name, prompt)

                # Strip markdown fences
                if text.startswith("```"):
                    parts = text.split("```")
                    text = parts[1] if len(parts) > 1 else text
                    if text.startswith("json"):
                        text = text[4:]
                text = text.strip()

                data = json.loads(text)
                if "subject" not in data or "body" not in data:
                    raise ValueError(f"LLM response missing subject/body keys: {text[:200]}")

                logger.info(f"[drafter] Draft complete using {model_name}: subject='{data['subject'][:60]}...'")
                return data
            except Exception as e:
                logger.warning(
                    f"[drafter] Model {model_name} failed to generate email draft: {e}. "
                    f"Trying next model in fallback chain..."
                )

        raise RuntimeError("All LLM models in fallback chain failed to generate email draft.")
