"""
Local MLX model scorer for Apple Silicon Macs.

Provides fully offline, zero-cost LLM scoring using quantized models
that run on the Mac's unified memory. Used as a last-resort fallback
before the heuristic scorer.

Supported models:
- Phi-4-mini-instruct-4bit (~2.5GB RAM, best for structured JSON)
- Qwen3.5-4B-MLX-4bit (~3GB RAM, strong general-purpose backup)

Usage:
  # Pre-download models (run once):
  python -m intelligence.local_scorer --setup
  
  # Use in code:
  scorer = LocalMLXScorer(["mlx-community/Phi-4-mini-instruct-4bit"])
  result = scorer.generate("Score this job...")
"""

import json
import sys
from typing import List, Optional

from loguru import logger

# Lazy-loaded to avoid importing mlx_lm when it's not needed
_loaded_model = None
_loaded_tokenizer = None
_loaded_model_name = None


def _lazy_load(model_name: str):
    """Lazy-load a model into memory. Only called when cloud models are exhausted."""
    global _loaded_model, _loaded_tokenizer, _loaded_model_name

    if _loaded_model_name == model_name:
        return _loaded_model, _loaded_tokenizer

    try:
        from mlx_lm import load
        logger.info(f"[local_scorer] Loading model '{model_name}' into memory...")
        _loaded_model, _loaded_tokenizer = load(model_name)
        _loaded_model_name = model_name
        logger.info(f"[local_scorer] Model '{model_name}' loaded successfully")
        return _loaded_model, _loaded_tokenizer
    except ImportError:
        logger.error(
            "[local_scorer] mlx-lm not installed. Run: pip install mlx-lm"
        )
        raise
    except Exception as e:
        logger.error(f"[local_scorer] Failed to load model '{model_name}': {e}")
        raise


class LocalMLXScorer:
    """Local MLX-based scorer with multi-model fallback."""

    def __init__(self, model_names: List[str]):
        self.model_names = model_names
        self.current_model_index = 0
        self._available = None  # Lazy check

    def is_available(self) -> bool:
        """Check if mlx-lm is installed (doesn't load models)."""
        if self._available is not None:
            return self._available
        try:
            import mlx_lm
            self._available = True
        except ImportError:
            self._available = False
            logger.info("[local_scorer] mlx-lm not installed — local fallback disabled")
        return self._available

    def generate(self, prompt: str, max_tokens: int = 500) -> Optional[str]:
        """
        Generate text using local MLX model.
        Returns raw text response, or None if all models fail.
        """
        if not self.is_available():
            return None

        while self.current_model_index < len(self.model_names):
            model_name = self.model_names[self.current_model_index]
            try:
                from mlx_lm import generate as mlx_generate

                model, tokenizer = _lazy_load(model_name)

                # Build chat-format prompt for instruct models
                messages = [{"role": "user", "content": prompt}]
                
                # Try to apply chat template
                try:
                    formatted = tokenizer.apply_chat_template(
                        messages, tokenize=False, add_generation_prompt=True
                    )
                except Exception:
                    formatted = f"<|user|>\n{prompt}\n<|assistant|>\n"

                response = mlx_generate(
                    model,
                    tokenizer,
                    prompt=formatted,
                    max_tokens=max_tokens,
                    temp=0.1,  # Low temperature for deterministic JSON output
                )

                if response and response.strip():
                    logger.debug(f"[local_scorer] Generated {len(response)} chars with {model_name}")
                    return response.strip()
                else:
                    raise Exception("Empty response from local model")

            except ImportError:
                logger.error("[local_scorer] mlx-lm not installed")
                self._available = False
                return None

            except Exception as e:
                logger.warning(
                    f"[local_scorer] Model '{model_name}' failed: {e}. "
                    f"Trying next local model..."
                )
                self.current_model_index += 1

        logger.warning("[local_scorer] All local models exhausted")
        return None

    def score_job(self, prompt: str) -> Optional[dict]:
        """
        Generate and parse a JSON scoring response from local model.
        Returns parsed dict or None on failure.
        """
        text = self.generate(prompt)
        if not text:
            return None

        try:
            # Strip markdown fences
            if "```" in text:
                parts = text.split("```")
                for part in parts:
                    cleaned = part.strip()
                    if cleaned.startswith("json"):
                        cleaned = cleaned[4:].strip()
                    if cleaned.startswith("{"):
                        text = cleaned
                        break

            # Find the JSON object in the text
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                text = text[start:end]

            data = json.loads(text)
            if isinstance(data, dict):
                return data
        except (json.JSONDecodeError, Exception) as e:
            logger.debug(f"[local_scorer] JSON parse failed: {e}")

        return None


def setup():
    """Pre-download models for offline use."""
    models = [
        "mlx-community/Phi-4-mini-instruct-4bit",
        "mlx-community/Qwen3.5-4B-MLX-4bit",
    ]

    print("=" * 60)
    print("JobRadar Local Model Setup")
    print("=" * 60)
    print(f"\nDownloading {len(models)} models for offline scoring fallback...")
    print("This is a one-time download (~5GB total).\n")

    try:
        from mlx_lm import load
    except ImportError:
        print("ERROR: mlx-lm not installed. Run:")
        print("  pip install mlx-lm")
        sys.exit(1)

    for model_name in models:
        print(f"\n→ Downloading '{model_name}'...")
        try:
            model, tokenizer = load(model_name)
            print(f"  ✅ '{model_name}' downloaded and verified")
            # Unload to free memory
            del model, tokenizer
        except Exception as e:
            print(f"  ❌ Failed to download '{model_name}': {e}")

    print("\n" + "=" * 60)
    print("Setup complete! Enable local fallback in config.yaml:")
    print("  llm:")
    print("    local_fallback:")
    print("      enabled: true")
    print("=" * 60)


if __name__ == "__main__":
    if "--setup" in sys.argv:
        setup()
    else:
        print("Usage: python -m intelligence.local_scorer --setup")
        print("  Downloads MLX models for offline scoring fallback.")
