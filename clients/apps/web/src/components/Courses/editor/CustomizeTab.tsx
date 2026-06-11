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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@spaire/ui/components/ui/popover'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../../Toast/use-toast'
import { CourseDesignEditor } from './CourseDesignEditor'
import { CoursePhoneFrame } from './CoursePhoneFrame'
import { CustomizeCommandPalette } from './CustomizeCommandPalette'
import { type LessonHandlers } from './EditableCourseLandingView'
import {
  EditorProvider,
  SECTION_LABELS,
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
        console.info('[CustomizeTab] lesson update → PATCH', {
          lessonId,
          patch,
        })
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
    const body: Parameters<typeof updateCourse.mutateAsync>[0]['body'] = {
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
          (
            result.landing_overrides as {
              media?: Record<string, unknown>
            } | null
          )?.media ?? {},
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
          initialSnapshot={initial}
          onDiscarded={() => setDirty(false)}
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

  // The canvas IS the generated page (the design surface buyers see),
  // in editable mode — creator affordances wired to the S3/Mux-backed
  // endpoints. The old EditableCourseLandingView canvas is retired.
  const landing = (
    <CourseDesignEditor course={course} organization={organization} />
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
        <KeyboardShortcuts />
        <CoursePhoneFrame>{landing}</CoursePhoneFrame>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <KeyboardShortcuts />
      {landing}
    </div>
  )
}

// Binds ⌘Z / Ctrl+Z to undo and ⌘⇧Z / ⌘Y / Ctrl+Y to redo. The listener is
// scoped to the lifetime of the customize tab via the useEffect cleanup, so it
// detaches the moment the user navigates to another tab. We intentionally fire
// even when an EditText contentEditable is focused — the browser's native text
// undo would only revert the visible DOM and leave our editor state stale.
function KeyboardShortcuts() {
  const ed = useEditor()
  // The editor context's identity changes whenever overrides change, so we
  // keep the latest reference in a ref and attach the window listener exactly
  // once. Otherwise every keystroke (which mutates overrides via setText)
  // would tear down and re-attach the listener.
  const edRef = useRef(ed)
  edRef.current = ed
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        edRef.current.undo()
        return
      }
      if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        edRef.current.redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  return null
}

// Slim top bar — the only chrome in the customize page. No left rail, no
// right inspector; every change happens inline on the canvas.
function CustomizeBar({
  courseTitle,
  previewHref,
  dirty,
  saving,
  onSave,
  initialSnapshot,
  onDiscarded,
}: {
  courseTitle: string
  previewHref: string
  dirty: boolean
  saving: boolean
  onSave: () => void
  initialSnapshot: ResolvedOverrides
  onDiscarded: () => void
}) {
  return (
    <div className="relative flex h-12 flex-shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-[12px] text-gray-500">Course landing</span>
        <span className="text-[13px] text-gray-400">›</span>
        <span className="truncate text-[13px] font-medium text-gray-900">
          {courseTitle}
        </span>
        <span className="mx-1 h-4 w-px bg-gray-200" aria-hidden="true" />
        <UndoRedoButtons />
        <HiddenSectionsPill />
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
        <DiscardButton
          dirty={dirty}
          saving={saving}
          initialSnapshot={initialSnapshot}
          onDiscarded={onDiscarded}
        />
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
      {/* Radix-portaled dialog — DOM location is purely organizational. The
          palette owns its ⌘K listener and open state internally. */}
      <CustomizeCommandPalette
        initialSnapshot={initialSnapshot}
        dirty={dirty}
        saving={saving}
        onSave={onSave}
        previewHref={previewHref}
        onDiscarded={onDiscarded}
      />
    </div>
  )
}

// Undo / Redo. Icons match the inline-SVG style of the existing DesktopIcon /
// PhoneIcon below. Buttons disable cleanly when the history stack has nothing
// further in that direction. The keyboard shortcuts hook (KeyboardShortcuts)
// covers ⌘Z / ⌘⇧Z without going through these.
function UndoRedoButtons() {
  const ed = useEditor()
  return (
    <div className="flex items-center gap-0.5">
      <BarIconButton
        label="Undo"
        title="Undo (⌘Z)"
        disabled={!ed.canUndo}
        onClick={ed.undo}
      >
        <UndoIcon />
      </BarIconButton>
      <BarIconButton
        label="Redo"
        title="Redo (⌘⇧Z)"
        disabled={!ed.canRedo}
        onClick={ed.redo}
      >
        <RedoIcon />
      </BarIconButton>
    </div>
  )
}

// Shared chrome for small 24×24 icon buttons in the bar. Mirrors the touch
// targets used by DeviceButton but for non-toggle actions.
function BarIconButton({
  label,
  title,
  disabled,
  onClick,
  children,
}: {
  label: string
  title?: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-600"
    >
      {children}
    </button>
  )
}

// Counts sections that the user has hidden (via the existing eye toggle in the
// canvas EditBlock hover pill) and exposes a popover listing each one so they
// can bring it back. Renders nothing when there are no hidden sections.
function HiddenSectionsPill() {
  const ed = useEditor()
  const hiddenIds = Object.keys(ed.overrides.visible).filter(
    (id) => ed.overrides.visible[id] === false,
  )
  if (hiddenIds.length === 0) return null
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="ml-1 flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 transition-colors hover:bg-amber-100"
        >
          <EyeOffIcon />
          <span>
            {hiddenIds.length}{' '}
            {hiddenIds.length === 1 ? 'section hidden' : 'sections hidden'}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="px-1.5 pb-1.5 text-[11px] font-medium tracking-wide text-gray-500 uppercase">
          Hidden sections
        </div>
        <ul className="flex flex-col gap-0.5">
          {hiddenIds.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => ed.setVisible(id, true)}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[12px] text-gray-700 transition-colors hover:bg-gray-100"
              >
                <span className="truncate">{SECTION_LABELS[id] ?? id}</span>
                <span className="ml-3 text-[10.5px] font-medium tracking-wide text-gray-500 uppercase">
                  Show
                </span>
              </button>
            </li>
          ))}
        </ul>
        {hiddenIds.length > 1 ? (
          <div className="mt-1 border-t border-gray-100 pt-1">
            <button
              type="button"
              onClick={() => {
                for (const id of hiddenIds) ed.setVisible(id, true)
              }}
              className="flex w-full items-center justify-center rounded px-2 py-1.5 text-[11.5px] font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              Show all
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

// "Discard changes" — restores the snapshot the editor was seeded with on
// mount, in a single undo-able history frame. After restore, the previous
// state is still reachable via ⌘Z, so this isn't a destructive action. The
// confirm step exists because the action affects the entire page at once.
function DiscardButton({
  dirty,
  saving,
  initialSnapshot,
  onDiscarded,
}: {
  dirty: boolean
  saving: boolean
  initialSnapshot: ResolvedOverrides
  onDiscarded: () => void
}) {
  const ed = useEditor()
  const [open, setOpen] = useState(false)
  if (!dirty) return null
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={saving}
          className="rounded-md border border-gray-200 bg-white px-2.5 py-[6px] text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Discard
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="text-[12.5px] font-medium text-gray-900">
          Discard unsaved changes?
        </div>
        <p className="mt-1 text-[11.5px] leading-snug text-gray-500">
          Restores this page to what was last saved. You can still ⌘Z to bring
          your edits back.
        </p>
        <div className="mt-3 flex justify-end gap-1.5">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-gray-200 bg-white px-2.5 py-[5px] text-[11.5px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={() => {
              ed.restore(initialSnapshot)
              onDiscarded()
              setOpen(false)
            }}
            className="rounded-md bg-gray-900 px-2.5 py-[5px] text-[11.5px] font-semibold text-white transition-colors hover:bg-gray-800"
          >
            Discard
          </button>
        </div>
      </PopoverContent>
    </Popover>
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

function UndoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8a4 4 0 0 1 4-4h5a3 3 0 0 1 0 6H8" />
      <path d="M5.5 5.5 3 8l2.5 2.5" />
    </svg>
  )
}

function RedoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13 8a4 4 0 0 0-4-4H4a3 3 0 0 0 0 6h4" />
      <path d="M10.5 5.5 13 8l-2.5 2.5" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 8s2.5-4.5 6-4.5c1.3 0 2.4.4 3.3 1" />
      <path d="M14 8s-2.5 4.5-6 4.5c-1.3 0-2.4-.4-3.3-1" />
      <path d="M6.6 6.6a2 2 0 0 0 2.8 2.8" />
      <path d="M2.5 2.5 13.5 13.5" />
    </svg>
  )
}
