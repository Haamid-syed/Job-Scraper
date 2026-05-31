from dataclasses import dataclass, field
from typing import List, Optional
import yaml
import os
from loguru import logger


@dataclass
class SkillsConfig:
    primary: List[str]
    secondary: List[str]
    niche: List[str]


@dataclass
class ProfileConfig:
    name: str
    experience_years: int
    education: str
    skills: SkillsConfig


@dataclass
class FiltersConfig:
    role_types: List[str]
    job_types: List[str]
    locations: List[str]
    max_age_days: int
    min_score_display: int
    exclude_keywords: List[str]
    exclude_company_keywords: List[str]
    max_company_size: int


@dataclass
class LinkedInSourceConfig:
    enabled: bool
    max_results: int
    search_terms: List[str]


@dataclass
class WellfoundSourceConfig:
    enabled: bool
    max_results: int


@dataclass
class GoogleSearchSourceConfig:
    enabled: bool
    max_queries_per_run: int
    delay_between_queries_seconds: int
    ats_sites: List[str]
    search_templates: List[str]


@dataclass
class SimpleSourceConfig:
    enabled: bool


@dataclass
class MaxResultsSourceConfig:
    enabled: bool
    max_results: int = 30
    search_terms: List[str] = field(default_factory=list)


@dataclass
class ATSBoardsSourceConfig:
    enabled: bool
    companies: List[dict] = field(default_factory=list)


@dataclass
class LocalFallbackConfig:
    enabled: bool = False
    models: List[str] = field(default_factory=list)


@dataclass
class SourcesConfig:
    linkedin: LinkedInSourceConfig
    hn_hiring: SimpleSourceConfig
    yc_jobs: SimpleSourceConfig
    wellfound: WellfoundSourceConfig
    remotive: SimpleSourceConfig
    google_search: GoogleSearchSourceConfig
    # New V2 sources
    ats_boards: ATSBoardsSourceConfig = field(default_factory=lambda: ATSBoardsSourceConfig(enabled=False))
    remoteok: MaxResultsSourceConfig = field(default_factory=lambda: MaxResultsSourceConfig(enabled=False))
    indeed: MaxResultsSourceConfig = field(default_factory=lambda: MaxResultsSourceConfig(enabled=False))
    devto: SimpleSourceConfig = field(default_factory=lambda: SimpleSourceConfig(enabled=False))
    glassdoor: MaxResultsSourceConfig = field(default_factory=lambda: MaxResultsSourceConfig(enabled=False))
    remotehunter: MaxResultsSourceConfig = field(default_factory=lambda: MaxResultsSourceConfig(enabled=False))
    sourcingxpress: MaxResultsSourceConfig = field(default_factory=lambda: MaxResultsSourceConfig(enabled=False))


@dataclass
class SchedulerConfig:
    refresh_every_hours: int
    retry_failed_sources_after_minutes: int


@dataclass
class LLMConfig:
    provider: str
    model: str
    api_key: str
    max_retries: int
    retry_delay_seconds: int
    fallback_to_heuristic: bool
    openrouter_api_key: str = ""
    local_fallback: LocalFallbackConfig = field(default_factory=lambda: LocalFallbackConfig())


@dataclass
class LoggingConfig:
    level: str
    file: str
    rotation: str
    retention: str


@dataclass
class AppConfig:
    profile: ProfileConfig
    filters: FiltersConfig
    sources: SourcesConfig
    scheduler: SchedulerConfig
    llm: LLMConfig
    logging: LoggingConfig


def _parse_max_results_source(raw: dict) -> MaxResultsSourceConfig:
    """Parse a source config with enabled + max_results + optional search_terms."""
    return MaxResultsSourceConfig(
        enabled=raw.get("enabled", False),
        max_results=raw.get("max_results", 30),
        search_terms=raw.get("search_terms", []),
    )


def _load_dotenv(config_dir: str):
    """Manually load a local .env file from the backend or parent directory if it exists."""
    for dotenv_path in [os.path.join(config_dir, ".env"), os.path.join(config_dir, "..", ".env"), ".env", "../.env"]:
        if os.path.exists(dotenv_path):
            try:
                with open(dotenv_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#") or "=" not in line:
                            continue
                        k, v = line.split("=", 1)
                        os.environ[k.strip()] = v.strip().strip("'\"")
                logger.info(f"Loaded environment variables from local env file: {dotenv_path}")
                break
            except Exception as e:
                logger.warning(f"Failed to read env file {dotenv_path}: {e}")


def load_config(config_path: str = "config.yaml") -> AppConfig:
    """Load and validate config.yaml (or config.local.yaml if present). Fails fast."""
    # Check for local configuration override
    config_dir = os.path.dirname(os.path.abspath(config_path))
    config_filename = os.path.basename(config_path)
    local_path = os.path.join(config_dir, "config.local.yaml")
    
    if config_filename == "config.yaml" and os.path.exists(local_path):
        config_path = local_path
        logger.info(f"Using local configuration override: {config_path}")
    elif not os.path.exists(config_path):
        raise FileNotFoundError(
            f"Config file not found at '{config_path}'. "
            "Please create it from the template in the project root."
        )

    # Automatically load environment variables from local .env files
    _load_dotenv(os.path.dirname(os.path.abspath(config_path)))

    with open(config_path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    # --- Validate required keys ---
    required_top_keys = ["profile", "filters", "sources", "scheduler", "llm", "logging"]
    for key in required_top_keys:
        if key not in raw:
            raise ValueError(f"config.yaml is missing required section: '{key}'")

    # Validate API key is not placeholder (check environment variables first)
    api_key = os.environ.get("GEMINI_API_KEY") or raw["llm"].get("api_key", "")
    if not api_key or api_key == "YOUR_GEMINI_API_KEY_HERE":
        raise ValueError(
            "llm.api_key in config.yaml is not set and GEMINI_API_KEY environment variable is missing. "
            "Get a free key at https://aistudio.google.com/apikey and update config.yaml or set GEMINI_API_KEY in a local .env."
        )

    # --- Build typed config ---
    p = raw["profile"]
    skills_raw = p.get("skills", {})
    skills = SkillsConfig(
        primary=skills_raw.get("primary", []),
        secondary=skills_raw.get("secondary", []),
        niche=skills_raw.get("niche", []),
    )
    profile = ProfileConfig(
        name=p["name"],
        experience_years=p["experience_years"],
        education=p["education"],
        skills=skills,
    )

    f = raw["filters"]
    filters = FiltersConfig(
        role_types=f.get("role_types", []),
        job_types=f.get("job_types", []),
        locations=f.get("locations", []),
        max_age_days=f.get("max_age_days", 14),
        min_score_display=f.get("min_score_display", 6),
        exclude_keywords=f.get("exclude_keywords", []),
        exclude_company_keywords=f.get("exclude_company_keywords", []),
        max_company_size=f.get("max_company_size", 500),
    )

    s = raw["sources"]
    li_raw = s.get("linkedin", {})
    wf_raw = s.get("wellfound", {})
    gs_raw = s.get("google_search", {})
    ats_raw = s.get("ats_boards", {})

    sources = SourcesConfig(
        linkedin=LinkedInSourceConfig(
            enabled=li_raw.get("enabled", False),
            max_results=li_raw.get("max_results", 50),
            search_terms=li_raw.get("search_terms", []),
        ),
        hn_hiring=SimpleSourceConfig(enabled=s.get("hn_hiring", {}).get("enabled", False)),
        yc_jobs=SimpleSourceConfig(enabled=s.get("yc_jobs", {}).get("enabled", False)),
        wellfound=WellfoundSourceConfig(
            enabled=wf_raw.get("enabled", False),
            max_results=wf_raw.get("max_results", 30),
        ),
        remotive=SimpleSourceConfig(enabled=s.get("remotive", {}).get("enabled", False)),
        google_search=GoogleSearchSourceConfig(
            enabled=gs_raw.get("enabled", False),
            max_queries_per_run=gs_raw.get("max_queries_per_run", 25),
            delay_between_queries_seconds=gs_raw.get("delay_between_queries_seconds", 6),
            ats_sites=gs_raw.get("ats_sites", []),
            search_templates=gs_raw.get("search_templates", []),
        ),
        # V2 sources
        ats_boards=ATSBoardsSourceConfig(
            enabled=ats_raw.get("enabled", False),
            companies=ats_raw.get("companies", []),
        ),
        remoteok=_parse_max_results_source(s.get("remoteok", {})),
        indeed=_parse_max_results_source(s.get("indeed", {})),
        devto=SimpleSourceConfig(enabled=s.get("devto", {}).get("enabled", False)),
        glassdoor=_parse_max_results_source(s.get("glassdoor", {})),
        remotehunter=_parse_max_results_source(s.get("remotehunter", {})),
        sourcingxpress=_parse_max_results_source(s.get("sourcingxpress", {})),
    )

    sc = raw["scheduler"]
    scheduler = SchedulerConfig(
        refresh_every_hours=sc.get("refresh_every_hours", 6),
        retry_failed_sources_after_minutes=sc.get("retry_failed_sources_after_minutes", 30),
    )

    ll = raw["llm"]
    local_fb_raw = ll.get("local_fallback", {})
    local_fallback = LocalFallbackConfig(
        enabled=local_fb_raw.get("enabled", False),
        models=local_fb_raw.get("models", []),
    )
    llm = LLMConfig(
        provider=ll.get("provider", "gemini"),
        model=ll.get("model", "gemini-3.1-flash-lite"),
        api_key=os.environ.get("GEMINI_API_KEY") or ll["api_key"],
        max_retries=ll.get("max_retries", 3),
        retry_delay_seconds=ll.get("retry_delay_seconds", 5),
        fallback_to_heuristic=ll.get("fallback_to_heuristic", True),
        openrouter_api_key=os.environ.get("OPENROUTER_API_KEY") or ll.get("openrouter_api_key", ""),
        local_fallback=local_fallback,
    )

    lg = raw["logging"]
    logging_cfg = LoggingConfig(
        level=lg.get("level", "INFO"),
        file=lg.get("file", "logs/jobradar.log"),
        rotation=lg.get("rotation", "10 MB"),
        retention=lg.get("retention", "7 days"),
    )

    config = AppConfig(
        profile=profile,
        filters=filters,
        sources=sources,
        scheduler=scheduler,
        llm=llm,
        logging=logging_cfg,
    )

    logger.debug("Config loaded and validated successfully.")
    return config
