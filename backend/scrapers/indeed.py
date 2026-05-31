"""Indeed scraper — reuses python-jobspy (already a dependency for LinkedIn)."""

import hashlib
import random
import time
from datetime import datetime
from typing import List

from loguru import logger

from .base import BaseScraper, RawJob

TECH_KEYWORDS = [
    "react", "node.js", "typescript", "python", "fastapi", "postgres",
    "docker", "aws", "kubernetes", "redis", "graphql", "rust", "go",
    "webrtc", "websocket", "socket.io", "livekit", "next.js", "vue",
    "angular", "java", "spring", "express", "django",
]


class IndeedScraper(BaseScraper):
    """Scrapes Indeed jobs via python-jobspy (same library used for LinkedIn)."""

    source_name = "indeed"

    def __init__(self, config):
        self.config = config
        indeed_cfg = getattr(config.sources, "indeed", None)
        self.max_results = getattr(indeed_cfg, "max_results", 30) if indeed_cfg else 30
        self.search_terms = (
            getattr(indeed_cfg, "search_terms", None)
            if indeed_cfg
            else config.sources.linkedin.search_terms  # Fallback to LinkedIn terms
        )

    def scrape(self) -> List[RawJob]:
        try:
            from jobspy import scrape_jobs
        except ImportError:
            logger.error("[indeed] python-jobspy not installed. Run: pip install python-jobspy")
            return []

        start = time.time()
        logger.info(f"[{self.source_name}] Starting scrape...")

        all_jobs: List[RawJob] = []
        seen_ids: set = set()

        for term in self.search_terms:
            try:
                logger.debug(f"[{self.source_name}] Searching: '{term}'")
                df = scrape_jobs(
                    site_name=["indeed"],
                    search_term=term,
                    location="India",
                    results_wanted=self.max_results,
                    hours_old=24 * self.config.filters.max_age_days,
                    country_indeed="India",
                )
                if df is None or df.empty:
                    continue

                for _, row in df.iterrows():
                    apply_url = str(row.get("job_url") or row.get("apply_url") or "")
                    if not apply_url:
                        continue

                    # Deduplicate across search terms
                    job_id_raw = f"{str(row.get('company', '')).lower()}{str(row.get('title', '')).lower()}indeed"
                    job_id = hashlib.sha256(job_id_raw.encode()).hexdigest()[:16]
                    if job_id in seen_ids:
                        continue
                    seen_ids.add(job_id)

                    # Parse date
                    posted_at = None
                    date_val = row.get("date_posted") or row.get("posted_date")
                    if date_val:
                        try:
                            if isinstance(date_val, datetime):
                                posted_at = date_val
                            else:
                                posted_at = datetime.strptime(str(date_val)[:10], "%Y-%m-%d")
                        except Exception:
                            posted_at = None

                    description = str(row.get("description") or "")
                    desc_lower = description.lower()
                    stack = [kw for kw in TECH_KEYWORDS if kw in desc_lower]

                    job_type = str(row.get("job_type") or "full-time").lower()
                    if "intern" in job_type or "intern" in str(row.get("title", "")).lower():
                        job_type = "internship"

                    all_jobs.append(
                        RawJob(
                            title=str(row.get("title") or "").strip()[:200],
                            company=str(row.get("company") or "").strip()[:100],
                            apply_url=apply_url,
                            source=self.source_name,
                            description=description[:3000],
                            location=str(row.get("location") or "India"),
                            job_type=job_type,
                            posted_at=posted_at,
                            salary_range=str(row.get("min_amount") or ""),
                            company_size=str(row.get("company_num_employees") or ""),
                            stack_mentioned=stack,
                        )
                    )
            except Exception as e:
                logger.error(f"[{self.source_name}] Error for term '{term}': {e}")
                continue  # Try remaining terms instead of aborting all
            
            # Delay between search terms to avoid rapid rate-limiting
            time.sleep(random.uniform(3, 6))

        duration = time.time() - start
        logger.info(
            f"[{self.source_name}] Done — {len(all_jobs)} unique jobs in {duration:.1f}s "
            f"across {len(self.search_terms)} search terms"
        )
        return all_jobs
