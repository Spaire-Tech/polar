// Shared editorial stylebook for the AI landing-page generator and the
// per-field rewrite endpoint. Both routes import from here so a creator
// who clicks "✨ Rewrite" doesn't drop out of the same voice scaffolding
// that produced the original page.
//
// Design notes:
// - Positive constraints over negative ones. Banning specific clichés just
//   pushes the model into the next tier of clichés. Requiring a proper
//   noun / number / concrete object per long-form field is what produces
//   specificity.
// - The voice brief lives in the schema as a real field (`_brief`) so the
//   model emits it FIRST and conditions the rest of the stream on its own
//   pre-written voice. That makes "think before you write" structural
//   instead of aspirational.
// - Cardinality is normalized post-stream because Zod min/max stalls
//   `useObject` on partial JSON. The shape is enforced in the prompt and
//   then padded/sliced once the stream completes.

export const SHARED_STYLEBOOK = `
EDITORIAL CONTRACT — applies to every string you emit.

Voice
- Editorial, declarative, quiet. No exclamation points. No emojis. No markdown.
  No italics, em-dash-as-italics, or quote marks around strings. Plain text only.
- The UI handles all styling. You write words, not formatting.
- Pricing is rendered by the UI. NEVER emit a currency symbol or a price number
  anywhere, including paywall fields and FAQ answers.

Specificity (this is the rule that matters most)
- Every long-form field (description, value_prop.description, learn_item.description,
  faq answer, instructor_pull_quote, created_by_quote, created_by_bio, review.text)
  must contain at least one of: a proper noun from the brief, a specific number,
  or a concrete physical object/place/ritual named in the bio or the brief's
  textures. If you can't ground it, write a shorter sentence — don't pad with
  abstractions.
- Use the brief's "use_lexicon" words across the page so the voice is consistent
  across sections. Avoid every word in the brief's "avoid_lexicon".
- One concrete detail beats five abstractions. If you wrote a sentence that
  would still make sense for a different subject, rewrite it.

Cadence
- Vary sentence length within a paragraph. No three consecutive sentences that
  start with the same pronoun ("you", "she", "we", "the").
- No hedging ("maybe", "kind of", "might", "perhaps", "a bit").
- No filler intensifiers ("really", "very", "truly", "genuinely").

Cardinality (enforced by the renderer — do not violate)
- sections: exactly 4 entries for a course, exactly 0 for a series.
- learn_items: exactly 6 entries.
- faq_items: exactly 7 entries.
- final_cta_guarantees: exactly 4 short strings (1-3 words each).
- value_props: exactly 4 entries.
- reviews: ALWAYS return an empty array []. The creator adds their own.
`.trim()

// Compact cadence demos across multiple subjects. Rotated so the model
// doesn't pattern-match to a single persona. Each demo shows only the
// cadence — never full templates.
const CADENCE_DEMOS: { subject: string; lines: string[] }[] = [
  {
    subject: 'persuasive writing',
    lines: [
      'Tagline shape: "Build arguments that move people."',
      'Description shape: "A working novelist and former litigator on the structures, sentences, and habits behind writing that changes minds."',
      'Outcome shape: "Write a first sentence people can\'t put down."',
      'FAQ-answer shape: "Three real writing projects with feedback. Submit at your own pace. Lifetime access, on any device, with captions."',
    ],
  },
  {
    subject: 'cooking',
    lines: [
      'Tagline shape: "Eight weeks at the back of the restaurant."',
      'Description shape: "A line cook from a Roman trattoria walks through the four pasta shapes she rolls every Tuesday — the dough by feel, the cuts by eye."',
      'Outcome shape: "Roll cavatelli without weighing the flour."',
      'FAQ-answer shape: "Each lesson runs eleven to fourteen minutes. You can finish a section between dinner and bed."',
    ],
  },
  {
    subject: 'indie software',
    lines: [
      'Tagline shape: "Ship the thing you keep almost building."',
      'Description shape: "A solo founder takes you through the six decisions that shape a small SaaS — pricing, billing, onboarding, support, retention, the part you actually want to build."',
      'Outcome shape: "Wire Stripe, webhooks, and a refund flow that doesn\'t need babysitting."',
      'FAQ-answer shape: "Code samples ship in TypeScript with a Next.js example app. Port it to Remix or Svelte in an afternoon."',
    ],
  },
  {
    subject: 'documentary series',
    lines: [
      'Tagline shape: "What pressure does to you, and what you do back."',
      'Description shape: "A two-time Olympic 400m runner on the seven days before a final — the food, the calls home, the things she tells herself when the call room goes quiet. Six episodes, recorded the year after Paris."',
      'Watch-item shape: "The week before the final."',
      'FAQ-answer shape: "Six episodes, twenty-two minutes each. Watch in any order. Future episodes land in your library at no extra cost."',
    ],
  },
]

// Pick a 2-demo subset by keyword overlap with the course/series subject so
// the model sees cadence in a register that's at least adjacent to the
// subject — not always "writing teacher Lena".
export function pickCadenceDemos(
  title: string,
  description: string,
  bio: string,
  format: 'course' | 'series',
): string {
  const haystack = `${title} ${description} ${bio}`.toLowerCase()
  const scored = CADENCE_DEMOS.map((d) => {
    let score = 0
    if (haystack.includes(d.subject.split(' ')[0])) score += 3
    for (const word of d.subject.split(' ')) {
      if (haystack.includes(word)) score += 1
    }
    if (format === 'series' && d.subject === 'documentary series') score += 5
    return { ...d, score }
  })
  scored.sort((a, b) => b.score - a.score)
  const picks = scored.slice(0, 2)
  return picks
    .map(
      (d) =>
        `CADENCE — ${d.subject} (study the rhythm, never copy the words):\n${d.lines
          .map((l) => `  - ${l}`)
          .join('\n')}`,
    )
    .join('\n\n')
}

// ── Cardinality normalization ────────────────────────────────────────────
//
// The streaming schema can't enforce min/max because partial JSON would
// stall useObject. So we normalize post-stream before we persist the
// landing payload. This is what guarantees the renderer always gets the
// shape it expects (4 sections, 6 learn_items, 7 faq_items, 4 guarantees,
// 4 value_props).

const PLACEHOLDER_SECTION = { title: 'Module' }
const PLACEHOLDER_VALUE_PROP = { title: '', description: '' }
const PLACEHOLDER_LEARN = { title: '', description: '' }
const PLACEHOLDER_FAQ = { question: '', answer: '' }

function clampArray<T>(arr: unknown, n: number, filler: T): T[] {
  const list = Array.isArray(arr) ? (arr as T[]) : []
  if (list.length === n) return list
  if (list.length > n) return list.slice(0, n)
  return [...list, ...Array.from({ length: n - list.length }, () => filler)]
}

export function normalizeLandingCardinality(
  landing: Record<string, unknown> | null | undefined,
  format: 'course' | 'series',
): Record<string, unknown> {
  if (!landing || typeof landing !== 'object') return {}
  const out: Record<string, unknown> = { ...landing }

  out.value_props = clampArray(out.value_props, 4, { ...PLACEHOLDER_VALUE_PROP })
  out.learn_items = clampArray(out.learn_items, 6, { ...PLACEHOLDER_LEARN })
  out.faq_items = clampArray(out.faq_items, 7, { ...PLACEHOLDER_FAQ })

  const guarantees = Array.isArray(out.final_cta_guarantees)
    ? (out.final_cta_guarantees as string[])
    : []
  out.final_cta_guarantees =
    guarantees.length >= 4
      ? guarantees.slice(0, 4)
      : [...guarantees, ...Array.from({ length: 4 - guarantees.length }, () => '')]

  if (format === 'series') {
    out.sections = []
    out.sections_label = ''
    out.sections_heading = ''
    out.sections_subheading = ''
  } else {
    out.sections = clampArray(out.sections, 4, { ...PLACEHOLDER_SECTION })
  }

  // Reviews always normalized to empty — never ship fabricated testimonials.
  out.reviews = []

  return out
}
