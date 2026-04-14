"""Spaire Studio — AI-authored digital product generation.

Studio wraps the Anthropic Messages API to stream a Markdown manuscript for
creators. The first archetype is the *Workbook*: a structured, print-ready
PDF-bound deliverable (intro, chapters, reflection prompts, checklists).

The service is intentionally thin: construct a prompt, open a streaming
Messages request, yield deltas upward. Higher layers (endpoint, future
publish flow) handle SSE framing, persistence, PDF rendering, and product
creation.
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from anthropic import AsyncAnthropic

from polar.auth.models import AuthSubject, is_user
from polar.config import settings
from polar.exceptions import PolarError
from polar.models import Organization, User
from polar.postgres import AsyncSession
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from .schemas import WorkbookGenerateRequest

log = logging.getLogger(__name__)


# Anthropic SDK max_tokens per length preset. These are generous upper
# bounds; adaptive thinking + the model's own sense of "done" typically
# produces fewer tokens, and we pay only for what we use.
_LENGTH_BUDGET: dict[str, int] = {
    "short": 12_000,
    "standard": 24_000,
    "deep": 48_000,
}


# Stable, cacheable system prompt. Any byte change here invalidates the
# Anthropic prompt cache for all subsequent requests, so edit sparingly.
_WORKBOOK_SYSTEM_PROMPT = """You are Spaire Studio, an expert ghostwriter that authors production-ready digital workbooks for independent creators selling on Spaire.

A Spaire workbook is a downloadable, print-ready PDF that delivers a specific transformation to the reader. It sits somewhere between a book and a course: it teaches, but it also makes the reader *do the work* through prompts, checklists, and worksheets.

## Output format

You produce a single Markdown document. Nothing else — no preface to the user, no "here is your workbook" intro, no commentary on your own process. Just the manuscript, starting at `# {Title}`.

Use this structure:

```
# {Title}
*{Short one-line subtitle that names the transformation}*

## Introduction
{2-4 short paragraphs. Who this is for, the transformation, how to use the workbook.}

## Chapter 1 — {Name}
{Teach one core idea. 4-8 paragraphs. Concrete, specific, no filler.}

### Reflect
{3-6 open questions that make the reader apply the chapter to their life.}

### Do
- [ ] {Concrete action 1}
- [ ] {Concrete action 2}
- [ ] {Concrete action 3}

## Chapter 2 — {Name}
...

## Closing
{1-2 paragraphs: what the reader now has, what to do next.}

## Appendix — Quick-Reference Checklist
- [ ] ...
```

Rules:
- Chapter count scales with requested length: short = 3 chapters, standard = 5-6, deep = 8-10.
- Every chapter MUST include a "### Reflect" section with questions and a "### Do" section with checklist items written as `- [ ]`.
- Write to a single named audience, in their language. Never hedge with "depending on your situation".
- No meta-commentary about AI, Claude, or the generation process.
- No footnotes, no fake citations, no invented statistics.
- Use Markdown only — no HTML, no emoji unless the requested tone is "playful".
- Prose paragraphs only inside chapter bodies. No bullet lists except in "### Do" and the closing checklist.

## Quality bar

This is a paid digital product. A reader who spent $15 on it should close it feeling that you wrote the book they needed. That means: specific examples, named mental models, concrete frameworks, and prompts that cannot be answered with "yes" or "no"."""


class StudioError(PolarError):
    pass


class StudioNotConfigured(StudioError):
    def __init__(self) -> None:
        super().__init__(
            "Spaire Studio is not configured. Set ANTHROPIC_API_KEY.",
            status_code=503,
        )


class StudioOrganizationForbidden(StudioError):
    def __init__(self) -> None:
        super().__init__(
            "You do not have access to this organization.",
            status_code=403,
        )


class StudioService:
    """Singleton wrapper around the Anthropic SDK for Studio generation."""

    def __init__(self) -> None:
        self._client: AsyncAnthropic | None = None

    def _get_client(self) -> AsyncAnthropic:
        if not settings.ANTHROPIC_API_KEY:
            raise StudioNotConfigured()
        if self._client is None:
            self._client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        return self._client

    async def _authorize_organization(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization_id: Any,
    ) -> None:
        """Confirm the caller can act on behalf of the requested org."""
        if is_user(auth_subject):
            membership = await user_organization_service.get_by_user_and_org(
                session, auth_subject.subject.id, organization_id
            )
            if membership is None:
                raise StudioOrganizationForbidden()
        else:
            # Organization-scoped token: must match requested org.
            if auth_subject.subject.id != organization_id:
                raise StudioOrganizationForbidden()

    def _build_user_prompt(self, request: WorkbookGenerateRequest) -> str:
        return (
            f"Topic: {request.topic}\n"
            f"Audience: {request.audience}\n"
            f"Outcome: {request.outcome}\n"
            f"Tone: {request.tone}\n"
            f"Length: {request.length}\n\n"
            "Write the complete workbook manuscript now."
        )

    async def stream_workbook(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        request: WorkbookGenerateRequest,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Yield SSE-ready event dicts for a streaming workbook generation.

        Events:
        - ``{"event": "start"}`` — request accepted, model about to stream.
        - ``{"event": "delta", "data": {"text": "..."}}`` — a text chunk.
        - ``{"event": "done", "data": {...}}`` — terminal event with usage.
        - ``{"event": "error", "data": {"message": "..."}}`` — terminal error.
        """

        await self._authorize_organization(
            session, auth_subject, request.organization_id
        )

        try:
            client = self._get_client()
        except StudioNotConfigured as e:
            yield {"event": "error", "data": {"message": e.message}}
            return

        yield {
            "event": "start",
            "data": {
                "model": settings.ANTHROPIC_MODEL,
                "topic": request.topic,
            },
        }

        max_tokens = _LENGTH_BUDGET[request.length]

        try:
            async with client.messages.stream(
                model=settings.ANTHROPIC_MODEL,
                max_tokens=max_tokens,
                system=[
                    {
                        "type": "text",
                        "text": _WORKBOOK_SYSTEM_PROMPT,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=[
                    {"role": "user", "content": self._build_user_prompt(request)},
                ],
                thinking={"type": "adaptive"},
            ) as stream:
                async for text in stream.text_stream:
                    if not text:
                        continue
                    yield {"event": "delta", "data": {"text": text}}

                final = await stream.get_final_message()

            usage = final.usage
            yield {
                "event": "done",
                "data": {
                    "stop_reason": final.stop_reason,
                    "usage": {
                        "input_tokens": usage.input_tokens,
                        "output_tokens": usage.output_tokens,
                        "cache_creation_input_tokens": getattr(
                            usage, "cache_creation_input_tokens", 0
                        ),
                        "cache_read_input_tokens": getattr(
                            usage, "cache_read_input_tokens", 0
                        ),
                    },
                },
            }
        except (
            Exception
        ) as e:  # pragma: no cover — we want the client to see a clean error
            log.exception("studio.stream_workbook failed")
            yield {
                "event": "error",
                "data": {"message": f"Generation failed: {e.__class__.__name__}"},
            }

    @staticmethod
    def format_sse_data(data: Any) -> str:
        """JSON-encode an SSE payload so the client can ``JSON.parse`` it."""
        return json.dumps(data, ensure_ascii=False)


studio = StudioService()
