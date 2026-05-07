import { z } from 'zod'

// Streaming schema for the coaching onboarding AI step. The shape mirrors
// `CoachingLandingData` (minus the runtime-only fields the AI cannot generate
// — heroMediaUrl/heroMediaType, clientsAvatars, coreEvolution.mediaUrl /
// .mediaType, atlas.slides, nav.brand. Those are filled in client-side after
// streaming finishes; the brand is taken from the program title).
//
// Array fields are intentionally unbounded — `useObject` only resolves once
// Zod validates each streamed JSON partial, so strict cardinality on a
// streaming partial commonly stalls it. Cardinality is enforced in the prompt
// instead. We also keep nested fields liberally optional so partial-stream
// chunks parse cleanly.
const titlePartSchema = z.object({
  text: z.string(),
  italic: z.boolean().optional(),
})

const statSchema = z.object({
  label: z.string(),
  value: z.string(),
  barPercent: z.number(),
})

const metaSchema = z.object({
  label: z.string(),
  value: z.string(),
})

const sectionSchema = z.object({
  label: z.string(),
  body: z.string(),
})

const testimonialSchema = z.object({
  quote: z.string(),
  author: z.string(),
  authorSub: z.string(),
})

const faqItemSchema = z.object({
  q: z.string(),
  a: z.string(),
})

const lessonSchema = z.object({
  type: z.enum(['doc', 'video']),
  title: z.string(),
})

const moduleSchema = z.object({
  title: z.string(),
  lessons: z.array(lessonSchema),
})

const heroSchema = z.object({
  titleParts: z.array(titlePartSchema),
  subtitle: z.string(),
  ctaPrimary: z.string(),
  ctaSecondary: z.string(),
  clientsPillText: z.string(),
})

const coreEvolutionSchema = z.object({
  heading: z.string(),
  description: z.string(),
  resultsHeading: z.string(),
  stats: z.array(statSchema),
  cta: z.string(),
  caption: z.string(),
})

const coursesSchema = z.object({
  heading: z.string(),
  lede: z.string(),
})

const atlasSchema = z.object({
  eyebrow: z.string(),
  title: z.string(),
  meta: z.array(metaSchema),
  orderCta: z.string(),
  sections: z.array(sectionSchema),
  testimonial: testimonialSchema,
})

const faqSchema = z.object({
  heading: z.string(),
  lede: z.string(),
  cta: z.string(),
  items: z.array(faqItemSchema),
})

const landingSchema = z.object({
  hero: heroSchema,
  coreEvolution: coreEvolutionSchema,
  courses: coursesSchema,
  atlas: atlasSchema,
  faq: faqSchema,
})

export const coachingOutlineSchema = z.object({
  modules: z.array(moduleSchema),
  landing: landingSchema,
  intakeQuestions: z.array(z.string()),
  sessionIdeas: z.array(z.string()),
  // Optional clarifying questions the AI may ask before finalising. Rendered
  // as an inline panel above the generation cards. If empty / omitted, no
  // panel appears.
  clarifyingQuestions: z.array(z.string()).optional(),
})

export type CoachingOutline = z.infer<typeof coachingOutlineSchema>
export type CoachingOutlineLanding = z.infer<typeof landingSchema>
export type CoachingOutlineModule = z.infer<typeof moduleSchema>
