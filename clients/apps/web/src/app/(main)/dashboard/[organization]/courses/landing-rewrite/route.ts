'use server'

import { getAuthenticatedUser } from '@/utils/user'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'

const SYSTEM = `You are a landing-page copywriter for an online course.
Rewrite or generate the requested copy per the user's intent.
Respond with ONLY the rewritten line(s). No quotes, no preamble, no commentary.`

type RewriteContext = {
  courseTitle?: string | null
  instructor?: string | null
  lessonTitle?: string | null
  lessonIndex?: number | null
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = (await req.json()) as {
    intent?: string
    current?: string
    hint?: string
    kind?: string
    context?: RewriteContext
  }
  const { intent, current, hint, kind, context } = body

  // Only require `current` for generic rewrites; description-style generation
  // can run from scratch as long as we have lesson context.
  if (kind !== 'free_preview_description' && !current) {
    return new Response('current is required', { status: 400 })
  }

  let prompt: string
  if (kind === 'free_preview_description') {
    const lines = [
      `Task: write a free-preview episode description for a course landing page.`,
      context?.courseTitle ? `Course: "${context.courseTitle}"` : null,
      context?.instructor ? `Instructor: ${context.instructor}` : null,
      context?.lessonIndex && context?.lessonTitle
        ? `Episode ${context.lessonIndex}: "${context.lessonTitle}"`
        : context?.lessonTitle
          ? `Episode title: "${context.lessonTitle}"`
          : null,
      current ? `Current draft: "${current}"` : null,
      `Style: 1–2 sentences, concrete, second-person where it fits, no clichés, no hype, no quotes.`,
      intent ? `Direction: ${intent}` : null,
      ``,
      `Description:`,
    ].filter(Boolean)
    prompt = lines.join('\n')
  } else {
    prompt = `Field: ${hint ?? 'landing page copy'}
Current: "${current}"
Goal: ${intent ?? 'Make it punchier, 5-9 words.'}

Rewrite:`
  }

  const result = streamText({
    model: anthropic('claude-opus-4-7'),
    system: SYSTEM,
    prompt,
  })

  return result.toTextStreamResponse()
}
