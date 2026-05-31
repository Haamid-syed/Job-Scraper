"""
Centralized adaptive rate limiter for LLM API calls.

Uses a token-bucket algorithm with adaptive backoff:
- On 429/quota errors: doubles the backoff factor (up to 16x)
- On success: gradually decreases backoff (0.9x per success, min 1.0)
- Thread-safe for concurrent access from scorer + email drafter
"""

import threading
import time
from loguru import logger


class AdaptiveRateLimiter:
    """Token-bucket rate limiter with per-provider tracking."""

    def __init__(self, calls_per_minute: int = 10, burst_size: int = 3, name: str = "default"):
        self.name = name
        self.rate = calls_per_minute
        self.max_tokens = burst_size
        self.tokens = float(burst_size)
        self.last_refill = time.monotonic()
        self.backoff_factor = 1.0
        self._lock = threading.Lock()

    def _refill(self):
        """Refill tokens based on elapsed time."""
        now = time.monotonic()
        elapsed = now - self.last_refill
        # tokens_per_second = rate / 60
        new_tokens = elapsed * (self.rate / 60.0)
        self.tokens = min(self.max_tokens, self.tokens + new_tokens)
        self.last_refill = now

    def acquire(self, timeout: float = 120.0):
        """
        Block until a token is available.
        Uses Event-based waiting instead of busy polling.
        Raises TimeoutError if waiting exceeds timeout.
        """
        deadline = time.monotonic() + timeout
        while True:
            with self._lock:
                self._refill()
                if self.tokens >= 1.0:
                    self.tokens -= 1.0
                    return

                # Calculate exact wait time until next token is available
                tokens_needed = 1.0 - self.tokens
                wait_time = (tokens_needed / (self.rate / 60.0)) * self.backoff_factor

            # Clamp wait time
            wait_time = min(wait_time, 5.0)
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError(
                    f"[rate_limiter:{self.name}] Timed out waiting for rate limit token "
                    f"after {timeout}s (backoff_factor={self.backoff_factor:.1f})"
                )
            # Sleep precisely for the calculated duration (OS-level, zero CPU)
            time.sleep(min(wait_time, remaining))

    def report_429(self):
        """Called on rate limit / quota error — increases backoff."""
        with self._lock:
            old = self.backoff_factor
            self.backoff_factor = min(self.backoff_factor * 2.0, 16.0)
            logger.warning(
                f"[rate_limiter:{self.name}] 429 reported — backoff {old:.1f}x → {self.backoff_factor:.1f}x"
            )

    def report_success(self):
        """Called on success — gradually decreases backoff."""
        with self._lock:
            if self.backoff_factor > 1.0:
                self.backoff_factor = max(self.backoff_factor * 0.9, 1.0)


# ─── Global Singleton Instances ───────────────────────────────────────────────

_instances: dict = {}
_global_lock = threading.Lock()


def get_rate_limiter(provider: str = "gemini", calls_per_minute: int = 10) -> AdaptiveRateLimiter:
    """
    Get or create a rate limiter for a specific provider.
    Thread-safe singleton — same provider always returns same instance.
    """
    with _global_lock:
        if provider not in _instances:
            _instances[provider] = AdaptiveRateLimiter(
                calls_per_minute=calls_per_minute,
                burst_size=min(3, calls_per_minute),
                name=provider,
            )
            logger.info(
                f"[rate_limiter] Created limiter for '{provider}' "
                f"({calls_per_minute} RPM, burst={min(3, calls_per_minute)})"
            )
        return _instances[provider]
