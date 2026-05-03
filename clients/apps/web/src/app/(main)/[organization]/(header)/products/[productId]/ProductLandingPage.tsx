'use client'

// Public product page wrapper — for course products, fetches the public
// course landing data and renders the v2 landing view in preview mode. For
// non-course products falls back to the regular ProductDetailPage.

import type {
  CourseLandingPageData,
  CourseLessonRead,
  CourseRead,
} from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'
import { useEffect, useState } from 'react'
import { EditableCourseLandingView } from '@/components/Courses/editor/EditableCourseLandingView'
import {
  EditorProvider,
  mergeOverrides,
} from '@/components/Courses/editor/EditorContext'
import type { LandingMedia } from '@/hooks/queries/courses'
import { ProductDetailPage } from './ProductDetailPage'

export function ProductLandingPage({
  organization,
  product,
  otherProducts,
}: {
  organization: schemas['Organization']
  product: schemas['ProductStorefront']
  otherProducts: schemas['ProductStorefront'][]
}) {
  const [landing, setLanding] = useState<CourseLandingPageData | null>(null)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/customer-portal/courses/by-product/${product.id}/landing`,
      { credentials: 'include' },
    )
      .then(async (r) => {
        if (!r.ok) return null
        return (await r.json()) as CourseLandingPageData
      })
      .then((data) => {
        if (cancelled) return
        setLanding(data)
        setResolved(true)
      })
      .catch(() => {
        if (cancelled) return
        setResolved(true)
      })
    return () => {
      cancelled = true
    }
  }, [product.id])

  if (!resolved) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-32 animate-pulse rounded-full bg-gray-100" />
      </div>
    )
  }

  if (landing) {
    return (
      <CourseLandingShell
        organization={organization}
        product={product}
        landing={landing}
      />
    )
  }

  return (
    <ProductDetailPage
      organization={organization}
      product={product}
      otherProducts={otherProducts}
    />
  )
}

function CourseLandingShell({
  organization,
  product,
  landing,
}: {
  organization: schemas['Organization']
  product: schemas['ProductStorefront']
  landing: CourseLandingPageData
}) {
  // Build a CourseRead-shaped object from landing data so the existing
  // EditableCourseLandingView (preview mode) can render it untouched.
  const flatLessons: CourseLessonRead[] = landing.lessons.map((l, i) => ({
    id: l.id,
    module_id: 'public',
    title: l.title,
    content_type: l.content_type,
    content: null,
    video_asset_id: null,
    duration_seconds: l.duration_seconds,
    position: l.position ?? i,
    is_free_preview: l.is_free_preview,
    published: true,
    mux_upload_id: null,
    mux_asset_id: null,
    mux_playback_id: l.mux_playback_id ?? null,
    mux_status: l.mux_status ?? null,
    thumbnail_url: l.thumbnail_url,
    thumbnail_object_position: null,
    description: l.description ?? null,
    created_at: '',
    modified_at: null,
  }))

  const paywallPosition = flatLessons.findIndex((l) => !l.is_free_preview)
  const fakeCourse: CourseRead = {
    id: landing.id,
    product_id: product.id,
    organization_id: organization.id,
    title: landing.title ?? product.name,
    slug: null,
    course_type: landing.course_type,
    paywall_enabled: paywallPosition >= 0,
    paywall_lesson_id: null,
    paywall_position: paywallPosition >= 0 ? paywallPosition : null,
    ai_generated: false,
    description: landing.description,
    thumbnail_url: landing.thumbnail_url,
    thumbnail_object_position: landing.thumbnail_object_position ?? null,
    instructor_name: landing.instructor_name ?? null,
    instructor_bio: landing.instructor_bio ?? null,
    trailer_url: landing.trailer_url ?? null,
    instructor_name_italic: landing.instructor_name_italic ?? false,
    instructor_name_bold: landing.instructor_name_bold ?? false,
    instructor_name_uppercase: landing.instructor_name_uppercase ?? false,
    landing_overrides:
      (landing as { landing_overrides?: CourseRead['landing_overrides'] })
        .landing_overrides ?? null,
    modules: [],
    created_at: '',
    modified_at: null,
  }

  const initialOverrides = mergeOverrides(fakeCourse.landing_overrides ?? null)
  if (fakeCourse.thumbnail_url && !initialOverrides.media['hero.backdrop']) {
    initialOverrides.media['hero.backdrop'] = {
      kind: 'image',
      url: fakeCourse.thumbnail_url,
    }
  }
  if (fakeCourse.trailer_url && !initialOverrides.media['hero.trailer']) {
    initialOverrides.media['hero.trailer'] = {
      kind: 'video',
      url: fakeCourse.trailer_url,
    }
  }

  const noopUpload = async (_file: File): Promise<LandingMedia> => {
    throw new Error('Uploads are disabled on the public landing page.')
  }

  return (
    <EditorProvider
      initialOverrides={initialOverrides}
      onChange={() => undefined}
      uploadMedia={noopUpload}
      initialMode="preview"
    >
      <EditableCourseLandingView
        course={fakeCourse}
        organizationName={organization.name}
        flatLessons={flatLessons}
        product={product as unknown as schemas['Product']}
      />
    </EditorProvider>
  )
}
