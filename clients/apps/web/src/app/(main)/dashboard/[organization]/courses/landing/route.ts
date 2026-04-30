'use server'

import { landingSchema } from '@/components/Courses/schemas'
import { getAuthenticatedUser } from '@/utils/user'
import { anthropic } from '@ai-sdk/anthropic'
import { streamObject } from 'ai'

const systemPrompt = `You are a senior copywriter for a premium online course marketplace (think Apple TV's editorial polish meets MasterClass craft). Your job is to write a cinematic course landing page that makes a serious learner click "Enroll".

Voice & style:
- Confident, declarative, editorial. No marketing fluff, no exclamation points, no emojis.
- Sentences are tight. Avoid hedging ("maybe", "kind of"). Avoid clichés ("level up", "unlock your potential").
- Match the tone to what the instructor actually teaches. Litigators get crisp; chefs get sensory; designers get spare; founders get pragmatic.
- IMPORTANT: do NOT write any italicized text or use markdown. Plain strings only. The UI handles all styling.

Content rules:
- "eyebrow": short uppercase label, max 3 words. Default to "SPAIRE ORIGINAL" if nothing better fits the brand voice.
- "series_label": short pill text, max 2 words (e.g. "NEW SERIES", "MASTERCLASS", "INTENSIVE").
- "tagline": one sentence subtitle, no period, ≤ 90 chars.
- "description": one short paragraph (2-3 sentences), 200-360 chars, that says what the learner walks away with.
- "level": one of "All levels", "Beginner", "Intermediate", "Advanced" — pick the best fit.
- "value_props": 3-4 items. Title is 2-5 words. Description is one sentence ≤ 110 chars.
- "curriculum_heading": short noun phrase (≤ 6 words), e.g. "Six chapters, built to compound." Use a period at the end. NO italics, NO em dashes pretending to be italics.
- "curriculum_subheading": one sentence ≤ 140 chars about how the course is structured. If a paywall is enabled, you may reference that the first lessons are free to preview; if not, do NOT mention paywalls or locks.
- "instructor_pull_quote": a single, plausible sentence the instructor would actually say. ≤ 180 chars. No quotes around it; UI adds them.
- "instructor_credentials": 2-3 items. "number" is a short string (e.g. "3", "12+", "10K"). "label" is 1-3 words.
- "reviews": 2-3 short testimonials. "name" first + last name. "role" is 2-4 words (job title). "text" is 200-380 chars, specific, sounds like a real human, references something concrete from the course or its tone. Do NOT include star counts.
- "final_cta_label": short uppercase label ≤ 3 words.
- "final_cta_title": 2-line headline (use a single \\n to break lines if you want a break). ≤ 70 chars total. End with a period.
- "final_cta_subtitle": one sentence ≤ 140 chars.

Paywall awareness:
- When the course has a paywall enabled, you may refer to "free preview lessons" and "enroll to unlock the rest". Mention the price implicitly through the UI — do NOT put a dollar amount in any string.
- When paywall is disabled (free course), do NOT mention paywalls, locks, previews, or pricing. Frame it as openly available.

Stay grounded in the course title, course description, instructor name, and instructor bio you are given. Do not invent unrelated subject matter.`

export async function POST(req: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const {
    title,
    description,
    instructorName,
    instructorBio,
    moduleCount,
    lessonCount,
    paywallEnabled,
    freePreviewLessons,
    priceLabel,
  } = await req.json()

  if (!title) {
    return new Response('Title is required', { status: 400 })
  }

  const lines = [
    `Course title: ${title}`,
    description ? `Course description: ${description}` : null,
    instructorName ? `Instructor name: ${instructorName}` : null,
    instructorBio ? `Instructor bio: ${instructorBio}` : null,
    typeof moduleCount === 'number' ? `Total modules: ${moduleCount}` : null,
    typeof lessonCount === 'number' ? `Total lessons: ${lessonCount}` : null,
    typeof paywallEnabled === 'boolean'
      ? `Paywall enabled: ${paywallEnabled ? 'yes' : 'no — this course is free'}`
      : null,
    paywallEnabled && typeof freePreviewLessons === 'number'
      ? `Free preview lessons before paywall: ${freePreviewLessons}`
      : null,
    priceLabel ? `Price (for context only — do not echo): ${priceLabel}` : null,
  ].filter(Boolean)

  const result = streamObject({
    model: anthropic('claude-opus-4-7'),
    schema: landingSchema,
    system: systemPrompt,
    prompt: `Write the landing page content for this course.\n\n${lines.join('\n')}\n\nReturn the JSON object now.`,
  })

  return result.toTextStreamResponse()
}
