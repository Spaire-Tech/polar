'use server'

import { outlineSchema } from '@/components/Courses/schemas'
import { getAuthenticatedUser } from '@/utils/user'
import { anthropic } from '@ai-sdk/anthropic'
import { streamObject } from 'ai'

// ─────────────────────────────────────────────────────────────────────────────
// Spaire Original generation. Produces the STRUCTURE (modules/lessons) and all
// the WRITING that the course page renders: each lesson's description + the
// hero block (eyebrow, badge, hero description, instructor credential, title
// break). The field contracts below are derived directly from the course-page
// designs — lengths and registers are not decorative, they're what the layout
// slots can hold.
//
// The cardinal rule for the hero description: the creator's typed description
// is SOURCE MATERIAL, never the output. We synthesise a fresh 1–2 sentence
// hero line from who the instructor is and what the subject is — and we ignore
// the length of their input entirely. A page-long brief becomes one clean line.
// ─────────────────────────────────────────────────────────────────────────────

const SHARED_HERO_RULES = `THE HERO BLOCK — written from the inputs, for the top of the page:
- "eyebrow": "<Format> · <Subject>" — e.g. "Documentary Series · Golf", "Course · Persuasive Writing". ≤ 5 words, title case, no period.
- "badge": a short shelf label — Series: "New Series" / "Limited Series" / "Documentary" / "Original Series"; Course: "New Course" / "Masterclass". ≤ 3 words, no period.
- "description": THE most important field. 1–2 sentences, 120–220 characters, that introduce this Original. Lead with WHO the instructor is in one specific phrase, then what the work is. Ground it in their bio (a real credential, place, or number) and the subject. This is NOT the creator's description — if their input is a page long, ignore its length and distil the essence into one cinematic line. Never paste their words. No exclamation points, no clichés ("level up", "unlock", "take your X to the next level").
- "byline": the instructor's credibility in ONE sentence ≤ 90 chars, drawn from the bio (e.g. "Two-time major champion and former world No. 1."). Do NOT prefix with "with" or "— with"; the page adds that.
- "titleLines": the creator's title, VERBATIM, split into 1–2 array entries for a two-line display. Choose a natural break (["The Golfer's", "Blueprint"]); if it's short, return one entry. Do not reword the title.`

const courseSystemPrompt = `You are the lead instructional designer AND editorial writer for Spaire — a premium creator platform whose course pages read like a streaming service, not a Udemy listing. You produce the full structure and copy for ONE course.

STRUCTURE
- Create EXACTLY 4 modules — no more, no fewer. The outline page renders a four-stop timeline; four chapters, a complete arc from first principles to mastery.
- Each module: a "kicker" (a 1–2 word chapter label naming its role in the arc — "Foundations", "The Engine", "Scoring", "The Mind") and a clear 1–3 word "title" ("The Setup", "The Full Swing", "The Short Game"). Kicker and title must not repeat each other.
- Each module: 3–6 focused lessons. NEVER more than 6 per module — cut or merge before exceeding it.
- "arc": one clause completing the sentence "Four modules, shaped from your answers — {arc}." It MUST name the actual journey of THIS course in its own vocabulary (e.g. for golf: "a clear arc from setup to the shots that decide a round"). Lowercase start, ≤ 90 chars, no period. Never generic ("a journey from beginner to expert").
- Lesson "title": specific and concrete, 2–4 words, works on one line ("Grip & Setup", "Pre-Shot Routine"). Not vague ("Setup"), not a sentence.
- Lesson "description": the instructional register — a fragment, then one sentence. 80–130 characters. Name the concrete skill, move, or mistake. Example shape (do NOT copy the words): "Where every swing begins. The neutral grip, pressure points, and a setup you can repeat under pressure." Every description must be specific to THIS lesson; no two interchangeable.
- "content_type": "video" for demonstrations/walkthroughs (the default), "text" for conceptual or reference lessons.
- Start foundational, progress to application. Tailor depth and examples to the instructor's bio and subject.
- Paywall on: front-load the opening lessons so the free preview earns the purchase. Free: pace evenly, every lesson is core.

${SHARED_HERO_RULES}

Voice: confident, concrete, no marketing fluff. Names of things over abstractions. Return the JSON now and stop.`

// Episodic Originals are stored as a Course with format='series' and a single
// implicit module holding every episode; the UI relabels lessons → episodes.
const seriesSystemPrompt = `You are a story editor AND writer for a premium Spaire Original series — closer to a documentary producer than a course designer. You shape a season the creator can record into the camera, and you write the copy a streaming detail page would carry.

STRUCTURE
- "arc": one clause completing "Six episodes, in order — {arc}", naming THIS season's actual journey in its own vocabulary (e.g. for golf: "a season that builds from the first swing to the round that counts"). Lowercase start, ≤ 90 chars, no period, never generic.
- Return EXACTLY ONE module (the season). Its "kicker" is "Season"; its "title" is the season tagline (2–6 words, editorial, NOT "Module 1"); its "description" is one sentence framing the arc.
- Inside it, return EXACTLY 6 "lessons" — the episodes; the outline page renders a six-card grid. Self-contained, no "Episode 1 → 2" dependency, no homework, no quizzes. Let the opening episode plant a thread the final episode pays off.
- Episode "title": a story title, 2–4 words, evocative and concrete — a moment, place, or stakes ("The Wager", "Eighteen Inches", "Sand"). Never the "How to X" / "5 ways to Y" cadence.
- Episode "description": the narrative register — 1–2 sentences that set a SCENE. Name a place, a moment, a person, the stakes. Example shape (do NOT copy the words): "Pebble Beach, dawn. Jack bets a stranger he can fix any swing in one round — and explains why he always wins." Frame around watching ("Inside…", "A walk through…"), never "you'll learn".
- "content_type": "video" by default; "text" only for a genuinely written piece (a letter, a journal entry).
- No exclamation points. No clichés ("mindset shift", "unlock", "level up"). No instructional verbs ("learn to", "master").
- Tailor everything to the creator's bio: name the sport, the rituals, the opponents, the rounds, the decisions. Series live or die by specificity.
- Paywall on: the first 2–3 episodes must hook on their own — open with the most magnetic, story-driven ones.

${SHARED_HERO_RULES}

Return the JSON now and stop.`

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
    // Onboarding choices — each shapes the generation; the wizard passes them.
    trialMode,
    heroVariant,
    lessonCardVariant,
    billingType,
    priceLabel,
  } = await req.json()

  if (!title) {
    return new Response('Title is required', { status: 400 })
  }

  const isSeries = format === 'series'
  const systemPrompt = isSeries ? seriesSystemPrompt : courseSystemPrompt
  const unit = isSeries ? 'episode' : 'lesson'

  const lines = [
    `Title (use verbatim): ${title}`,
    // The creator's description is SOURCE MATERIAL for the hero + grounding —
    // never to be echoed verbatim. Flagged as such so the model distils it.
    description
      ? `Creator's brief (SOURCE MATERIAL — distil, never echo verbatim): ${description}`
      : null,
    targetAudience ? `Audience: ${targetAudience}` : null,
    differentiator
      ? `What makes it different: ${differentiator}`
      : null,
    instructorName ? `Instructor name (use verbatim): ${instructorName}` : null,
    instructorBio
      ? `Instructor bio (ground the hero description + byline in this): ${instructorBio}`
      : `Instructor bio: (none provided — keep the hero description about the work, not invented credentials)`,
    `Structure: ${
      isSeries
        ? 'episodic — one season of self-contained episodes'
        : 'modules — themed chapters'
    }`,
    typeof paywallEnabled === 'boolean'
      ? `Paywall: ${paywallEnabled ? 'enabled' : isSeries ? 'disabled (free series)' : 'disabled (free course)'}`
      : null,
    paywallEnabled &&
    trialMode === 'free_preview' &&
    typeof freePreviewLessons === 'number'
      ? `Trial: free preview — the first ${freePreviewLessons} ${unit}${freePreviewLessons === 1 ? '' : 's'} play in full. Front-load a complete, satisfying opening arc, and make ${unit} ${freePreviewLessons + 1} open the paid arc with a strong hook.`
      : null,
    paywallEnabled && trialMode === 'lesson_sample'
      ? `Trial: lesson sample — prospects see only a short clip from one ${unit}. Design at least one mid-${isSeries ? 'season' : 'course'} ${unit} as a strong standalone showcase to clip from.`
      : null,
    billingType
      ? `Billing: ${billingType === 'subscription' ? `subscription${priceLabel ? ` (${priceLabel})` : ''}` : `one-time purchase${priceLabel ? ` (${priceLabel})` : ''}`}`
      : null,
    heroVariant
      ? `Hero layout: ${
          heroVariant === 'marquee'
            ? 'Marquee — cinematic full-bleed; the title reads like a show name, keep it evocative'
            : 'Cover — editorial; the title carries explanatory weight and breaks across two lines'
        }`
      : null,
    lessonCardVariant
      ? `${isSeries ? 'Episode' : 'Lesson'} cards: ${
          lessonCardVariant === 'spotlight'
            ? `Spotlight — title sits OVER the image; keep each ${unit} title ≤ 4 words so it never wraps`
            : 'Catalog — title + 2-line description sit below the image; the description does real work here'
        }`
      : null,
  ].filter(Boolean)

  const intro = `${
    isSeries
      ? 'Shape the season and write every field for this Original:'
      : 'Build the course and write every field for this Original:'
  }\n${lines.join('\n')}\n\nOUTPUT ORDER & COMPLETENESS (critical):\n- Emit "arc" FIRST (one short clause), then the "modules" array fully populated, and the "hero" object LAST.\n- NEVER return an empty "modules" array. ${
    isSeries
      ? 'Always produce one season module containing EXACTLY 6 episodes.'
      : 'Always produce EXACTLY 4 modules, each with 3–6 lessons (never more than 6).'
  }\n- Every lesson/episode MUST have a non-empty "description"; every module a "kicker".\n\nReturn the JSON object now and stop. Do not add prose after the JSON.`

  const result = streamObject({
    model: anthropic('claude-opus-4-7'),
    schema: outlineSchema,
    system: systemPrompt,
    // Generous budget: a full outline (modules + lessons + per-item
    // descriptions + the hero block) can run long, and any truncation is a
    // SILENT 'length' finish that yields a partial/empty object with no error
    // thrown — exactly the "came back empty, backend says nothing" symptom.
    // 3200 was occasionally clipping the stream before the modules completed.
    maxOutputTokens: 16000,
    prompt: intro,
    onError: ({ error }) => {
      // eslint-disable-next-line no-console
      console.error('[outline] streamObject error:', error)
    },
    onFinish: ({ object, error, usage }) => {
      const moduleCount = object?.modules?.length ?? 0
      const lessonCount =
        object?.modules?.reduce(
          (acc, m) => acc + (m.lessons?.length ?? 0),
          0,
        ) ?? 0
      // Always log the outcome so an empty/partial generation is never silent.
      // eslint-disable-next-line no-console
      console[moduleCount === 0 ? 'error' : 'log'](
        '[outline] finished:',
        JSON.stringify({
          format: isSeries ? 'series' : 'course',
          moduleCount,
          lessonCount,
          validationFailed: !!error,
          usage,
        }),
      )
    },
  })

  return result.toTextStreamResponse()
}
