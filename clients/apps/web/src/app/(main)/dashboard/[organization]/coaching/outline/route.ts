'use server'

import { coachingOutlineSchema } from '@/components/Coaching/schemas'
import { getAuthenticatedUser } from '@/utils/user'
import { anthropic } from '@ai-sdk/anthropic'
import { streamObject } from 'ai'

const systemPrompt = `You are an expert coaching program designer helping a coach launch a digital coaching program on Spaire (a Kajabi-like platform). The program is sold as a digital product — the coach is NOT booking 1:1 sessions; they are selling access to a packaged program.

You generate four things in one streaming response:

1) modules: A program outline of 3–5 modules, each with 2–5 lessons (type "doc" or "video"). Modules should progress logically. Lesson titles should be concrete and outcome-oriented.

2) landing: Landing page draft. Include:
   - hero (one-line headline; can use emotional, action-oriented language)
   - sub (1–2 sentence supporting line)
   - bullets (4–6 "what's included" items)
   - faqs (4–6 question/answer pairs that address common buyer concerns; the answers should be 1–3 sentences each)

3) intakeQuestions: 3–5 questions to ask the buyer right after purchase, to help the coach personalize the experience.

4) sessionIdeas: ONLY when the format is "cohort" or "hybrid". 4–6 group session topics with no dates attached. If format is "self", return an empty array.

5) clarifyingQuestions: IMPORTANT. If the user's prompt is ambiguous about anything material to the landing page or program structure — most commonly refund policy, money-back guarantee terms, target audience, prerequisites, time commitment per week, what's NOT included, certification/credentials — return up to 3 short questions you'd like the user to answer to make the draft more accurate. Each question should be specific and short (under 100 chars). If the prompt is detailed enough that you can confidently make all calls, return an EMPTY array. Do not pad.

Constraints:
- Match the coach's voice from their bio when one is provided.
- Keep copy plain and confident; avoid exclamation marks.
- Never invent specific guarantees (e.g. "100% money back") unless the user mentioned them OR you've added it to clarifyingQuestions.
- For cohort/hybrid programs, weave the cohort cadence into bullets and FAQs.`

export async function POST(req: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const {
    programTitle,
    promise,
    format,
    weeks,
    coachName,
    coachBio,
    coachCredentials,
    pricingModel,
    price,
    accessDuration,
    freePreview,
    clarifyingAnswers,
    aiPrompt,
  } = await req.json()

  if (!programTitle && !aiPrompt) {
    return new Response('programTitle or aiPrompt is required', { status: 400 })
  }

  const lines = [
    programTitle ? `Program title: ${programTitle}` : null,
    promise ? `One-sentence promise: ${promise}` : null,
    format ? `Format: ${format}` : null,
    weeks ? `Length: ${weeks} weeks` : null,
    coachName ? `Coach: ${coachName}` : null,
    coachBio ? `Coach bio: ${coachBio}` : null,
    coachCredentials ? `Coach credentials: ${coachCredentials}` : null,
    pricingModel ? `Pricing: ${pricingModel}${price ? ` at $${price}` : ''}` : null,
    accessDuration ? `Access: ${accessDuration}` : null,
    typeof freePreview === 'boolean'
      ? `Free preview enabled: ${freePreview ? 'yes' : 'no'}`
      : null,
    aiPrompt ? `\nUser description:\n${aiPrompt}` : null,
    clarifyingAnswers && Object.keys(clarifyingAnswers).length > 0
      ? `\nUser answered clarifying questions:\n${Object.entries(
          clarifyingAnswers as Record<string, string>,
        )
          .map(([q, a]) => `Q: ${q}\nA: ${a}`)
          .join('\n')}`
      : null,
  ].filter(Boolean)

  const result = streamObject({
    model: anthropic('claude-opus-4-7'),
    schema: coachingOutlineSchema,
    system: systemPrompt,
    maxOutputTokens: 3000,
    prompt: `Generate the coaching program draft for:\n${lines.join('\n')}\n\nReturn the JSON object now and stop.`,
  })

  return result.toTextStreamResponse()
}
