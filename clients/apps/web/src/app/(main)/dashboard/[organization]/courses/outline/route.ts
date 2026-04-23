'use server'

import { getAuthenticatedUser } from '@/utils/user'
import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { z } from 'zod'

const outlineSchema = z.object({
  modules: z.array(
    z.object({
      title: z.string(),
      description: z.string().optional(),
      lessons: z.array(
        z.object({
          title: z.string(),
          content_type: z.enum(['text', 'video']),
        }),
      ),
    }),
  ),
})

export type CourseOutline = z.infer<typeof outlineSchema>

const systemPrompt = `You are an expert instructional designer. Create well-structured, comprehensive course outlines.
Guidelines:
- Create 3-7 modules that build progressively on each other
- Each module should have 2-6 focused lessons
- Modules should have clear, descriptive titles that communicate the learning objective
- Lessons should have specific, actionable titles (e.g. "Setting Up Your Development Environment" not just "Setup")
- Mix content types: use "video" for demonstrations and walkthroughs, "text" for conceptual explanations and references
- Start with foundational concepts and progress toward advanced application`

export async function POST(req: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { title, description, targetAudience } = await req.json()

  if (!title) {
    return new Response('Title is required', { status: 400 })
  }

  try {
    const { object } = await generateObject({
      model: anthropic('claude-opus-4-7'),
      schema: outlineSchema,
      system: systemPrompt,
      prompt: `Create a course outline for:
Title: ${title}${description ? `\nDescription: ${description}` : ''}${targetAudience ? `\nTarget Audience: ${targetAudience}` : ''}`,
    })

    return Response.json(object)
  } catch (err) {
    console.error('[course-outline] generation error:', err)
    return new Response(JSON.stringify({ error: 'Failed to generate outline' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
