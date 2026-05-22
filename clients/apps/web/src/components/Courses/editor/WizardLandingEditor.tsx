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
  useStageMuxUpload,
  useStageOrgMedia,
} from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../../Toast/use-toast'
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
//
// Files are uploaded the moment the user picks them — the lesson row
// doesn't exist yet, so we stage the upload (Mux direct upload / S3
// staging media) and remember the resulting identifiers. CourseWizard
// passes them straight into CourseLessonCreate at finalize time so the
// new lesson is already pointing at the uploaded asset.
export type WizardLessonEdit = {
  title?: string
  description?: string | null
  thumbnailFile?: File
  thumbnailObjectUrl?: string
  // Uploaded URL of the thumbnail (S3 staging). Set once the upload
  // completes. When present, CourseWizard skips re-uploading at finalize.
  thumbnailStagedUrl?: string
  videoFile?: File
  videoObjectUrl?: string
  // Mux upload id created the moment the user picked the video file. The
  // webhook will resolve this id back to the lesson once Mux is done.
  muxUploadId?: string
  // Tracks in-flight uploads so the publish handler can surface a
  // "still uploading" message instead of dropping the file silently.
  uploading?: boolean
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
  /**
   * Files the user picked but whose upload has NOT completed yet. The
   * publish handler awaits these — uploads started while the wizard was
   * open finish in the background, and finalize only needs the URLs.
   */
  pendingFiles: Map<string, File>
  /** Already-uploaded hero/trailer URLs (S3 staging). */
  stagedHeroUrl: string | null
  stagedTrailerUrl: string | null
  /** Original files (kept as a fallback if a staging upload failed). */
  pendingHeroFile: File | null
  pendingTrailerFile: File | null
  /** Already-uploaded URLs for landing-overrides media slots. */
  stagedSlotMedia: Map<string, { url: string; kind: 'image' | 'video' }>
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
  format = 'course',
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
  format?: 'course' | 'series'
}) {
  const pendingFilesRef = useRef<Map<string, File>>(new Map())
  const pendingHeroFileRef = useRef<File | null>(initialThumbFile)
  const pendingTrailerFileRef = useRef<File | null>(null)
  const stagedHeroUrlRef = useRef<string | null>(null)
  const stagedTrailerUrlRef = useRef<string | null>(null)
  const stagedSlotMediaRef = useRef<
    Map<string, { url: string; kind: 'image' | 'video' }>
  >(new Map())
  const objectUrlsRef = useRef<string[]>([])
  const stageMedia = useStageOrgMedia()
  const stageMux = useStageMuxUpload()

  const initialOverrides = useMemo(() => {
    const merged = mergeOverrides(null)
    const text = (initialLanding ?? {}) as Record<string, unknown>
    if (draft.courseTitle) merged.text['hero.title'] = draft.courseTitle
    if (typeof text.tagline === 'string')
      merged.text['hero.tagline'] = text.tagline
    if (typeof text.eyebrow === 'string')
      merged.text['hero.eyebrow'] = text.eyebrow
    if (typeof text.series_label === 'string')
      merged.text['hero.series_label'] = text.series_label
    if (typeof text.level === 'string') merged.text['hero.level'] = text.level
    if (typeof text.lessons_heading === 'string')
      merged.text['lessons.heading'] = text.lessons_heading
    if (typeof text.lessons_subheading === 'string')
      merged.text['lessons.subheading'] = text.lessons_subheading
    if (typeof text.instructor_pull_quote === 'string')
      merged.text['instructor.quote'] = text.instructor_pull_quote
    if (typeof text.created_by_eyebrow === 'string')
      merged.text['createdBy.eyebrow'] = text.created_by_eyebrow
    if (typeof text.created_by_quote === 'string')
      merged.text['createdBy.quote'] = text.created_by_quote
    if (typeof text.created_by_headline === 'string')
      merged.text['createdBy.headline'] = text.created_by_headline
    if (typeof text.created_by_bio === 'string')
      merged.text['createdBy.bio'] = text.created_by_bio
    if (typeof text.sections_label === 'string')
      merged.text['sections.eyebrow'] = text.sections_label
    if (typeof text.sections_heading === 'string')
      merged.text['sections.heading'] = text.sections_heading
    if (typeof text.sections_subheading === 'string')
      merged.text['sections.subheading'] = text.sections_subheading
    if (typeof text.paywall_eyebrow === 'string')
      merged.text['paywall.eyebrow'] = text.paywall_eyebrow
    if (typeof text.paywall_title === 'string')
      merged.text['paywall.title'] = text.paywall_title
    if (typeof text.paywall_subtitle === 'string')
      merged.text['paywall.subtitle'] = text.paywall_subtitle
    if (typeof text.paywall_price_sub === 'string')
      merged.text['paywall.priceSub'] = text.paywall_price_sub
    if (typeof text.paywall_cta === 'string')
      merged.text['paywall.cta'] = text.paywall_cta
    if (typeof text.final_cta_label === 'string')
      merged.text['finalCta.label'] = text.final_cta_label
    if (typeof text.final_cta_title === 'string')
      merged.text['finalCta.title'] = text.final_cta_title
    if (typeof text.final_cta_subtitle === 'string')
      merged.text['finalCta.subtitle'] = text.final_cta_subtitle
    if (typeof text.final_cta_secondary === 'string')
      merged.text['finalCta.secondary'] = text.final_cta_secondary
    if (Array.isArray(text.final_cta_guarantees)) {
      const g = text.final_cta_guarantees as unknown[]
      g.slice(0, 4).forEach((item, i) => {
        if (typeof item === 'string') {
          merged.text[`finalCta.guarantee${i + 1}`] = item
        }
      })
    }
    if (typeof text.learn_eyebrow === 'string')
      merged.text['learn.eyebrow'] = text.learn_eyebrow
    if (typeof text.learn_title === 'string')
      merged.text['learn.title'] = text.learn_title
    if (typeof text.learn_title_em === 'string')
      merged.text['learn.titleEm'] = text.learn_title_em
    if (Array.isArray(text.learn_items)) {
      ;(text.learn_items as unknown[]).slice(0, 4).forEach((item, i) => {
        if (!item || typeof item !== 'object') return
        const it = item as { title?: unknown; description?: unknown }
        if (typeof it.title === 'string')
          merged.text[`learn.item${i + 1}.title`] = it.title
        if (typeof it.description === 'string')
          merged.text[`learn.item${i + 1}.desc`] = it.description
      })
    }
    if (typeof text.faq_eyebrow === 'string')
      merged.text['faq.eyebrow'] = text.faq_eyebrow
    if (typeof text.faq_title === 'string')
      merged.text['faq.title'] = text.faq_title
    if (typeof text.faq_title_em === 'string')
      merged.text['faq.titleEm'] = text.faq_title_em
    if (Array.isArray(text.faq_items)) {
      ;(text.faq_items as unknown[]).slice(0, 7).forEach((item, i) => {
        if (!item || typeof item !== 'object') return
        const it = item as { question?: unknown; answer?: unknown }
        if (typeof it.question === 'string')
          merged.text[`faq.item${i + 1}.q`] = it.question
        if (typeof it.answer === 'string')
          merged.text[`faq.item${i + 1}.a`] = it.answer
      })
    }
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
  }, [
    draft.courseTitle,
    draft.name,
    initialLanding,
    initialThumbFile,
    initialThumbName,
  ])

  const [overrides, setOverrides] = useState(initialOverrides)
  const overridesRef = useRef(overrides)

  // Buffered per-lesson edits. Live state is what the preview reads; the ref
  // is what the publish handler hands back to the host (so the user's latest
  // changes are always captured even if a re-render is in flight).
  const [lessonEdits, setLessonEdits] = useState<Map<string, WizardLessonEdit>>(
    () => new Map(),
  )
  const lessonEditsRef = useRef(lessonEdits)

  const updateLessonEdit = (id: string, patch: Partial<WizardLessonEdit>) => {
    setLessonEdits((prev) => {
      const next = new Map(prev)
      const merged = { ...(next.get(id) ?? {}), ...patch }
      next.set(id, merged)
      lessonEditsRef.current = next
      return next
    })
  }

  useEffect(
    () => () => {
      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    },
    [],
  )

  const handleChange = (next: ResolvedOverrides) => {
    setOverrides(next)
    overridesRef.current = next
  }

  // Slot upload — fires the moment the user picks a file. Returns an
  // immediate object URL so the canvas previews live; the real S3
  // upload kicks off in the background and the staged URL replaces the
  // object URL once it lands. Finalize won't re-upload anything that
  // has already staged successfully.
  const wizardUpload = async (
    slotId: string,
    file: File,
  ): Promise<LandingMedia> => {
    const localUrl = URL.createObjectURL(file)
    objectUrlsRef.current.push(localUrl)
    pendingFilesRef.current.set(slotId, file)
    const kind: LandingMedia['kind'] = file.type.startsWith('video')
      ? 'video'
      : 'image'

    const isHeroImage =
      slotId === 'hero.backdrop' && file.type.startsWith('image')
    const isTrailer =
      slotId === 'trailer.video' ||
      (slotId === 'hero.backdrop' && file.type.startsWith('video'))
    if (isHeroImage) pendingHeroFileRef.current = file
    if (isTrailer) pendingTrailerFileRef.current = file

    // Kick the real upload off in the background. Failure is non-fatal
    // here — the file is still in pendingFiles, so finalize falls back
    // to uploading it then. We surface a toast either way so the user
    // knows their pick made it.
    stageMedia
      .mutateAsync({ organizationId: organization.id, file })
      .then((res) => {
        pendingFilesRef.current.delete(slotId)
        if (isHeroImage) stagedHeroUrlRef.current = res.url
        else if (isTrailer) stagedTrailerUrlRef.current = res.url
        else stagedSlotMediaRef.current.set(slotId, res)
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[WizardLandingEditor] staged upload failed', slotId, err)
        toast({
          title: 'Upload still pending — will retry on Create',
          description: err instanceof Error ? err.message : undefined,
        })
      })

    return { kind, url: localUrl, name: file.name }
  }

  // Build a fake CourseRead so the EditableCourseLandingView (which expects a
  // course shape) renders correctly. Lessons + paywall flow from the wizard
  // draft so the customize preview matches what's saved on Create.
  const fakeCourse: CourseRead = useMemo(() => {
    type WizardModule = {
      id: string
      title: string
      lessons: CourseLessonRead[]
    }
    const wizardModules: WizardModule[] = []
    let pos = 0
    let lessonIdx = 1
    let moduleIdx = 0
    for (const m of outline.modules ?? []) {
      const moduleId = `wizard-module-${moduleIdx}`
      const moduleTitle =
        (typeof m?.title === 'string' && m.title.trim()) ||
        `Section ${moduleIdx + 1}`
      const moduleLessons: CourseLessonRead[] = []
      for (const l of m?.lessons ?? []) {
        if (!l?.title) continue
        moduleLessons.push({
          id: `wizard-${lessonIdx}`,
          module_id: moduleId,
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
      wizardModules.push({
        id: moduleId,
        title: moduleTitle,
        lessons: moduleLessons,
      })
      moduleIdx += 1
    }
    // Outline streams in incrementally; until anything resolves, fall back to
    // a single "Module" placeholder so the canvas isn't empty mid-stream.
    if (wizardModules.length === 0) {
      wizardModules.push({
        id: 'wizard-module-0',
        title: 'Module',
        lessons: [],
      })
    }
    const paywallEnabled = !!draft.paywallEnabled
    const paywallPosition = paywallEnabled
      ? (draft.paywallPosition ?? null)
      : null
    return {
      id: 'wizard-course',
      product_id: 'wizard-product',
      organization_id: organization.id,
      title: draft.courseTitle || 'Untitled course',
      slug: null,
      course_type: 'evergreen',
      format,
      sample: null,
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
      modules: wizardModules.map((m, i) => ({
        id: m.id,
        course_id: 'wizard-course',
        title: m.title,
        description: null,
        position: i,
        status: 'draft',
        release_at: null,
        drip_days: null,
        lessons: m.lessons,
        created_at: new Date().toISOString(),
        modified_at: null,
      })),
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
    const base = fakeCourse.modules.flatMap((m) => m.lessons)
    if (lessonEdits.size === 0) return base
    return base.map((lesson) => {
      const edit = lessonEdits.get(lesson.id)
      if (!edit) return lesson
      return {
        ...lesson,
        title: edit.title ?? lesson.title,
        description:
          edit.description !== undefined
            ? edit.description
            : lesson.description,
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
          uploading: true,
        })
        // Fire the staging upload immediately so the file is in S3 by
        // the time the user clicks Create.
        try {
          const res = await stageMedia.mutateAsync({
            organizationId: organization.id,
            file,
          })
          updateLessonEdit(lessonId, {
            thumbnailStagedUrl: res.url,
            uploading: false,
          })
        } catch (err) {
          updateLessonEdit(lessonId, { uploading: false })
          // eslint-disable-next-line no-console
          console.warn(
            '[WizardLandingEditor] lesson thumbnail staging failed',
            lessonId,
            err,
          )
          // Keep the File around — finalize re-tries once the course
          // exists.
        }
      },
      uploadVideo: async (lessonId, file, onProgress) => {
        const url = URL.createObjectURL(file)
        objectUrlsRef.current.push(url)
        updateLessonEdit(lessonId, {
          videoFile: file,
          videoObjectUrl: url,
          uploading: true,
        })
        // Seed the progress callback at 0% so the lesson tile shows
        // its uploading affordance the moment the file is picked —
        // matches the dashboard editor behaviour where the bar appears
        // immediately rather than after the first XHR progress event.
        onProgress?.(0)
        // Stage a direct upload that isn't tied to any lesson; the
        // upload_id rides along on CourseLessonCreate so the webhook
        // attaches the asset once transcoding finishes.
        try {
          const { upload_id, upload_url } = await stageMux.mutateAsync(
            organization.id,
          )
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.upload.onprogress = (ev) => {
              if (ev.lengthComputable)
                onProgress?.(Math.round((ev.loaded / ev.total) * 100))
            }
            xhr.onload = () =>
              xhr.status >= 200 && xhr.status < 300
                ? resolve()
                : reject(new Error(`Upload failed (${xhr.status})`))
            xhr.onerror = () => reject(new Error('Network error during upload'))
            xhr.open('PUT', upload_url)
            xhr.send(file)
          })
          updateLessonEdit(lessonId, {
            muxUploadId: upload_id,
            uploading: false,
          })
        } catch (err) {
          updateLessonEdit(lessonId, { uploading: false })
          // eslint-disable-next-line no-console
          console.warn(
            '[WizardLandingEditor] lesson video staging failed',
            lessonId,
            err,
          )
          // Leave videoFile in the edit so finalize re-tries.
        }
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
                stagedHeroUrl: stagedHeroUrlRef.current,
                stagedTrailerUrl: stagedTrailerUrlRef.current,
                pendingHeroFile: pendingHeroFileRef.current,
                pendingTrailerFile: pendingTrailerFileRef.current,
                stagedSlotMedia: stagedSlotMediaRef.current,
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
            organizationAvatarUrl={organization.avatar_url}
            flatLessons={flatLessons}
            product={fakeProduct}
            lessonHandlers={wizardLessonHandlers}
          />
        </div>
      </div>
    </EditorProvider>
  )
}
