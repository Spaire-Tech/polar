'use client'

// Dashboard customize tab. The customize page opens fully — there's no left
// rail and no right inspector — so all edits happen directly on the canvas.
// Save/Publish lives in a slim top bar; the EditorProvider still tracks state.

import {
  CourseRead,
  LandingMedia,
  useCreateMuxUpload,
  useUpdateCourse,
  useUpdateCourseLesson,
  useUploadCourseThumbnail,
  useUploadCourseTrailer,
  useUploadLandingMedia,
  useUploadLessonThumbnail,
} from '@/hooks/queries/courses'
import { useProduct } from '@/hooks/queries/products'
import { schemas } from '@spaire/client'
import { useMemo, useRef, useState } from 'react'
import { toast } from '../../Toast/use-toast'
import { CoursePhoneFrame } from './CoursePhoneFrame'
import {
  EditableCourseLandingView,
  type LessonHandlers,
} from './EditableCourseLandingView'
import {
  EditorProvider,
  mergeOverrides,
  useEditor,
  type ResolvedOverrides,
} from './EditorContext'

export function CustomizeTab({
  course,
  organization,
}: {
  course: CourseRead
  organization: schemas['Organization']
}) {
  const updateCourse = useUpdateCourse()
  const uploadThumb = useUploadCourseThumbnail()
  const uploadTrailer = useUploadCourseTrailer()
  const uploadMediaSlot = useUploadLandingMedia()
  const updateLessonMut = useUpdateCourseLesson()
  const uploadLessonThumbMut = useUploadLessonThumbnail()
  const createMuxUpload = useCreateMuxUpload()
  const { data: product } = useProduct(course.product_id)

  const lessonHandlers = useMemo<LessonHandlers>(
    () => ({
      updateLesson: async (lessonId, patch) => {
        // eslint-disable-next-line no-console
        console.info('[CustomizeTab] lesson update → PATCH', { lessonId, patch })
        try {
          const result = await updateLessonMut.mutateAsync({
            lessonId,
            body: patch,
          })
          // eslint-disable-next-line no-console
          console.info('[CustomizeTab] lesson update ← ok', {
            lessonId,
            title: result.title,
            description: result.description,
          })
          toast({ title: 'Lesson updated' })
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[CustomizeTab] lesson update ← FAILED', err)
          toast({
            title: 'Lesson update failed',
            description: err instanceof Error ? err.message : String(err),
          })
          throw err
        }
      },
      uploadThumbnail: async (lessonId, file) => {
        // eslint-disable-next-line no-console
        console.info('[CustomizeTab] lesson thumbnail → POST', {
          lessonId,
          fileName: file.name,
          fileSize: file.size,
        })
        try {
          const result = await uploadLessonThumbMut.mutateAsync({
            lessonId,
            file,
          })
          // eslint-disable-next-line no-console
          console.info('[CustomizeTab] lesson thumbnail ← ok', {
            lessonId,
            thumbnail_url: result.thumbnail_url,
          })
          toast({ title: 'Thumbnail uploaded' })
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[CustomizeTab] lesson thumbnail ← FAILED', err)
          toast({
            title: 'Thumbnail upload failed',
            description: err instanceof Error ? err.message : String(err),
          })
          throw err
        }
      },
      uploadVideo: async (lessonId, file, onProgress) => {
        const { upload_url } = await createMuxUpload.mutateAsync(lessonId)
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.upload.onprogress = (ev) => {
            if (!ev.lengthComputable || !onProgress) return
            onProgress(Math.round((ev.loaded / ev.total) * 100))
          }
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error(`Upload failed (${xhr.status})`))
          xhr.onerror = () => reject(new Error('Network error during upload'))
          xhr.open('PUT', upload_url)
          xhr.send(file)
        })
      },
    }),
    [updateLessonMut, uploadLessonThumbMut, createMuxUpload],
  )

  // Seed the editor once per course. If we recomputed `initial` whenever
  // course.landing_overrides / thumbnail_url / trailer_url changed (which
  // happens after every successful upload that invalidates the course
  // query), the EditorProvider would re-seed mid-edit and clobber unsaved
  // local changes — text edits, freshly uploaded images, etc. Pinning the
  // seed to course.id keeps the editor's local state authoritative until
  // the user navigates away or swaps courses.
  const seedRef = useRef<{ courseId: string; value: ResolvedOverrides } | null>(
    null,
  )
  if (seedRef.current?.courseId !== course.id) {
    const merged = mergeOverrides(course.landing_overrides ?? null)
    if (course.thumbnail_url && !merged.media['hero.backdrop']) {
      merged.media['hero.backdrop'] = {
        kind: 'image',
        url: course.thumbnail_url,
        // Seed the slot's crop from the canonical course column so the
        // first render in the canvas matches what the customer portal
        // already shows. Subsequent repositions stay on the slot and are
        // mirrored back to course.thumbnail_object_position on save.
        objectPosition: course.thumbnail_object_position ?? undefined,
      }
    }
    if (course.trailer_url && !merged.media['trailer.video']) {
      merged.media['trailer.video'] = {
        kind: 'video',
        url: course.trailer_url,
      }
    }
    seedRef.current = { courseId: course.id, value: merged }
  }
  const initial = seedRef.current.value

  const [dirty, setDirty] = useState(false)
  const overridesRef = useRef<ResolvedOverrides>(initial)

  const handleChange = (next: ResolvedOverrides) => {
    overridesRef.current = next
    setDirty(true)
  }

  const heroUpload = async (file: File): Promise<LandingMedia> => {
    const updated = await uploadThumb.mutateAsync({ courseId: course.id, file })
    return { kind: 'image', url: updated.thumbnail_url ?? '', name: file.name }
  }

  const trailerUpload = async (file: File): Promise<LandingMedia> => {
    const updated = await uploadTrailer.mutateAsync({
      courseId: course.id,
      file,
    })
    return { kind: 'video', url: updated.trailer_url ?? '', name: file.name }
  }

  const slotUpload = async (file: File): Promise<LandingMedia> => {
    const res = await uploadMediaSlot.mutateAsync({ courseId: course.id, file })
    return { kind: res.kind, url: res.url, name: file.name }
  }

  // The hero has two separate slots — image (cover) and trailer (peek). Route
  // each to the right course column so the Netflix-style hero plays the
  // trailer for ~10s and then settles on the cover image.
  const heroImageUpload = async (file: File): Promise<LandingMedia> => {
    if (file.type.startsWith('video/')) return trailerUpload(file)
    return heroUpload(file)
  }
  const heroTrailerUpload = async (file: File): Promise<LandingMedia> => {
    if (file.type.startsWith('image/')) return heroUpload(file)
    return trailerUpload(file)
  }

  const uploaderForSlot = (slotId: string) => {
    if (slotId === 'hero.backdrop') return heroImageUpload
    if (slotId === 'hero.trailer') return heroTrailerUpload
    if (slotId === 'trailer.video') return trailerUpload
    return slotUpload
  }

  const handleSave = async () => {
    const persistedMedia = { ...overridesRef.current.media }
    // hero image / trailer are mirrored onto course columns, so don't
    // double-store them in landing_overrides. We do, however, want the
    // hero image's repositioning (objectPosition) to survive — promote
    // it onto course.thumbnail_object_position before dropping the slot
    // so the customer portal, course list, etc. see the same crop.
    const heroBackdrop = persistedMedia['hero.backdrop']
    const heroTrailer = persistedMedia['hero.trailer']
    const trailerVideo = persistedMedia['trailer.video']
    const heroBackdropPosition =
      heroBackdrop && heroBackdrop.kind === 'image'
        ? heroBackdrop.objectPosition
        : undefined
    delete persistedMedia['hero.backdrop']
    delete persistedMedia['hero.trailer']
    delete persistedMedia['trailer.video']
    const body: Parameters<
      typeof updateCourse.mutateAsync
    >[0]['body'] = {
      landing_overrides: {
        ...overridesRef.current,
        media: persistedMedia,
      },
    }
    // Always send the hero position when it's been set. The previous
    // optimisation skipped the write when the new value matched the seeded
    // value, which meant repositions to an "already-stored" coordinate
    // (the common case after the page loads) never persisted.
    if (heroBackdropPosition) {
      body.thumbnail_object_position = heroBackdropPosition
    }
    // Mirror "user removed media" back to the canonical course columns.
    // If the slot is gone from the editor state AND the course still has
    // a URL on file, the user cleared it — PATCH the column to null so
    // the public landing actually drops the asset.
    const heroImageGone =
      !heroBackdrop ||
      (heroBackdrop.kind === 'image' && !heroBackdrop.url) ||
      heroBackdrop.kind !== 'image'
    if (heroImageGone && course.thumbnail_url) {
      body.thumbnail_url = null
      body.thumbnail_object_position = null
    }
    const trailerGone =
      !trailerVideo &&
      !(heroTrailer && heroTrailer.kind === 'video') &&
      !(heroBackdrop && heroBackdrop.kind === 'video')
    if (trailerGone && course.trailer_url) {
      body.trailer_url = null
    }
    // Surface what's being sent so the user can confirm in the network
    // tab that their edits made it into the PATCH payload.
    // eslint-disable-next-line no-console
    console.info('[CustomizeTab] save → PATCH /v1/courses/' + course.id, body)
    try {
      const result = await updateCourse.mutateAsync({
        courseId: course.id,
        body,
      })
      // eslint-disable-next-line no-console
      console.info('[CustomizeTab] save ← ok', {
        id: result.id,
        landing_overrides_keys: Object.keys(result.landing_overrides ?? {}),
        text_keys: Object.keys(
          (result.landing_overrides as { text?: Record<string, string> } | null)
            ?.text ?? {},
        ),
        media_keys: Object.keys(
          (result.landing_overrides as {
            media?: Record<string, unknown>
          } | null)?.media ?? {},
        ),
      })
      setDirty(false)
      toast({ title: 'Landing saved' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // eslint-disable-next-line no-console
      console.error('[CustomizeTab] save ← FAILED', err)
      toast({ title: 'Failed to save', description: message })
    }
  }

  const flatLessons = useMemo(
    () => course.modules.flatMap((m) => m.lessons),
    [course.modules],
  )

  const saving = updateCourse.isPending

  return (
    <EditorProvider
      initialOverrides={initial}
      onChange={handleChange}
      uploadMedia={slotUpload}
      uploaderForSlot={uploaderForSlot}
      isUploading={
        uploadThumb.isPending ||
        uploadTrailer.isPending ||
        uploadMediaSlot.isPending
      }
    >
      <div className="flex h-full flex-col bg-white">
        <CustomizeBar
          courseTitle={course.title ?? 'Untitled course'}
          previewHref={`/${organization.slug}/products/${course.product_id}`}
          dirty={dirty}
          saving={saving}
          onSave={handleSave}
        />
        <CustomizeCanvas
          course={course}
          organization={organization}
          flatLessons={flatLessons}
          product={product}
          lessonHandlers={lessonHandlers}
        />
      </div>
    </EditorProvider>
  )
}

// The canvas reads `ed.device` from the EditorProvider so the desktop /
// mobile toggle in CustomizeBar can swap between the desktop layout and
// the real mobile components wrapped in an iPhone frame. Mobile mode
// uses the same EditableCourseLandingView — it already branches its
// sectionMap on `ed.device === 'mobile'`.
function CustomizeCanvas({
  course,
  organization,
  flatLessons,
  product,
  lessonHandlers,
}: {
  course: CourseRead
  organization: schemas['Organization']
  flatLessons: CourseRead['modules'][number]['lessons']
  product: schemas['Product'] | undefined
  lessonHandlers: LessonHandlers
}) {
  const ed = useEditor()
  const isMobileMode = ed.device === 'mobile'

  const landing = (
    <EditableCourseLandingView
      course={course}
      organizationName={organization.name}
      organizationSlug={organization.slug}
      organizationAvatarUrl={organization.avatar_url}
      flatLessons={flatLessons}
      product={product}
      lessonHandlers={lessonHandlers}
    />
  )

  if (isMobileMode) {
    return (
      <div
        className="flex-1 overflow-y-auto"
        style={{
          background: 'oklch(0.96 0.005 280)',
          padding: '32px 16px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        <CoursePhoneFrame>{landing}</CoursePhoneFrame>
      </div>
    )
  }

  return <div className="flex-1 overflow-y-auto">{landing}</div>
}

// Slim top bar — the only chrome in the customize page. No left rail, no
// right inspector; every change happens inline on the canvas.
function CustomizeBar({
  courseTitle,
  previewHref,
  dirty,
  saving,
  onSave,
}: {
  courseTitle: string
  previewHref: string
  dirty: boolean
  saving: boolean
  onSave: () => void
}) {
  return (
    <div className="relative flex h-12 flex-shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-[12px] text-gray-500">Course landing</span>
        <span className="text-[13px] text-gray-400">›</span>
        <span className="truncate text-[13px] font-medium text-gray-900">
          {courseTitle}
        </span>
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="pointer-events-auto">
          <DeviceToggle />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11.5px] text-gray-400">
          {dirty ? 'Unsaved changes' : saving ? '' : 'All changes saved'}
        </span>
        <a
          href={previewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-gray-200 bg-white px-3 py-[6px] text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Preview ↗
        </a>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-md bg-gray-900 px-3.5 py-[7px] text-[12px] font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Saving…' : dirty ? 'Save & publish' : 'Republish'}
        </button>
      </div>
    </div>
  )
}

// Centred segmented control that switches between the desktop layout and
// the iPhone-framed real mobile components. Lives inside EditorProvider so
// it can read/write `ed.device` directly.
function DeviceToggle() {
  const ed = useEditor()
  return (
    <div
      role="tablist"
      aria-label="Preview device"
      className="flex items-center gap-0.5 rounded-md border border-gray-200 bg-gray-50 p-0.5"
    >
      <DeviceButton
        active={ed.device !== 'mobile'}
        onClick={() => ed.setDevice('desktop')}
        label="Desktop preview"
      >
        <DesktopIcon />
        <span>Desktop</span>
      </DeviceButton>
      <DeviceButton
        active={ed.device === 'mobile'}
        onClick={() => ed.setDevice('mobile')}
        label="Mobile preview"
      >
        <PhoneIcon />
        <span>Mobile</span>
      </DeviceButton>
    </div>
  )
}

function DeviceButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={label}
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 rounded px-2.5 py-1 text-[11.5px] font-medium tracking-tight transition-colors',
        active
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-500 hover:text-gray-800',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function DesktopIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="12" height="8.5" rx="1.2" />
      <path d="M6 14h4M8 11.5V14" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="2" width="6" height="12" rx="1.4" />
      <path d="M7.25 12.5h1.5" />
    </svg>
  )
}
