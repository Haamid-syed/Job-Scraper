"""
Shared Playwright stealth utilities for all browser-based scrapers.

Patches common detection vectors that anti-bot systems check:
- navigator.webdriver
- Chrome automation flags
- Plugin/language fingerprints
"""

STEALTH_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--disable-features=VizDisplayCompositor",
    "--no-first-run",
    "--no-default-browser-check",
]

STEALTH_SCRIPT = """
    // Remove webdriver flag
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    
    // Mock plugins (headless Chrome has none by default)
    Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
    });
    
    // Mock languages
    Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
    });
    
    // Patch chrome object
    window.chrome = { runtime: {} };
"""

USER_AGENTS = [
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
]


def create_stealth_context(playwright_instance, headless=True):
    """
    Create a stealth Playwright browser + context with anti-detection patches.
    
    Returns (browser, context) tuple.
    """
    import random
    
    browser = playwright_instance.chromium.launch(
        headless=headless,
        args=STEALTH_ARGS,
    )
    
    context = browser.new_context(
        viewport={"width": 1280, "height": 720},
        user_agent=random.choice(USER_AGENTS),
        locale="en-US",
        timezone_id="America/New_York",
    )
    
    # Inject stealth patches before any page loads
    context.add_init_script(STEALTH_SCRIPT)
    
    return browser, context
