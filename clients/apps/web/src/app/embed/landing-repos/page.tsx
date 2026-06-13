'use client'

// Focused harness for item 6 part 2: the landing-customize lesson tile's
// "Reposition" pill must open the RepositionInPortal overlay, which now
// previews the portal HERO (the now-playing marquee), so the focal point is
// set against the surface students actually see. Renders
// EditableCourseLandingView in edit mode with real lessonHandlers and a
// lesson that already has a thumbnail.

import { EditableCourseLandingView } from '@/components/Courses/editor/EditableCourseLandingView'
import { EditorProvider } from '@/components/Courses/editor/EditorContext'
import type { CourseLessonRead, CourseRead } from '@/hooks/queries/courses'
import { useEffect, useState } from 'react'

const NOW = '2026-06-12T00:00:00Z'

// A tiny solid-colour PNG (1×1, teal) as a data URL so the tile has a real
// thumbnail_url to reposition without any network.
const THUMB =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const lesson = (
  id: string,
  position: number,
  title: string,
  description: string,
  withThumb: boolean,
): CourseLessonRead =>
  ({
    id,
    module_id: 'm1',
    title,
    content_type: 'video',
    content: null,
    video_asset_id: null,
    duration_seconds: 540,
    position,
    is_free_preview: position < 2,
    published: true,
    mux_upload_id: null,
    mux_asset_id: null,
    mux_playback_id: null,
    mux_status: null,
    thumbnail_url: withThumb ? THUMB : null,
    thumbnail_object_position: '50% 50%',
    description,
    release_at: null,
    drip_days: null,
    comments_mode: 'visible',
    created_at: NOW,
    modified_at: null,
  }) as unknown as CourseLessonRead

export default function LandingReposHarness() {
  const [variant, setVariant] = useState<'spotlight' | 'catalog'>('spotlight')
  useEffect(() => {
    const card = new URLSearchParams(window.location.search).get('card')
    setVariant(card === 'catalog' ? 'catalog' : 'spotlight')
  }, [])

  const lessons = [
    lesson('l1', 0, 'Flour & Gluten', 'Why your bread is dense. Protein and crumb.', true),
    lesson('l2', 1, 'Fats At Work', 'Butter versus oil — how fat rewrites texture.', true),
  ]

  const course = {
    id: 'c-mock',
    product_id: 'p-mock',
    organization_id: 'o-mock',
    title: 'The Science of Baking',
    slug: 'science-of-baking',
    course_type: 'evergreen',
    format: 'course',
    paywall_enabled: false,
    paywall_lesson_id: null,
    paywall_position: null,
    ai_generated: false,
    hero_variant: 'cover',
    lesson_card_variant: variant,
    trial_mode: 'free_preview',
    description: 'Master the chemistry behind every bake.',
    thumbnail_url: THUMB,
    thumbnail_object_position: '50% 50%',
    instructor_name: 'Carla Marín',
    instructor_bio: null,
    trailer_url: null,
    instructor_name_italic: true,
    instructor_name_bold: true,
    instructor_name_uppercase: true,
    landing_overrides: null,
    sample: null,
    modules: [
      {
        id: 'm1',
        course_id: 'c-mock',
        title: 'Fundamentals',
        description: null,
        position: 0,
        status: 'published',
        release_at: null,
        drip_days: null,
        lessons,
        created_at: NOW,
        modified_at: null,
      },
    ],
    created_at: NOW,
    modified_at: null,
  } as unknown as CourseRead

  const lessonHandlers = {
    updateLesson: async () => undefined,
    uploadThumbnail: async () => undefined,
    uploadVideo: async () => undefined,
  }

  return (
    <div style={{ height: '100vh', overflow: 'auto', background: '#fff' }}>
      <EditorProvider
        initialOverrides={null}
        onChange={() => undefined}
        uploadMedia={async () => ({ kind: 'image', url: THUMB })}
        initialMode="edit"
      >
        <EditableCourseLandingView
          course={course}
          organizationName="Spaire"
          organizationSlug="spairehq"
          flatLessons={lessons}
          lessonHandlers={lessonHandlers}
        />
      </EditorProvider>
    </div>
  )
}
