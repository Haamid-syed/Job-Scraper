import time
from datetime import datetime, timedelta
from typing import List

import requests
from tenacity import retry, stop_after_attempt, wait_exponential
from loguru import logger

from .base import BaseScraper, RawJob


class RemotiveScraper(BaseScraper):
    """Scrapes Remotive.com free public API."""

    source_name = "remotive"
    API_URL = "https://remotive.com/api/remote-jobs"

    def __init__(self, config):
        self.config = config
        self.max_age_days = config.filters.max_age_days

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
    def _fetch_jobs(self) -> list:
        resp = requests.get(
            self.API_URL,
            params={"category": "software-dev", "limit": 100},
            timeout=self.timeout_seconds,
        )
        resp.raise_for_status()
        return resp.json().get("jobs", [])

    def scrape(self) -> List[RawJob]:
        start = time.time()
        logger.info(f"[{self.source_name}] Starting scrape...")

        raw_jobs = self._fetch_jobs()
        cutoff = datetime.now() - timedelta(days=self.max_age_days)
        jobs = []

        for job in raw_jobs:
            # Location filter — empty location means worldwide
            location_str = (job.get("candidate_required_location") or "").lower().strip()
            if location_str and not any(
                kw in location_str
                for kw in ["worldwide", "remote", "india", "anywhere", "global"]
            ):
                continue

            # Parse published date
            published_raw = job.get("publication_date") or job.get("published_date") or ""
            posted_at = None
            if published_raw:
                try:
                    posted_at = datetime.fromisoformat(published_raw.replace("Z", "+00:00")).replace(tzinfo=None)
                except Exception:
                    try:
                        posted_at = datetime.strptime(published_raw[:10], "%Y-%m-%d")
                    except Exception:
                        posted_at = None

            # Age filter
            if posted_at and posted_at < cutoff:
                continue

            # Extract stack from tags
            tags = job.get("tags") or []
            stack = [t.lower() for t in tags if isinstance(t, str)]

            jobs.append(
                RawJob(
                    title=job.get("title", "").strip(),
                    company=job.get("company_name", "").strip(),
                    apply_url=job.get("url", ""),
                    source=self.source_name,
                    description=job.get("description", "")[:3000],
                    location=job.get("candidate_required_location") or "Remote",
                    job_type=job.get("job_type", "full-time").lower(),
                    posted_at=posted_at,
                    salary_range=job.get("salary", ""),
                    stack_mentioned=stack,
                )
            )

        duration = time.time() - start
        logger.info(
            f"[{self.source_name}] Done — {len(jobs)} jobs in {duration:.1f}s "
            f"(from {len(raw_jobs)} total)"
        )
        return jobs
