"""
Claude API provider — primary LLM for structured parsing.

# CORE_CANDIDATE — reusable Claude wrapper with consistent error handling.

Uses claude-sonnet-4-20250514 for the best balance of Korean understanding,
structured output quality, and cost. Temperature 0.0 for deterministic parsing.

Includes retry logic with exponential backoff — prevents transient API errors
from failing the entire voice pipeline (which would frustrate the farmer).
"""

import asyncio
import logging

import anthropic

from app.config import settings
from app.core.ai.llm_provider import LLMProvider

logger = logging.getLogger(__name__)

# Retry config: 3 attempts with 1s, 2s, 4s backoff
MAX_RETRIES = 3
BASE_DELAY_SECONDS = 1.0
# Timeout per request — if Claude doesn't respond in 30s, something is wrong
REQUEST_TIMEOUT_SECONDS = 30.0


class ClaudeProvider(LLMProvider):
    """Claude API implementation of the LLM provider interface."""

    def __init__(self, model: str = "claude-sonnet-4-20250514"):
        self.client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        self.model = model

    async def complete(
        self,
        system_prompt: str,
        user_message: str,
        max_tokens: int = 2000,
        temperature: float = 0.0,
    ) -> str:
        """
        Send a message to Claude with retry logic.

        Retries on transient errors (rate limit, server error, timeout).
        Does NOT retry on client errors (bad request, auth failure).
        """
        last_error: Exception | None = None

        for attempt in range(MAX_RETRIES):
            try:
                response = await self.client.messages.create(
                    model=self.model,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_message}],
                )
                # Claude returns a list of content blocks — we want the text from the first one
                return response.content[0].text

            except anthropic.RateLimitError as e:
                # 429 — back off and retry
                last_error = e
                delay = BASE_DELAY_SECONDS * (2 ** attempt)
                logger.warning("Claude rate limited (attempt %d/%d), retrying in %.1fs", attempt + 1, MAX_RETRIES, delay)
                await asyncio.sleep(delay)

            except anthropic.InternalServerError as e:
                # 500 — transient server error, retry
                last_error = e
                delay = BASE_DELAY_SECONDS * (2 ** attempt)
                logger.warning("Claude server error (attempt %d/%d), retrying in %.1fs", attempt + 1, MAX_RETRIES, delay)
                await asyncio.sleep(delay)

            except (asyncio.TimeoutError, anthropic.APITimeoutError) as e:
                # Timeout — retry with backoff
                last_error = e
                delay = BASE_DELAY_SECONDS * (2 ** attempt)
                logger.warning("Claude timeout (attempt %d/%d), retrying in %.1fs", attempt + 1, MAX_RETRIES, delay)
                await asyncio.sleep(delay)

            except anthropic.APIError as e:
                # Other API errors (400, 401, 403) — don't retry, these won't fix themselves
                logger.error("Claude API error (not retryable): %s", e)
                raise

        # All retries exhausted
        logger.error("Claude failed after %d attempts", MAX_RETRIES)
        raise last_error or RuntimeError("Claude API failed after all retries")
