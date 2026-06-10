'use client'

// CoverHeroEmbed — renders the EXISTING "Cover" hero (the boxed, editorial
// landing hero we already ship) in read-only preview mode, seeded with the
// same sample content as the Marquee clone so the two read as a fair pair in
// the hero picker. Mounted bare under /embed so the picker can iframe + scale
// it exactly like the design's live thumbnails.

import {
  EditableCourseLandingView,
  type EditableLandingProps,
} from '@/components/Courses/editor/EditableCourseLandingView'
import { EditorProvider } from '@/components/Courses/editor/EditorContext'
import type {
  CourseLessonRead,
  CourseRead,
  LandingOverrides,
} from '@/hooks/queries/courses'
import type { schemas } from '@spaire/client'

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=1920&q=80&auto=format&fit=crop'

const now = () => new Date().toISOString()

// 11 sample lessons (~3h42m total) so the hero meta line mirrors the Marquee
// sample ("11 Lessons · 3h 42m").
const sampleLessons: CourseLessonRead[] = Array.from({ length: 11 }).map(
  (_, i) => ({
    id: `cover-lesson-${i + 1}`,
    module_id: 'cover-module',
    title: `Lesson ${i + 1}`,
    content_type: 'video',
    content: null,
    video_asset_id: null,
    duration_seconds: 1200,
    position: i,
    is_free_preview: i < 3,
    published: true,
    mux_upload_id: null,
    mux_asset_id: null,
    mux_playback_id: null,
    mux_status: null,
    thumbnail_url: null,
    thumbnail_object_position: null,
    description: null,
    created_at: now(),
    modified_at: null,
  }),
)

const sampleCourse: CourseRead = {
  id: 'cover-course',
  product_id: 'cover-product',
  organization_id: 'cover-org',
  title: 'Championship Tennis',
  slug: null,
  course_type: 'evergreen',
  format: 'series',
  sample: null,
  paywall_enabled: true,
  paywall_lesson_id: null,
  paywall_position: 3,
  ai_generated: true,
  hero_variant: 'cover',
  lesson_card_variant: 'catalog',
  trial_mode: 'free_preview',
  description:
    'A two-time Grand Slam champion takes you inside the all-court game.',
  thumbnail_url: HERO_IMAGE,
  thumbnail_object_position: null,
  instructor_name: 'Carla Marín',
  instructor_bio: 'Former world No. 2 and two-time Grand Slam champion.',
  trailer_url: null,
  instructor_name_italic: false,
  instructor_name_bold: true,
  instructor_name_uppercase: true,
  landing_overrides: null,
  modules: [
    {
      id: 'cover-module',
      course_id: 'cover-course',
      title: 'The all-court game',
      description: null,
      position: 0,
      status: 'public',
      release_at: null,
      drip_days: null,
      lessons: sampleLessons,
      created_at: now(),
      modified_at: null,
    },
  ],
  created_at: now(),
  modified_at: null,
}

const sampleProduct = {
  prices: [
    {
      amount_type: 'fixed' as const,
      price_amount: 8900,
      price_currency: 'usd',
    },
  ],
} as unknown as schemas['Product']

// Seed the hero copy so it parallels the Marquee sample rather than the leaky
// generic defaults.
const initialOverrides: LandingOverrides = {
  text: {
    'hero.eyebrow': 'SPAIRE ORIGINAL',
    'hero.series_label': 'DOCUMENTARY SERIES',
    'hero.level': 'All levels',
    'hero.tagline':
      'The strokes, the footwork, and the mind that wins the points that matter.',
  },
  media: {
    'hero.backdrop': { kind: 'image', url: HERO_IMAGE },
  },
} as unknown as LandingOverrides

const props: EditableLandingProps = {
  course: sampleCourse,
  organizationName: 'Carla Marín',
  organizationSlug: 'carla-marin',
  organizationAvatarUrl: null,
  flatLessons: sampleLessons,
  product: sampleProduct,
}

export function CoverHeroEmbed() {
  return (
    <EditorProvider
      initialOverrides={initialOverrides}
      initialMode="preview"
      onChange={() => {}}
      uploadMedia={async () => ({ kind: 'image', url: '' })}
    >
      <EditableCourseLandingView {...props} />
    </EditorProvider>
  )
}

export default CoverHeroEmbed
