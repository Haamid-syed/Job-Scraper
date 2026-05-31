"""
OpenRouter free-tier client for LLM scoring fallback.

Uses OpenAI-compatible API at https://openrouter.ai/api/v1
Free tier: 20 RPM, 50 requests/day (1000/day with $10 credits)

Free models available (as of May 2026):
- deepseek/deepseek-v4-flash:free
- google/gemma-4-26b-a4b-it:free
- qwen/qwen3-next-80b-a3b-instruct:free
"""

import json
import time
from typing import Optional

import requests
from loguru import logger

from intelligence.rate_limiter import get_rate_limiter

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# Free models to try, in order of preference
FREE_MODELS = [
    "deepseek/deepseek-v4-flash:free",
    "google/gemma-4-26b-a4b-it:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
]


class OpenRouterClient:
    """OpenAI-compatible client for OpenRouter's free models."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.rate_limiter = get_rate_limiter("openrouter", calls_per_minute=20)
        self.current_model_index = 0
        self.models = list(FREE_MODELS)
        logger.info(f"[openrouter] Initialized with {len(self.models)} free models")

    def is_available(self) -> bool:
        """Check if client has a valid API key."""
        return bool(self.api_key and self.api_key.strip())

    def generate(self, prompt: str, max_retries: int = 2) -> Optional[str]:
        """
        Generate text using OpenRouter free models.
        Automatically falls through the model list on failures.
        Returns the raw text response, or None if all models fail.
        """
        if not self.is_available():
            return None

        while self.current_model_index < len(self.models):
            model = self.models[self.current_model_index]

            for attempt in range(max_retries):
                try:
                    self.rate_limiter.acquire(timeout=60)

                    response = requests.post(
                        f"{OPENROUTER_BASE_URL}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                            "HTTP-Referer": "https://jobradar.local",
                            "X-Title": "JobRadar",
                        },
                        json={
                            "model": model,
                            "messages": [
                                {"role": "user", "content": prompt}
                            ],
                            "temperature": 0.2,
                            "max_tokens": 500,
                        },
                        timeout=30,
                    )

                    if response.status_code == 429:
                        self.rate_limiter.report_429()
                        logger.warning(f"[openrouter] Rate limited on {model}")
                        raise Exception("429 rate limit")

                    response.raise_for_status()
                    data = response.json()

                    # Extract text from OpenAI-compatible response
                    choices = data.get("choices", [])
                    if choices:
                        text = choices[0].get("message", {}).get("content", "").strip()
                        if text:
                            self.rate_limiter.report_success()
                            return text

                    raise Exception(f"Empty response from {model}")

                except TimeoutError:
                    logger.warning(f"[openrouter] Rate limiter timeout for {model}")
                    break  # Move to next model

                except Exception as e:
                    err_str = str(e).lower()
                    if "429" in err_str or "rate" in err_str or "limit" in err_str:
                        self.rate_limiter.report_429()
                        if attempt == max_retries - 1:
                            break  # Move to next model
                        time.sleep(2 * (attempt + 1))
                    else:
                        logger.warning(f"[openrouter] {model} failed (attempt {attempt+1}): {e}")
                        if attempt == max_retries - 1:
                            break
                        time.sleep(1)

            # This model failed — try next
            logger.info(f"[openrouter] Moving past {model}")
            self.current_model_index += 1

        logger.warning("[openrouter] All free models exhausted")
        return None

    def score_job(self, prompt: str) -> Optional[dict]:
        """
        Generate and parse a JSON scoring response.
        Returns parsed dict or None on failure.
        """
        text = self.generate(prompt)
        if not text:
            return None

        try:
            # Strip markdown fences
            if text.startswith("```"):
                parts = text.split("```")
                text = parts[1] if len(parts) > 1 else text
                if text.startswith("json"):
                    text = text[4:]
            text = text.strip()

            data = json.loads(text)
            if isinstance(data, dict):
                return data
        except (json.JSONDecodeError, Exception) as e:
            logger.debug(f"[openrouter] JSON parse failed: {e}")

        return None
