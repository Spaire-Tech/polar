'use client'

// Render-only harness for OutlineTab with a mock course, so the variant-
// aware lesson cards (Spotlight / Catalog) can be verified in a browser.
// ?variant=spotlight|catalog · ?paywall=1 adds a paywall split.

import { OutlineTab } from '@/components/Courses/editor/OutlineTab'
import type {
  CourseLessonRead,
  CourseRead,
} from '@/hooks/queries/courses'
import { useEffect, useState } from 'react'

const NOW = '2026-06-12T00:00:00Z'
const L = (
  id: string,
  position: number,
  title: string,
  description: string,
  opts: Partial<CourseLessonRead> = {},
): CourseLessonRead =>
  ({
    id,
    module_id: 'm1',
    title,
    description,
    content_type: 'video',
    content: null,
    position,
    is_free_preview: false,
    published: position < 2,
    duration_seconds: 300 + position * 120,
    thumbnail_url:
      position % 2 === 0
        ? 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=60&auto=format&fit=crop'
        : null,
    mux_playback_id: 'fake',
    mux_status: 'ready',
    created_at: NOW,
    modified_at: null,
    ...opts,
  }) as unknown as CourseLessonRead

export default function OutlineTabEmbed() {
  const [params, setParams] = useState<URLSearchParams | null>(null)
  useEffect(() => setParams(new URLSearchParams(window.location.search)), [])
  if (!params) return null
  const variant = params.get('variant') === 'spotlight' ? 'spotlight' : 'catalog'
  const paywall = params.get('paywall') === '1'

  const course = {
    id: 'c1',
    title: 'The Science of Baking',
    course_type: 'evergreen',
    format: 'course',
    lesson_card_variant: variant,
    paywall_enabled: paywall,
    paywall_position: paywall ? 2 : null,
    modules: [
      {
        id: 'm1',
        course_id: 'c1',
        title: 'The Ingredients',
        description: null,
        position: 0,
        status: 'published',
        release_at: null,
        drip_days: null,
        lessons: [
          L('l1', 0, 'Flour & Gluten', 'Why your bread is dense. Protein, hydration, and crumb.'),
          L('l2', 1, 'Fats At Work', 'Butter versus oil — how fat rewrites texture in every bake.'),
          L('l3', 2, 'Sugar Is Structure', 'Past sweetness: moisture, browning, spread.', { drip_days: 7 }),
          L('l4', 3, 'What Eggs Do', 'Binding, lifting, emulsifying — and the swaps that work.'),
        ],
        created_at: NOW,
        modified_at: null,
      },
    ],
    created_at: NOW,
    modified_at: null,
  } as unknown as CourseRead

  return (
    <div style={{ background: '#fafafa', minHeight: '100vh' }}>
      <OutlineTab
        course={course}
        selectedLessonId={null}
        onSelectLesson={() => undefined}
        onAddLesson={() => undefined}
        onUpdateLesson={() => undefined}
        onDeleteLesson={() => undefined}
        onReorderLessons={() => undefined}
      />
    </div>
  )
}
