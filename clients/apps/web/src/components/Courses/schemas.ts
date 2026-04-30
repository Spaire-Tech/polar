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
// (layout, colors, typography) — every string below comes from the model so
// section labels, headings, and copy can all be tailored to the course.
export const landingSchema = z.object({
  // ── Hero ────────────────────────────────────────────────────────────────
  eyebrow: z.string(), // e.g. "SPAIRE ORIGINAL"
  series_label: z.string(), // e.g. "NEW SERIES" / "MASTERCLASS" / "INTENSIVE"
  tagline: z.string(), // hero subtitle, no period
  description: z.string(), // longer paragraph, body copy
  level: z.string(), // "All levels" / "Beginner" / "Intermediate" / "Advanced"

  // ── Value strip ─────────────────────────────────────────────────────────
  value_props_label: z.string(), // section eyebrow, e.g. "WHAT'S INCLUDED"
  value_props: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
      }),
    )
    .min(3)
    .max(4),

  // ── Curriculum timeline ─────────────────────────────────────────────────
  curriculum_label: z.string(), // e.g. "CURRICULUM"
  curriculum_heading: z.string(), // e.g. "Six chapters, built to compound."
  curriculum_subheading: z.string(),

  // ── Full lesson list ────────────────────────────────────────────────────
  lessons_label: z.string(), // e.g. "EVERY LESSON"
  lessons_heading: z.string(), // e.g. "The full arc."
  lessons_subheading: z.string(),

  // ── Instructor block ────────────────────────────────────────────────────
  instructor_label: z.string(), // e.g. "YOUR INSTRUCTOR"
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

  // ── Reviews ─────────────────────────────────────────────────────────────
  reviews_label: z.string(), // e.g. "FROM STUDENTS"
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

  // ── Final CTA ───────────────────────────────────────────────────────────
  final_cta_label: z.string(), // e.g. "READY WHEN YOU ARE"
  final_cta_title: z.string(), // 1–2 line headline (use \n to break)
  final_cta_subtitle: z.string(),
  final_cta_primary: z.string(), // primary button label, e.g. "Enroll"
  final_cta_secondary: z.string(), // secondary button label
})

export type CourseLanding = z.infer<typeof landingSchema>
