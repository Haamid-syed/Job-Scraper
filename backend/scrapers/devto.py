"""dev.to Jobs scraper — uses their free public listings API."""

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
    "User-Agent": "JobRadar/2.0",
    "Accept": "application/json",
}


class DevToScraper(BaseScraper):
    """Scrapes developer job listings from dev.to's public API."""

    source_name = "devto"

    def __init__(self, config):
        self.config = config

    def scrape(self) -> List[RawJob]:
        start = time.time()
        logger.info(f"[{self.source_name}] Starting scrape...")

        jobs: List[RawJob] = []
        page = 1
        max_pages = 3  # dev.to paginates at 30/page

        while page <= max_pages:
            try:
                resp = requests.get(
                    "https://dev.to/api/listings",
                    params={"category": "cfp", "page": page},  # cfp = call for proposals / jobs
                    headers=HEADERS,
                    timeout=15,
                )
                if resp.status_code == 404 or resp.status_code == 422:
                    break
                resp.raise_for_status()
                listings = resp.json()
            except Exception as e:
                logger.warning(f"[{self.source_name}] API page {page} failed: {e}")
                break

            if not listings:
                break

            for entry in listings:
                try:
                    category = entry.get("category", "")
                    # dev.to listings can be "cfp", "education", "jobs", etc.
                    # We look at the title/body for job indicators
                    title = entry.get("title", "").strip()
                    if not title:
                        continue

                    body = entry.get("body_markdown", "") or ""
                    desc = body[:3000]
                    desc_lower = desc.lower()
                    title_lower = title.lower()

                    # Filter: must look like a job listing
                    job_indicators = ["hiring", "developer", "engineer", "looking for",
                                      "remote", "full-time", "intern", "position", "role",
                                      "join us", "apply", "we're hiring"]
                    if not any(ind in title_lower or ind in desc_lower for ind in job_indicators):
                        continue

                    # Extract org/user as company
                    user = entry.get("user", {})
                    company = user.get("name", "Unknown") if user else "Unknown"
                    org = entry.get("organization", {})
                    if org and org.get("name"):
                        company = org["name"]

                    # Stack detection
                    tag_list = entry.get("tag_list", [])
                    if isinstance(tag_list, str):
                        tag_list = [t.strip() for t in tag_list.split(",")]
                    tags_lower = [t.lower() for t in tag_list]

                    stack = list(set(
                        [kw for kw in TECH_KEYWORDS if kw in desc_lower] +
                        [t for t in tags_lower if t in TECH_KEYWORDS]
                    ))

                    # Parse date
                    posted_at = None
                    pub_date = entry.get("published_at") or entry.get("created_at", "")
                    if pub_date:
                        try:
                            posted_at = datetime.fromisoformat(
                                pub_date.replace("Z", "+00:00")
                            ).replace(tzinfo=None)
                        except Exception:
                            pass

                    listing_url = entry.get("url", "")
                    if not listing_url:
                        slug = entry.get("slug", "")
                        listing_url = f"https://dev.to/listings/{slug}" if slug else ""
                    if not listing_url:
                        continue

                    job_type = "full-time"
                    if "intern" in title_lower or "intern" in desc_lower:
                        job_type = "internship"

                    location = "Remote"
                    if any(loc in desc_lower for loc in ["india", "mumbai", "bangalore", "bengaluru"]):
                        location = "India"

                    jobs.append(RawJob(
                        title=title[:200],
                        company=company[:100],
                        apply_url=listing_url,
                        source=self.source_name,
                        description=desc,
                        location=location,
                        job_type=job_type,
                        posted_at=posted_at,
                        stack_mentioned=stack,
                    ))

                except Exception as e:
                    logger.debug(f"[{self.source_name}] Error parsing listing: {e}")
                    continue

            page += 1
            time.sleep(0.5)  # Be polite to dev.to

        duration = time.time() - start
        logger.info(f"[{self.source_name}] Done — {len(jobs)} jobs in {duration:.1f}s")
        return jobs
