'use client'

// New customize editor for the course landing page.
//
// Layout: top sub-toolbar (mode + device + save) → left rail (Design / Content
// / Media / Sections / AI) → live canvas → right inspector. Sits inside the
// CourseHeader-driven nav, so the dashboard top nav stays as-is.
//
// Edits are accumulated locally in `draft` (LandingConfig) and persisted via
// the parent's onSave handler, which writes them to course.landing_config.

import {
  ensureGoogleFonts,
  isSectionVisible,
  mediaValue,
  setMedia as configSetMedia,
  setText as configSetText,
  setTheme as configSetTheme,
  setVisible as configSetVisible,
  textValue,
  themeStyle,
  type LandingConfig,
  type LandingMedia,
  type LandingSectionId,
  type LandingTheme,
  LandingEditorProvider,
} from '../landingConfig'
import {
  CourseRead,
  useUploadCourseThumbnail,
} from '@/hooks/queries/courses'
import {
  CurriculumTimeline,
  FinalCta,
  FullLessonList,
  InstructorBlock,
  Reviews,
  TrailerBlock,
  ValueStrip,
} from '../CourseWizard.preview'
import { splitLanding, type StoredLanding } from '../landingStorage'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import DesktopWindowsOutlined from '@mui/icons-material/DesktopWindowsOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import PhoneIphoneOutlined from '@mui/icons-material/PhoneIphoneOutlined'
import RestartAltOutlined from '@mui/icons-material/RestartAltOutlined'
import TabletMacOutlined from '@mui/icons-material/TabletMacOutlined'
import TextFieldsOutlined from '@mui/icons-material/TextFieldsOutlined'
import ViewQuiltOutlined from '@mui/icons-material/ViewQuiltOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Inspector } from './CustomizeTab.inspector'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CourseCustomizeEdits = {
  title: string | null
  description: string | null
  instructor_name: string | null
  instructor_bio: string | null
  instructor_name_italic: boolean
  instructor_name_bold: boolean
  instructor_name_uppercase: boolean
  trailer_url: string | null
  thumbnail_object_position: string | null
  landing_config: LandingConfig | null
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile'
type EditorMode = 'edit' | 'preview'
type PanelId = 'design' | 'content' | 'media' | 'sections' | 'ai'

// ─── Main component ───────────────────────────────────────────────────────────

export function CustomizeTab({
  course,
  onSave,
  isSaving,
}: {
  course: CourseRead
  onSave: (edits: CourseCustomizeEdits) => void
  isSaving: boolean
}) {
  const uploadThumbnail = useUploadCourseThumbnail()
  const thumbnailInputRef = useRef<HTMLInputElement>(null)

  // Course-level fields (editable directly on the course row).
  const [title, setTitle] = useState(course.title ?? '')
  const [description, setDescription] = useState(course.description ?? '')
  const [instructorName, setInstructorName] = useState(
    course.instructor_name ?? '',
  )
  const [instructorBio, setInstructorBio] = useState(
    course.instructor_bio ?? '',
  )
  const [trailerUrl, setTrailerUrl] = useState(course.trailer_url ?? '')
  const [thumbnailUrl, setThumbnailUrl] = useState(
    course.thumbnail_url ?? null,
  )
  const [thumbnailPosition, setThumbnailPosition] = useState<string | null>(
    course.thumbnail_object_position ?? null,
  )

  // Landing config draft — drives the live canvas.
  const [draft, setDraft] = useState<LandingConfig>(
    course.landing_config ?? {},
  )

  // Editor UI state
  const [mode, setMode] = useState<EditorMode>('edit')
  const [device, setDevice] = useState<DeviceMode>('desktop')
  const [panel, setPanel] = useState<PanelId>('design')

  // Reset when navigating to a different course.
  useEffect(() => {
    setTitle(course.title ?? '')
    setDescription(course.description ?? '')
    setInstructorName(course.instructor_name ?? '')
    setInstructorBio(course.instructor_bio ?? '')
    setTrailerUrl(course.trailer_url ?? '')
    setThumbnailUrl(course.thumbnail_url ?? null)
    setThumbnailPosition(course.thumbnail_object_position ?? null)
    setDraft(course.landing_config ?? {})
  }, [course.id])

  useEffect(() => {
    ensureGoogleFonts(draft)
  }, [draft])

  const dirty =
    title !== (course.title ?? '') ||
    description !== (course.description ?? '') ||
    instructorName !== (course.instructor_name ?? '') ||
    instructorBio !== (course.instructor_bio ?? '') ||
    trailerUrl !== (course.trailer_url ?? '') ||
    (thumbnailPosition ?? null) !==
      (course.thumbnail_object_position ?? null) ||
    JSON.stringify(draft) !== JSON.stringify(course.landing_config ?? {})

  const handleThumbnailUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const updated = await uploadThumbnail.mutateAsync({
        courseId: course.id,
        file,
      })
      setThumbnailUrl(updated.thumbnail_url ?? null)
    } catch {}
    e.target.value = ''
  }

  const handleSave = () => {
    onSave({
      title: title.trim() || null,
      description: description.trim() || null,
      instructor_name: instructorName.trim() || null,
      instructor_bio: instructorBio.trim() || null,
      // styling toggles kept unchanged from course; the redesigned editor
      // controls these via the theme typography knobs instead.
      instructor_name_italic: course.instructor_name_italic,
      instructor_name_bold: course.instructor_name_bold,
      instructor_name_uppercase: course.instructor_name_uppercase,
      trailer_url: trailerUrl.trim() || null,
      thumbnail_object_position: thumbnailPosition,
      landing_config: draft,
    })
  }

  const handleReset = () => {
    setTitle(course.title ?? '')
    setDescription(course.description ?? '')
    setInstructorName(course.instructor_name ?? '')
    setInstructorBio(course.instructor_bio ?? '')
    setTrailerUrl(course.trailer_url ?? '')
    setThumbnailUrl(course.thumbnail_url ?? null)
    setThumbnailPosition(course.thumbnail_object_position ?? null)
    setDraft(course.landing_config ?? {})
  }

  // Mutators wired through the LandingEditorProvider so primitives in the
  // canvas (EditText / EditMedia / EditSection) can write back.
  const editorCtx = useMemo(
    () => ({
      config: draft,
      mode,
      setText: (path: string, value: string | null) =>
        setDraft((d) => configSetText(d, path, value)),
      setMedia: (id: string, value: LandingMedia) =>
        setDraft((d) => configSetMedia(d, id, value)),
      setTheme: (patch: LandingTheme) =>
        setDraft((d) => configSetTheme(d, patch)),
      setVisible: (id: LandingSectionId, value: boolean) =>
        setDraft((d) => configSetVisible(d, id, value)),
    }),
    [draft, mode],
  )

  const deviceWidth: number | string = {
    desktop: '100%',
    tablet: 900,
    mobile: 420,
  }[device]

  return (
    <LandingEditorProvider value={editorCtx}>
      <div className="flex h-full min-h-0 overflow-hidden">
        {/* LEFT RAIL — panel selector */}
        <LeftRail panel={panel} onPanel={setPanel} mode={mode} />

        {/* CANVAS COLUMN — sub-toolbar + live preview */}
        <div className="flex flex-1 flex-col overflow-hidden bg-gray-100">
          <SubToolbar
            mode={mode}
            onMode={setMode}
            device={device}
            onDevice={setDevice}
            dirty={dirty}
            isSaving={isSaving}
            onSave={handleSave}
            onReset={handleReset}
          />
          <div className="flex-1 overflow-auto p-6">
            <div
              className="mx-auto bg-white"
              style={{
                width: deviceWidth,
                maxWidth: '100%',
                borderRadius: device === 'desktop' ? 16 : 22,
                border:
                  device === 'desktop'
                    ? '1px solid rgb(229,229,232)'
                    : '1px solid rgb(229,229,232)',
                boxShadow:
                  device === 'desktop'
                    ? '0 1px 2px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.06)'
                    : '0 12px 40px rgba(0,0,0,0.10)',
                overflow: 'hidden',
              }}
            >
              <CanvasPreview
                course={course}
                draft={draft}
                title={title}
                description={description}
                instructorName={instructorName}
                instructorBio={instructorBio}
                trailerUrl={trailerUrl}
                thumbnailUrl={thumbnailUrl}
                thumbnailPosition={thumbnailPosition}
                device={device}
              />
            </div>
          </div>
        </div>

        {/* RIGHT INSPECTOR */}
        <Inspector
          panel={panel}
          draft={draft}
          setDraft={setDraft}
          // course-level fields proxied for Content panel
          title={title}
          setTitle={setTitle}
          description={description}
          setDescription={setDescription}
          instructorName={instructorName}
          setInstructorName={setInstructorName}
          instructorBio={instructorBio}
          setInstructorBio={setInstructorBio}
          trailerUrl={trailerUrl}
          setTrailerUrl={setTrailerUrl}
          thumbnailUrl={thumbnailUrl}
          thumbnailPosition={thumbnailPosition}
          setThumbnailPosition={setThumbnailPosition}
          uploading={uploadThumbnail.isPending}
          onPickThumbnail={() => thumbnailInputRef.current?.click()}
        />
        <input
          ref={thumbnailInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleThumbnailUpload}
        />
      </div>
    </LandingEditorProvider>
  )
}

// ─── Sub-toolbar (mode / device / save) ─────────────────────────────────────

function SubToolbar({
  mode,
  onMode,
  device,
  onDevice,
  dirty,
  isSaving,
  onSave,
  onReset,
}: {
  mode: EditorMode
  onMode: (m: EditorMode) => void
  device: DeviceMode
  onDevice: (d: DeviceMode) => void
  dirty: boolean
  isSaving: boolean
  onSave: () => void
  onReset: () => void
}) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4">
      {/* Left: mode toggle */}
      <div className="flex items-center gap-1 rounded-full bg-gray-100 p-0.5">
        <button
          type="button"
          onClick={() => onMode('edit')}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === 'edit'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <EditOutlined sx={{ fontSize: 13 }} />
          Edit
        </button>
        <button
          type="button"
          onClick={() => onMode('preview')}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === 'preview'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <VisibilityOutlined sx={{ fontSize: 13 }} />
          Preview
        </button>
      </div>

      {/* Center: device toggle */}
      <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5">
        {(
          [
            ['desktop', DesktopWindowsOutlined],
            ['tablet', TabletMacOutlined],
            ['mobile', PhoneIphoneOutlined],
          ] as const
        ).map(([id, Icon]) => (
          <button
            type="button"
            key={id}
            onClick={() => onDevice(id)}
            title={id}
            className={`flex h-7 w-8 items-center justify-center rounded-md transition-colors ${
              device === id
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Icon sx={{ fontSize: 15 }} />
          </button>
        ))}
      </div>

      {/* Right: save / reset */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onReset}
          disabled={!dirty || isSaving}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-40"
        >
          <RestartAltOutlined sx={{ fontSize: 14 }} />
          Reset
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || isSaving}
          className="rounded-full bg-gray-900 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
        >
          {isSaving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

// ─── Left rail ──────────────────────────────────────────────────────────────

function LeftRail({
  panel,
  onPanel,
  mode,
}: {
  panel: PanelId
  onPanel: (p: PanelId) => void
  mode: EditorMode
}) {
  if (mode === 'preview') {
    return (
      <div className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-gray-200 bg-white py-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-400"
          title="Preview mode — switch to Edit to use panels"
        >
          <VisibilityOutlined sx={{ fontSize: 16 }} />
        </div>
      </div>
    )
  }
  const items: {
    id: PanelId
    label: string
    Icon: typeof EditOutlined
  }[] = [
    { id: 'design', label: 'Design', Icon: AutoAwesomeOutlined },
    { id: 'content', label: 'Content', Icon: TextFieldsOutlined },
    { id: 'media', label: 'Media', Icon: ImageOutlined },
    { id: 'sections', label: 'Sections', Icon: ViewQuiltOutlined },
    { id: 'ai', label: 'AI', Icon: AutoAwesomeOutlined },
  ]
  return (
    <div className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-gray-200 bg-white py-3">
      {items.map(({ id, label, Icon }) => {
        const on = panel === id
        return (
          <button
            type="button"
            key={id}
            onClick={() => onPanel(id)}
            className={`flex w-12 flex-col items-center gap-1 rounded-lg py-2 transition-colors ${
              on
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icon sx={{ fontSize: 18 }} />
            <span className="text-[10px] font-medium tracking-wide">
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Live canvas: re-uses public landing components with the draft applied ──

function CanvasPreview({
  course,
  draft,
  title,
  description,
  instructorName,
  instructorBio,
  trailerUrl,
  thumbnailUrl,
  thumbnailPosition,
  device,
}: {
  course: CourseRead
  draft: LandingConfig
  title: string
  description: string
  instructorName: string
  instructorBio: string
  trailerUrl: string
  thumbnailUrl: string | null
  thumbnailPosition: string | null
  device: DeviceMode
}) {
  const { humanDescription, landing } = useMemo(
    () => splitLanding(description),
    [description],
  )

  // If there's no AI landing payload yet, fall back to a minimal shape so the
  // sections still render (they all guard against empty fields).
  const landingPayload: StoredLanding = landing ?? {
    eyebrow: 'SPAIRE ORIGINAL',
    series_label: 'NEW SERIES',
    tagline: '',
    description: humanDescription ?? '',
    level: 'All levels',
  }

  const flatLessons = useMemo(
    () =>
      course.modules.flatMap((m) =>
        m.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          content_type: l.content_type,
          duration_seconds: l.duration_seconds,
          is_free_preview: l.is_free_preview,
          published: l.published,
          thumbnail_url: l.thumbnail_url,
          mux_playback_id: l.mux_playback_id ?? null,
          locked: false,
          completed: false,
        })),
      ),
    [course.modules],
  )

  const heroMedia = mediaValue(draft, 'hero.backdrop')
  const trailerMedia = mediaValue(draft, 'trailer.video')
  const finalCtaMedia = mediaValue(draft, 'finalCta.backdrop')

  const effectiveHeroImage =
    heroMedia?.kind === 'image' ? heroMedia.url : thumbnailUrl
  const effectiveHeroVideo =
    heroMedia?.kind === 'video' ? heroMedia.url : null
  const effectiveTrailer = trailerMedia?.url ?? trailerUrl

  const totalDurationSeconds = flatLessons.reduce(
    (acc, l) => acc + (l.duration_seconds ?? 0),
    0,
  )

  const pricing = {
    paywallEnabled: course.paywall_enabled,
    priceCents: 0,
    freePreviewLessons: course.paywall_position ?? 0,
  }

  const outline = {
    modules: [
      {
        title: title || 'Course',
        lessons: flatLessons.map((l) => ({
          title: l.title,
          content_type:
            l.content_type === 'video' ? ('video' as const) : ('text' as const),
        })),
      },
    ],
  }

  const visible = (id: LandingSectionId) => isSectionVisible(draft, id)

  const wrapperStyle: React.CSSProperties = {
    ...themeStyle(draft),
    fontFamily: "'Poppins', system-ui, sans-serif",
    // Hint to responsive rules in our preview when shrunk to tablet/mobile.
    minHeight: 600,
  }

  return (
    <div style={wrapperStyle} data-device={device}>
      {visible('hero') && (
        <CanvasHero
          title={textValue(draft, 'hero.title', title || 'Course title')}
          tagline={textValue(
            draft,
            'hero.tagline',
            landingPayload.tagline ?? '',
          )}
          eyebrow={textValue(
            draft,
            'hero.eyebrow',
            landingPayload.eyebrow ?? 'SPAIRE ORIGINAL',
          )}
          seriesLabel={textValue(
            draft,
            'hero.series_label',
            landingPayload.series_label ?? 'NEW SERIES',
          )}
          level={textValue(
            draft,
            'hero.level',
            landingPayload.level ?? 'All levels',
          )}
          instructorName={instructorName || 'Instructor'}
          thumbnailUrl={effectiveHeroImage}
          thumbnailPosition={thumbnailPosition}
          heroVideoUrl={effectiveHeroVideo}
          totalDurationSeconds={totalDurationSeconds}
          lessonCount={flatLessons.length}
          paywallEnabled={course.paywall_enabled}
          hasTrailer={!!effectiveTrailer}
        />
      )}
      {visible('trailer') && effectiveTrailer && (
        <TrailerBlock
          trailerUrl={effectiveTrailer}
          thumbnailUrl={effectiveHeroImage}
          thumbPosition={thumbnailPosition}
          onReplaceTrailer={() => {}}
        />
      )}
      {visible('value') && <ValueStrip landing={landingPayload} />}
      {visible('curriculum') && (
        <CurriculumTimeline outline={outline} landing={landingPayload} />
      )}
      {visible('lessons') && (
        <FullLessonList
          outline={outline}
          pricing={pricing}
          landing={landingPayload}
        />
      )}
      {visible('instructor') && (
        <InstructorBlock
          instructor={{
            name: instructorName || 'Instructor',
            bio: instructorBio,
          }}
          draft={{
            name: instructorName,
            courseTitle: title,
            desc: humanDescription ?? '',
            nameItalic: false,
            nameBold: true,
            nameUppercase: true,
          }}
          landing={landingPayload}
          portraitUrl={mediaValue(draft, 'instructor.portrait')?.url ?? null}
        />
      )}
      {visible('reviews') && <Reviews landing={landingPayload} />}
      {visible('finalCta') && (
        <FinalCta
          landing={landingPayload}
          pricing={pricing}
          onCreate={() => {}}
          backdropUrl={finalCtaMedia?.url ?? null}
        />
      )}
    </div>
  )
}

function CanvasHero({
  title,
  tagline,
  eyebrow,
  seriesLabel,
  level,
  instructorName,
  thumbnailUrl,
  thumbnailPosition,
  heroVideoUrl,
  totalDurationSeconds,
  lessonCount,
  paywallEnabled,
  hasTrailer,
}: {
  title: string
  tagline: string
  eyebrow: string
  seriesLabel: string
  level: string
  instructorName: string
  thumbnailUrl: string | null
  thumbnailPosition: string | null
  heroVideoUrl: string | null
  totalDurationSeconds: number
  lessonCount: number
  paywallEnabled: boolean
  hasTrailer: boolean
}) {
  const fmtDuration = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    return h > 0 ? `${h} hr ${m} min` : `${m} min`
  }
  const FONT = "'Poppins', system-ui, sans-serif"
  return (
    <section
      style={{
        position: 'relative',
        height: 'min(82vh, 680px)',
        minHeight: 520,
        margin: '20px 20px 0',
        borderRadius: 24,
        overflow: 'hidden',
        background: '#000',
        isolation: 'isolate',
        fontFamily: FONT,
      }}
    >
      <div style={{ position: 'absolute', inset: 0 }}>
        {heroVideoUrl ? (
          <video
            key={heroVideoUrl}
            src={heroVideoUrl}
            autoPlay
            muted
            loop
            playsInline
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: thumbnailPosition ?? 'center',
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse at 25% 35%, oklch(0.42 0.12 35) 0%, oklch(0.18 0.05 280) 55%, oklch(0.08 0.02 280) 100%)',
            }}
          />
        )}
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 80%, rgba(0,0,0,0.88) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 32,
          top: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          letterSpacing: '0.18em',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.85)',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'oklch(0.78 0.16 25)',
            boxShadow: '0 0 12px oklch(0.78 0.16 25)',
          }}
        />
        {eyebrow}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '40px 48px 44px',
          color: 'white',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 18,
            fontSize: 12,
            color: 'rgba(255,255,255,0.7)',
            fontWeight: 500,
          }}
        >
          <span
            style={{
              padding: '4px 10px',
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.2)',
              fontSize: 10,
              letterSpacing: '0.12em',
              fontWeight: 600,
              color: 'white',
            }}
          >
            {seriesLabel}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.65)' }}>
            {lessonCount} lessons
          </span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.65)' }}>
            {totalDurationSeconds > 0
              ? fmtDuration(totalDurationSeconds)
              : '—'}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.65)' }}>{level}</span>
        </div>
        <h1
          style={{
            fontSize: 'clamp(38px, 6vw, 76px)',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 0.96,
            margin: '0 0 18px',
            color: 'white',
            maxWidth: '14ch',
            textShadow: '0 2px 30px rgba(0,0,0,0.4)',
          }}
        >
          {title}
        </h1>
        {(tagline || instructorName) && (
          <div
            style={{
              fontSize: 'clamp(14px, 1.3vw, 17px)',
              fontWeight: 400,
              color: 'rgba(255,255,255,0.92)',
              maxWidth: 600,
              marginBottom: 28,
              lineHeight: 1.4,
            }}
          >
            {tagline}{' '}
            {instructorName && (
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>
                — with {instructorName}
              </span>
            )}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 22px 12px 14px',
              background: 'white',
              color: 'oklch(0.18 0.008 280)',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'oklch(0.18 0.008 280)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingLeft: 2,
              }}
            >
              ▶
            </span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {paywallEnabled ? 'Enroll' : 'Start free'}
            </span>
          </button>
          {hasTrailer && (
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '13px 20px',
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: 'white',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Watch trailer
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

