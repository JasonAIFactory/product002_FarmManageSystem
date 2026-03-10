"""
Claude API provider — primary LLM for structured parsing.

# CORE_CANDIDATE — reusable Claude wrapper with consistent error handling.

Uses claude-sonnet-4-20250514 for the best balance of Korean understanding,
structured output quality, and cost. Temperature 0.0 for deterministic parsing.
"""

import anthropic

from app.config import settings
from app.core.ai.llm_provider import LLMProvider


class ClaudeProvider(LLMProvider):
    """Claude API implementation of the LLM provider interface."""

    def __init__(self, model: str = "claude-sonnet-4-20250514"):
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = model

    async def complete(
        self,
        system_prompt: str,
        user_message: str,
        max_tokens: int = 2000,
        temperature: float = 0.0,
    ) -> str:
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        # Claude returns a list of content blocks — we want the text from the first one
        return response.content[0].text
