import { z } from 'zod'

// ── Landing (coaching-shaped public page copy) ───────────────────────────
//
// Same intent as the course landing schema (every visible string comes from
// the model, the UI handles layout) but the section shapes are different —
// coaching pages lead with a transformation promise, who-this-is-for, and
// by-the-end outcomes; week-by-week replaces lesson-list curriculum.

export const coachingLandingSchema = z.object({
  // Hero
  eyebrow: z.string(),
  series_label: z.string(),
  tagline: z.string(),
  description: z.string(),

  // Transformation (the big promise)
  transformation_label: z.string(),
  transformation: z.string(),

  // Who this is for + by-the-end
  audience_label: z.string(),
  audience_heading: z.string(),
  audience_items: z.array(z.string()),

  outcomes_label: z.string(),
  outcomes_heading: z.string(),
  outcomes_items: z.array(z.string()),

  // What's included
  whats_included_label: z.string(),
  whats_included: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
    }),
  ),

  // Week-by-week
  curriculum_label: z.string(),
  curriculum_heading: z.string(),
  curriculum_subheading: z.string(),

  // Coach
  coach_label: z.string(),
  coach_pull_quote: z.string(),
  coach_credentials: z.array(
    z.object({
      number: z.string(),
      label: z.string(),
    }),
  ),

  // Objections
  objections_label: z.string(),
  objections: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
    }),
  ),

  // Reviews
  reviews_label: z.string(),
  reviews: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      text: z.string(),
    }),
  ),

  // Final CTA
  final_cta_label: z.string(),
  final_cta_title: z.string(),
  final_cta_subtitle: z.string(),
  final_cta_primary: z.string(),
  final_cta_secondary: z.string(),
})

export type CoachingLanding = z.infer<typeof coachingLandingSchema>
