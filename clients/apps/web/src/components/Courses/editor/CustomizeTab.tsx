'use client'

import { CourseRead, useUploadCourseThumbnail } from '@/hooks/queries/courses'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import MovieOutlined from '@mui/icons-material/MovieOutlined'
import PersonOutlined from '@mui/icons-material/PersonOutlined'
import TextFieldsOutlined from '@mui/icons-material/TextFieldsOutlined'
import { useEffect, useRef, useState } from 'react'
import { ThumbnailPositioner } from './ThumbnailPositioner'

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
}

// ─── Hero preview (mirrors real landing page) ─────────────────────────────────

export function HeroPreview({
  title,
  description,
  instructorName,
  instructorNameItalic,
  instructorNameBold,
  instructorNameUppercase,
  thumbnailUrl,
  thumbnailObjectPosition,
  trailerUrl,
}: {
  title: string | null
  description: string | null
  instructorName: string | null
  instructorNameItalic: boolean
  instructorNameBold: boolean
  instructorNameUppercase: boolean
  thumbnailUrl: string | null
  thumbnailObjectPosition: string | null
  trailerUrl: string | null
}) {
  const displayName = instructorName || 'Instructor Name'
  const displayTitle = title || 'Course Title'
  const displayDesc = description || ''

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden bg-black"
      style={{ fontFamily: 'var(--font-dm-sans), system-ui, sans-serif' }}
    >
      {/* Background: trailer → thumbnail → gradient */}
      {trailerUrl ? (
        <video
          key={trailerUrl}
          src={trailerUrl}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: thumbnailObjectPosition ?? 'center' }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
          }}
        />
      )}

      {/* Gradients */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to right, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.7) 25%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0) 100%)',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: '40%',
          background:
            'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0) 100%)',
        }}
      />

      {/* Content */}
      <div
        className="absolute bottom-0 left-0 z-10 flex flex-col items-center text-center text-white"
        style={{ padding: '0 10% 12%', width: 'min(55%, 280px)' }}
      >
        {/* Instructor name */}
        <div
          style={{
            fontFamily: 'var(--font-barlow-condensed), Impact, sans-serif',
            fontWeight: instructorNameBold ? 800 : 700,
            fontStyle: instructorNameItalic ? 'italic' : 'normal',
            fontSize: 'clamp(22px, 4vw, 32px)',
            lineHeight: 0.95,
            letterSpacing: '0.01em',
            textTransform: instructorNameUppercase ? 'uppercase' : 'none',
            whiteSpace: 'nowrap',
            width: '100%',
          }}
        >
          {displayName}
        </div>

        {/* Separator */}
        <div
          style={{
            width: 20,
            height: 1.5,
            background: '#fff',
            margin: '10px auto 8px',
          }}
        />

        {/* Course title */}
        <div
          style={{
            fontSize: 'clamp(11px, 1.6vw, 14px)',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.98)',
            letterSpacing: '-0.005em',
            marginBottom: 8,
          }}
        >
          {displayTitle}
        </div>

        {/* Description */}
        {displayDesc && (
          <p
            style={{
              fontSize: 'clamp(9px, 1.2vw, 11px)',
              fontWeight: 400,
              color: 'rgba(255,255,255,0.72)',
              lineHeight: 1.5,
              marginBottom: 14,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {displayDesc}
          </p>
        )}

        {/* CTA */}
        <div className="flex items-center gap-2">
          <div
            style={{
              padding: '6px 14px',
              background: '#fff',
              color: '#000',
              borderRadius: 100,
              fontSize: 'clamp(9px, 1.1vw, 11px)',
              fontWeight: 500,
            }}
          >
            Start Class
          </div>
          {trailerUrl && (
            <div
              style={{
                padding: '6px 12px',
                background: 'rgba(30,30,30,0.85)',
                color: '#fff',
                borderRadius: 100,
                fontSize: 'clamp(9px, 1.1vw, 11px)',
                fontWeight: 500,
              }}
            >
              Trailer
            </div>
          )}
        </div>
      </div>

      {/* "PREVIEW" watermark */}
      <div
        className="absolute right-3 top-3 z-20 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-white/50"
        style={{ background: 'rgba(255,255,255,0.08)' }}
      >
        Preview
      </div>
    </div>
  )
}

// ─── Field components ─────────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500">
          {icon}
        </span>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
      {children}
    </label>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-900/8"
    />
  )
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm leading-relaxed text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-900/8"
    />
  )
}

function StyleToggle({
  active,
  onClick,
  label,
  italic,
  bold,
}: {
  active: boolean
  onClick: () => void
  label: string
  italic?: boolean
  bold?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border py-1.5 text-xs transition-all ${
        active
          ? 'border-gray-900 bg-gray-900 text-white'
          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
      }`}
      style={{
        fontStyle: italic ? 'italic' : 'normal',
        fontWeight: bold ? 700 : 400,
      }}
    >
      {label}
    </button>
  )
}

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

  // Local draft state (reflects course props, editable in real-time)
  const [title, setTitle] = useState(course.title ?? '')
  const [description, setDescription] = useState(course.description ?? '')
  const [instructorName, setInstructorName] = useState(
    course.instructor_name ?? '',
  )
  const [instructorBio, setInstructorBio] = useState(
    course.instructor_bio ?? '',
  )
  const [nameItalic, setNameItalic] = useState(course.instructor_name_italic)
  const [nameBold, setNameBold] = useState(course.instructor_name_bold)
  const [nameUppercase, setNameUppercase] = useState(
    course.instructor_name_uppercase,
  )
  const [trailerUrl, setTrailerUrl] = useState(course.trailer_url ?? '')
  const [thumbnailUrl, setThumbnailUrl] = useState(
    course.thumbnail_url ?? null,
  )
  const [thumbnailPosition, setThumbnailPosition] = useState<string | null>(
    course.thumbnail_object_position ?? null,
  )

  // Sync if course changes from outside (e.g. refetch)
  useEffect(() => {
    setTitle(course.title ?? '')
    setDescription(course.description ?? '')
    setInstructorName(course.instructor_name ?? '')
    setInstructorBio(course.instructor_bio ?? '')
    setNameItalic(course.instructor_name_italic)
    setNameBold(course.instructor_name_bold)
    setNameUppercase(course.instructor_name_uppercase)
    setTrailerUrl(course.trailer_url ?? '')
    setThumbnailUrl(course.thumbnail_url ?? null)
    setThumbnailPosition(course.thumbnail_object_position ?? null)
  }, [course.id]) // reset only when course changes

  const dirty =
    title !== (course.title ?? '') ||
    description !== (course.description ?? '') ||
    instructorName !== (course.instructor_name ?? '') ||
    instructorBio !== (course.instructor_bio ?? '') ||
    nameItalic !== course.instructor_name_italic ||
    nameBold !== course.instructor_name_bold ||
    nameUppercase !== course.instructor_name_uppercase ||
    trailerUrl !== (course.trailer_url ?? '') ||
    (thumbnailPosition ?? null) !== (course.thumbnail_object_position ?? null)

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
    } catch {
      // handled by mutation
    }
    e.target.value = ''
  }

  const handleSave = () => {
    onSave({
      title: title.trim() || null,
      description: description.trim() || null,
      instructor_name: instructorName.trim() || null,
      instructor_bio: instructorBio.trim() || null,
      instructor_name_italic: nameItalic,
      instructor_name_bold: nameBold,
      instructor_name_uppercase: nameUppercase,
      trailer_url: trailerUrl.trim() || null,
      thumbnail_object_position: thumbnailPosition,
    })
  }

  const handleReset = () => {
    setTitle(course.title ?? '')
    setDescription(course.description ?? '')
    setInstructorName(course.instructor_name ?? '')
    setInstructorBio(course.instructor_bio ?? '')
    setNameItalic(course.instructor_name_italic)
    setNameBold(course.instructor_name_bold)
    setNameUppercase(course.instructor_name_uppercase)
    setTrailerUrl(course.trailer_url ?? '')
    setThumbnailUrl(course.thumbnail_url ?? null)
    setThumbnailPosition(course.thumbnail_object_position ?? null)
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* ── Left: editor panel ────────────────────────────────────── */}
      <div className="flex w-[380px] shrink-0 flex-col overflow-y-auto border-r border-gray-100 bg-gray-50/50">
        <div className="flex flex-col gap-4 p-6 pb-4">
          {/* Course info */}
          <SectionCard
            icon={<TextFieldsOutlined sx={{ fontSize: 17 }} />}
            title="Course info"
            subtitle="Title and description shown on the landing page."
          >
            <div className="flex flex-col gap-3">
              <div>
                <FieldLabel>Title</FieldLabel>
                <TextInput
                  value={title}
                  onChange={setTitle}
                  placeholder="e.g. The YouTube Growth Blueprint"
                />
              </div>
              <div>
                <FieldLabel>Description</FieldLabel>
                <TextArea
                  value={description}
                  onChange={setDescription}
                  placeholder="Summarize what students will learn."
                  rows={3}
                />
              </div>
            </div>
          </SectionCard>

          {/* Instructor */}
          <SectionCard
            icon={<PersonOutlined sx={{ fontSize: 17 }} />}
            title="Instructor"
            subtitle="How your name appears on the course hero."
          >
            <div className="flex flex-col gap-3">
              <div>
                <FieldLabel>Name</FieldLabel>
                <TextInput
                  value={instructorName}
                  onChange={setInstructorName}
                  placeholder="e.g. Alex Rivera"
                />
              </div>
              <div>
                <FieldLabel>Name style</FieldLabel>
                <div className="flex gap-2">
                  <StyleToggle
                    active={nameItalic}
                    onClick={() => setNameItalic((v) => !v)}
                    label="Italic"
                    italic
                  />
                  <StyleToggle
                    active={nameBold}
                    onClick={() => setNameBold((v) => !v)}
                    label="Bold"
                    bold
                  />
                  <StyleToggle
                    active={nameUppercase}
                    onClick={() => setNameUppercase((v) => !v)}
                    label="ALL CAPS"
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Bio</FieldLabel>
                <TextArea
                  value={instructorBio}
                  onChange={setInstructorBio}
                  placeholder="One sentence about you."
                  rows={2}
                />
              </div>
            </div>
          </SectionCard>

          {/* Thumbnail */}
          <SectionCard
            icon={<ImageOutlined sx={{ fontSize: 17 }} />}
            title="Thumbnail"
            subtitle="Hero background image. JPG, PNG or WebP · 1280×720 recommended."
          >
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleThumbnailUpload}
            />
            {thumbnailUrl ? (
              <div className="flex flex-col gap-3">
                <ThumbnailPositioner
                  src={thumbnailUrl}
                  value={thumbnailPosition}
                  onChange={setThumbnailPosition}
                />
                <p className="text-xs text-gray-500">
                  Drag to set the focal point shown in the hero.
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={uploadThumbnail.isPending}
                    onClick={() => thumbnailInputRef.current?.click()}
                    className="rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                  >
                    {uploadThumbnail.isPending ? 'Uploading…' : 'Replace image'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={uploadThumbnail.isPending}
                onClick={() => thumbnailInputRef.current?.click()}
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white p-4 transition-colors hover:border-gray-400 hover:bg-gray-50"
              >
                <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-100">
                  <ImageOutlined className="text-gray-300" sx={{ fontSize: 24 }} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-700">
                    {uploadThumbnail.isPending ? 'Uploading…' : 'Upload image'}
                  </p>
                  <p className="text-xs text-gray-400">Click to select a file</p>
                </div>
              </button>
            )}
          </SectionCard>

          {/* Trailer */}
          <SectionCard
            icon={<MovieOutlined sx={{ fontSize: 17 }} />}
            title="Trailer"
            subtitle="Optional video URL (MP4/HLS). Plays as the hero background when set."
          >
            <div>
              <FieldLabel>Video URL</FieldLabel>
              <TextInput
                value={trailerUrl}
                onChange={setTrailerUrl}
                placeholder="https://example.com/trailer.mp4"
              />
              {trailerUrl && (
                <p className="mt-1.5 text-xs text-green-600">
                  ✓ Trailer URL set — shown in preview
                </p>
              )}
              {trailerUrl && (
                <button
                  type="button"
                  onClick={() => setTrailerUrl('')}
                  className="mt-2 text-xs text-gray-400 underline hover:text-gray-600"
                >
                  Remove trailer
                </button>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Save / Reset bar */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-gray-200 bg-white/95 px-6 py-3 backdrop-blur">
          <button
            type="button"
            disabled={!dirty || isSaving}
            onClick={handleReset}
            className="rounded-full border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            Reset
          </button>
          <button
            type="button"
            disabled={!dirty || isSaving}
            onClick={handleSave}
            className="rounded-full bg-gray-900 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* ── Right: live preview ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col bg-gray-950">
        {/* Preview header */}
        <div className="flex h-10 shrink-0 items-center border-b border-white/8 px-5">
          <span className="text-xs font-medium text-white/40 tracking-wide uppercase">
            Landing page preview
          </span>
        </div>

        {/* Hero preview fills remaining space */}
        <div className="relative flex-1 overflow-hidden">
          <HeroPreview
            title={title}
            description={description}
            instructorName={instructorName}
            instructorNameItalic={nameItalic}
            instructorNameBold={nameBold}
            instructorNameUppercase={nameUppercase}
            thumbnailUrl={thumbnailUrl}
            thumbnailObjectPosition={thumbnailPosition}
            trailerUrl={trailerUrl.trim() || null}
          />
        </div>
      </div>
    </div>
  )
}
