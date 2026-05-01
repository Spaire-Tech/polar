'use client'

import { CourseLandingView } from '@/app/(main)/[organization]/portal/courses/[courseId]/CourseLandingView'
import type { FlatLesson } from '@/app/(main)/[organization]/portal/courses/[courseId]/MasterClassLessonList'
import {
  CourseRead,
  useUpdateCourse,
  useUploadCourseThumbnail,
  useUploadCourseTrailer,
} from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  joinLanding,
  splitLanding,
  type StoredLanding,
} from '../landingStorage'
import { toast } from '../../Toast/use-toast'
import {
  EditBlock,
  EditMedia,
  EditText,
  EditorProvider,
  useEditor,
  type LandingMedia,
  type LandingOverrides,
} from './EditPrimitives'

// ── Stored shape ─────────────────────────────────────────────────────────────

// LandingOverrides lives inside the course `description` field via the existing
// landing-storage marker. We extend StoredLanding with a `_overrides` blob so
// text/media/visibility maps round-trip without a backend schema change.
type StoredOverrides = LandingOverrides

function readOverrides(landing: StoredLanding | null): StoredOverrides {
  const ov = (landing as any)?._overrides as StoredOverrides | undefined
  return {
    text: { ...(ov?.text ?? {}) },
    media: { ...(ov?.media ?? {}) },
    visible: { ...(ov?.visible ?? {}) },
  }
}

function writeOverrides(
  landing: StoredLanding | null,
  next: StoredOverrides,
): StoredLanding {
  return { ...(landing ?? {}), _overrides: next } as StoredLanding
}

// ── Section list (must match EditableLandingCanvas) ─────────────────────────

const SECTIONS = [
  { id: 'hero', label: 'Hero', hint: 'Cinematic header' },
  { id: 'value', label: "What's included", hint: '4-column value strip' },
  { id: 'trailer', label: 'Trailer', hint: 'Video block' },
  { id: 'curriculum', label: 'Curriculum', hint: 'Chapter cards' },
  { id: 'lessons', label: 'All lessons', hint: 'Accordion + paywall' },
  { id: 'instructor', label: 'Instructor', hint: 'Bio + pull quote' },
  { id: 'reviews', label: 'Reviews', hint: 'Student quotes' },
  { id: 'finalCta', label: 'Final CTA', hint: 'Closing block' },
] as const

// Hero/trailer have direct course columns. Other slots ride inside the
// landing._overrides.media map and upload via the generic landing-media
// endpoint.
const MEDIA_SLOTS: { id: string; label: string; hint?: string }[] = [
  {
    id: 'hero.backdrop',
    label: 'Hero backdrop',
    hint: 'Image or video — top of the page',
  },
  { id: 'trailer.video', label: 'Trailer video', hint: 'mp4/webm' },
  {
    id: 'instructor.portrait',
    label: 'Instructor portrait',
    hint: 'Square or 4:5',
  },
  { id: 'finalCta.backdrop', label: 'Final CTA backdrop' },
  { id: 'curriculum.1', label: 'Chapter 01 cover' },
  { id: 'curriculum.2', label: 'Chapter 02 cover' },
  { id: 'curriculum.3', label: 'Chapter 03 cover' },
  { id: 'curriculum.4', label: 'Chapter 04 cover' },
  { id: 'curriculum.5', label: 'Chapter 05 cover' },
  { id: 'curriculum.6', label: 'Chapter 06 cover' },
]

// ── Top-level component ──────────────────────────────────────────────────────

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

  const initial = useMemo(() => {
    const { humanDescription, landing } = splitLanding(course.description)
    return {
      humanDescription: humanDescription ?? '',
      landing: (landing ?? {}) as StoredLanding,
      overrides: readOverrides(landing),
    }
  }, [course.id, course.description])

  const [overrides, setOverrides] = useState<StoredOverrides>(initial.overrides)
  const [dirty, setDirty] = useState(false)
  const overridesRef = useRef(overrides)

  useEffect(() => {
    setOverrides(initial.overrides)
    overridesRef.current = initial.overrides
    setDirty(false)
  }, [initial])

  const handleOverridesChange = (next: StoredOverrides) => {
    setOverrides(next)
    overridesRef.current = next
    setDirty(true)
  }

  const flatLessons: FlatLesson[] = useMemo(() => {
    let pos = 0
    return course.modules.flatMap((m) =>
      m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description ?? null,
        position: pos++,
        duration_seconds: l.duration_seconds ?? 0,
        thumbnail_url: l.thumbnail_url ?? null,
        thumbnail_object_position: l.thumbnail_object_position ?? null,
        mux_playback_id: l.mux_playback_id ?? null,
        mux_status: l.mux_status ?? null,
        completed: false,
        is_free_preview: l.is_free_preview ?? false,
        content_type: l.content_type,
        content: l.content ?? null,
      })),
    )
  }, [course.modules])

  const handleSave = async () => {
    try {
      const nextLanding = writeOverrides(initial.landing, overridesRef.current)
      await updateCourse.mutateAsync({
        courseId: course.id,
        body: {
          description: joinLanding(initial.humanDescription, nextLanding),
        },
      })
      setDirty(false)
      toast({ title: 'Landing saved' })
    } catch {
      toast({ title: 'Failed to save' })
    }
  }

  // Hero backdrop is a special slot: when uploaded as image, it also writes
  // course.thumbnail_url (so onboarding/customize stay in sync). We expose a
  // separate uploader to wire the editor's MediaPanel "Hero backdrop" tile.
  const handleHeroUpload = async (file: File) => {
    const updated = await uploadThumb.mutateAsync({ courseId: course.id, file })
    return {
      kind: 'image',
      url: updated.thumbnail_url ?? '',
    } as LandingMedia
  }

  const handleTrailerUpload = async (file: File) => {
    const updated = await uploadTrailer.mutateAsync({
      courseId: course.id,
      file,
    })
    return { kind: 'video', url: updated.trailer_url ?? '' } as LandingMedia
  }

  // Pre-populate hero/trailer media slots from course columns so editors see
  // the onboarding-uploaded image/trailer right away.
  const seededOverrides: StoredOverrides = useMemo(() => {
    const seeded = { ...overrides, media: { ...overrides.media } }
    if (!seeded.media['hero.backdrop'] && course.thumbnail_url) {
      seeded.media['hero.backdrop'] = {
        kind: 'image',
        url: course.thumbnail_url,
      }
    }
    if (!seeded.media['trailer.video'] && course.trailer_url) {
      seeded.media['trailer.video'] = {
        kind: 'video',
        url: course.trailer_url,
      }
    }
    return seeded
  }, [overrides, course.thumbnail_url, course.trailer_url])

  return (
    <div className="flex h-full flex-col bg-[oklch(0.96_0.005_280)]">
      <EditorProvider
        courseId={course.id}
        initialOverrides={seededOverrides}
        onChange={handleOverridesChange}
      >
        <Toolbar
          dirty={dirty}
          onSave={handleSave}
          saving={updateCourse.isPending}
        />
        <div className="flex flex-1 overflow-hidden">
          <LeftRail />
          <Canvas
            organization={organization}
            course={course}
            flatLessons={flatLessons}
          />
          <Inspector
            course={course}
            onHeroUpload={handleHeroUpload}
            onTrailerUpload={handleTrailerUpload}
            heroUploading={uploadThumb.isPending}
            trailerUploading={uploadTrailer.isPending}
          />
        </div>
      </EditorProvider>
    </div>
  )
}

// ── Toolbar (dark) ───────────────────────────────────────────────────────────

function Toolbar({
  dirty,
  onSave,
  saving,
}: {
  dirty: boolean
  onSave: () => void
  saving: boolean
}) {
  const ed = useEditor()
  return (
    <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-white/[0.06] bg-[oklch(0.18_0.01_280)] px-4 text-white">
      <div className="flex items-center gap-2 text-[12px] text-white/55">
        <span className="text-[14px] font-semibold tracking-tight text-white">
          Customize
        </span>
        <span className="mx-1 h-4 w-px bg-white/10" />
        <span>Course landing</span>
      </div>

      <div className="flex items-center gap-3">
        {/* Mode switch */}
        <div className="flex gap-0.5 rounded-full bg-white/[0.06] p-[3px]">
          {(['edit', 'preview'] as const).map((m) => (
            <button
              key={m}
              onClick={() => ed.setMode(m)}
              className={`rounded-full px-3 py-[5px] text-[12px] font-medium transition-colors ${
                ed.mode === m
                  ? 'bg-white text-[oklch(0.18_0.01_280)]'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              {m === 'edit' ? 'Edit' : 'Preview'}
            </button>
          ))}
        </div>

        <span className="h-4 w-px bg-white/10" />

        {/* Device switch */}
        <div className="flex gap-1">
          {(['desktop', 'tablet', 'mobile'] as const).map((d) => (
            <button
              key={d}
              onClick={() => ed.setDevice(d)}
              className={`flex h-7 w-8 items-center justify-center rounded-md text-[12px] transition-colors ${
                ed.device === d
                  ? 'bg-white/10 text-white'
                  : 'text-white/55 hover:text-white'
              }`}
              title={d}
            >
              {d === 'desktop' ? '🖥' : d === 'tablet' ? '⊟' : '▯'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          disabled={!dirty || saving}
          className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-[7px] text-[12px] font-medium text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onSave}
          disabled={!dirty || saving}
          className="rounded-md bg-[oklch(0.78_0.16_285)] px-3.5 py-[7px] text-[12px] font-semibold text-[oklch(0.18_0.01_280)] transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Publish
        </button>
      </div>
    </div>
  )
}

// ── Left rail ────────────────────────────────────────────────────────────────

function LeftRail() {
  const ed = useEditor()
  const items: { id: typeof ed.panel; label: string; icon: string }[] = [
    { id: 'sections', label: 'Sections', icon: '◫' },
    { id: 'content', label: 'Content', icon: '✎' },
    { id: 'media', label: 'Media', icon: '🖼' },
  ]
  return (
    <div className="flex w-16 flex-shrink-0 flex-col items-center gap-1 border-r border-gray-200 bg-white py-3">
      {items.map((it) => {
        const on = ed.panel === it.id
        return (
          <button
            key={it.id}
            onClick={() => ed.setPanel(it.id)}
            className={`flex w-13 flex-col items-center gap-1 rounded-md px-2 py-2.5 transition-colors ${
              on
                ? 'bg-[oklch(0.96_0.012_265)] text-[oklch(0.45_0.18_265)]'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span className="text-[16px]">{it.icon}</span>
            <span className="text-[10px] font-medium tracking-tight">
              {it.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Canvas (editable landing) ───────────────────────────────────────────────

function Canvas({
  organization,
  course,
  flatLessons,
}: {
  organization: schemas['Organization']
  course: CourseRead
  flatLessons: FlatLesson[]
}) {
  const ed = useEditor()
  const deviceWidth: Record<typeof ed.device, string | number> = {
    desktop: '100%',
    tablet: 900,
    mobile: 420,
  }
  const isFramed = ed.device !== 'desktop'

  return (
    <div className="flex-1 overflow-y-auto bg-[oklch(0.96_0.005_280)]">
      <div
        style={{
          width: deviceWidth[ed.device],
          maxWidth: '100%',
          margin: isFramed ? '24px auto' : 0,
          border: isFramed ? '1px solid oklch(0.92 0.003 280)' : 'none',
          borderRadius: isFramed ? 16 : 0,
          boxShadow: isFramed ? '0 12px 40px rgba(0,0,0,0.08)' : 'none',
          overflow: isFramed ? 'hidden' : 'visible',
          background: 'white',
          transition: 'all 250ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        <EditableLanding
          organization={organization}
          course={course}
          flatLessons={flatLessons}
        />
      </div>
    </div>
  )
}

function EditableLanding({
  organization,
  course,
  flatLessons,
}: {
  organization: schemas['Organization']
  course: CourseRead
  flatLessons: FlatLesson[]
}) {
  const ed = useEditor()

  // Build the landing JSON the public view expects, with text overrides applied.
  // Every editable field is mirrored into ed.text so the EditText elements can
  // mutate independently while CourseLandingView still receives the merged view.
  const landing = useMemo(() => {
    const t = (path: string, fallback: string) => ed.t(path, fallback)
    return {
      eyebrow: t('hero.eyebrow', 'SPAIRE ORIGINAL'),
      series_label: t('hero.series_label', 'NEW SERIES'),
      tagline: t('hero.tagline', course.title ?? ''),
      description: t('hero.description', ''),
      level: t('hero.level', 'All levels'),
      value_props_label: t('value.label', "WHAT'S INCLUDED"),
      value_props: [],
      curriculum_label: t('curriculum.label', 'CURRICULUM'),
      curriculum_heading: t('curriculum.heading', 'Built to compound.'),
      curriculum_subheading: t(
        'curriculum.subheading',
        'Every chapter assumes the last.',
      ),
      lessons_label: t('lessons.label', 'EVERY LESSON'),
      lessons_heading: t('lessons.heading', 'The full arc.'),
      lessons_subheading: t(
        'lessons.subheading',
        'Enroll to unlock the rest.',
      ),
      instructor_label: t('instructor.label', 'YOUR INSTRUCTOR'),
      instructor_pull_quote: t('instructor.quote', ''),
      instructor_credentials: [],
      reviews_label: t('reviews.label', 'FROM STUDENTS'),
      reviews: [],
      final_cta_label: t('finalCta.label', 'READY?'),
      final_cta_title: t('finalCta.title', "Start free."),
      final_cta_subtitle: t(
        'finalCta.subtitle',
        'The first lessons are free to preview.',
      ),
      final_cta_primary: t('finalCta.primary', 'Enroll'),
      final_cta_secondary: t('finalCta.secondary', 'Watch trailer'),
    }
  }, [
    ed.overrides.text,
    course.title,
  ])

  // We render the existing public CourseLandingView, but overlay editable
  // wrappers (EditBlock + EditMedia) by stacking them. The cleanest approach
  // here is to render the public view as the visual base and then overlay
  // transparent EditBlock wrappers via a thin DOM tree above it. To keep this
  // contained we instead render edit zones inline by wrapping with a single
  // EditBlock-per-section using anchor divs. CourseLandingView already owns
  // the visuals, so we add a simple "section affordance" overlay.

  return (
    <div className="relative">
      <CourseLandingView
        organizationName={organization.name}
        instructorName={ed.t('hero.instructor', course.instructor_name ?? '')}
        instructorBio={ed.t('instructor.bio', course.instructor_bio ?? '')}
        courseTitle={ed.t('hero.title', course.title ?? 'Untitled course')}
        courseDescription={ed.t('hero.description', '')}
        thumbnailUrl={
          ed.m('hero.backdrop')?.url ?? course.thumbnail_url ?? null
        }
        thumbnailObjectPosition={course.thumbnail_object_position ?? null}
        trailerUrl={
          ed.m('trailer.video')?.url ?? course.trailer_url ?? null
        }
        isStarted={false}
        paywallEnabled={course.paywall_enabled}
        paywallPosition={course.paywall_position}
        flatLessons={flatLessons}
        landing={landing}
        onStart={() => {}}
        onTrailer={() => {
          document
            .getElementById('preview-trailer')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
      />
      {/* Floating section overlays in edit mode — let the user toggle visibility
          and signpost which sections exist. The actual canvas is the public
          landing above; this layer is a thin affordance. */}
      {ed.mode === 'edit' && (
        <SectionOverlays />
      )}
      {/* Hidden inline-edit anchors so EditBlock/EditText/EditMedia keep their
          context wired through (used by Inspector controls below). */}
      <div className="hidden">
        {SECTIONS.map((s) => (
          <EditBlock key={s.id} id={s.id} label={s.label}>
            <span />
          </EditBlock>
        ))}
        {MEDIA_SLOTS.map((s) => (
          <EditMedia key={s.id} id={s.id} label={s.label}>
            <span />
          </EditMedia>
        ))}
        <EditText path="hero.title" defaultValue="" />
        <EditText path="hero.tagline" defaultValue="" />
      </div>
    </div>
  )
}

// Floating overlay strip showing each section with quick visibility toggle.
function SectionOverlays() {
  const ed = useEditor()
  return (
    <div className="pointer-events-none fixed top-20 right-[340px] z-30 flex flex-col gap-1">
      {SECTIONS.map((s) => {
        const visible = ed.overrides.visible[s.id] !== false
        return (
          <button
            key={s.id}
            onClick={() => ed.setVisible(s.id, !visible)}
            className={`pointer-events-auto rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] transition-colors ${
              visible
                ? 'border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50'
                : 'border-gray-300 bg-gray-100 text-gray-400 line-through'
            }`}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Inspector panel ─────────────────────────────────────────────────────────

function Inspector({
  course,
  onHeroUpload,
  onTrailerUpload,
  heroUploading,
  trailerUploading,
}: {
  course: CourseRead
  onHeroUpload: (f: File) => Promise<LandingMedia>
  onTrailerUpload: (f: File) => Promise<LandingMedia>
  heroUploading: boolean
  trailerUploading: boolean
}) {
  const ed = useEditor()
  const title = {
    sections: 'Sections',
    content: 'Content',
    media: 'Media',
  }[ed.panel]

  return (
    <div className="flex w-[320px] flex-shrink-0 flex-col border-l border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3.5">
        <span className="text-[13px] font-semibold tracking-tight text-gray-900">
          {title}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-3.5">
        {ed.panel === 'sections' && <SectionsPanel />}
        {ed.panel === 'content' && <ContentPanel course={course} />}
        {ed.panel === 'media' && (
          <MediaPanel
            course={course}
            onHeroUpload={onHeroUpload}
            onTrailerUpload={onTrailerUpload}
            heroUploading={heroUploading}
            trailerUploading={trailerUploading}
          />
        )}
      </div>
    </div>
  )
}

function SectionsPanel() {
  const ed = useEditor()
  return (
    <div className="px-2.5">
      <div className="px-1 pb-3 text-[12px] text-gray-500">
        Toggle to hide a section from the published landing.
      </div>
      {SECTIONS.map((s) => {
        const visible = ed.overrides.visible[s.id] !== false
        return (
          <div
            key={s.id}
            className="flex items-center gap-2.5 rounded-lg px-2 py-2.5 hover:bg-gray-50"
          >
            <span className="select-none text-gray-300">⋮⋮</span>
            <div className="flex-1">
              <div className="text-[12.5px] font-medium text-gray-900">
                {s.label}
              </div>
              <div className="mt-0.5 text-[11px] text-gray-500">{s.hint}</div>
            </div>
            <button
              type="button"
              onClick={() => ed.setVisible(s.id, !visible)}
              className={`relative h-[18px] w-[34px] rounded-full transition-colors ${
                visible
                  ? 'bg-[oklch(0.55_0.20_265)]'
                  : 'bg-gray-200'
              }`}
              aria-label={visible ? 'Hide section' : 'Show section'}
            >
              <span
                className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform"
                style={{
                  transform: visible ? 'translateX(18px)' : 'translateX(2px)',
                }}
              />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function ContentPanel({ course }: { course: CourseRead }) {
  return (
    <div className="flex flex-col">
      <PanelGroup title="Hero copy">
        <TextField
          label="Course title"
          path="hero.title"
          defaultValue={course.title ?? ''}
        />
        <TextField
          label="Eyebrow"
          path="hero.eyebrow"
          defaultValue="SPAIRE ORIGINAL"
        />
        <TextField
          label="Tagline"
          path="hero.tagline"
          defaultValue=""
          multiline
        />
        <TextField
          label="Description"
          path="hero.description"
          defaultValue=""
          multiline
        />
        <TextField label="Level" path="hero.level" defaultValue="All levels" />
      </PanelGroup>

      <PanelGroup title="Curriculum">
        <TextField
          label="Heading"
          path="curriculum.heading"
          defaultValue="Built to compound."
        />
        <TextField
          label="Subheading"
          path="curriculum.subheading"
          defaultValue=""
          multiline
        />
      </PanelGroup>

      <PanelGroup title="Lesson list">
        <TextField
          label="Heading"
          path="lessons.heading"
          defaultValue="The full arc."
        />
        <TextField
          label="Subheading"
          path="lessons.subheading"
          defaultValue=""
          multiline
        />
      </PanelGroup>

      <PanelGroup title="Instructor">
        <TextField
          label="Name"
          path="hero.instructor"
          defaultValue={course.instructor_name ?? ''}
        />
        <TextField
          label="Pull quote"
          path="instructor.quote"
          defaultValue=""
          multiline
        />
        <TextField
          label="Bio"
          path="instructor.bio"
          defaultValue={course.instructor_bio ?? ''}
          multiline
        />
      </PanelGroup>

      <PanelGroup title="Final CTA">
        <TextField
          label="Headline"
          path="finalCta.title"
          defaultValue="Start free."
          multiline
        />
        <TextField
          label="Subhead"
          path="finalCta.subtitle"
          defaultValue=""
          multiline
        />
        <TextField
          label="Primary button"
          path="finalCta.primary"
          defaultValue="Enroll"
        />
        <TextField
          label="Secondary button"
          path="finalCta.secondary"
          defaultValue="Watch trailer"
        />
      </PanelGroup>

      <div className="px-4 pb-4 text-[11.5px] leading-relaxed text-gray-500">
        Tip — click any text on the page to edit in place. Hover any media tile
        for an upload button.
      </div>
    </div>
  )
}

function MediaPanel({
  course: _course,
  onHeroUpload,
  onTrailerUpload,
  heroUploading,
  trailerUploading,
}: {
  course: CourseRead
  onHeroUpload: (f: File) => Promise<LandingMedia>
  onTrailerUpload: (f: File) => Promise<LandingMedia>
  heroUploading: boolean
  trailerUploading: boolean
}) {
  return (
    <div>
      <div className="px-4 pb-3 text-[12px] leading-relaxed text-gray-500">
        Upload images or videos for any slot. Hero and trailer write to the
        course directly so they show up on the storefront and the onboarding
        preview.
      </div>
      <div className="px-2.5">
        {MEDIA_SLOTS.map((s) => (
          <MediaSlotRow
            key={s.id}
            id={s.id}
            label={s.label}
            hint={s.hint}
            customUpload={
              s.id === 'hero.backdrop'
                ? onHeroUpload
                : s.id === 'trailer.video'
                  ? onTrailerUpload
                  : undefined
            }
            customBusy={
              s.id === 'hero.backdrop'
                ? heroUploading
                : s.id === 'trailer.video'
                  ? trailerUploading
                  : false
            }
          />
        ))}
      </div>
    </div>
  )
}

function MediaSlotRow({
  id,
  label,
  hint,
  customUpload,
  customBusy,
}: {
  id: string
  label: string
  hint?: string
  customUpload?: (f: File) => Promise<LandingMedia>
  customBusy?: boolean
}) {
  const ed = useEditor()
  const m = ed.m(id)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    try {
      const next = customUpload
        ? await customUpload(f)
        : await ed.uploadMedia(f)
      ed.setMedia(id, next)
    } catch {
      toast({ title: 'Upload failed' })
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  return (
    <div className="flex items-center gap-2.5 rounded-lg px-1 py-2 hover:bg-gray-50">
      <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
        {m?.kind === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {m?.kind === 'video' && (
          <video
            src={m.url}
            muted
            loop
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {!m && (
          <span className="absolute inset-0 flex items-center justify-center text-gray-300">
            🖼
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-medium tracking-tight text-gray-900">
          {label}
        </div>
        <div className="truncate text-[11px] text-gray-500">
          {m ? 'Uploaded' : hint || 'Empty'}
        </div>
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy || customBusy}
          className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50"
          title="Upload"
        >
          ↑
        </button>
        {m && (
          <button
            type="button"
            onClick={() => ed.setMedia(id, null)}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200"
            title="Remove"
          >
            ✕
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={onFile}
        />
      </div>
    </div>
  )
}

// ── Form primitives (inspector) ─────────────────────────────────────────────

function PanelGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-gray-100 pb-4 mb-4 last:border-b-0">
      <div className="px-4 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-gray-500">
        {title}
      </div>
      <div className="flex flex-col gap-2.5 px-4">{children}</div>
    </div>
  )
}

function TextField({
  label,
  path,
  defaultValue,
  multiline,
}: {
  label: string
  path: string
  defaultValue: string
  multiline?: boolean
}) {
  const ed = useEditor()
  const v = ed.t(path, defaultValue)
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-gray-600">{label}</span>
      {multiline ? (
        <textarea
          value={v}
          rows={3}
          onChange={(e) => ed.setText(path, e.target.value)}
          className="w-full resize-none rounded-md border border-gray-200 bg-white px-2.5 py-2 text-[12.5px] tracking-tight text-gray-900 transition-colors focus:border-blue-500 focus:outline-none"
        />
      ) : (
        <input
          value={v}
          onChange={(e) => ed.setText(path, e.target.value)}
          className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-[12.5px] tracking-tight text-gray-900 transition-colors focus:border-blue-500 focus:outline-none"
        />
      )}
    </label>
  )
}
