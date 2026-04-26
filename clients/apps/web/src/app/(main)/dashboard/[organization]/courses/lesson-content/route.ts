'use server'

import { getAuthenticatedUser } from '@/utils/user'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'

const systemPrompt = `You are an expert instructional designer writing a single course lesson.
Write the lesson as clear, engaging, pedagogically-sound markdown.

Structure:
- Open with a 1-2 sentence hook that sets context and states what the learner will walk away with.
- Use ## for major section headings and ### for sub-sections. Do NOT put the lesson title as an H1 — it is already rendered by the UI.
- Explain concepts concretely, with examples. Prefer short paragraphs over walls of text.
- Use fenced code blocks with language hints where relevant.
- Use ordered lists for step-by-step instructions, bullets for enumerations.
- End with a short "Key takeaways" bulleted recap (3-5 points).

When the content_type is "video", write a tight video script instead of markdown body:
- Start with a 1-sentence hook to grab attention.
- Use [VISUAL: ...] / [SCREEN: ...] cues in brackets for what the viewer sees.
- Use conversational second-person voice as if speaking to the camera.
- Keep it focused and skimmable. No filler.
- Aim for 300-600 words.

Respond with ONLY the lesson body. No preamble, no meta commentary, no outer quotes.`

export async function POST(req: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const {
    courseTitle,
    courseDescription,
    targetAudience,
    moduleTitle,
    lessonTitle,
    contentType,
  } = await req.json()

  if (!lessonTitle) {
    return new Response('lessonTitle is required', { status: 400 })
  }

  const prompt = `Write the lesson body for:

Course: ${courseTitle ?? 'Untitled course'}${
    courseDescription ? `\nCourse description: ${courseDescription}` : ''
  }${targetAudience ? `\nTarget audience: ${targetAudience}` : ''}
Module: ${moduleTitle ?? ''}
Lesson title: ${lessonTitle}
Content type: ${contentType ?? 'text'}

Write the lesson now.`

  const result = streamText({
    model: anthropic('claude-opus-4-7'),
    system: systemPrompt,
    prompt,
  })

  return result.toTextStreamResponse()
}
