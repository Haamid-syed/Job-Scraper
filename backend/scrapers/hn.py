import time
import re
from datetime import datetime
from typing import List, Optional

import requests
from tenacity import retry, stop_after_attempt, wait_exponential
from loguru import logger

from .base import BaseScraper, RawJob


class HNHiringScraper(BaseScraper):
    """Scrapes the monthly 'Ask HN: Who is hiring?' thread via Algolia API."""

    source_name = "hn"
    timeout_seconds = 30

    SEARCH_URL = "https://hn.algolia.com/api/v1/search"
    JOB_KEYWORDS = [
        "hiring", "looking for", "remote", "salary", "equity", "engineer",
        "developer", "full-time", "intern", "part-time", "contract",
    ]

    def __init__(self, config):
        self.config = config

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
    def _fetch_json(self, url: str, params: dict) -> dict:
        resp = requests.get(url, params=params, timeout=self.timeout_seconds)
        resp.raise_for_status()
        return resp.json()

    def _get_current_hiring_thread(self) -> Optional[dict]:
        """Find the most recent 'Ask HN: Who is hiring?' thread for the current or previous month."""
        data = self._fetch_json(
            self.SEARCH_URL,
            {"query": "Ask HN: Who is hiring?", "tags": "story", "hitsPerPage": 5},
        )
        hits = data.get("hits", [])
        now = datetime.now()
        months = [now.strftime("%B %Y")]
        # Also try previous month as fallback
        if now.month == 1:
            prev = datetime(now.year - 1, 12, 1)
        else:
            prev = datetime(now.year, now.month - 1, 1)
        months.append(prev.strftime("%B %Y"))

        for hit in hits:
            title = hit.get("title", "")
            for m in months:
                if m in title:
                    return hit
        # Fallback to first result
        return hits[0] if hits else None

    def _fetch_comments(self, story_id: str) -> List[dict]:
        data = self._fetch_json(
            self.SEARCH_URL,
            {"tags": f"comment,story_{story_id}", "hitsPerPage": 1000},
        )
        return data.get("hits", [])

    def _is_job_comment(self, text: str) -> bool:
        text_lower = text.lower()
        keyword_count = sum(1 for kw in self.JOB_KEYWORDS if kw in text_lower)
        return keyword_count >= 2

    def _extract_email(self, text: str) -> Optional[str]:
        match = re.search(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text)
        return match.group(0) if match else None

    def _parse_comment_to_job(self, comment: dict) -> Optional[RawJob]:
        text = comment.get("comment_text") or comment.get("story_text") or ""
        # Strip HTML tags
        clean_text = re.sub(r"<[^>]+>", " ", text).strip()

        if not self._is_job_comment(clean_text):
            return None

        lines = [l.strip() for l in clean_text.split("\n") if l.strip()]
        if not lines:
            return None

        # First line usually contains company name and role
        first_line = lines[0]

        # Try to extract company name — often before | or : or ( 
        company = "Unknown"
        title = "Software Engineer"

        separators = ["|", "–", "-", ":", "("]
        for sep in separators:
            if sep in first_line:
                parts = first_line.split(sep, 1)
                company = parts[0].strip()
                title = parts[1].strip() if len(parts) > 1 else title
                break
        else:
            company = first_line[:50].strip()

        # Clean up
        company = re.sub(r"\s+", " ", company)[:100]
        title = re.sub(r"\s+", " ", title)[:200]

        if not company or company.lower() in ("hiring", "remote", "looking for"):
            return None

        # Detect location
        location = "Remote"
        lower = clean_text.lower()
        if "onsite" in lower or "in-person" in lower:
            location = "Onsite"
        elif "hybrid" in lower:
            location = "Hybrid"
        elif "remote" in lower:
            location = "Remote"
        for loc in ["india", "mumbai", "bangalore", "bengaluru"]:
            if loc in lower:
                location = loc.title()
                break

        # Detect job type
        job_type = "full-time"
        if "intern" in lower:
            job_type = "internship"
        elif "contract" in lower:
            job_type = "contract"

        # Detect stack
        tech_keywords = [
            "react", "node.js", "typescript", "python", "fastapi", "postgres",
            "docker", "aws", "kubernetes", "redis", "graphql", "rust", "go",
            "webrtc", "websocket", "socket.io", "livekit", "next.js", "vue",
            "angular", "java", "spring", "rails", "ruby", "php", "elixir",
        ]
        stack = [kw for kw in tech_keywords if kw in lower]

        # Posted at — use comment created_at
        posted_at = None
        if comment.get("created_at"):
            try:
                posted_at = datetime.fromisoformat(
                    comment["created_at"].replace("Z", "+00:00")
                ).replace(tzinfo=None)
            except Exception:
                posted_at = None

        # Always link to the HN comment. The email (if present) lives in the
        # description text and is detected by the boost-signal computation.
        hn_url = f"https://news.ycombinator.com/item?id={comment.get('objectID', '')}"

        return RawJob(
            title=title,
            company=company,
            apply_url=hn_url,
            source=self.source_name,
            description=clean_text[:3000],
            location=location,
            job_type=job_type,
            posted_at=posted_at,
            stack_mentioned=stack,
        )

    def scrape(self) -> List[RawJob]:
        start = time.time()
        logger.info(f"[{self.source_name}] Starting scrape...")

        thread = self._get_current_hiring_thread()
        if not thread:
            logger.warning(f"[{self.source_name}] Could not find current hiring thread")
            return []

        story_id = thread.get("objectID")
        thread_title = thread.get("title", "")
        logger.info(f"[{self.source_name}] Found thread: {thread_title} (id={story_id})")

        comments = self._fetch_comments(story_id)
        logger.info(f"[{self.source_name}] Fetched {len(comments)} comments")

        jobs = []
        for comment in comments:
            job = self._parse_comment_to_job(comment)
            if job:
                jobs.append(job)

        duration = time.time() - start
        logger.info(
            f"[{self.source_name}] Done — {len(jobs)} jobs parsed in {duration:.1f}s"
        )
        return jobs
