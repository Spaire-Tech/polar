import { z } from 'zod'

export const outlineSchema = z.object({
  modules: z.array(
    z.object({
      title: z.string(),
      description: z.string().optional(),
      lessons: z.array(
        z.object({
          title: z.string(),
          content_type: z.enum(['text', 'video']),
        }),
      ),
    }),
  ),
})

export type CourseOutline = z.infer<typeof outlineSchema>

// Landing page content generated from full course/instructor context.
// Drives the cinematic course landing preview.
export const landingSchema = z.object({
  // Hero
  eyebrow: z.string(), // e.g. "SPAIRE ORIGINAL"
  series_label: z.string(), // e.g. "NEW SERIES" or "MASTERCLASS"
  tagline: z.string(), // short hero subtitle, one sentence
  description: z.string(), // longer paragraph for above-the-fold body
  level: z.string(), // "All levels" / "Beginner" / "Advanced"
  // Value props — what's included
  value_props: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
      }),
    )
    .min(3)
    .max(4),
  // Curriculum framing
  curriculum_heading: z.string(),
  curriculum_subheading: z.string(),
  // Instructor block
  instructor_pull_quote: z.string(),
  instructor_credentials: z
    .array(
      z.object({
        number: z.string(),
        label: z.string(),
      }),
    )
    .min(2)
    .max(3),
  // Reviews — synthetic; clearly framed in the UI as illustrative
  reviews: z
    .array(
      z.object({
        name: z.string(),
        role: z.string(),
        text: z.string(),
      }),
    )
    .min(2)
    .max(3),
  // Final CTA panel
  final_cta_label: z.string(),
  final_cta_title: z.string(),
  final_cta_subtitle: z.string(),
})

export type CourseLanding = z.infer<typeof landingSchema>
