import time
import random
import re
from datetime import datetime
from typing import List

from loguru import logger

from .base import BaseScraper, RawJob

TECH_KEYWORDS = [
    "react", "node.js", "typescript", "python", "fastapi", "postgresql", "postgres",
    "docker", "aws", "kubernetes", "redis", "graphql", "rust", "go",
    "webrtc", "websocket", "socket.io", "livekit", "next.js", "vue",
    "angular", "java", "express", "django", "flutter", "swift", "kotlin",
]


class WellfoundScraper(BaseScraper):
    """Scrapes Wellfound (AngelList) jobs via Playwright."""

    source_name = "wellfound"
    timeout_seconds = 60

    def __init__(self, config):
        self.config = config
        self.max_results = config.sources.wellfound.max_results

    def scrape(self) -> List[RawJob]:
        try:
            from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
        except ImportError:
            logger.error("[wellfound] playwright not installed. Run: pip install playwright && playwright install chromium")
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
                        "https://wellfound.com/jobs?role=engineer&remote=true",
                        timeout=self.timeout_seconds * 1000,
                        wait_until="networkidle",
                    )
                except PlaywrightTimeout:
                    logger.warning(f"[{self.source_name}] Page load timed out, trying with domcontentloaded")
                    page.goto(
                        "https://wellfound.com/jobs?role=engineer&remote=true",
                        wait_until="domcontentloaded",
                    )

                # Stealth delay
                time.sleep(random.uniform(2, 3))

                # Extract job cards
                job_cards = page.query_selector_all(
                    "[data-test='StartupResult'], "
                    "[class*='JobListing'], "
                    "[class*='job-listing'], "
                    "div[class*='styles_component']"
                )

                logger.info(f"[{self.source_name}] Found {len(job_cards)} cards")

                for card in job_cards[:self.max_results]:
                    try:
                        text = card.inner_text()
                        link_el = card.query_selector("a[href]")
                        href = link_el.get_attribute("href") if link_el else ""

                        if href and href.startswith("/"):
                            job_url = f"https://wellfound.com{href}"
                        elif href and href.startswith("http"):
                            job_url = href
                        else:
                            job_url = "https://wellfound.com/jobs"

                        lines = [l.strip() for l in text.split("\n") if l.strip()]

                        company = lines[0] if lines else "Unknown"
                        title = lines[1] if len(lines) > 1 else "Software Engineer"

                        location = "Remote"
                        salary_range = ""
                        company_size = ""

                        for line in lines:
                            ll = line.lower()
                            if "remote" in ll or "anywhere" in ll:
                                location = line
                            elif re.search(r"\$[\d,]+", line):
                                salary_range = line
                            elif re.search(r"\d+[-–]\d+\s*(employees|people|person)", ll):
                                company_size = line

                        desc_lower = text.lower()
                        stack = [kw for kw in TECH_KEYWORDS if kw in desc_lower]
                        job_type = "internship" if "intern" in desc_lower else "full-time"

                        jobs.append(
                            RawJob(
                                title=title[:200],
                                company=company[:100],
                                apply_url=job_url,
                                source=self.source_name,
                                description=text[:3000],
                                location=location,
                                job_type=job_type,
                                posted_at=None,  # Wellfound doesn't always show dates
                                salary_range=salary_range,
                                company_size=company_size,
                                stack_mentioned=stack,
                            )
                        )
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
