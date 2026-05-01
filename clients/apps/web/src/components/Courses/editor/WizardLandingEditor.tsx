'use client'

// WizardLandingEditor — hosts the same EditorShell + EditableCourseLandingView
// inside the onboarding wizard preview, before the course exists in the DB.
//
// Because there's no course.id yet:
//   • media uploads are buffered into a Map<slotId, File> alongside an object
//     URL, so the canvas previews live but real S3 uploads are deferred.
//   • the hero backdrop is seeded from the thumbnail uploaded earlier in
//     onboarding (media.thumbFile) so the same image shows up here.
//   • clicking Publish hands the host (CourseWizard) the buffered overrides +
//     files; the host creates the course, uploads the files, and patches
//     landing_overrides.

import {
  CourseLessonRead,
  CourseRead,
  LandingMedia,
  LandingOverrides,
} from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { EditableCourseLandingView } from './EditableCourseLandingView'
import { EditorProvider, mergeOverrides } from './EditorContext'
import { EditorShell } from './EditorShell'

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
}

export type WizardFinalizationData = {
  overrides: Required<LandingOverrides>
  /** Files keyed by slot id that need to be uploaded after course creation. */
  pendingFiles: Map<string, File>
  /** New thumbnail file the user picked inline (replaces media.thumbFile). */
  pendingHeroFile: File | null
  /** New trailer file the user picked inline. */
  pendingTrailerFile: File | null
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
  // Buffer File objects that we'll upload after the course is created.
  const pendingFilesRef = useRef<Map<string, File>>(new Map())
  const pendingHeroFileRef = useRef<File | null>(initialThumbFile)
  const pendingTrailerFileRef = useRef<File | null>(null)
  const objectUrlsRef = useRef<string[]>([])

  // Seed the override blob: text comes from the AI-streamed landing JSON,
  // hero backdrop comes from the onboarding-uploaded thumbnail (object URL).
  const initialOverrides = useMemo(() => {
    const merged = mergeOverrides(null)
    // Seed hero/title/tagline from draft + landing
    const text = (initialLanding ?? {}) as Record<string, unknown>
    if (draft.courseTitle) merged.text['hero.title'] = draft.courseTitle
    if (typeof text.tagline === 'string') merged.text['hero.tagline'] = text.tagline
    if (typeof text.eyebrow === 'string') merged.text['hero.eyebrow'] = text.eyebrow
    if (typeof text.series_label === 'string') merged.text['hero.series_label'] = text.series_label
    if (typeof text.level === 'string') merged.text['hero.level'] = text.level
    if (typeof text.curriculum_heading === 'string') merged.text['curriculum.heading'] = text.curriculum_heading
    if (typeof text.curriculum_subheading === 'string') merged.text['curriculum.subheading'] = text.curriculum_subheading
    if (typeof text.lessons_heading === 'string') merged.text['lessons.heading'] = text.lessons_heading
    if (typeof text.lessons_subheading === 'string') merged.text['lessons.subheading'] = text.lessons_subheading
    if (typeof text.instructor_pull_quote === 'string') merged.text['instructor.quote'] = text.instructor_pull_quote
    if (typeof text.final_cta_label === 'string') merged.text['finalCta.label'] = text.final_cta_label
    if (typeof text.final_cta_title === 'string') merged.text['finalCta.title'] = text.final_cta_title
    if (typeof text.final_cta_subtitle === 'string') merged.text['finalCta.subtitle'] = text.final_cta_subtitle
    if (typeof text.final_cta_primary === 'string') merged.text['finalCta.primary'] = text.final_cta_primary
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

  useEffect(() => () => {
    objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  const handleChange = (next: Required<LandingOverrides>) => {
    setOverrides(next)
    overridesRef.current = next
  }

  // In wizard mode, "uploads" produce object URLs and buffer the File for the
  // host to upload after course creation.
  const wizardUpload = async (slotId: string, file: File): Promise<LandingMedia> => {
    const url = URL.createObjectURL(file)
    objectUrlsRef.current.push(url)
    pendingFilesRef.current.set(slotId, file)
    if (slotId === 'hero.backdrop') pendingHeroFileRef.current = file
    if (slotId === 'trailer.video') pendingTrailerFileRef.current = file
    const kind: LandingMedia['kind'] = file.type.startsWith('video') ? 'video' : 'image'
    return { kind, url, name: file.name }
  }

  // Build a fake CourseRead so the EditableCourseLandingView (which expects a
  // course shape) renders correctly. Lessons are derived from the streamed
  // outline.
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
    return {
      id: 'wizard-course',
      product_id: 'wizard-product',
      organization_id: organization.id,
      title: draft.courseTitle || 'Untitled course',
      slug: null,
      course_type: 'evergreen',
      paywall_enabled: false,
      paywall_lesson_id: null,
      paywall_position: null,
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
  }, [draft.courseTitle, draft.desc, draft.name, organization.id, outline.modules])

  const flatLessons = fakeCourse.modules[0].lessons

  return (
    <EditorProvider
      initialOverrides={overrides}
      onChange={handleChange}
      uploadMedia={(file) => wizardUpload('__generic__', file)}
      uploaderForSlot={(slotId) => (file) => wizardUpload(slotId, file)}
    >
      <EditorShell
        breadcrumb={{ course: draft.courseTitle || 'Untitled course' }}
        onSave={() => {}}
        onPublish={() =>
          onPublish({
            overrides: overridesRef.current,
            pendingFiles: pendingFilesRef.current,
            pendingHeroFile: pendingHeroFileRef.current,
            pendingTrailerFile: pendingTrailerFileRef.current,
          })
        }
        saving={publishing}
        dirty
      >
        <EditableCourseLandingView
          course={fakeCourse}
          organizationName={organization.name}
          flatLessons={flatLessons}
        />
      </EditorShell>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="fixed left-4 top-[72px] z-30 rounded-full border border-gray-200 bg-white px-3 py-1 text-[12px] font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          ← Back
        </button>
      )}
    </EditorProvider>
  )
}
