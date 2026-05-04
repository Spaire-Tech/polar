'use client'

// WizardLandingEditor — onboarding step that previews the same v2 landing
// the dashboard customize tab shows. The shell mirrors CustomizeTab: no left
// rail, no right inspector, only a slim top bar with Back / Create course.
// All edits happen inline on the canvas.
//
// Because there's no course.id yet:
//   • media uploads are buffered into a Map<slotId, File> alongside an object
//     URL, so the canvas previews live but real S3 uploads are deferred.
//   • the hero backdrop is seeded from the thumbnail uploaded earlier in
//     onboarding (media.thumbFile) so the same image shows up here.
//   • clicking Create course hands the host (CourseWizard) the buffered
//     overrides + files; the host creates the course, uploads the files, and
//     patches landing_overrides.

import {
  CourseLessonRead,
  CourseRead,
  LandingMedia,
} from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  EditableCourseLandingView,
  type LessonHandlers,
} from './EditableCourseLandingView'
import {
  EditorProvider,
  mergeOverrides,
  type ResolvedOverrides,
} from './EditorContext'

// Per-lesson edit state collected during the wizard preview. Real lesson
// records don't exist yet (the course hasn't been created), so any edits the
// user makes on the customize step are buffered here keyed by the wizard
// placeholder id ("wizard-N", 1-indexed) and replayed by CourseWizard once
// the lessons have actually been persisted.
export type WizardLessonEdit = {
  title?: string
  description?: string | null
  thumbnailFile?: File
  thumbnailObjectUrl?: string
  videoFile?: File
  videoObjectUrl?: string
}

export type WizardEditorOutline = {
  modules?: Array<
    | {
        title?: string
        description?: string
        lessons?: Array<{
          title?: string
          content_type?: 'text' | 'video'
        } | null> | null
      }
    | null
    | undefined
  >
}

export type WizardEditorDraft = {
  name: string
  courseTitle: string
  desc: string
  /** Price in minor units (cents). Optional — undefined renders no price. */
  priceCents?: number | null
  priceCurrency?: string
  paywallEnabled?: boolean
  /** Number of lessons before the paywall (free preview count). */
  paywallPosition?: number | null
}

export type WizardFinalizationData = {
  overrides: ResolvedOverrides
  /** Files keyed by slot id that need to be uploaded after course creation. */
  pendingFiles: Map<string, File>
  /** New thumbnail file the user picked inline (replaces media.thumbFile). */
  pendingHeroFile: File | null
  /** New trailer file the user picked inline. */
  pendingTrailerFile: File | null
  /**
   * Per-lesson edits the user made in the wizard preview, keyed by the wizard
   * placeholder id ("wizard-N"). The host maps these back onto the real
   * lesson records by position once the course is created.
   */
  lessonEdits: Map<string, WizardLessonEdit>
}

export function WizardLandingEditor({
  organization,
  draft,
  outline,
  initialLanding,
  initialThumbFile,
  initialThumbName,
  onPublish,
  publishing,
  onBack,
}: {
  organization: schemas['Organization']
  draft: WizardEditorDraft
  outline: WizardEditorOutline
  initialLanding: Record<string, unknown> | null
  initialThumbFile: File | null
  initialThumbName: string
  onPublish: (data: WizardFinalizationData) => void | Promise<void>
  publishing?: boolean
  onBack?: () => void
}) {
  const pendingFilesRef = useRef<Map<string, File>>(new Map())
  const pendingHeroFileRef = useRef<File | null>(initialThumbFile)
  const pendingTrailerFileRef = useRef<File | null>(null)
  const objectUrlsRef = useRef<string[]>([])

  const initialOverrides = useMemo(() => {
    const merged = mergeOverrides(null)
    const text = (initialLanding ?? {}) as Record<string, unknown>
    if (draft.courseTitle) merged.text['hero.title'] = draft.courseTitle
    if (typeof text.tagline === 'string') merged.text['hero.tagline'] = text.tagline
    if (typeof text.eyebrow === 'string') merged.text['hero.eyebrow'] = text.eyebrow
    if (typeof text.series_label === 'string') merged.text['hero.series_label'] = text.series_label
    if (typeof text.level === 'string') merged.text['hero.level'] = text.level
    if (typeof text.lessons_heading === 'string') merged.text['lessons.heading'] = text.lessons_heading
    if (typeof text.lessons_subheading === 'string') merged.text['lessons.subheading'] = text.lessons_subheading
    if (typeof text.instructor_pull_quote === 'string') merged.text['instructor.quote'] = text.instructor_pull_quote
    if (typeof text.final_cta_label === 'string') merged.text['finalCta.label'] = text.final_cta_label
    if (typeof text.final_cta_title === 'string') merged.text['finalCta.title'] = text.final_cta_title
    if (typeof text.final_cta_subtitle === 'string') merged.text['finalCta.subtitle'] = text.final_cta_subtitle
    if (typeof text.final_cta_secondary === 'string') merged.text['finalCta.secondary'] = text.final_cta_secondary
    if (draft.name) merged.text['hero.instructor'] = draft.name
    if (initialThumbFile) {
      const url = URL.createObjectURL(initialThumbFile)
      objectUrlsRef.current.push(url)
      merged.media['hero.backdrop'] = {
        kind: 'image',
        url,
        name: initialThumbName,
      }
    }
    return merged
  }, [draft.courseTitle, draft.name, initialLanding, initialThumbFile, initialThumbName])

  const [overrides, setOverrides] = useState(initialOverrides)
  const overridesRef = useRef(overrides)

  // Buffered per-lesson edits. Live state is what the preview reads; the ref
  // is what the publish handler hands back to the host (so the user's latest
  // changes are always captured even if a re-render is in flight).
  const [lessonEdits, setLessonEdits] = useState<Map<string, WizardLessonEdit>>(
    () => new Map(),
  )
  const lessonEditsRef = useRef(lessonEdits)

  const updateLessonEdit = (
    id: string,
    patch: Partial<WizardLessonEdit>,
  ) => {
    setLessonEdits((prev) => {
      const next = new Map(prev)
      const merged = { ...(next.get(id) ?? {}), ...patch }
      next.set(id, merged)
      lessonEditsRef.current = next
      return next
    })
  }

  useEffect(() => () => {
    objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  const handleChange = (next: ResolvedOverrides) => {
    setOverrides(next)
    overridesRef.current = next
  }

  const wizardUpload = async (slotId: string, file: File): Promise<LandingMedia> => {
    const url = URL.createObjectURL(file)
    objectUrlsRef.current.push(url)
    pendingFilesRef.current.set(slotId, file)
    if (slotId === 'hero.backdrop' && file.type.startsWith('image')) {
      pendingHeroFileRef.current = file
    }
    if (
      slotId === 'trailer.video' ||
      (slotId === 'hero.backdrop' && file.type.startsWith('video'))
    ) {
      pendingTrailerFileRef.current = file
    }
    const kind: LandingMedia['kind'] = file.type.startsWith('video') ? 'video' : 'image'
    return { kind, url, name: file.name }
  }

  // Build a fake CourseRead so the EditableCourseLandingView (which expects a
  // course shape) renders correctly. Lessons + paywall flow from the wizard
  // draft so the customize preview matches what's saved on Create.
  const fakeCourse: CourseRead = useMemo(() => {
    const flatLessons: CourseLessonRead[] = []
    let pos = 0
    let lessonIdx = 1
    for (const m of outline.modules ?? []) {
      for (const l of m?.lessons ?? []) {
        if (!l?.title) continue
        flatLessons.push({
          id: `wizard-${lessonIdx}`,
          module_id: 'wizard-module',
          title: l.title,
          content_type: l.content_type ?? 'text',
          content: null,
          video_asset_id: null,
          duration_seconds: null,
          position: pos++,
          is_free_preview: false,
          published: false,
          mux_upload_id: null,
          mux_asset_id: null,
          mux_playback_id: null,
          mux_status: null,
          thumbnail_url: null,
          thumbnail_object_position: null,
          description: null,
          created_at: new Date().toISOString(),
          modified_at: null,
        })
        lessonIdx += 1
      }
    }
    const paywallEnabled = !!draft.paywallEnabled
    const paywallPosition = paywallEnabled
      ? draft.paywallPosition ?? null
      : null
    return {
      id: 'wizard-course',
      product_id: 'wizard-product',
      organization_id: organization.id,
      title: draft.courseTitle || 'Untitled course',
      slug: null,
      course_type: 'evergreen',
      paywall_enabled: paywallEnabled,
      paywall_lesson_id: null,
      paywall_position: paywallPosition,
      ai_generated: true,
      description: draft.desc,
      thumbnail_url: null,
      thumbnail_object_position: null,
      instructor_name: draft.name,
      instructor_bio: null,
      trailer_url: null,
      instructor_name_italic: false,
      instructor_name_bold: true,
      instructor_name_uppercase: true,
      landing_overrides: null,
      modules: [
        {
          id: 'wizard-module',
          course_id: 'wizard-course',
          title: 'Module',
          description: null,
          position: 0,
          status: 'draft',
          release_at: null,
          drip_days: null,
          lessons: flatLessons,
          created_at: new Date().toISOString(),
          modified_at: null,
        },
      ],
      created_at: new Date().toISOString(),
      modified_at: null,
    }
  }, [
    draft.courseTitle,
    draft.desc,
    draft.name,
    draft.paywallEnabled,
    draft.paywallPosition,
    organization.id,
    outline.modules,
  ])

  // Apply buffered edits on top of the placeholder lessons so the preview
  // reflects them live (title, description, thumbnail). Video previews are
  // wired through getLocalVideoUrl on the lesson handlers below.
  const flatLessons = useMemo<CourseLessonRead[]>(() => {
    const base = fakeCourse.modules[0].lessons
    if (lessonEdits.size === 0) return base
    return base.map((lesson) => {
      const edit = lessonEdits.get(lesson.id)
      if (!edit) return lesson
      return {
        ...lesson,
        title: edit.title ?? lesson.title,
        description:
          edit.description !== undefined ? edit.description : lesson.description,
        thumbnail_url: edit.thumbnailObjectUrl ?? lesson.thumbnail_url,
      }
    })
  }, [fakeCourse.modules, lessonEdits])

  const wizardLessonHandlers = useMemo<LessonHandlers>(
    () => ({
      updateLesson: async (lessonId, patch) => {
        updateLessonEdit(lessonId, {
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.description !== undefined
            ? { description: patch.description }
            : {}),
        })
      },
      uploadThumbnail: async (lessonId, file) => {
        const url = URL.createObjectURL(file)
        objectUrlsRef.current.push(url)
        updateLessonEdit(lessonId, {
          thumbnailFile: file,
          thumbnailObjectUrl: url,
        })
      },
      uploadVideo: async (lessonId, file) => {
        const url = URL.createObjectURL(file)
        objectUrlsRef.current.push(url)
        updateLessonEdit(lessonId, {
          videoFile: file,
          videoObjectUrl: url,
        })
      },
      getLocalVideoUrl: (lessonId) => lessonEdits.get(lessonId)?.videoObjectUrl,
    }),
    [lessonEdits],
  )

  // Build a fake Product shape so the price renders consistently with the
  // dashboard view. We only fill in what `formatProductPrice` needs.
  const fakeProduct = useMemo(() => {
    if (draft.priceCents == null) return undefined
    return {
      prices: [
        {
          amount_type: 'fixed' as const,
          price_amount: draft.priceCents,
          price_currency: draft.priceCurrency ?? 'usd',
        },
      ],
    } as unknown as schemas['Product']
  }, [draft.priceCents, draft.priceCurrency])

  return (
    <EditorProvider
      initialOverrides={overrides}
      onChange={handleChange}
      uploadMedia={(file) => wizardUpload('__generic__', file)}
      uploaderForSlot={(slotId) => (file) => wizardUpload(slotId, file)}
    >
      <div className="flex h-full flex-col bg-white">
        <div className="flex h-12 flex-shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4">
          <div className="flex min-w-0 items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="rounded-md px-2 py-1 text-[12px] font-medium text-gray-600 hover:bg-gray-50"
              >
                ← Back
              </button>
            )}
            <span className="text-[12px] text-gray-500">Course landing</span>
            <span className="text-[13px] text-gray-400">›</span>
            <span className="truncate text-[13px] font-medium text-gray-900">
              {draft.courseTitle || 'Untitled course'}
            </span>
          </div>
          <button
            type="button"
            disabled={publishing}
            onClick={() =>
              onPublish({
                overrides: overridesRef.current,
                pendingFiles: pendingFilesRef.current,
                pendingHeroFile: pendingHeroFileRef.current,
                pendingTrailerFile: pendingTrailerFileRef.current,
                lessonEdits: lessonEditsRef.current,
              })
            }
            className="rounded-md bg-gray-900 px-3.5 py-[7px] text-[12px] font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {publishing ? 'Creating…' : 'Create course'}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <EditableCourseLandingView
            course={fakeCourse}
            organizationName={organization.name}
            organizationSlug={organization.slug}
            flatLessons={flatLessons}
            product={fakeProduct}
            lessonHandlers={wizardLessonHandlers}
          />
        </div>
      </div>
    </EditorProvider>
  )
}
