"""
Description enricher — fetches full job descriptions for sparse listings.

Some scrapers only get a short summary (e.g., 100-200 chars from a listing card).
This module fetches the full job page and extracts the description, giving the
LLM scorer much better data to work with.

Runs between the filter phase and the score phase.
"""

import re
import time
from typing import List

import requests
from loguru import logger

from scrapers.base import RawJob

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
}

# Minimum description length to consider "rich enough"
MIN_DESCRIPTION_LENGTH = 200

# Max descriptions to enrich per run (avoid blocking the pipeline too long)
MAX_ENRICH_PER_RUN = 15


def _extract_text_from_html(html: str) -> str:
    """Strip HTML tags and extract visible text content."""
    # Remove script and style blocks entirely
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
    # Convert block tags to newlines
    html = re.sub(r'<(?:p|div|br|h[1-6]|li|tr)[^>]*>', '\n', html, flags=re.IGNORECASE)
    # Remove all remaining tags
    text = re.sub(r'<[^>]+>', ' ', html)
    # Clean up whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {2,}', ' ', text)
    return text.strip()


def _fetch_job_description(url: str, timeout: int = 10) -> str:
    """Fetch a job page and extract description text."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
        if resp.status_code != 200:
            return ""

        html = resp.text
        text = _extract_text_from_html(html)

        # Try to find the most relevant section
        # Look for common job description markers
        markers = [
            "job description", "about the role", "what you'll do",
            "responsibilities", "requirements", "qualifications",
            "about this role", "the role", "what we're looking for",
        ]

        text_lower = text.lower()
        best_start = -1
        for marker in markers:
            idx = text_lower.find(marker)
            if idx >= 0 and (best_start < 0 or idx < best_start):
                best_start = idx

        if best_start >= 0:
            # Return from the marker onward (up to 3000 chars)
            return text[best_start:best_start + 3000].strip()
        else:
            # No marker found — return a chunk from the middle of the page
            # (skip nav/header, take the meat)
            mid = len(text) // 4
            return text[mid:mid + 3000].strip()

    except Exception as e:
        logger.debug(f"[enricher] Failed to fetch {url}: {e}")
        return ""


def enrich_descriptions(jobs: List[RawJob]) -> int:
    """
    Enrich sparse job descriptions by fetching full job pages.
    Modifies jobs in-place. Returns count of enriched jobs.
    Uses parallel fetching to avoid blocking the pipeline.
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    sparse_jobs = [
        j for j in jobs
        if len(j.description) < MIN_DESCRIPTION_LENGTH and j.apply_url
    ]

    if not sparse_jobs:
        return 0

    to_enrich = sparse_jobs[:MAX_ENRICH_PER_RUN]
    logger.info(f"[enricher] Enriching {len(to_enrich)} sparse descriptions in parallel...")

    enriched = 0

    def _enrich_one(job: RawJob) -> bool:
        full_desc = _fetch_job_description(job.apply_url)
        if full_desc and len(full_desc) > len(job.description):
            old_len = len(job.description)
            job.description = full_desc[:3000]
            logger.debug(
                f"[enricher] Enriched '{job.title}' @ '{job.company}': "
                f"{old_len} → {len(job.description)} chars"
            )
            return True
        return False

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(_enrich_one, job): job for job in to_enrich}
        for future in as_completed(futures):
            try:
                if future.result():
                    enriched += 1
            except Exception as e:
                logger.debug(f"[enricher] Enrichment failed: {e}")

    logger.info(f"[enricher] Enriched {enriched} / {len(sparse_jobs)} sparse descriptions")
    return enriched

