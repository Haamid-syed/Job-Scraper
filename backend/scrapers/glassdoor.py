"""Glassdoor scraper — Playwright with internal API/JSON-LD extraction."""

import time
import json
import random
import re
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


class GlassdoorScraper(BaseScraper):
    """Scrapes Glassdoor jobs via Playwright with JSON-LD extraction."""

    source_name = "glassdoor"
    timeout_seconds = 45

    def __init__(self, config):
        self.config = config
        gd_cfg = getattr(config.sources, "glassdoor", None)
        self.max_results = getattr(gd_cfg, "max_results", 30) if gd_cfg else 30
        self.search_terms = (
            getattr(gd_cfg, "search_terms", None)
            if gd_cfg
            else ["software engineer", "web developer remote"]
        )

    def _extract_json_ld(self, page) -> List[dict]:
        """Extract structured job data from JSON-LD scripts in the page."""
        try:
            scripts = page.query_selector_all('script[type="application/ld+json"]')
            results = []
            for script in scripts:
                try:
                    raw = script.inner_text()
                    data = json.loads(raw)
                    # JSON-LD can be a single object or array
                    if isinstance(data, list):
                        results.extend(data)
                    elif isinstance(data, dict):
                        # Check if it's a JobPosting schema
                        if data.get("@type") == "JobPosting":
                            results.append(data)
                        # Or an ItemList containing JobPostings
                        elif "itemListElement" in data:
                            for item in data["itemListElement"]:
                                inner = item.get("item", item)
                                if inner.get("@type") == "JobPosting":
                                    results.append(inner)
                except Exception:
                    continue
            return results
        except Exception:
            return []

    def _intercept_api_responses(self, page) -> List[dict]:
        """Intercept XHR/fetch responses that contain job data."""
        captured = []

        def on_response(response):
            try:
                url = response.url
                if any(kw in url for kw in ["graphql", "/api/", "job-listing", "jobs-listing"]):
                    if response.status == 200:
                        try:
                            body = response.json()
                            captured.append(body)
                        except Exception:
                            pass
            except Exception:
                pass

        page.on("response", on_response)
        return captured

    def scrape(self) -> List[RawJob]:
        try:
            from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
        except ImportError:
            logger.error("[glassdoor] playwright not installed")
            return []

        start = time.time()
        logger.info(f"[{self.source_name}] Starting scrape via Playwright...")

        jobs: List[RawJob] = []

        try:
            with sync_playwright() as p:
                from scrapers.stealth import create_stealth_context
                browser, context = create_stealth_context(p)

                for term in self.search_terms[:3]:
                    page = context.new_page()
                    captured = self._intercept_api_responses(page)

                    try:
                        search_url = (
                            f"https://www.glassdoor.com/Job/{term.replace(' ', '-')}-jobs-SRCH_KO0,{len(term)}.htm"
                        )
                        page.goto(search_url, timeout=self.timeout_seconds * 1000, wait_until="domcontentloaded")
                        time.sleep(random.uniform(2, 4))

                        # Try JSON-LD extraction first (most reliable)
                        json_ld_jobs = self._extract_json_ld(page)
                        for jd in json_ld_jobs[:self.max_results]:
                            try:
                                title = jd.get("title", "").strip()
                                org = jd.get("hiringOrganization", {})
                                company = org.get("name", "Unknown") if isinstance(org, dict) else "Unknown"

                                if not title or not company:
                                    continue

                                desc = jd.get("description", "")
                                desc = re.sub(r"<[^>]+>", " ", desc)
                                desc = re.sub(r"\s+", " ", desc).strip()
                                desc_lower = desc.lower()

                                location_data = jd.get("jobLocation", {})
                                if isinstance(location_data, dict):
                                    addr = location_data.get("address", {})
                                    location = addr.get("addressLocality", "Remote") if isinstance(addr, dict) else "Remote"
                                elif isinstance(location_data, list) and location_data:
                                    addr = location_data[0].get("address", {})
                                    location = addr.get("addressLocality", "Remote") if isinstance(addr, dict) else "Remote"
                                else:
                                    location = "Remote"

                                stack = [kw for kw in TECH_KEYWORDS if kw in desc_lower]

                                posted_at = None
                                date_posted = jd.get("datePosted", "")
                                if date_posted:
                                    try:
                                        posted_at = datetime.fromisoformat(date_posted.replace("Z", "+00:00")).replace(tzinfo=None)
                                    except Exception:
                                        pass

                                apply_url = jd.get("url", "") or search_url
                                job_type = jd.get("employmentType", "FULL_TIME")
                                if isinstance(job_type, list):
                                    job_type = job_type[0] if job_type else "full-time"
                                job_type = "internship" if "intern" in str(job_type).lower() else "full-time"

                                jobs.append(RawJob(
                                    title=title[:200],
                                    company=company[:100],
                                    apply_url=apply_url,
                                    source=self.source_name,
                                    description=desc[:3000],
                                    location=location,
                                    job_type=job_type,
                                    posted_at=posted_at,
                                    stack_mentioned=stack,
                                ))
                            except Exception as e:
                                logger.debug(f"[{self.source_name}] Error parsing JSON-LD entry: {e}")
                                continue

                    except PlaywrightTimeout:
                        logger.warning(f"[{self.source_name}] Timeout for term '{term}'")
                    except Exception as e:
                        logger.warning(f"[{self.source_name}] Error for term '{term}': {e}")
                    finally:
                        page.close()
                    
                    time.sleep(random.uniform(3, 6))

                browser.close()

        except Exception as e:
            logger.error(f"[{self.source_name}] Playwright error: {e}")
            return []

        duration = time.time() - start
        logger.info(f"[{self.source_name}] Done — {len(jobs)} jobs in {duration:.1f}s")
        return jobs
