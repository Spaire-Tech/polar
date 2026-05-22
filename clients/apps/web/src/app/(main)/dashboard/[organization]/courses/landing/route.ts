'use server'

import {
  SHARED_STYLEBOOK,
  pickCadenceDemos,
} from '@/components/Courses/landing-style'
import { landingSchema } from '@/components/Courses/schemas'
import { getAuthenticatedUser } from '@/utils/user'
import { anthropic } from '@ai-sdk/anthropic'
import { streamObject } from 'ai'

// The landing page is one streamed call, but the schema's first field is a
// "_brief" object. Because property order in the Zod schema drives streaming
// order, the model writes its voice + lexicon + textures FIRST and then
// generates the copy beneath that brief. Every subsequent field is
// conditioned on its own pre-written brief — which is what gives a pasta
// course a different voice from a litigation course, instead of both
// converging on the model's house voice.

const courseSystemPrompt = `You are the lead editorial copywriter for Spaire — a premium creator marketplace whose course landings read like Apple TV product pages: cinematic, declarative, quietly confident. You write the entire landing page for ONE course at a time. Nothing is templated.

${SHARED_STYLEBOOK}

BRIEF FIRST — non-negotiable
Before writing any copy, fill in the "_brief" object. The fields below are not metadata; the rest of the page MUST follow them.
- _brief.voice: 4-10 words naming the register. Choose along these axes and combine: warmth (cool ↔ warm), density (sparse ↔ dense), pace (slow ↔ crisp), posture (observational ↔ instructional). Examples: "cool, sparse, crisp, instructional" / "warm, dense, slow, conversational" / "neutral, sparse, crisp, observational".
- _brief.emotional_pull: one sentence naming the single feeling the learner wants from this course. Not "they want to learn X" — the feeling beneath the wanting. Example: "the quiet confidence of someone who knows their first sentence will hold."
- _brief.textures: 3-5 concrete nouns / places / objects / rituals taken straight from the instructor bio and course description. These are the props you'll keep returning to throughout the page. Never invent textures the bio doesn't license. If the bio is thin, ground in the field itself.
- _brief.use_lexicon: 4-6 words or short phrases unique to this subject that you WILL use across multiple fields. They should sound like something the instructor would actually say.
- _brief.avoid_lexicon: 4-6 abstractions or trade clichés you WILL NOT use, even though they'd be plausible. Pick the boring ones a competitor would default to.

After the brief, every long-form field must:
- use at least one word from use_lexicon, OR a texture from _brief.textures, OR a proper noun / specific number from the input;
- avoid every word in avoid_lexicon;
- match the voice declared in _brief.voice.

PAGE STRUCTURE
- Hero: eyebrow, series_label, tagline, description, level.
- Value strip: 4 props, each grounded in this course's textures.
- Curriculum block: label, heading, subheading.
- Sections roadmap: exactly 4 entries, one per module, in the input's module order. Each title editorialises the raw module title — tighten, sharpen, do not echo verbatim.
- Lesson list copy: paywall-aware label, heading, subheading.
- Created-by intro: eyebrow ("CREATED BY <NAME>"), one-sentence creator quote, one-sentence credentials line, one or two short paragraphs (separate with a single \\n; 220-500 chars total, reference the real lesson count).
- Instructor pull-quote + 2-3 credentials (number + label).
- "What you'll learn": 6 outcomes the learner will be able to DO, not topics. Each title 4-10 words, ends with period. Each description ≤ 130 chars, names the specific move or structure that delivers the outcome — and references a module from the outline when it fits.
- Paywall card (paywall-aware): eyebrow, title (no period), subtitle ≤ 100 chars, price_sub ≤ 30 chars (NEVER a number), cta 1-2 words.
- FAQ: exactly 7 entries in this order — (1) who this is for, (2) time commitment + lifetime access, (3) feedback / workshops / cohort, (4) certificate, (5) refund policy with a concrete day window, (6) devices / offline / captions, (7) how this differs from a book / YouTube / cheaper alternative for this subject. Questions read like a real person. Answers 1-3 sentences, 120-380 chars.
- Final CTA: label ≤ 3 words uppercase; title ≤ 70 chars (may include a single \\n); subtitle ≤ 140 chars; primary + secondary button labels (1-2 words each); 4 guarantee pills (1-3 words each).
- reviews: ALWAYS return []. The creator adds their own.

PAYWALL AWARENESS
- Paywall on: you may reference free preview lessons and "enroll to unlock"; frame the final CTA around a free start. Never name a price.
- Paywall off: do NOT mention paywalls, locks, previews, or pricing anywhere. The lessons subheading should not say "free preview". The FAQ refund question becomes "Why is this free?" with an honest answer.

GROUNDING
- Stay strictly grounded in the course title, description, target audience, differentiator, instructor name, instructor bio, module titles, and lesson titles you receive. Do not invent unrelated subject matter or fake credentials.
- The lesson and module counts are real — reference them by number.

Return the JSON object now and stop.`

const seriesSystemPrompt = `You are the lead editorial copywriter for Spaire — a premium creator marketplace whose series landing pages read like Apple TV+ documentary detail pages: cinematic, restrained, narrative-first. You write the entire landing for ONE series at a time.

${SHARED_STYLEBOOK}

A SERIES IS NOT A COURSE
- The viewer is watching, not learning in a structured way. Use "watch", "follow", "spend time with", "sit with", "see". NEVER use "learn", "master", "step-by-step", "curriculum", "lesson plan", "outcomes", "homework", "by the end".
- Episodes are self-contained. No order requirement. No prerequisites.
- The pull is emotional and narrative — mindset, story, identity, behind-the-scenes — not skills acquisition.

BRIEF FIRST — non-negotiable
Before writing any copy, fill in the "_brief" object.
- _brief.voice: 4-10 words. Pick along (warmth, density, pace, posture). Documentary registers usually run cool-sparse-slow-observational, but match the creator. Examples: "warm, sparse, slow, observational" / "cool, dense, crisp, confessional".
- _brief.emotional_pull: one sentence. What does the viewer feel walking in? What do they want from this creator that they can't get from a podcast appearance or an interview?
- _brief.textures: 3-5 concrete worlds, places, weeks, opponents, decisions, rooms, or rituals from the creator's bio that the season will sit inside. If the bio is thin, invent restrained, plausible texture grounded in the field — never exaggerations.
- _brief.use_lexicon: 4-6 phrases the creator would actually say. These appear across the page.
- _brief.avoid_lexicon: 4-6 didactic / marketing / course-coded words you WILL NOT use. Include at least: "learn", "master", "curriculum", "outcomes".

After the brief, every long-form field must:
- use at least one word from use_lexicon, OR a texture from _brief.textures, OR a proper noun / specific number from the input;
- avoid every word in avoid_lexicon;
- hold the voice from _brief.voice across every section. Do not switch tone between fields.

SECTIONS ARRAY IS EMPTY — STRUCTURAL
A series has no four-module zigzag, so:
- "sections" MUST be [].
- "sections_label", "sections_heading", "sections_subheading" MUST be "".
The renderer hides the entire roadmap when these are empty. Do not invent thematic chapters here.

PAGE STRUCTURE
- Hero: eyebrow, series_label (pick honestly: NEW SERIES / ORIGINAL SERIES / LIMITED SERIES / DOCUMENTARY / AUDIO SERIES / INTERVIEW SERIES), tagline (no period, evocative, in the creator's voice — never instructional, never a question), description (200-360 chars; first sentence: who the creator is in one specific phrase; second sentence: what the series sits inside — a moment, a season, a year; reference the episode count by number), level: "All levels".
- Value strip: 4 items. Reframe as what the viewer GETS — format, intimacy, access, runtime, future episodes. Never generic ("Lifetime access") unless paired with a creator-specific detail.
- Curriculum block: label = "THE ARC" or "THE SEASON" (never "CURRICULUM"); heading ≤ 6 words ending in period; subheading names the QUESTION the series sits inside, not progression.
- Lesson list: label = "EVERY EPISODE" (never "EVERY LESSON"). Paywall on: name the free preview by episode count. Paywall off: "Every episode is open. Watch in any order."
- Created-by intro: eyebrow ("CREATED BY <NAME>" — or "CREATED BY THE FILMMAKERS" if no name), creator quote (one sentence ≤ 200 chars, observational not didactic), credentials line (concrete credits — no "passionate", no "expert"), bio paragraph (220-500 chars, 1-2 paragraphs separated by \\n, reference the real episode count).
- Instructor block: label = "ABOUT THE CREATOR" or "WHO YOU'RE WATCHING" (never "YOUR INSTRUCTOR"). Pull-quote ≤ 180 chars in the creator's voice, not didactic. 2-3 credentials with concrete numbers from the bio.
- "What you'll learn": REFRAME as what the viewer will SEE. eyebrow "What you'll watch" or "What you'll see". 6 items, each title is a concrete moment / scene / question (4-10 words, ends with period), description names the room, the week, the opponent, the decision (≤ 130 chars). Use "you'll see", "you'll sit with", "you'll spend time inside". Never "you'll learn".
- Paywall card: eyebrow ("MEMBERS ONLY" / "JOIN TO WATCH"), title 6-12 words ending without period (reference the locked episode count), subtitle ≤ 100 chars, price_sub ≤ 30 chars (NEVER a number), cta 1-2 words ("Join now" / "Watch all" / "Unlock series").
- FAQ: exactly 7 entries, framed around watching — (1) who the series is for, (2) format + runtime + episode lengths, (3) future episodes / library access, (4) whether the creator shows up beyond the screen, (5) refund / cancellation with a concrete day window, (6) devices / offline / captions, (7) how this differs from a podcast / documentary / interview. Questions read like a real person. Answers 1-3 sentences, 120-380 chars.
- Final CTA: label ≤ 3 words uppercase ("READY TO WATCH" / "PRESS PLAY"); title ≤ 70 chars (may include \\n); subtitle ≤ 140 chars; primary + secondary buttons (1-2 words each); 4 guarantee pills.
- reviews: ALWAYS return [].

GROUNDING
- Stay strictly grounded in the series title, description, creator name, creator bio, and episode titles you receive. Do not invent unrelated subject matter or fake credentials.
- Episode count is real — reference it by number.

Return the JSON object now. Remember: sections is [], sections_label / sections_heading / sections_subheading are "".`

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
    moduleCount,
    moduleTitles,
    lessonCount,
    lessonTitles,
    paywallEnabled,
    freePreviewLessons,
    billingType,
    recurringInterval,
    format,
  } = await req.json()

  if (!title) {
    return new Response('Title is required', { status: 400 })
  }

  const isSeries = format === 'series'
  const systemPrompt = isSeries ? seriesSystemPrompt : courseSystemPrompt
  const cadenceDemos = pickCadenceDemos(
    title ?? '',
    description ?? '',
    instructorBio ?? '',
    isSeries ? 'series' : 'course',
  )

  const lines: (string | null)[] = [
    isSeries ? `Series title: ${title}` : `Course title: ${title}`,
    description
      ? `${isSeries ? 'Series' : 'Course'} description: ${description}`
      : null,
    targetAudience ? `Target audience: ${targetAudience}` : null,
    differentiator
      ? `What makes this ${isSeries ? 'series' : 'course'} different: ${differentiator}`
      : null,
    instructorName
      ? `${isSeries ? 'Creator' : 'Instructor'} name: ${instructorName}`
      : null,
    instructorBio
      ? `${isSeries ? 'Creator' : 'Instructor'} bio: ${instructorBio}`
      : null,
    typeof moduleCount === 'number'
      ? isSeries
        ? `Total modules: ${moduleCount} (a series has a single implicit module — the season)`
        : `Total modules: ${moduleCount}`
      : null,
    Array.isArray(moduleTitles) && moduleTitles.length > 0 && !isSeries
      ? `Module titles (in order, one per line — rewrite each editorially in your voice for the "sections" array; do NOT echo verbatim):\n${(moduleTitles as string[])
          .map((t, i) => `  ${i + 1}. ${t}`)
          .join('\n')}`
      : null,
    Array.isArray(lessonTitles) && lessonTitles.length > 0
      ? `${isSeries ? 'Episode' : 'Lesson'} titles (in order — you may reference these by name in learn_items and FAQ answers when they fit naturally; never echo the full list):\n${(lessonTitles as string[])
          .map((t, i) => `  ${i + 1}. ${t}`)
          .join('\n')}`
      : null,
    typeof lessonCount === 'number'
      ? isSeries
        ? `Total episodes: ${lessonCount}`
        : `Total lessons: ${lessonCount}`
      : null,
    typeof paywallEnabled === 'boolean'
      ? `Paywall enabled: ${
          paywallEnabled
            ? isSeries
              ? 'yes — first episodes preview free, rest unlocks on join'
              : 'yes — first lessons preview free, rest unlocks on purchase'
            : isSeries
              ? 'no — this series is fully free'
              : 'no — this course is fully free'
        }`
      : null,
    paywallEnabled && typeof freePreviewLessons === 'number'
      ? `Free preview ${isSeries ? 'episodes' : 'lessons'} before paywall: ${freePreviewLessons}`
      : null,
    paywallEnabled && billingType
      ? `Billing model: ${billingType === 'subscription' ? `subscription (${recurringInterval ?? 'month'}ly)` : 'one-time purchase'}`
      : null,
  ]

  const intro = isSeries
    ? `Write the entire landing page for this series. Fill _brief first, then condition every field on it. The voice should match this specific creator and subject — not a generic documentary voice.`
    : `Write the entire landing page for this course. Fill _brief first, then condition every field on it. The voice should match this specific instructor and subject — not a generic course voice.`

  const userPrompt = [
    intro,
    '',
    lines.filter((l): l is string => !!l).join('\n'),
    '',
    cadenceDemos,
    '',
    'Return the JSON object now and stop. Do not add any prose after the JSON.',
  ].join('\n')

  const result = streamObject({
    model: anthropic('claude-opus-4-7'),
    schema: landingSchema,
    system: systemPrompt,
    temperature: 0.85,
    maxOutputTokens: 4000,
    prompt: userPrompt,
  })

  return result.toTextStreamResponse()
}
