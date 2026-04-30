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
- Tailor the depth and pacing to the instructor's voice when an instructor bio is provided
- When a paywall is enabled, the first module should land hard so free-preview lessons earn the upsell. When the course is free (no paywall), pace evenly and treat every lesson as core curriculum`

export async function POST(req: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const {
    title,
    description,
    targetAudience,
    instructorName,
    instructorBio,
    paywallEnabled,
    freePreviewLessons,
  } = await req.json()

  if (!title) {
    return new Response('Title is required', { status: 400 })
  }

  const lines = [
    `Title: ${title}`,
    description ? `Description: ${description}` : null,
    targetAudience ? `Target Audience: ${targetAudience}` : null,
    instructorName ? `Instructor: ${instructorName}` : null,
    instructorBio ? `Instructor bio: ${instructorBio}` : null,
    typeof paywallEnabled === 'boolean'
      ? `Paywall: ${paywallEnabled ? 'enabled' : 'disabled (free course)'}`
      : null,
    paywallEnabled && typeof freePreviewLessons === 'number'
      ? `Free preview lessons before paywall: ${freePreviewLessons}`
      : null,
  ].filter(Boolean)

  const result = streamObject({
    model: anthropic('claude-opus-4-7'),
    schema: outlineSchema,
    system: systemPrompt,
    prompt: `Create a course outline for:\n${lines.join('\n')}`,
  })

  return result.toTextStreamResponse()
}
