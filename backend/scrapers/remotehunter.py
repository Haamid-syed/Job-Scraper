"""RemoteHunter scraper — Playwright-based scraper for remotehunter.com."""

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


class RemoteHunterScraper(BaseScraper):
    """Scrapes remote jobs from remotehunter.com via Playwright."""

    source_name = "remotehunter"
    timeout_seconds = 30

    def __init__(self, config):
        self.config = config
        rh_cfg = getattr(config.sources, "remotehunter", None)
        self.max_results = getattr(rh_cfg, "max_results", 30) if rh_cfg else 30

    def scrape(self) -> List[RawJob]:
        try:
            from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
        except ImportError:
            logger.error("[remotehunter] playwright not installed")
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
                    page.goto(
                        "https://www.remotehunter.com/jobs?category=engineering",
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

                # Try to find job cards — look for common patterns
                selectors = [
                    "article", "[class*='job']", "[class*='listing']",
                    "[class*='card']", "[data-testid*='job']",
                    "div[class*='JobCard']", "a[href*='/jobs/']",
                ]
                
                cards = []
                for sel in selectors:
                    found = page.query_selector_all(sel)
                    if len(found) > 3:  # Must find a reasonable number
                        cards = found
                        logger.debug(f"[{self.source_name}] Found {len(found)} cards with selector '{sel}'")
                        break

                if not cards:
                    # Fallback: try to extract from page content
                    logger.info(f"[{self.source_name}] No structured cards found, trying link extraction")
                    links = page.query_selector_all("a[href*='job'], a[href*='position'], a[href*='career']")
                    cards = links

                for card in cards[:self.max_results]:
                    try:
                        text = card.inner_text()
                        link_el = card if card.get_attribute("href") else card.query_selector("a[href]")
                        href = link_el.get_attribute("href") if link_el else ""

                        if href and href.startswith("/"):
                            job_url = f"https://www.remotehunter.com{href}"
                        elif href and href.startswith("http"):
                            job_url = href
                        else:
                            continue

                        lines = [l.strip() for l in text.split("\n") if l.strip()]
                        if not lines:
                            continue

                        title = lines[0] if lines else "Software Engineer"
                        company = lines[1] if len(lines) > 1 else "Unknown"

                        desc_lower = text.lower()
                        stack = [kw for kw in TECH_KEYWORDS if kw in desc_lower]
                        job_type = "internship" if "intern" in desc_lower else "full-time"

                        jobs.append(RawJob(
                            title=title[:200],
                            company=company[:100],
                            apply_url=job_url,
                            source=self.source_name,
                            description=text[:3000],
                            location="Remote",
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
