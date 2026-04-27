'use server'

import { outlineSchema } from '@/components/Courses/schemas'
import { getAuthenticatedUser } from '@/utils/user'
import { anthropic } from '@ai-sdk/anthropic'
import { streamObject } from 'ai'

const systemPrompt = `You are an expert instructional designer. Create well-structured, comprehensive course outlines.
Guidelines:
- Create 3-7 modules that build progressively on each other
- Each module should have 2-6 focused lessons
- Modules should have clear, descriptive titles that communicate the learning objective
- Lessons should have specific, actionable titles (e.g. "Setting Up Your Development Environment" not just "Setup")
- Mix content types: use "video" for demonstrations and walkthroughs, "text" for conceptual explanations and references
- Start with foundational concepts and progress toward advanced application
- The very first lesson of the very first module MUST be a free preview titled exactly "Trailer". Its content_type MUST be "video". Its purpose is to introduce the course to prospective students before purchase — keep it short and inviting.`

export async function POST(req: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { title, description, targetAudience } = await req.json()

  if (!title) {
    return new Response('Title is required', { status: 400 })
  }

  const result = streamObject({
    model: anthropic('claude-opus-4-7'),
    schema: outlineSchema,
    system: systemPrompt,
    prompt: `Create a course outline for:
Title: ${title}${description ? `\nDescription: ${description}` : ''}${targetAudience ? `\nTarget Audience: ${targetAudience}` : ''}`,
  })

  return result.toTextStreamResponse()
}
