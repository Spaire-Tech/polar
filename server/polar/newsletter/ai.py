"""AI-assisted writing transforms for newsletter posts.

A thin wrapper around pydantic-ai's OpenAI integration. Mirrors the
shape of `polar.organization.ai_validation` so we stay consistent with
the platform's existing AI surface (same SDK, same model setting).

Backs the editor's inline AI popover: a creator selects a span of
text, picks an action, and gets the transformed text back. The
backend is a stateless text-in / text-out call — we don't persist
the prompt or the response, and we don't touch the post document
ourselves. The editor decides whether to accept the suggestion and
splices it back in.

V1 surface: five fixed actions (polish / shorter / longer / fix
grammar / change tone) plus an optional tone hint for the last one.
Each maps to a hard-coded prompt below. Adding new actions = one
constant + one Literal case.
"""

from __future__ import annotations

import asyncio
from typing import Literal

import structlog
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from polar.config import settings

log = structlog.get_logger(__name__)


AITransformAction = Literal[
    "polish",
    "shorter",
    "longer",
    "grammar",
    "tone",
]

# Hard cap on input size. Beyond this we refuse rather than ship a
# truncated request — the editor only ever sends the selected span,
# so a 4k cap covers any realistic single-paragraph selection.
_MAX_INPUT_CHARS = 4000


_SYSTEM_PROMPT = (
    "You are an editing assistant for a long-form newsletter writer. "
    "You will be given a short passage of the writer's prose and an "
    "instruction. Apply the instruction faithfully and return ONLY "
    "the rewritten passage — no preamble, no explanation, no "
    "surrounding quotes. Preserve the author's voice, paragraph "
    "structure, and any deliberate stylistic choices. Never invent "
    "facts. Never add a sign-off. Return plain text only (no markdown, "
    "no HTML)."
)

_ACTION_INSTRUCTIONS: dict[AITransformAction, str] = {
    "polish": (
        "Polish this passage. Tighten the prose, smooth the rhythm, "
        "and remove awkward phrasing — without changing the meaning, "
        "voice, or length significantly."
    ),
    "shorter": (
        "Make this passage shorter. Cut filler words, redundant "
        "clauses, and weak sentences. Aim for roughly 60–70% of the "
        "original length while keeping every important idea."
    ),
    "longer": (
        "Expand this passage. Add a concrete example, a piece of "
        "supporting detail, or a clarifying sentence where the prose "
        "would benefit. Stay in the author's voice. Do not pad with "
        "filler."
    ),
    "grammar": (
        "Fix grammar, punctuation, and spelling errors in this "
        "passage. Do not rephrase anything that's already correct. "
        "Keep the author's voice intact."
    ),
    "tone": (
        "Rewrite this passage in a {tone} tone. Preserve the meaning "
        "exactly; change only the register and word choice to match "
        "the requested tone."
    ),
}


class NewsletterAITransformer:
    """Stateless transformer instance. One per process is fine — the
    pydantic-ai Agent owns the underlying HTTP client and reuses it."""

    def __init__(self) -> None:
        provider = OpenAIProvider(api_key=settings.OPENAI_API_KEY)
        self.model = OpenAIChatModel(settings.OPENAI_MODEL, provider=provider)
        # `output_type=str` keeps the response as a single string —
        # matches the wire we want (text-in / text-out).
        self.agent: Agent[None, str] = Agent(
            self.model,
            output_type=str,
            system_prompt=_SYSTEM_PROMPT,
        )

    async def transform(
        self,
        *,
        text: str,
        action: AITransformAction,
        tone: str | None = None,
        timeout_seconds: int = 20,
    ) -> str:
        """Run the transform and return the rewritten text.

        Raises ValueError when the input is empty, too long, or
        configuration is missing. Raises TimeoutError when the
        upstream call doesn't return in `timeout_seconds`. Callers
        in endpoints should map both to 4xx / 5xx as appropriate.
        """
        if not settings.OPENAI_API_KEY:
            raise ValueError("AI transforms not configured")
        clean = (text or "").strip()
        if not clean:
            raise ValueError("Text to transform is empty")
        if len(clean) > _MAX_INPUT_CHARS:
            raise ValueError(
                f"Text exceeds the {_MAX_INPUT_CHARS}-character limit"
            )

        instruction_template = _ACTION_INSTRUCTIONS[action]
        if action == "tone":
            tone_word = (tone or "neutral").strip() or "neutral"
            instruction = instruction_template.format(tone=tone_word)
        else:
            instruction = instruction_template

        prompt = f"INSTRUCTION:\n{instruction}\n\nPASSAGE:\n{clean}"

        log.info(
            "newsletter.ai_transform",
            action=action,
            tone=tone,
            input_chars=len(clean),
        )
        result = await asyncio.wait_for(
            self.agent.run(prompt), timeout=timeout_seconds
        )
        return str(result.output).strip()


# Lazy singleton — instantiated on first use so we don't pay the
# provider init cost at module import time (and so importing the
# module without an OPENAI_API_KEY set doesn't error out).
_instance: NewsletterAITransformer | None = None


def get_ai_transformer() -> NewsletterAITransformer:
    global _instance
    if _instance is None:
        _instance = NewsletterAITransformer()
    return _instance
