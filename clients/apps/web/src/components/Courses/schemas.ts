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

// The full landing page is AI-generated. The UI only renders structure
// (layout, colors, typography) — every string below comes from the model.
//
// IMPORTANT: array fields are NOT bounded with min/max here on purpose. The
// `useObject` hook only fires onFinish once Zod validates the streamed JSON;
// strict cardinality on a streaming partial commonly stalls it. Cardinality
// is enforced in the prompt instead.
export const landingSchema = z.object({
  // Hero
  eyebrow: z.string(),
  series_label: z.string(),
  tagline: z.string(),
  description: z.string(),
  level: z.string(),

  // Value strip
  value_props_label: z.string(),
  value_props: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
    }),
  ),

  // Trailer
  trailer_label: z.string().optional(),
  trailer_heading: z.string().optional(),

  // Curriculum
  curriculum_label: z.string(),
  curriculum_heading: z.string(),
  curriculum_subheading: z.string(),

  // Full lesson list
  lessons_label: z.string(),
  lessons_heading: z.string(),
  lessons_subheading: z.string(),

  // Instructor
  instructor_label: z.string(),
  instructor_pull_quote: z.string(),
  instructor_credentials: z.array(
    z.object({
      number: z.string(),
      label: z.string(),
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

export type CourseLanding = z.infer<typeof landingSchema>
