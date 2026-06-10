'use client'

// CatalogLessonCardEmbed — renders the EXISTING customer-portal lesson card
// (the "Catalog" style: thumbnail on top, title + details below) with sample
// content, so the lesson-card picker can iframe it as the live "Catalog"
// preview. Mirrors how CoverHeroEmbed surfaces the existing hero.

import { LessonCard } from '@/app/(main)/[organization]/portal/courses/[courseId]/CoursePortalView'
import type { CustomerLessonRead } from '@/hooks/queries/courses'

const IMAGE =
  'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=1920&q=80&auto=format&fit=crop'

const sampleLesson: CustomerLessonRead = {
  id: 'catalog-lesson-9',
  title: 'Constructing the Point',
  content_type: 'video',
  content: null,
  position: 8,
  duration_seconds: 1380,
  is_free_preview: false,
  mux_playback_id: null,
  mux_status: null,
  thumbnail_url: IMAGE,
  thumbnail_object_position: null,
  completed: false,
  description:
    'Patterns, angles, and patience. How Jack builds a winning point and the high-percentage tennis behind it.',
  locked: false,
  locked_until: null,
}

export function CatalogLessonCardEmbed() {
  return (
    <div style={{ width: 340 }}>
      <LessonCard
        lesson={sampleLesson}
        globalIndex={9}
        hue={25}
        isInProgress={false}
        fallbackThumbnailUrl={IMAGE}
        fallbackObjectPosition={null}
        onSelect={() => {}}
      />
    </div>
  )
}

export default CatalogLessonCardEmbed
