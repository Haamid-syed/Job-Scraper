from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List
import hashlib
import json


@dataclass
class RawJob:
    title: str
    company: str
    apply_url: str
    source: str
    description: str = ""
    location: str = ""
    job_type: str = ""
    posted_at: Optional[datetime] = None
    salary_range: str = ""
    company_size: str = ""
    stack_mentioned: List[str] = field(default_factory=list)

    @property
    def id(self) -> str:
        raw = f"{self.company.lower().strip()}{self.title.lower().strip()}{self.source}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    @property
    def canonical_id(self) -> str:
        """Source-agnostic ID for cross-source dedup. Same job on LinkedIn and HN get same canonical_id."""
        import re
        norm_company = re.sub(r'[^a-z0-9]', '', self.company.lower().strip())
        norm_title = re.sub(r'[^a-z0-9]', '', self.title.lower().strip())
        raw = f"{norm_company}{norm_title}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "company": self.company,
            "apply_url": self.apply_url,
            "source": self.source,
            "description": self.description,
            "location": self.location,
            "job_type": self.job_type,
            "posted_at": self.posted_at.isoformat() if self.posted_at else None,
            "salary_range": self.salary_range,
            "company_size": self.company_size,
            "stack_mentioned": json.dumps(self.stack_mentioned),
        }


class BaseScraper:
    """All scrapers inherit this. Provides retry wrapper and circuit-breaker awareness."""
    source_name: str = "base"
    timeout_seconds: int = 30

    def scrape(self) -> List[RawJob]:
        raise NotImplementedError

    def safe_scrape(self) -> tuple:
        """Returns (jobs, error_message). Never raises."""
        try:
            jobs = self.scrape()
            return jobs, None
        except Exception as e:
            return [], str(e)
