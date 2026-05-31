import time
import random
import json
from datetime import datetime, timedelta
from typing import List, Optional

import requests
from bs4 import BeautifulSoup
from loguru import logger

from .base import BaseScraper, RawJob

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

TECH_KEYWORDS = [
    "react", "node.js", "typescript", "python", "fastapi", "postgresql",
    "docker", "aws", "kubernetes", "redis", "graphql", "rust", "go",
    "webrtc", "websocket", "socket.io", "livekit", "next.js", "vue",
    "angular", "java", "express", "django",
]

JOB_URL_KEYWORDS = ["jobs", "careers", "apply", "lever", "greenhouse", "ashby", "workable", "job"]


class GoogleSearchScraper(BaseScraper):
    """Discovers job listings via targeted Google dork searches."""

    source_name = "google"

    def __init__(self, config):
        self.config = config
        self._llm_model = None

    def _generate_queries(self) -> List[str]:
        """Generate targeted queries from config templates × niche skills."""
        queries: List[str] = []
        niche_skills = self.config.profile.skills.niche
        ats_sites = self.config.sources.google_search.ats_sites
        cutoff_date = (datetime.now() - timedelta(days=self.config.filters.max_age_days)).strftime("%Y-%m-%d")

        for skill in niche_skills[:4]:
            for site in ats_sites[:4]:
                queries.append(f'site:{site} "{skill}" engineer OR developer')
            queries.append(f'"{skill}" startup "we are hiring" engineer remote after:{cutoff_date}')
            queries.append(f'"{skill}" internship developer 2026 after:{cutoff_date}')

        max_q = self.config.sources.google_search.max_queries_per_run
        return queries[:max_q]

    def _fetch_and_parse_job_page(self, url: str) -> Optional[RawJob]:
        """Fetch job page and extract structured data."""
        try:
            resp = requests.get(url, timeout=10, headers=HEADERS)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")
            page_text = soup.get_text(separator=" ", strip=True)[:3000]
            return self._extract_job_with_llm(url, page_text)
        except Exception as e:
            logger.debug(f"[google] Could not fetch/parse {url}: {e}")
            return None

    def _extract_job_with_llm(self, url: str, page_text: str) -> Optional[RawJob]:
        """Use Gemini to extract structured job info from arbitrary page text."""
        if not self._llm_model:
            return self._heuristic_extract(url, page_text)

        try:

            prompt = f"""Extract job listing info from this page. Return JSON only, or null if not a job listing.
URL: {url}
Page text (truncated): {page_text}

JSON format if it IS a job:
{{"title": "...", "company": "...", "location": "...", "job_type": "...", 
  "description_excerpt": "...(first 500 chars of requirements)...",
  "apply_url": "{url}"}}

Return null (literally the word null) if this is not a job listing page."""

            response = self._llm_model.generate_content(prompt)
            text = response.text.strip()

            if text.lower() == "null" or text.lower().startswith("null"):
                return None

            # Strip markdown fences
            if text.startswith("```"):
                parts = text.split("```")
                text = parts[1] if len(parts) > 1 else text
                if text.startswith("json"):
                    text = text[4:]
            text = text.strip()

            data = json.loads(text)
            if not data or not isinstance(data, dict):
                return None

            title = data.get("title", "").strip()
            company = data.get("company", "").strip()
            if not title or not company:
                return None

            desc = data.get("description_excerpt", page_text[:500])
            desc_lower = desc.lower()
            stack = [kw for kw in TECH_KEYWORDS if kw in desc_lower]
            job_type = data.get("job_type", "full-time").lower()
            if "intern" in job_type or "intern" in title.lower():
                job_type = "internship"

            return RawJob(
                title=title[:200],
                company=company[:100],
                apply_url=data.get("apply_url", url),
                source=self.source_name,
                description=desc[:3000],
                location=data.get("location", "Remote"),
                job_type=job_type,
                posted_at=None,
                stack_mentioned=stack,
            )
        except Exception as e:
            logger.debug(f"[google] LLM extraction failed for {url}: {e}")
            return self._heuristic_extract(url, page_text)

    def _heuristic_extract(self, url: str, page_text: str) -> Optional[RawJob]:
        """Simple heuristic extraction when LLM is unavailable."""
        lower = page_text.lower()
        job_indicators = ["software engineer", "developer", "hiring", "apply now", "job description", "requirements"]
        if not any(ind in lower for ind in job_indicators):
            return None

        lines = [l.strip() for l in page_text.split("\n") if l.strip() and len(l.strip()) > 3]
        title = lines[0] if lines else "Software Engineer"
        company = lines[1] if len(lines) > 1 else "Unknown"

        # Try to get better title/company from URL
        url_parts = url.rstrip("/").split("/")
        if "lever.co" in url or "greenhouse.io" in url or "ashbyhq.com" in url:
            if len(url_parts) >= 4:
                company = url_parts[-2].replace("-", " ").title()
                title = url_parts[-1].replace("-", " ").title()

        stack = [kw for kw in TECH_KEYWORDS if kw in lower]
        job_type = "internship" if "intern" in lower else "full-time"

        return RawJob(
            title=title[:200],
            company=company[:100],
            apply_url=url,
            source=self.source_name,
            description=page_text[:3000],
            location="Remote",
            job_type=job_type,
            posted_at=None,
            stack_mentioned=stack,
        )

    def scrape(self) -> List[RawJob]:
        try:
            from googlesearch import search as google_search
        except ImportError:
            logger.error("[google] googlesearch-python not installed. Run: pip install googlesearch-python")
            return []

        start = time.time()
        logger.info(f"[{self.source_name}] Starting scrape...")

        # Initialize Gemini model once for the whole scrape run
        self._llm_model = None
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.config.llm.api_key)
            self._llm_model = genai.GenerativeModel(self.config.llm.model)
        except Exception as e:
            logger.warning(f"[google] Could not initialize Gemini, using heuristic extraction: {e}")

        queries = self._generate_queries()
        delay = self.config.sources.google_search.delay_between_queries_seconds
        jobs: List[RawJob] = []
        seen_urls: set = set()
        consecutive_429s = 0

        for i, query in enumerate(queries):
            try:
                logger.debug(f"[google] Query {i+1}/{len(queries)}: {query}")
                results = list(google_search(query, num_results=5, sleep_interval=2))
                consecutive_429s = 0  # reset on success

                for url in results:
                    if url in seen_urls:
                        continue
                    if not any(kw in url for kw in JOB_URL_KEYWORDS):
                        continue
                    seen_urls.add(url)

                    job = self._fetch_and_parse_job_page(url)
                    if job:
                        jobs.append(job)
                        logger.debug(f"[google] Extracted: {job.title} @ {job.company}")

                # Random delay between queries — HARD limit to avoid rate limiting
                sleep_time = delay + random.uniform(0, 4)
                time.sleep(sleep_time)

            except Exception as e:
                logger.warning(f"[google] Query failed: {query[:60]}... — {e}")
                
                # Check for 429 Rate Limits and abort early if blocked
                err_str = str(e).lower()
                if "429" in err_str or "too many requests" in err_str or "rate limit" in err_str:
                    consecutive_429s += 1
                    if consecutive_429s >= 3:
                        logger.error(
                            f"[google] Aborting Google Search scraper: {consecutive_429s} consecutive 429 rate limits. "
                            "Google is temporarily blocking requests from this IP."
                        )
                        break
                else:
                    consecutive_429s = 0

                time.sleep(delay)
                continue

        duration = time.time() - start
        logger.info(f"[{self.source_name}] Done — {len(jobs)} jobs in {duration:.1f}s")
        return jobs
