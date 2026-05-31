"""SourcingXpress scraper — Playwright-based scraper for sourcingxpress.com job listings."""

import time
import random
from datetime import datetime
from typing import List

from loguru import logger

from .base import BaseScraper, RawJob

TECH_KEYWORDS = [
    "react", "node.js", "typescript", "python", "fastapi", "postgresql",
    "docker", "aws", "kubernetes", "redis", "graphql", "rust", "go",
    "webrtc", "websocket", "socket.io", "livekit", "next.js", "vue",
    "angular", "java", "express", "django",
]


class SourcingXpressScraper(BaseScraper):
    """Scrapes developer jobs from SourcingXpress via Playwright."""

    source_name = "sourcingxpress"
    timeout_seconds = 30

    def __init__(self, config):
        self.config = config
        sx_cfg = getattr(config.sources, "sourcingxpress", None)
        self.max_results = getattr(sx_cfg, "max_results", 30) if sx_cfg else 30

    def scrape(self) -> List[RawJob]:
        try:
            from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
        except ImportError:
            logger.error("[sourcingxpress] playwright not installed")
            return []

        start = time.time()
        logger.info(f"[{self.source_name}] Starting scrape via Playwright...")

        jobs: List[RawJob] = []

        try:
            with sync_playwright() as p:
                from scrapers.stealth import create_stealth_context
                browser, context = create_stealth_context(p)
                page = context.new_page()

                try:
                    # SourcingXpress job listings page
                    page.goto(
                        "https://www.sourcingxpress.com/jobs",
                        timeout=self.timeout_seconds * 1000,
                        wait_until="domcontentloaded",
                    )
                except PlaywrightTimeout:
                    logger.warning(f"[{self.source_name}] Page load timed out")
                    try:
                        browser.close()
                    except Exception:
                        pass
                    return []

                time.sleep(random.uniform(2, 4))

                # Try multiple selector strategies
                selectors = [
                    "[class*='job-card']", "[class*='JobCard']",
                    "[class*='listing']", "[class*='Listing']",
                    "div[class*='card']", "article",
                    "a[href*='/job/']", "a[href*='/jobs/']",
                    "[data-job]", "[data-testid*='job']",
                ]

                cards = []
                for sel in selectors:
                    found = page.query_selector_all(sel)
                    if len(found) >= 2:
                        cards = found
                        logger.debug(f"[{self.source_name}] Found {len(found)} items with selector '{sel}'")
                        break

                if not cards:
                    logger.info(f"[{self.source_name}] No structured cards found, trying generic approach")
                    # Try to find any links that look like job listings
                    all_links = page.query_selector_all("a[href]")
                    for link in all_links:
                        href = link.get_attribute("href") or ""
                        text = link.inner_text().strip()
                        if len(text) > 10 and any(kw in href.lower() for kw in ["job", "position", "career", "opening"]):
                            cards.append(link)

                for card in cards[:self.max_results]:
                    try:
                        text = card.inner_text()
                        link_el = card if card.get_attribute("href") else card.query_selector("a[href]")
                        href = link_el.get_attribute("href") if link_el else ""

                        if href and href.startswith("/"):
                            job_url = f"https://www.sourcingxpress.com{href}"
                        elif href and href.startswith("http"):
                            job_url = href
                        else:
                            continue

                        lines = [l.strip() for l in text.split("\n") if l.strip()]
                        if not lines:
                            continue

                        title = lines[0][:200]
                        company = lines[1][:100] if len(lines) > 1 else "Unknown"

                        # Location detection
                        text_lower = text.lower()
                        location = "Remote"
                        if "india" in text_lower or "mumbai" in text_lower or "bangalore" in text_lower:
                            location = "India"

                        stack = [kw for kw in TECH_KEYWORDS if kw in text_lower]
                        job_type = "internship" if "intern" in text_lower else "full-time"

                        jobs.append(RawJob(
                            title=title,
                            company=company,
                            apply_url=job_url,
                            source=self.source_name,
                            description=text[:3000],
                            location=location,
                            job_type=job_type,
                            posted_at=None,
                            stack_mentioned=stack,
                        ))
                    except Exception as e:
                        logger.debug(f"[{self.source_name}] Error parsing card: {e}")
                        continue

                browser.close()

        except Exception as e:
            logger.error(f"[{self.source_name}] Playwright error: {e}")
            return []

        duration = time.time() - start
        logger.info(f"[{self.source_name}] Done — {len(jobs)} jobs in {duration:.1f}s")
        return jobs
