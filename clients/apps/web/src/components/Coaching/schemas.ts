import { z } from 'zod'

// Streaming schema for the coaching onboarding AI step. Mirrors the shape used
// by the prototype's SAMPLE_* constants. Array fields are intentionally
// unbounded — `useObject` only resolves once Zod validates the streamed JSON,
// so strict cardinality on a streaming partial commonly stalls it. Cardinality
// is enforced in the prompt instead.
export const coachingOutlineSchema = z.object({
  modules: z.array(
    z.object({
      title: z.string(),
      lessons: z.array(
        z.object({
          type: z.enum(['doc', 'video']),
          title: z.string(),
        }),
      ),
    }),
  ),
  landing: z.object({
    hero: z.string(),
    sub: z.string(),
    bullets: z.array(z.string()),
    faqs: z.array(
      z.object({
        q: z.string(),
        a: z.string(),
      }),
    ),
  }),
  intakeQuestions: z.array(z.string()),
  sessionIdeas: z.array(z.string()),
  // Optional clarifying questions the AI may ask before finalising. Rendered
  // as an inline panel above the generation cards. If empty / omitted, no
  // panel appears.
  clarifyingQuestions: z.array(z.string()).optional(),
})

export type CoachingOutline = z.infer<typeof coachingOutlineSchema>
