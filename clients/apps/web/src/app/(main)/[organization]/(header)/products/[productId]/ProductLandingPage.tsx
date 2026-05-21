'use client'

// Public product page wrapper — for course products, fetches the public
// course landing data and renders the v2 landing view in preview mode. For
// non-course products falls back to the regular ProductDetailPage.

import { EditableCourseLandingView } from '@/components/Courses/editor/EditableCourseLandingView'
import {
  EditorProvider,
  mergeOverrides,
} from '@/components/Courses/editor/EditorContext'
import type {
  CourseLandingPageData,
  CourseLessonRead,
  CourseRead,
  LandingMedia,
} from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'
import { useEffect, useState } from 'react'
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
  // Distinguish "no course for this product" (404 → fall back to the
  // generic product page) from "the API is unhappy" (5xx / network →
  // surface a real error so the customer doesn't silently get the
  // wrong UI and click Buy without seeing the course landing).
  const [serverError, setServerError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setServerError(false)
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/customer-portal/courses/by-product/${product.id}/landing`,
      { credentials: 'include', cache: 'no-store' },
    )
      .then(async (r) => {
        if (cancelled) return null
        if (r.status === 404 || r.status === 403) return null
        if (!r.ok) {
          setServerError(true)
          return null
        }
        return (await r.json()) as CourseLandingPageData
      })
      .then((data) => {
        if (cancelled) return
        if (data) {
          // eslint-disable-next-line no-console
          console.info('[ProductLandingPage] /landing ← ok', {
            paywall_enabled: data.paywall_enabled,
            paywall_position: data.paywall_position,
            lesson_count: data.lessons?.length,
            lessons: data.lessons?.map((l, i) => ({
              i,
              id: l.id,
              title: l.title,
              is_free_preview: l.is_free_preview,
              locked: (l as { locked?: boolean }).locked,
              has_thumbnail: !!l.thumbnail_url,
              has_description: !!l.description,
              has_mux_playback_id: !!l.mux_playback_id,
            })),
          })
        }
        setLanding(data)
        setResolved(true)
      })
      .catch(() => {
        if (cancelled) return
        setServerError(true)
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

  if (serverError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-base font-medium text-gray-900">
          Couldn't load this course right now
        </p>
        <p className="max-w-sm text-sm text-gray-500">
          Please refresh the page in a moment. If the problem persists,
          contact support.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Try again
        </button>
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
    module_id: l.module_id ?? 'public',
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

  // Trust the backend's paywall settings rather than reverse-engineering
  // them from is_free_preview flags. Falls back to inference only when the
  // backend doesn't report paywall_enabled (older landing payload).
  const inferredPaywallPosition = flatLessons.findIndex(
    (l) => !l.is_free_preview,
  )
  const paywallEnabled =
    landing.paywall_enabled ??
    (inferredPaywallPosition >= 0)
  const paywallPosition =
    landing.paywall_position ??
    (inferredPaywallPosition >= 0 ? inferredPaywallPosition : null)
  // Modules for the Sections roadmap. Prefer the explicit `landing.modules`
  // payload when the backend returns it; otherwise fall back to deriving a
  // module list from the lessons' module_id (in the order each module first
  // appears) so the Sections block still renders even if the API response
  // didn't include the modules field.
  type PublicModule = { id: string; title: string; position: number }
  const explicit = (landing.modules ?? []).map<PublicModule>((m) => ({
    id: m.id,
    title: m.title,
    position: m.position,
  }))
  let modulesPublic: PublicModule[] = explicit
  if (modulesPublic.length === 0) {
    const seen = new Set<string>()
    modulesPublic = []
    for (const l of landing.lessons) {
      const mid = l.module_id
      if (!mid || mid === 'public' || seen.has(mid)) continue
      seen.add(mid)
      modulesPublic.push({
        id: mid,
        title: `Section ${modulesPublic.length + 1}`,
        position: modulesPublic.length,
      })
    }
  }

  const fakeCourse: CourseRead = {
    id: landing.id,
    product_id: product.id,
    organization_id: organization.id,
    title: landing.title ?? product.name,
    slug: null,
    course_type: landing.course_type,
    format:
      ((landing as { format?: string }).format as 'course' | 'series') ??
      'course',
    sample:
      (landing as { sample?: CourseRead['sample'] }).sample ?? null,
    paywall_enabled: paywallEnabled,
    paywall_lesson_id: null,
    paywall_position: paywallPosition,
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
    // Public modules carry id + title + position only — that's all the
    // Sections roadmap needs. Lessons are intentionally empty here because
    // the public page reads them from `flatLessons` instead.
    modules: modulesPublic.map((m) => ({
      id: m.id,
      course_id: landing.id,
      title: m.title,
      description: null,
      position: m.position,
      status: 'published',
      release_at: null,
      drip_days: null,
      lessons: [],
      created_at: '',
      modified_at: null,
    })),
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
        organizationAvatarUrl={organization.avatar_url}
        flatLessons={flatLessons}
        product={product as unknown as schemas['Product']}
      />
    </EditorProvider>
  )
}
