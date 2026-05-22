'use server'

import { outlineSchema } from '@/components/Courses/schemas'
import { getAuthenticatedUser } from '@/utils/user'
import { anthropic } from '@ai-sdk/anthropic'
import { streamObject } from 'ai'

const courseSystemPrompt = `You are an expert instructional designer. Create well-structured, comprehensive course outlines.
Guidelines:
- Create EXACTLY 4 modules — no more, no fewer. The "Sections" roadmap on the landing page is built around four sections, so the outline must always have four. If the topic is small, tighten lessons rather than collapsing modules; if the topic is large, group rather than adding a fifth module.
- Each module should have 2-6 focused lessons
- Modules should have clear, descriptive titles that communicate the learning objective
- Lessons should have specific, actionable titles (e.g. "Setting Up Your Development Environment" not just "Setup")
- Mix content types: use "video" for demonstrations and walkthroughs, "text" for conceptual explanations and references
- Start with foundational concepts and progress toward advanced application
- Tailor the depth and pacing to the instructor's voice when an instructor bio is provided
- When a paywall is enabled, the first module should land hard so free-preview lessons earn the upsell. When the course is free (no paywall), pace evenly and treat every lesson as core curriculum`

// Series share the same JSON schema as Courses — they're stored as a Course
// with format='series' and a single implicit "module" holding every episode.
// The prompt asks for ONE module containing every episode as a "lesson"; the
// UI relabels lessons → episodes at render time.
const seriesSystemPrompt = `You are a story editor for a premium series — closer to a documentary producer or a podcast season editor than a course designer. You shape a thematic arc the creator can record straight into the camera, not a curriculum.

Output format (important)
- Return EXACTLY ONE module. Treat that module as the season itself; its "title" is the season tagline (2-6 words, editorial, NOT "Module 1"). Its "description" is one sentence framing the arc.
- Inside that single module, return EXACTLY 6 "lessons" — these are the episodes. Never more, never fewer. If the topic is huge, tighten and combine; if it's narrow, slow down and let scenes breathe. Always six.
- Each lesson title is the episode title.
- Pick "content_type" per episode: "video" for personal, on-camera reflection or behind-the-scenes (the default for a series), "text" only when the episode is genuinely better as a written piece (e.g. a letter, a journal entry, a written reflection).

Voice & structure
- Episodes are self-contained but build a larger thematic arc. No "Episode 1 → Episode 2" dependency, no "before you start" gating, no homework, no quizzes.
- Episode titles read like documentary chapters or essay titles — evocative, specific, in the creator's voice. Avoid the "How to X" / "5 ways to Y" instructional cadence.
- Names of things, places, people, moments. Concrete > generic. "The week before the final" beats "Handling pressure".
- No exclamation points. No clichés ("level up", "mindset shift", "unlock"). No instructional verbs ("learn to", "master", "build").
- Tailor pacing, voice, and subject grounding to the instructor's bio. If they're an athlete, name the sport, the rituals, the specific opponents or moments. If they're a founder, name the stage, the round, the decision. Series live or die by specificity.
- When a paywall is enabled, the first 2-3 episodes should hook on their own — open with the most magnetic, story-driven episodes so the free preview earns the unlock. When free, pace evenly across the arc.`

export async function POST(req: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const {
    title,
    description,
    targetAudience,
    differentiator,
    instructorName,
    instructorBio,
    paywallEnabled,
    freePreviewLessons,
    format,
  } = await req.json()

  if (!title) {
    return new Response('Title is required', { status: 400 })
  }

  const isSeries = format === 'series'
  const systemPrompt = isSeries ? seriesSystemPrompt : courseSystemPrompt

  const lines = [
    `Title: ${title}`,
    description ? `Description: ${description}` : null,
    targetAudience ? `Target Audience: ${targetAudience}` : null,
    differentiator
      ? `What makes this ${isSeries ? 'series' : 'course'} different: ${differentiator}`
      : null,
    instructorName ? `Instructor: ${instructorName}` : null,
    instructorBio ? `Instructor bio: ${instructorBio}` : null,
    typeof paywallEnabled === 'boolean'
      ? `Paywall: ${paywallEnabled ? 'enabled' : isSeries ? 'disabled (free series)' : 'disabled (free course)'}`
      : null,
    paywallEnabled && typeof freePreviewLessons === 'number'
      ? `Free preview ${isSeries ? 'episodes' : 'lessons'} before paywall: ${freePreviewLessons}`
      : null,
  ].filter(Boolean)

  const intro = isSeries
    ? `Shape the episode list for this series:\n${lines.join('\n')}\n\nReturn the JSON object now and stop.`
    : `Create a course outline for:\n${lines.join('\n')}\n\nReturn the JSON object now and stop.`

  const result = streamObject({
    model: anthropic('claude-opus-4-7'),
    schema: outlineSchema,
    system: systemPrompt,
    maxOutputTokens: 2400,
    prompt: intro,
  })

  return result.toTextStreamResponse()
}
