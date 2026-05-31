"""YC Jobs scraper — Playwright-based for JS-rendered SPA content."""

import time
import random
from datetime import datetime
from typing import List

from loguru import logger

from .base import BaseScraper, RawJob

YC_JOBS_URL = "https://www.ycombinator.com/jobs"

TECH_KEYWORDS = [
    "react", "node.js", "typescript", "python", "fastapi", "postgres",
    "docker", "aws", "kubernetes", "redis", "graphql", "rust", "go",
    "webrtc", "websocket", "next.js", "vue", "angular",
]

# YC category/directory slugs to skip (not actual job listings)
CATEGORY_SLUGS = {
    "designer", "product-manager", "recruiting-hr", "sales-manager",
    "science", "software-engineer", "marketing", "operations",
    "finance", "legal", "other", "jobs", "role", "companies",
    "location", "industry", "salary", "equity",
}


class YCJobsScraper(BaseScraper):
    """Scrapes YC jobs page using Playwright to handle React SPA rendering."""

    source_name = "yc"
    timeout_seconds = 45

    def __init__(self, config):
        self.config = config

    def scrape(self) -> List[RawJob]:
        try:
            from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
        except ImportError:
            logger.error("[yc] playwright not installed")
            return []

        start = time.time()
        logger.info(f"[{self.source_name}] Starting scrape via Playwright (SPA)...")

        jobs: List[RawJob] = []
        today = datetime.now()

        try:
            with sync_playwright() as p:
                from scrapers.stealth import create_stealth_context
                browser, context = create_stealth_context(p)
                page = context.new_page()

                try:
                    page.goto(YC_JOBS_URL, timeout=self.timeout_seconds * 1000, wait_until="networkidle")
                except PlaywrightTimeout:
                    logger.warning(f"[{self.source_name}] Page load timed out, trying domcontentloaded")
                    try:
                        page.goto(YC_JOBS_URL, timeout=self.timeout_seconds * 1000, wait_until="domcontentloaded")
                    except PlaywrightTimeout:
                        logger.error(f"[{self.source_name}] Page completely timed out")
                        browser.close()
                        return []

                # Wait for JS-rendered content
                time.sleep(3)

                # Scroll to trigger lazy-loading
                for _ in range(3):
                    page.evaluate("window.scrollBy(0, window.innerHeight)")
                    time.sleep(1)

                # Extract job links from the rendered page
                links = page.query_selector_all("a[href*='/companies/']")
                
                # Also try generic job card selectors
                if len(links) < 5:
                    links = page.query_selector_all("a[href*='/jobs/']")

                logger.info(f"[{self.source_name}] Found {len(links)} potential job links")

                seen_urls = set()
                for link in links[:50]:
                    try:
                        href = link.get_attribute("href") or ""
                        if not href:
                            continue

                        # Skip category pages
                        slug = href.rstrip("/").split("/")[-1].lower()
                        if slug in CATEGORY_SLUGS:
                            continue

                        # Make URL absolute
                        if href.startswith("/"):
                            job_url = f"https://www.ycombinator.com{href}"
                        elif href.startswith("http"):
                            job_url = href
                        else:
                            continue

                        if job_url in seen_urls:
                            continue
                        seen_urls.add(job_url)

                        # Extract card text
                        text = link.inner_text().strip()
                        if not text or len(text) < 5:
                            continue

                        lines = [l.strip() for l in text.split("\n") if l.strip()]
                        if not lines:
                            continue

                        company = lines[0] if lines else "Unknown"
                        title = lines[1] if len(lines) > 1 else "Software Engineer"

                        # Detect location from card text
                        location = "Remote"
                        text_lower = text.lower()
                        for loc_str in ["remote", "san francisco", "new york", "india", "hybrid", "london"]:
                            if loc_str in text_lower:
                                for line in lines:
                                    if loc_str in line.lower():
                                        location = line
                                        break
                                break

                        # Get description from nearby element or parent
                        parent = link.evaluate_handle("el => el.closest('div') || el.parentElement")
                        desc_text = ""
                        if parent:
                            try:
                                desc_text = parent.inner_text()
                            except Exception:
                                desc_text = text

                        desc_lower = desc_text.lower()
                        stack = [kw for kw in TECH_KEYWORDS if kw in desc_lower]

                        job_type = "full-time"
                        if "intern" in desc_lower or "intern" in title.lower():
                            job_type = "internship"

                        jobs.append(
                            RawJob(
                                title=title[:200],
                                company=company[:100],
                                apply_url=job_url,
                                source=self.source_name,
                                description=desc_text[:3000],
                                location=location,
                                job_type=job_type,
                                posted_at=today,
                                stack_mentioned=stack,
                            )
                        )
                    except Exception as e:
                        logger.debug(f"[{self.source_name}] Error parsing link: {e}")
                        continue

                browser.close()

        except Exception as e:
            logger.error(f"[{self.source_name}] Playwright error: {e}")
            return []

        duration = time.time() - start
        logger.info(f"[{self.source_name}] Done — {len(jobs)} jobs in {duration:.1f}s")
        return jobs
