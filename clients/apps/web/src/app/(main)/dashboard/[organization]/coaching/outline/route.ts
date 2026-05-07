'use server'

import { coachingOutlineSchema } from '@/components/Coaching/schemas'
import { getAuthenticatedUser } from '@/utils/user'
import { anthropic } from '@ai-sdk/anthropic'
import { streamObject } from 'ai'

const systemPrompt = `You are an expert coaching program designer helping a coach launch a digital coaching program on Spaire (a Kajabi-like platform). The program is sold as a digital product — the coach is NOT booking 1:1 sessions; they are selling access to a packaged program.

You generate the following in one streaming response. Every field must be populated — do not return empty strings or empty arrays where the schema implies content.

1) modules: 3–5 modules, each with 2–5 lessons (type "doc" or "video"). Modules progress logically; lesson titles are concrete and outcome-oriented. Mix doc and video.

2) landing: A complete landing page draft modelled after a polished, editorial product page. Includes:

   hero:
   - titleParts: 2–4 short pieces that read as a single sentence. Mark 1–2 of them \`italic: true\` to break the headline rhythm (these render in Instrument Serif italics). Keep the words short, real, no exclamation marks.
   - subtitle: 1–2 sentences supporting the headline.
   - ctaPrimary: short label e.g. "See programs", "Start now".
   - ctaSecondary: short secondary label e.g. "Learn more".
   - clientsPillText: short social-proof line like "+ 1,200 students" or "Trusted by 300 coaches" — never invent a specific number unless the user gave one; use a generic phrase if not.

   coreEvolution:
   - heading: name the program's core pillar (often the program title or a tight phrase).
   - description: 2–4 sentences on what the program does and how it changes the buyer's life.
   - resultsHeading: e.g. "Expected Results".
   - stats: 4–6 outcome stats relevant to the program. Each has a short label, a value like "+30%" / "8 weeks" / "-5kg", and a barPercent integer in 30–95 reflecting how much movement the buyer should expect.
   - cta: short button label like "Join now".
   - caption: one short line that captions the secondary image.

   courses:
   - heading: short title for the curriculum section, e.g. "Your journey, step by step".
   - lede: 1–2 sentences describing how the modules unfold.

   atlas: This populates a detailed product modal.
   - eyebrow: a short line above the title, e.g. "Redefine your limits.".
   - title: the program title, or a tight variant.
   - meta: EXACTLY 3 entries. Typical labels: "Duration", "Format", "Follow-up" (or similarly coach-relevant pairs). Values are concrete, e.g. "4 months", "Self-paced", "WhatsApp support".
   - orderCta: includes the price if known, e.g. "Order — $99".
   - sections: 2–3 entries with labels like "Ideal for", "Money-back guarantee", "Delivery & access". Bodies are 1–3 sentences. NEVER invent a specific guarantee unless the user mentioned one or it's in clarifyingAnswers.
   - testimonial: a believable single-buyer quote (1–3 sentences). Author is initials-only, e.g. "Diego. S". authorSub names the program (e.g. the program title).

   faq:
   - heading: short, e.g. "Frequently Asked Questions".
   - lede: one sentence explaining why the FAQ exists.
   - cta: short contact label e.g. "Get in touch".
   - items: 4–6 plausible buyer questions with plain 1–3 sentence answers.

3) intakeQuestions: 3–5 questions to ask the buyer right after purchase, to personalise the experience.

4) sessionIdeas: ONLY when the format is "cohort" or "hybrid". 4–6 group session topics, no dates. If format is "self", return [].

5) clarifyingQuestions: IMPORTANT. If the user's prompt is ambiguous about anything material to the landing page or program structure — most commonly refund policy, money-back guarantee terms, target audience, prerequisites, time commitment per week, what's NOT included, certification/credentials — return up to 3 short questions (under 100 chars each). If the prompt is detailed enough, return [].

Voice & constraints:
- Plain, confident, no exclamation marks, no marketing fluff, no "Unlock!" / "Transform!".
- Match the coach's bio voice when provided.
- For cohort/hybrid programs, weave the cohort cadence into the FAQ and atlas sections.
- Never invent specific guarantees (refund windows, success rates) unless the user supplied them.`

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
    prompt: userPrompt,
    aiPrompt,
  } = await req.json()

  const description = userPrompt || aiPrompt

  if (!programTitle && !description) {
    return new Response('programTitle or prompt is required', { status: 400 })
  }

  // clarifyingAnswers can be either a string (raw notes the user typed) or
  // an object { question: answer } when the AI asked structured questions.
  let clarifyingAnswersBlock: string | null = null
  if (clarifyingAnswers) {
    if (
      typeof clarifyingAnswers === 'object' &&
      Object.keys(clarifyingAnswers).length > 0
    ) {
      clarifyingAnswersBlock = Object.entries(
        clarifyingAnswers as Record<string, string>,
      )
        .filter(([, v]) => v && String(v).trim().length > 0)
        .map(([q, a]) => `Q: ${q}\nA: ${a}`)
        .join('\n')
    } else if (typeof clarifyingAnswers === 'string' && clarifyingAnswers.trim()) {
      clarifyingAnswersBlock = clarifyingAnswers
    }
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
    description ? `\nUser description:\n${description}` : null,
    clarifyingAnswersBlock
      ? `\nUser answered clarifying questions / extra notes:\n${clarifyingAnswersBlock}`
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
