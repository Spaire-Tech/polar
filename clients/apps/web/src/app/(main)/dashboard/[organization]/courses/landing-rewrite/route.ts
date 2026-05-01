'use server'

import { getAuthenticatedUser } from '@/utils/user'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'

const SYSTEM = `You are a landing-page copywriter for an online course.
Rewrite the given text per the user's intent.
Respond with ONLY the rewritten line(s). No quotes, no preamble, no commentary.`

export async function POST(req: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { intent, current, hint } = await req.json()
  if (!current) {
    return new Response('current is required', { status: 400 })
  }

  const prompt = `Field: ${hint ?? 'landing page copy'}
Current: "${current}"
Goal: ${intent ?? 'Make it punchier, 5-9 words.'}

Rewrite:`

  const result = streamText({
    model: anthropic('claude-opus-4-7'),
    system: SYSTEM,
    prompt,
  })

  return result.toTextStreamResponse()
}
