"""RemoteOK scraper — uses their free public JSON API."""

import time
from datetime import datetime
from typing import List

import requests
from loguru import logger

from .base import BaseScraper, RawJob

TECH_KEYWORDS = [
    "react", "node.js", "typescript", "python", "fastapi", "postgresql",
    "docker", "aws", "kubernetes", "redis", "graphql", "rust", "go",
    "webrtc", "websocket", "socket.io", "livekit", "next.js", "vue",
    "angular", "java", "express", "django",
]

HEADERS = {
    "User-Agent": "JobRadar/2.0 (job aggregator; contact: haamid@example.com)",
}


class RemoteOKScraper(BaseScraper):
    """Scrapes remote developer jobs from RemoteOK's public JSON API."""

    source_name = "remoteok"

    def __init__(self, config):
        self.config = config
        self.max_results = getattr(
            getattr(config.sources, "remoteok", None), "max_results", 50
        )

    def scrape(self) -> List[RawJob]:
        start = time.time()
        logger.info(f"[{self.source_name}] Starting scrape...")

        try:
            resp = requests.get(
                "https://remoteok.com/api",
                headers=HEADERS,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.error(f"[{self.source_name}] API request failed: {e}")
            return []

        # First element is a metadata/legal notice object — skip it
        job_entries = data[1:] if len(data) > 1 else []
        jobs: List[RawJob] = []

        for entry in job_entries[:self.max_results]:
            try:
                title = entry.get("position", "").strip()
                company = entry.get("company", "").strip()
                if not title or not company:
                    continue

                # Filter by tags matching developer roles
                tags = [t.lower() for t in entry.get("tags", [])]
                desc = entry.get("description", "")
                desc_lower = desc.lower()

                # Extract stack from tags + description
                stack = list(set(
                    [kw for kw in TECH_KEYWORDS if kw in desc_lower] +
                    [t for t in tags if t in TECH_KEYWORDS]
                ))

                # Parse date
                posted_at = None
                date_str = entry.get("date", "")
                if date_str:
                    try:
                        posted_at = datetime.fromisoformat(
                            date_str.replace("Z", "+00:00")
                        ).replace(tzinfo=None)
                    except Exception:
                        pass

                # Salary
                salary_parts = []
                if entry.get("salary_min"):
                    salary_parts.append(f"${entry['salary_min']:,}")
                if entry.get("salary_max"):
                    salary_parts.append(f"${entry['salary_max']:,}")
                salary_range = " - ".join(salary_parts) if salary_parts else ""

                job_type = "full-time"
                if "intern" in title.lower() or "intern" in desc_lower:
                    job_type = "internship"

                apply_url = entry.get("apply_url") or entry.get("url", "")
                if not apply_url:
                    slug = entry.get("slug", "")
                    apply_url = f"https://remoteok.com/remote-jobs/{slug}" if slug else ""

                if not apply_url:
                    continue

                location = entry.get("location", "Remote") or "Remote"

                jobs.append(RawJob(
                    title=title[:200],
                    company=company[:100],
                    apply_url=apply_url,
                    source=self.source_name,
                    description=desc[:3000],
                    location=location,
                    job_type=job_type,
                    posted_at=posted_at,
                    salary_range=salary_range,
                    stack_mentioned=stack,
                ))

            except Exception as e:
                logger.debug(f"[{self.source_name}] Error parsing entry: {e}")
                continue

        duration = time.time() - start
        logger.info(f"[{self.source_name}] Done — {len(jobs)} jobs in {duration:.1f}s")
        return jobs
