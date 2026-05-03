'use client'

// Apple TV-style course landing — mirrors the Spaire Course Landing v2 design
// (light page, dark cinematic hero in a rounded box, free preview episode grid,
// dark paywall block, light instructor section, dark final CTA).
//
// Inline editing is provided by EditText, EditMedia and EditBlock — every
// visible string is click-to-edit and every media tile gets a hover Replace
// button. Live values that come from elsewhere in the editor (paywall position,
// product price) flow through props so the landing always reflects what the
// creator chose during onboarding.

import type { CourseLessonRead, CourseRead } from '@/hooks/queries/courses'
import { api } from '@/utils/client'
import { CONFIG } from '@/utils/config'
import type { schemas } from '@spaire/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '../../Toast/use-toast'
import { HlsVideo } from '../HlsVideo'
import { useEditor } from './EditorContext'
import { EditBlock, EditMedia, EditText } from './EditPrimitives'
import { HeroMedia } from './HeroMedia'

// Imperative handlers wired by the host (CustomizeTab) so episode tiles can
// persist edits to the actual course lesson — title, description, thumbnail
// and video — instead of only updating landing_overrides. When omitted (e.g.
// in the wizard preview) the tiles fall back to the legacy slot-based
// EditMedia flow that just stores into landing_overrides.
export type LessonHandlers = {
  updateLesson: (
    lessonId: string,
    patch: { title?: string; description?: string | null },
  ) => Promise<void>
  uploadThumbnail: (lessonId: string, file: File) => Promise<void>
  uploadVideo: (
    lessonId: string,
    file: File,
    onProgress?: (pct: number) => void,
  ) => Promise<void>
}

const FONT_VAR = 'var(--font-body, "Poppins", system-ui, sans-serif)'
const HEADING_VAR = 'var(--font-heading, ' + FONT_VAR + ')'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDuration(secs: number) {
  if (!secs) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h} hr ${m} min`
  return `${m} min`
}

function fmtLessonTime(secs?: number | null) {
  if (!secs) return '—'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}m ${String(s).padStart(2, '0')}s`
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many
}

export function formatProductPrice(
  product: schemas['Product'] | undefined,
): string {
  if (!product) return ''
  const fixed = product.prices.find((p) => p.amount_type === 'fixed')
  if (!fixed || !('price_amount' in fixed)) {
    const free = product.prices.find((p) => p.amount_type === 'free')
    if (free) return 'Free'
    const custom = product.prices.find((p) => p.amount_type === 'custom')
    if (custom) return 'Pay what you want'
    return ''
  }
  const cents = fixed.price_amount as number
  const dollars = cents / 100
  if (dollars === Math.floor(dollars)) return `$${dollars.toFixed(0)}`
  return `$${dollars.toFixed(2)}`
}

// ── Top-level ──────────────────────────────────────────────────────────────

export type EditableLandingProps = {
  course: CourseRead
  organizationName: string
  organizationSlug?: string
  flatLessons: CourseLessonRead[]
  product?: schemas['Product']
  lessonHandlers?: LessonHandlers
}

// Trigger checkout for the course product. Mirrors ProductDetailPage.handleBuy
// — POST /v1/checkouts/client/ with the product id, then redirect to the
// hosted checkout URL. In edit mode (customize page) this is a no-op so the
// dashboard preview doesn't accidentally open a real checkout.
function useEnroll(productId: string | undefined) {
  const ed = useEditor()
  const [busy, setBusy] = useState(false)
  const enabled = ed.mode === 'preview' && !!productId
  const enroll = useCallback(async () => {
    if (!enabled || busy || !productId) return
    setBusy(true)
    try {
      const { data: checkout, error } = await api.POST(
        '/v1/checkouts/client/',
        { body: { product_id: productId } },
      )
      if (error || !checkout?.client_secret) {
        toast({
          title: 'Could not start checkout',
          description: 'Please try again in a moment.',
        })
        return
      }
      window.location.href = `${CONFIG.FRONTEND_BASE_URL}/checkout/${checkout.client_secret}?theme=light`
    } finally {
      setBusy(false)
    }
  }, [enabled, busy, productId])
  return { enroll, busy, enabled }
}

export function EditableCourseLandingView({
  course,
  organizationName,
  organizationSlug,
  flatLessons,
  product,
  lessonHandlers,
}: EditableLandingProps) {
  const ed = useEditor()
  const priceLabel = formatProductPrice(product)
  const { enroll, busy: enrolling, enabled: canEnroll } = useEnroll(product?.id)

  const paywallAt =
    course.paywall_enabled && course.paywall_position != null
      ? Math.min(course.paywall_position, flatLessons.length)
      : null
  const freeLessons =
    paywallAt != null ? flatLessons.slice(0, paywallAt) : flatLessons
  const paidLessons =
    paywallAt != null ? flatLessons.slice(paywallAt) : []
  const lockedCount = paidLessons.length

  const sectionMap: Record<string, { label: string; node: React.ReactNode }> = {
    hero: {
      label: 'Hero',
      node: (
        <Hero
          course={course}
          flatLessons={flatLessons}
          freeCount={freeLessons.length}
          priceLabel={priceLabel}
          onEnroll={enroll}
          enrolling={enrolling}
          canEnroll={canEnroll}
        />
      ),
    },
    lessons: {
      label: 'Free preview',
      node: (
        <EpisodeGrid
          course={course}
          freeLessons={freeLessons}
          paidLessons={paidLessons}
          lockedCount={lockedCount}
          priceLabel={priceLabel}
          organizationSlug={organizationSlug}
          onEnroll={enroll}
          enrolling={enrolling}
          canEnroll={canEnroll}
          lessonHandlers={lessonHandlers}
        />
      ),
    },
    instructor: { label: 'Instructor', node: <Instructor course={course} /> },
    finalCta: {
      label: 'Final CTA',
      node: (
        <FinalCta
          freeCount={freeLessons.length}
          priceLabel={priceLabel}
          onEnroll={enroll}
          enrolling={enrolling}
          canEnroll={canEnroll}
        />
      ),
    },
  }

  return (
    <div
      data-spaire-editor
      style={{
        background: 'var(--bg-0, #fff)',
        color: 'var(--fg-0, oklch(0.18 0.008 280))',
        fontFamily: FONT_VAR,
        minHeight: '100%',
      }}
    >
      {ed.overrides.order
        .filter((id) => sectionMap[id])
        .map((id) => {
          const s = sectionMap[id]
          return (
            <EditBlock key={id} id={id} label={s.label}>
              {s.node}
            </EditBlock>
          )
        })}
      <Footer organizationName={organizationName} />
    </div>
  )
}

// ── Hero ────────────────────────────────────────────────────────────────────

function Hero({
  course,
  flatLessons,
  freeCount,
  priceLabel,
  onEnroll,
  enrolling,
  canEnroll,
}: {
  course: CourseRead
  flatLessons: CourseLessonRead[]
  freeCount: number
  priceLabel: string
  onEnroll: () => void
  enrolling: boolean
  canEnroll: boolean
}) {
  const ed = useEditor()
  const totalDurationSeconds = flatLessons.reduce(
    (a, l) => a + (l.duration_seconds ?? 0),
    0,
  )

  // Resolve the trailer URL the same way HeroMediaSurface does so the Watch
  // trailer button always plays whatever is shown in the hero peek.
  const heroImage = ed.m('hero.backdrop')
  const heroTrailer = ed.m('hero.trailer')
  const trailerUrl =
    (heroTrailer && heroTrailer.kind === 'video' ? heroTrailer.url : null) ??
    (heroImage && heroImage.kind === 'video' ? heroImage.url : null) ??
    course.trailer_url ??
    null

  const [trailerOpen, setTrailerOpen] = useState(false)

  return (
    <section
      style={{
        position: 'relative',
        height: 'min(88vh, 760px)',
        minHeight: 580,
        margin: '20px 20px 0',
        borderRadius: 'calc(28px * var(--radius-mul, 1))',
        overflow: 'hidden',
        background: '#000',
        isolation: 'isolate',
        border: '1px solid oklch(0.92 0.003 280)',
        boxShadow:
          '0 2px 6px rgba(0,0,0,0.06), 0 24px 60px rgba(0,0,0,0.10)',
      }}
    >
      <EditMedia
        id="hero.backdrop"
        label="hero image"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          overflow: 'hidden',
        }}
        renderMedia={() => null}
        chromeless
      >
        <HeroMediaSurface
          fallbackImageUrl={course.thumbnail_url ?? null}
          fallbackTrailerUrl={course.trailer_url ?? null}
        />
      </EditMedia>

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          pointerEvents: 'none',
          background:
            'linear-gradient(180deg, oklch(0 0 0 / 0.2) 0%, oklch(0 0 0 / 0) 30%, oklch(0 0 0 / 0) 45%, oklch(0 0 0 / 0.6) 80%, oklch(0 0 0 / 0.92) 100%)',
        }}
      />

      {/* SPAIRE ORIGINAL pill (top-left) */}
      <div
        style={{
          position: 'absolute',
          left: 32,
          top: 28,
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'oklch(0.72 0.16 25)',
            boxShadow: '0 0 12px oklch(0.72 0.16 25)',
          }}
        />
        <EditText
          path="hero.eyebrow"
          defaultValue="SPAIRE ORIGINAL"
          style={{
            fontSize: 11,
            letterSpacing: '0.18em',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.85)',
            fontFamily: FONT_VAR,
          }}
        />
      </div>

      {/* Hero media controls (top-right) — separate Add image + Add trailer */}
      <HeroMediaControls />
      {/* Bottom content */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 3,
          padding: '40px 48px 52px',
          color: 'white',
          fontFamily: FONT_VAR,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
            fontSize: 12,
            color: 'rgba(255,255,255,0.65)',
            fontWeight: 500,
          }}
        >
          <EditText
            path="hero.series_label"
            defaultValue="NEW SERIES"
            style={{
              padding: '3px 10px',
              background: 'rgba(255,255,255,0.12)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.18)',
              fontSize: 10,
              letterSpacing: '0.12em',
              fontWeight: 600,
              color: 'white',
            }}
          />
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>
            {flatLessons.length} {plural(flatLessons.length, 'lesson', 'lessons')}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>
            {fmtDuration(totalDurationSeconds)}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <EditText
            path="hero.level"
            defaultValue="All levels"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          />
        </div>

        <EditText
          as="h1"
          path="hero.title"
          defaultValue={course.title ?? 'Untitled course'}
          multiline
          style={{
            fontSize: `calc(clamp(52px, 7.5vw, 96px) * var(--type-scale, 1))`,
            fontWeight: 'var(--h-weight, 700)',
            fontStyle: 'var(--h-italic, normal)',
            letterSpacing: 'calc(var(--h-tracking, 0em) - 0.045em)',
            lineHeight: 'calc(var(--h-leading, 1) * 0.95)',
            margin: '0 0 18px',
            color: 'white',
            maxWidth: '14ch',
            textShadow: '0 2px 30px oklch(0 0 0 / 0.35)',
            fontFamily: HEADING_VAR,
          }}
        />

        <div
          style={{
            fontSize: 'clamp(14px, 1.3vw, 18px)',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.88)',
            maxWidth: 560,
            marginBottom: 30,
            lineHeight: 1.4,
          }}
        >
          <EditText
            path="hero.tagline"
            defaultValue="Build arguments that move people"
          />
          {course.instructor_name && (
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>
              {' '}— with{' '}
              <EditText
                path="hero.instructor"
                defaultValue={course.instructor_name}
              />
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (trailerUrl) setTrailerOpen(true)
            }}
            disabled={!trailerUrl}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '13px 22px 13px 14px',
              background: 'white',
              color: 'oklch(0.14 0.006 280)',
              borderRadius: 999,
              boxShadow: '0 8px 28px oklch(0 0 0 / 0.4)',
              border: 'none',
              cursor: trailerUrl ? 'pointer' : 'not-allowed',
              opacity: trailerUrl ? 1 : 0.55,
              fontFamily: 'inherit',
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'oklch(0.14 0.006 280)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingLeft: 2,
                fontSize: 11,
              }}
            >
              ▶
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1 }}>
              <EditText path="hero.cta_secondary" defaultValue="Watch trailer" />
            </span>
          </button>
          <button
            type="button"
            onClick={onEnroll}
            disabled={!canEnroll || enrolling}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '14px 22px',
              background: 'rgba(255,255,255,0.10)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: 'white',
              borderRadius: 999,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: canEnroll ? (enrolling ? 'wait' : 'pointer') : 'default',
              fontFamily: 'inherit',
              opacity: enrolling ? 0.7 : 1,
            }}
          >
            {enrolling
              ? 'Loading…'
              : `Enroll${priceLabel ? ` · ${priceLabel}` : ''} →`}
          </button>
        </div>
      </div>
      {trailerOpen && trailerUrl && (
        <TrailerModal url={trailerUrl} onClose={() => setTrailerOpen(false)} />
      )}
    </section>
  )
}

// Fullscreen trailer player. Mounts a fixed overlay with the video; tries
// to enter the browser's Fullscreen API on open and falls back to the
// 100vw/100vh overlay if the browser refuses (e.g. iOS Safari).
function TrailerModal({ url, onClose }: { url: string; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)

    const v = videoRef.current as
      | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
      | null
    if (v) {
      try {
        if (typeof v.requestFullscreen === 'function') {
          Promise.resolve(v.requestFullscreen()).catch(() => {})
        } else if (typeof v.webkitEnterFullscreen === 'function') {
          v.webkitEnterFullscreen()
        }
      } catch {
        // ignored — user can use the in-player fullscreen control
      }
    }

    const onFsChange = () => {
      if (!document.fullscreenElement) onClose()
    }
    document.addEventListener('fullscreenchange', onFsChange)

    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFsChange)
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {})
      }
    }
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.95)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <video
        ref={videoRef}
        src={url}
        autoPlay
        controls
        playsInline
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '92vw',
          maxHeight: '92vh',
          background: 'black',
          borderRadius: 8,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close trailer"
        style={{
          position: 'absolute',
          right: 24,
          top: 24,
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.10)',
          border: '1px solid rgba(255,255,255,0.20)',
          color: 'white',
          fontSize: 18,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        ✕
      </button>
    </div>
  )
}

// Surface that reads media from the editor state first (so uploads show
// immediately) and falls back to the course's persisted thumbnail / trailer.
function HeroMediaSurface({
  fallbackImageUrl,
  fallbackTrailerUrl,
}: {
  fallbackImageUrl: string | null
  fallbackTrailerUrl: string | null
}) {
  const ed = useEditor()
  const heroImage = ed.m('hero.backdrop')
  const heroTrailer = ed.m('hero.trailer')
  const imageUrl =
    heroImage && heroImage.kind === 'image' ? heroImage.url : fallbackImageUrl
  const trailerUrl =
    heroTrailer && heroTrailer.kind === 'video'
      ? heroTrailer.url
      : heroImage && heroImage.kind === 'video'
        ? heroImage.url
        : fallbackTrailerUrl
  return (
    <HeroMedia imageUrl={imageUrl} trailerUrl={trailerUrl} peekSeconds={10} />
  )
}

// Hero media controls — sits in the top-right corner of the hero. Two
// separate buttons: Add image (writes to course.thumbnail_url + the
// hero.backdrop slot), Add trailer (writes to course.trailer_url + the
// hero.trailer slot). An info icon explains the Netflix/YouTube-style peek.
function HeroMediaControls() {
  const ed = useEditor()
  const [tipOpen, setTipOpen] = useState(false)
  const [busyImage, setBusyImage] = useState(false)
  const [busyTrailer, setBusyTrailer] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const trailerInputRef = useRef<HTMLInputElement>(null)
  if (ed.mode !== 'edit') return null

  const heroImage = ed.m('hero.backdrop')
  const heroTrailer = ed.m('hero.trailer')
  const hasImage = !!heroImage && heroImage.kind === 'image'
  const hasTrailer =
    !!heroTrailer ||
    (!!heroImage && heroImage.kind === 'video')

  const upload = async (slotId: string, file: File) => {
    const uploader = ed.uploaderForSlot?.(slotId) ?? ed.uploadMedia
    try {
      const next = await uploader(file)
      if (!next?.url) {
        // eslint-disable-next-line no-console
        console.error('[HeroMediaControls] upload returned empty url', {
          slotId,
          next,
        })
        toast({
          title: `Upload failed for ${slotId}`,
          description: 'Server returned an empty url. See console for details.',
        })
        return
      }
      // eslint-disable-next-line no-console
      console.log('[HeroMediaControls] upload ok', {
        slotId,
        url: next.url,
        kind: next.kind,
      })
      ed.setMedia(slotId, { ...next, name: file.name })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // eslint-disable-next-line no-console
      console.error(
        '[HeroMediaControls] upload failed',
        { slotId, file: file.name },
        err,
      )
      toast({
        title: `Upload failed for ${slotId}`,
        description: message,
      })
    }
  }

  const onImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusyImage(true)
    try {
      await upload('hero.backdrop', file)
    } finally {
      setBusyImage(false)
    }
  }

  const onTrailer = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusyTrailer(true)
    try {
      await upload('hero.trailer', file)
    } finally {
      setBusyTrailer(false)
    }
  }

  const pillBtn = (busy: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 12px',
    borderRadius: 999,
    background: 'rgba(20,20,22,0.92)',
    color: 'white',
    fontSize: 11.5,
    fontWeight: 600,
    border: '1px solid rgba(255,255,255,0.10)',
    fontFamily: 'Inter, system-ui, sans-serif',
    cursor: busy ? 'wait' : 'pointer',
  })

  return (
    <div
      style={{
        position: 'absolute',
        right: 24,
        top: 24,
        zIndex: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={onImage}
      />
      <input
        ref={trailerInputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={onTrailer}
      />
      <button
        type="button"
        onClick={() => imageInputRef.current?.click()}
        disabled={busyImage}
        style={pillBtn(busyImage)}
      >
        {busyImage
          ? 'Uploading image…'
          : hasImage
            ? '↺ Replace image'
            : '＋ Add image'}
      </button>
      <button
        type="button"
        onClick={() => trailerInputRef.current?.click()}
        disabled={busyTrailer}
        style={pillBtn(busyTrailer)}
      >
        {busyTrailer
          ? 'Uploading trailer…'
          : hasTrailer
            ? '↺ Replace trailer'
            : '＋ Add trailer'}
      </button>
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          aria-label="How hero media works"
          onClick={() => setTipOpen((p) => !p)}
          onMouseEnter={() => setTipOpen(true)}
          onMouseLeave={() => setTipOpen(false)}
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.14)',
            border: '1px solid rgba(255,255,255,0.20)',
            color: 'white',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'help',
            fontFamily: 'inherit',
          }}
        >
          ?
        </button>
        {tipOpen && (
          <div
            role="tooltip"
            style={{
              position: 'absolute',
              right: 0,
              top: 34,
              width: 260,
              padding: 12,
              borderRadius: 10,
              background: 'rgba(20,20,22,0.95)',
              color: 'white',
              fontSize: 11.5,
              lineHeight: 1.5,
              border: '1px solid rgba(255,255,255,0.10)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
              fontFamily: 'Inter, system-ui, sans-serif',
              zIndex: 10,
            }}
          >
            <strong style={{ fontSize: 11, letterSpacing: '0.06em' }}>
              UPLOAD A TRAILER + IMAGE
            </strong>
            <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.78)' }}>
              Like Netflix or YouTube — when both are set, the hero plays the
              first ~10 seconds of the trailer as a peek, then settles on the
              cover image. One of them works on its own too.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Episode grid (free preview) + paywall ─────────────────────────────────

function EpisodeGrid({
  course,
  freeLessons,
  paidLessons,
  lockedCount,
  priceLabel,
  organizationSlug,
  onEnroll,
  enrolling,
  canEnroll,
  lessonHandlers,
}: {
  course: CourseRead
  freeLessons: CourseLessonRead[]
  paidLessons: CourseLessonRead[]
  lockedCount: number
  priceLabel: string
  organizationSlug?: string
  onEnroll: () => void
  enrolling: boolean
  canEnroll: boolean
  lessonHandlers?: LessonHandlers
}) {
  const [openLessonId, setOpenLessonId] = useState<string | null>(null)
  const openLesson = freeLessons.find((l) => l.id === openLessonId) ?? null
  const thumbHues = [35, 195, 285, 145, 25, 320]
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <section
      style={{
        padding: '72px 32px 0',
        maxWidth: 1320,
        margin: '0 auto',
        fontFamily: FONT_VAR,
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <EditText
          as="h2"
          path="lessons.heading"
          defaultValue="Free preview"
          style={{
            fontSize: 'calc(clamp(26px, 3vw, 38px) * var(--type-scale, 1))',
            fontWeight: 'var(--h-weight, 600)',
            letterSpacing: 'calc(var(--h-tracking, 0em) - 0.03em)',
            lineHeight: 1.05,
            margin: '0 0 8px',
            color: 'oklch(0.18 0.008 280)',
            fontFamily: HEADING_VAR,
          }}
        />
        <EditText
          as="p"
          path="lessons.subheading"
          defaultValue={
            freeLessons.length > 0
              ? `Watch the first ${freeLessons.length} ${plural(
                  freeLessons.length,
                  'episode',
                  'episodes',
                )} before you enroll.`
              : 'Mark a lesson as free preview to show it here.'
          }
          multiline
          style={{
            fontSize: 14.5,
            color: 'oklch(0.52 0.008 280)',
            margin: 0,
            fontWeight: 400,
          }}
        />
      </div>

      {freeLessons.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 18,
            marginBottom: 40,
          }}
        >
          {freeLessons.map((lesson, i) => {
            const hue = thumbHues[i % thumbHues.length]
            const isHovered = hovered === lesson.id
            return (
              <div
                key={lesson.id}
                onMouseEnter={() => setHovered(lesson.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: 'white',
                  borderRadius: 'calc(20px * var(--radius-mul, 1))',
                  overflow: 'hidden',
                  border: '1px solid oklch(0.92 0.003 280)',
                  cursor: 'pointer',
                  transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                  boxShadow: isHovered
                    ? '0 16px 48px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)'
                    : '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.05)',
                  transition:
                    'transform 250ms cubic-bezier(0.34,1.3,0.64,1), box-shadow 250ms ease',
                }}
              >
                <EpisodeThumb
                  lesson={lesson}
                  index={i + 1}
                  hue={hue}
                  hovered={isHovered}
                  lessonHandlers={lessonHandlers}
                  onOpen={() => setOpenLessonId(lesson.id)}
                />
                <EpisodeInfo
                  course={course}
                  lesson={lesson}
                  lessonHandlers={lessonHandlers}
                  index={i + 1}
                  organizationSlug={organizationSlug}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Paywall block */}
      {course.paywall_enabled && lockedCount > 0 && (
        <div
          style={{
            background: 'oklch(0.18 0.008 280)',
            borderRadius: 'calc(20px * var(--radius-mul, 1))',
            overflow: 'hidden',
            marginBottom: 72,
            boxShadow:
              '0 2px 6px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.08)',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              padding: '26px 28px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              flexWrap: 'wrap',
              background:
                'radial-gradient(ellipse at 80% 50%, oklch(0.40 0.18 265 / 0.35), transparent 60%)',
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 18,
              }}
            >
              🔒
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <EditText
                path="paywall.title"
                defaultValue={`${lockedCount} more ${plural(
                  lockedCount,
                  'lesson',
                  'lessons',
                )}, unlocked when you enroll`}
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: '-0.015em',
                  color: 'white',
                  display: 'block',
                  marginBottom: 4,
                }}
              />
              <EditText
                path="paywall.subtitle"
                defaultValue="Lifetime access · Workshops · Certificate · 30-day refund"
                style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.5)',
                  display: 'block',
                  lineHeight: 1.4,
                }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                flexShrink: 0,
              }}
            >
              {priceLabel && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                  }}
                >
                  <span
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      letterSpacing: '-0.025em',
                      color: 'white',
                    }}
                  >
                    {priceLabel}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={onEnroll}
                disabled={!canEnroll || enrolling}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 20px',
                  borderRadius: 999,
                  background: 'white',
                  color: 'oklch(0.18 0.008 280)',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  cursor: canEnroll ? (enrolling ? 'wait' : 'pointer') : 'default',
                  fontFamily: 'inherit',
                  opacity: enrolling ? 0.7 : 1,
                }}
              >
                {enrolling ? (
                  'Loading…'
                ) : (
                  <>
                    <EditText path="paywall.cta" defaultValue="Enroll" /> →
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Locked episode previews */}
          <div
            style={{
              display: 'flex',
              gap: 0,
              padding: '20px 28px 22px',
              overflowX: 'auto',
              alignItems: 'flex-start',
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            {paidLessons.slice(0, 5).map((lesson, i) => (
              <LockedRowItem
                key={lesson.id}
                lesson={lesson}
                index={freeLessons.length + i + 1}
                hue={thumbHues[i % thumbHues.length]}
              />
            ))}
            {lockedCount > 5 && (
              <div
                style={{
                  flex: '0 0 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  paddingLeft: 4,
                  alignSelf: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.28)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  +{lockedCount - 5}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: 'rgba(255,255,255,0.20)',
                  }}
                >
                  more {plural(lockedCount - 5, 'lesson', 'lessons')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {openLesson && (
        <LessonLightbox
          lesson={openLesson}
          onClose={() => setOpenLessonId(null)}
        />
      )}
    </section>
  )
}

function LessonLightbox({
  lesson,
  onClose,
}: {
  lesson: CourseLessonRead
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 1100,
          aspectRatio: '16 / 9',
          background: '#000',
          borderRadius: 16,
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {lesson.mux_playback_id && lesson.mux_status === 'ready' ? (
          <HlsVideo
            playbackId={lesson.mux_playback_id}
            poster={lesson.thumbnail_url}
            controls
            autoPlay
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 14,
            }}
          >
            {lesson.mux_upload_id
              ? 'Video is still processing — check back in a moment.'
              : 'No video uploaded for this lesson yet.'}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'rgba(0,0,0,0.55)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.15)',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}

function EpisodeThumb({
  lesson,
  index,
  hue,
  hovered,
  lessonHandlers,
  onOpen,
}: {
  lesson: CourseLessonRead
  index: number
  hue: number
  hovered: boolean
  lessonHandlers?: LessonHandlers
  onOpen: () => void
}) {
  const ed = useEditor()

  // In edit mode with no real lesson handlers (e.g. the wizard preview where
  // lesson ids are placeholders), fall back to the original slot-based
  // EditMedia tile so authors can still drop in a thumbnail. Preview mode
  // always uses the real-lesson display so the public landing renders the
  // actual thumbnail + Mux peek video.
  if (ed.mode === 'edit' && !lessonHandlers) {
    return (
      <EditMedia
        id={`lesson.${lesson.id}.thumb`}
        label={`Episode ${index} thumbnail`}
        style={{
          position: 'relative',
          aspectRatio: '16 / 9',
          background: '#111',
          overflow: 'hidden',
        }}
        placeholder={
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse at 30% 40%, oklch(0.42 0.10 ${hue}) 0%, oklch(0.18 0.05 ${
                (hue + 25) % 360
              }) 55%, oklch(0.07 0.01 280) 100%)`,
            }}
          />
        }
      >
        <EpisodeThumbBadges
          index={index}
          durationSeconds={lesson.duration_seconds}
        />
      </EditMedia>
    )
  }

  return (
    <RealLessonEpisodeThumb
      lesson={lesson}
      index={index}
      hue={hue}
      hovered={hovered}
      isEditMode={ed.mode === 'edit'}
      lessonHandlers={lessonHandlers}
      onOpen={onOpen}
    />
  )
}

function EpisodeThumbBadges({
  index,
  durationSeconds,
}: {
  index: number
  durationSeconds: number | null | undefined
}) {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 10,
          top: 10,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.10em',
          color: 'rgba(255,255,255,0.80)',
          background: 'rgba(0,0,0,0.40)',
          backdropFilter: 'blur(8px)',
          padding: '3px 7px',
          borderRadius: 4,
          zIndex: 4,
        }}
      >
        EPISODE {index}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 10,
          bottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.85)',
          background: 'rgba(0,0,0,0.50)',
          backdropFilter: 'blur(8px)',
          padding: '3px 8px',
          borderRadius: 5,
          zIndex: 4,
        }}
      >
        ⏱ <span>{fmtLessonTime(durationSeconds ?? null)}</span>
      </div>
    </>
  )
}

// Episode thumb wired to the actual lesson record. Owns:
//   • Thumbnail + Mux video peek (fade in muted on hover, max 10s)
//   • Click-to-open lightbox (in preview mode only)
//   • Edit affordances (Replace thumbnail / Replace video) in edit mode
function RealLessonEpisodeThumb({
  lesson,
  index,
  hue,
  hovered,
  isEditMode,
  lessonHandlers,
  onOpen,
}: {
  lesson: CourseLessonRead
  index: number
  hue: number
  hovered: boolean
  isEditMode: boolean
  lessonHandlers?: LessonHandlers
  onOpen: () => void
}) {
  const peekSeconds = 10
  const [peekActive, setPeekActive] = useState(false)
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [thumbBusy, setThumbBusy] = useState(false)
  const [videoBusy, setVideoBusy] = useState(false)
  const [videoProgress, setVideoProgress] = useState<number | null>(null)
  const thumbInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const playbackId =
    lesson.mux_playback_id && lesson.mux_status === 'ready'
      ? lesson.mux_playback_id
      : null
  const thumbnailUrl = lesson.thumbnail_url ?? null

  // Drive the hover-triggered peek. Re-evaluate when `hovered` flips.
  useEffect(() => {
    if (peekTimerRef.current) {
      clearTimeout(peekTimerRef.current)
      peekTimerRef.current = null
    }
    if (hovered && playbackId) {
      setPeekActive(true)
      peekTimerRef.current = setTimeout(
        () => setPeekActive(false),
        peekSeconds * 1000,
      )
    } else {
      setPeekActive(false)
    }
    return () => {
      if (peekTimerRef.current) clearTimeout(peekTimerRef.current)
    }
  }, [hovered, playbackId])

  const onPickThumb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !lessonHandlers) return
    setThumbBusy(true)
    try {
      await lessonHandlers.uploadThumbnail(lesson.id, file)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast({ title: 'Thumbnail upload failed', description: message })
    } finally {
      setThumbBusy(false)
    }
  }

  const onPickVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !lessonHandlers) return
    setVideoBusy(true)
    setVideoProgress(0)
    try {
      await lessonHandlers.uploadVideo(lesson.id, file, (pct) =>
        setVideoProgress(pct),
      )
      toast({
        title: 'Video uploaded',
        description: 'Mux is processing — preview will appear shortly.',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast({ title: 'Video upload failed', description: message })
    } finally {
      setVideoBusy(false)
      setVideoProgress(null)
    }
  }

  const placeholder = (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at 30% 40%, oklch(0.42 0.10 ${hue}) 0%, oklch(0.18 0.05 ${
          (hue + 25) % 360
        }) 55%, oklch(0.07 0.01 280) 100%)`,
        zIndex: 0,
      }}
    />
  )

  return (
    <div
      onClick={() => {
        if (isEditMode) return
        onOpen()
      }}
      style={{
        position: 'relative',
        aspectRatio: '16 / 9',
        background: '#111',
        overflow: 'hidden',
        cursor: isEditMode ? 'default' : 'pointer',
      }}
    >
      {!thumbnailUrl && !playbackId && placeholder}
      {thumbnailUrl && (
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
            opacity: peekActive ? 0 : 1,
            transition: 'opacity 400ms ease',
            zIndex: 1,
          }}
        />
      )}
      {playbackId && peekActive && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            opacity: 1,
            transition: 'opacity 400ms ease',
            pointerEvents: 'none',
          }}
        >
          <HlsVideo
            playbackId={playbackId}
            poster={thumbnailUrl}
            controls={false}
            autoPlay
            muted
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <EpisodeThumbBadges
        index={index}
        durationSeconds={lesson.duration_seconds}
      />

      {/* Play overlay (preview mode only) */}
      {!isEditMode && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: hovered && !peekActive ? 1 : 0,
            transition: 'opacity 200ms ease',
            zIndex: 3,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.95)',
              color: 'oklch(0.18 0.008 280)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingLeft: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              fontSize: 16,
            }}
          >
            ▶
          </div>
        </div>
      )}

      {/* Edit affordances */}
      {isEditMode && lessonHandlers && (
        <>
          <input
            ref={thumbInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onPickThumb}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            hidden
            onChange={onPickVideo}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              border: hovered
                ? '2px dashed rgba(99,102,241,0.85)'
                : '2px dashed transparent',
              borderRadius: 'inherit',
              pointerEvents: 'none',
              zIndex: 5,
              transition: 'border-color 150ms ease',
            }}
          />
          {hovered && (
            <div
              style={{
                position: 'absolute',
                right: 10,
                top: 10,
                zIndex: 6,
                display: 'flex',
                gap: 6,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => thumbInputRef.current?.click()}
                disabled={thumbBusy}
                style={lessonPillBtn}
              >
                {thumbBusy
                  ? 'Uploading…'
                  : thumbnailUrl
                    ? 'Replace thumbnail'
                    : 'Add thumbnail'}
              </button>
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                disabled={videoBusy}
                style={lessonPillBtn}
              >
                {videoBusy
                  ? videoProgress != null
                    ? `Uploading ${videoProgress}%`
                    : 'Uploading…'
                  : playbackId
                    ? 'Replace video'
                    : 'Add video'}
              </button>
            </div>
          )}
          {lesson.mux_upload_id && !playbackId && (
            <div
              style={{
                position: 'absolute',
                left: 10,
                bottom: 10,
                zIndex: 6,
                fontSize: 10.5,
                fontWeight: 600,
                color: 'white',
                background: 'rgba(0,0,0,0.6)',
                padding: '4px 8px',
                borderRadius: 999,
              }}
            >
              ◐ Processing video…
            </div>
          )}
        </>
      )}
    </div>
  )
}

const lessonPillBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 12px',
  borderRadius: 999,
  background: 'rgba(20,20,22,0.92)',
  color: 'white',
  fontSize: 11.5,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.08)',
  fontFamily: 'Inter, system-ui, sans-serif',
}

function EpisodeInfo({
  course,
  lesson,
  index,
  organizationSlug,
  lessonHandlers,
}: {
  course: CourseRead
  lesson: CourseLessonRead
  index: number
  organizationSlug?: string
  lessonHandlers?: LessonHandlers
}) {
  const ed = useEditor()
  const descPath = `lesson.${lesson.id}.description`
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // When real lesson handlers are wired, the description and title persist
  // back to the actual lesson record (so the customize edit and the lesson
  // editor stay in sync). Without handlers we fall back to landing_overrides.
  const persistsToLesson = !!lessonHandlers
  const titleRef = useRef<HTMLDivElement>(null)
  const descRef = useRef<HTMLDivElement>(null)
  const [titleEditing, setTitleEditing] = useState(false)
  const [descEditing, setDescEditing] = useState(false)
  const lessonTitle = lesson.title ?? ''
  const lessonDesc = lesson.description ?? ''
  // Sync DOM contentEditable text with the underlying lesson value when not
  // actively editing, so refetches (e.g. after wizard edits) flow back into
  // the customize preview.
  useEffect(() => {
    if (titleEditing) return
    if (titleRef.current && titleRef.current.innerText !== lessonTitle) {
      titleRef.current.innerText = lessonTitle
    }
  }, [lessonTitle, titleEditing])
  useEffect(() => {
    if (descEditing) return
    if (descRef.current && descRef.current.innerText !== lessonDesc) {
      descRef.current.innerText = lessonDesc
    }
  }, [lessonDesc, descEditing])

  const generate = async () => {
    if (!organizationSlug) {
      setError('AI needs an organization context.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(
        `/dashboard/${organizationSlug}/courses/landing-rewrite`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'free_preview_description',
            current: ed.t(descPath, ''),
            hint: `Episode ${index} description`,
            intent:
              'Write a single 2-sentence description that hooks the reader. No quotes.',
            context: {
              courseTitle: course.title,
              instructor: course.instructor_name,
              lessonTitle: lesson.title,
              lessonIndex: index,
            },
          }),
        },
      )
      if (!res.ok || !res.body) {
        setError(`Generation failed (${res.status}).`)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
      }
      const next = acc.trim().replace(/^["']|["']$/g, '')
      if (persistsToLesson && lessonHandlers) {
        if (descRef.current) descRef.current.innerText = next
        try {
          await lessonHandlers.updateLesson(lesson.id, { description: next })
        } catch (e) {
          setError((e as Error).message ?? 'Failed to save description.')
        }
      } else {
        ed.setText(descPath, next)
      }
    } catch (e) {
      setError((e as Error).message ?? 'Generation failed.')
    } finally {
      setBusy(false)
    }
  }

  const persistTitle = async () => {
    setTitleEditing(false)
    if (!persistsToLesson || !lessonHandlers) return
    const next = (titleRef.current?.innerText ?? '').trim()
    if (!next) {
      if (titleRef.current) titleRef.current.innerText = lessonTitle
      return
    }
    if (next === lessonTitle) return
    try {
      await lessonHandlers.updateLesson(lesson.id, { title: next })
    } catch (e) {
      toast({
        title: 'Failed to save title',
        description: (e as Error).message ?? '',
      })
    }
  }

  const persistDesc = async () => {
    setDescEditing(false)
    if (!persistsToLesson || !lessonHandlers) return
    const next = (descRef.current?.innerText ?? '').replace(/\n+$/, '')
    if (next === lessonDesc) return
    try {
      await lessonHandlers.updateLesson(lesson.id, {
        description: next.length > 0 ? next : null,
      })
    } catch (e) {
      toast({
        title: 'Failed to save description',
        description: (e as Error).message ?? '',
      })
    }
  }

  return (
    <div style={{ padding: '16px 18px 18px' }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: 'oklch(0.66 0.006 280)',
          marginBottom: 4,
          textTransform: 'uppercase',
        }}
      >
        Episode {index}
      </div>
      {persistsToLesson && ed.mode === 'edit' ? (
        <div
          ref={titleRef}
          contentEditable
          suppressContentEditableWarning
          onFocus={() => setTitleEditing(true)}
          onBlur={persistTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ;(e.target as HTMLElement).blur()
            }
            if (e.key === 'Escape') {
              if (titleRef.current) titleRef.current.innerText = lessonTitle
              ;(e.target as HTMLElement).blur()
            }
          }}
          style={{
            fontSize: 15.5,
            fontWeight: 600,
            letterSpacing: '-0.015em',
            color: 'oklch(0.18 0.008 280)',
            lineHeight: 1.25,
            marginBottom: 7,
            outline: titleEditing ? '2px solid #6366f1' : 'none',
            outlineOffset: 2,
            cursor: 'text',
            borderRadius: 3,
          }}
        />
      ) : (
        <div
          style={{
            fontSize: 15.5,
            fontWeight: 600,
            letterSpacing: '-0.015em',
            color: 'oklch(0.18 0.008 280)',
            lineHeight: 1.25,
            marginBottom: 7,
          }}
        >
          {lesson.title}
        </div>
      )}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        {persistsToLesson ? (
          ed.mode === 'edit' ? (
            <div
              ref={descRef}
              contentEditable
              suppressContentEditableWarning
              onFocus={() => setDescEditing(true)}
              onBlur={persistDesc}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  if (descRef.current)
                    descRef.current.innerText = lessonDesc
                  ;(e.target as HTMLElement).blur()
                }
              }}
              style={{
                fontSize: 12.5,
                color: 'oklch(0.52 0.008 280)',
                lineHeight: 1.6,
                display: 'block',
                minHeight: '1.6em',
                outline: descEditing ? '2px solid #6366f1' : 'none',
                outlineOffset: 2,
                cursor: 'text',
                borderRadius: 3,
                whiteSpace: 'pre-wrap',
              }}
            />
          ) : (
            <p
              style={{
                fontSize: 12.5,
                color: 'oklch(0.52 0.008 280)',
                lineHeight: 1.6,
                margin: 0,
                whiteSpace: 'pre-wrap',
              }}
            >
              {lessonDesc}
            </p>
          )
        ) : (
          <EditText
            path={descPath}
            defaultValue={lesson.description ?? ''}
            multiline
            style={{
              fontSize: 12.5,
              color: 'oklch(0.52 0.008 280)',
              lineHeight: 1.6,
              display: 'block',
              minHeight: '1.6em',
            }}
          />
        )}
        {ed.mode === 'edit' && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={generate}
              disabled={busy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 9px',
                borderRadius: 999,
                background:
                  'linear-gradient(135deg, oklch(0.96 0.04 280), oklch(0.95 0.05 320))',
                border: '1px solid oklch(0.90 0.04 280)',
                color: 'oklch(0.35 0.18 280)',
                fontSize: 10.5,
                fontWeight: 600,
                cursor: busy ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ✦ {busy ? 'Generating…' : 'Generate description'}
            </button>
            {error && (
              <span style={{ fontSize: 10.5, color: 'oklch(0.55 0.18 25)' }}>
                {error}
              </span>
            )}
          </div>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 11.5,
          color: 'oklch(0.66 0.006 280)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        ⏱ <span>{fmtLessonTime(lesson.duration_seconds)}</span>
      </div>
    </div>
  )
}

function LockedRowItem({
  lesson,
  index,
  hue,
}: {
  lesson: CourseLessonRead
  index: number
  hue: number
}) {
  return (
    <div
      style={{
        flex: '0 0 200px',
        display: 'flex',
        gap: 11,
        alignItems: 'flex-start',
        paddingRight: 20,
        borderRight: '1px solid rgba(255,255,255,0.07)',
        marginRight: 20,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 68,
          height: 44,
          borderRadius: 7,
          overflow: 'hidden',
          flexShrink: 0,
          background: 'rgba(255,255,255,0.06)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(150deg, oklch(0.80 0.06 ${hue}) 0%, oklch(0.88 0.02 280) 100%)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.25)',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 11,
          }}
        >
          🔒
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: '0.06em',
            color: 'rgba(255,255,255,0.28)',
            textTransform: 'uppercase',
            marginBottom: 3,
          }}
        >
          Episode {index}
        </div>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.45)',
            lineHeight: 1.3,
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {lesson.title}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10.5,
            color: 'rgba(255,255,255,0.24)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          ⏱ <span>{fmtLessonTime(lesson.duration_seconds)}</span>
        </div>
      </div>
    </div>
  )
}

// ── Instructor (light) ──────────────────────────────────────────────────────

function Instructor({ course }: { course: CourseRead }) {
  return (
    <section
      style={{
        padding: '72px 32px 80px',
        maxWidth: 1320,
        margin: '0 auto',
        fontFamily: FONT_VAR,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.18em',
          fontWeight: 600,
          color: 'oklch(0.66 0.006 280)',
          marginBottom: 36,
          textTransform: 'uppercase',
        }}
      >
        <EditText path="instructor.eyebrow" defaultValue="YOUR INSTRUCTOR" />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '0.75fr 1fr',
          gap: 60,
          alignItems: 'center',
        }}
      >
        <EditMedia
          id="instructor.portrait"
          label="instructor portrait"
          style={{
            position: 'relative',
            aspectRatio: '4 / 5',
            borderRadius: 'calc(28px * var(--radius-mul, 1))',
            overflow: 'hidden',
            boxShadow:
              '0 2px 6px rgba(0,0,0,0.06), 0 24px 60px rgba(0,0,0,0.12)',
          }}
          placeholder={
            <>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(160deg, oklch(0.42 0.09 35), oklch(0.18 0.05 65))',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 16,
                  top: 16,
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.3)',
                  zIndex: 3,
                }}
              >
                portrait placeholder
              </div>
            </>
          }
        >
          {course.instructor_name && (
            <div
              style={{
                position: 'absolute',
                left: 20,
                bottom: 18,
                color: 'white',
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                textShadow: '0 2px 12px rgba(0,0,0,0.7)',
                zIndex: 3,
              }}
            >
              {course.instructor_name}
            </div>
          )}
        </EditMedia>

        <div>
          <EditText
            as="blockquote"
            path="instructor.quote"
            defaultValue={
              '"Persuasion isn’t convincing. It’s giving someone a way to change their mind without losing face."'
            }
            multiline
            style={{
              fontSize: 'calc(clamp(22px, 2.6vw, 34px) * var(--type-scale, 1))',
              fontWeight: 'var(--h-weight, 500)',
              fontStyle: 'var(--h-italic, normal)',
              letterSpacing: 'calc(var(--h-tracking, 0em) - 0.022em)',
              lineHeight: 1.2,
              margin: '0 0 14px',
              color: 'oklch(0.18 0.008 280)',
              fontFamily: HEADING_VAR,
            }}
          />
          {course.instructor_name && (
            <div
              style={{
                fontSize: 12,
                color: 'oklch(0.66 0.006 280)',
                letterSpacing: '0.04em',
                marginBottom: 28,
              }}
            >
              — {course.instructor_name}
            </div>
          )}
          <EditText
            as="p"
            path="instructor.bio"
            defaultValue={course.instructor_bio ?? ''}
            multiline
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: 'oklch(0.32 0.008 280)',
              margin: '0 0 36px',
              maxWidth: 520,
            }}
          />

          <div
            style={{
              display: 'flex',
              gap: 0,
              paddingTop: 28,
              borderTop: '1px solid oklch(0.92 0.003 280)',
              alignItems: 'flex-start',
            }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                  flex: 1,
                  paddingLeft: i === 1 ? 0 : 32,
                  borderLeft:
                    i === 1
                      ? 'none'
                      : '1px solid oklch(0.92 0.003 280)',
                }}
              >
                <EditText
                  path={`cred${i}.num`}
                  defaultValue={['3', '12', '02'][i - 1]}
                  style={{
                    fontSize: 36,
                    fontWeight: 600,
                    letterSpacing: '-0.03em',
                    color: 'oklch(0.18 0.008 280)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
                <EditText
                  path={`cred${i}.label`}
                  defaultValue={
                    ['Published works', 'Years of practice', 'Spaire courses'][
                      i - 1
                    ]
                  }
                  style={{
                    fontSize: 11.5,
                    color: 'oklch(0.52 0.008 280)',
                    letterSpacing: '0.02em',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Final CTA ──────────────────────────────────────────────────────────────

function FinalCta({
  freeCount,
  priceLabel,
  onEnroll,
  enrolling,
  canEnroll,
}: {
  freeCount: number
  priceLabel: string
  onEnroll: () => void
  enrolling: boolean
  canEnroll: boolean
}) {
  return (
    <section
      style={{
        position: 'relative',
        margin: '0 20px 0',
        padding: '88px 48px 80px',
        background: 'oklch(0.18 0.008 280)',
        borderRadius: 'calc(28px * var(--radius-mul, 1))',
        overflow: 'hidden',
        isolation: 'isolate',
        textAlign: 'center',
        fontFamily: FONT_VAR,
      }}
    >
      <EditMedia
        id="finalCta.backdrop"
        label="CTA backdrop"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          borderRadius: 'inherit',
          overflow: 'hidden',
        }}
        placeholder={
          <>
            <div
              style={{
                position: 'absolute',
                left: '-10%',
                top: '-40%',
                width: '70%',
                height: '130%',
                background:
                  'radial-gradient(ellipse, oklch(0.45 0.18 265 / 0.50) 0%, transparent 60%)',
                filter: 'blur(40px)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: '-10%',
                bottom: '-40%',
                width: '60%',
                height: '130%',
                background:
                  'radial-gradient(ellipse, oklch(0.50 0.15 25 / 0.32) 0%, transparent 60%)',
                filter: 'blur(40px)',
              }}
            />
          </>
        }
      />
      {/* CTA backdrop EditMedia is self-closing — it has only a placeholder. */}

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 640,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 10.5,
            letterSpacing: '0.20em',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.45)',
            marginBottom: 28,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'oklch(0.72 0.16 25)',
              boxShadow: '0 0 10px oklch(0.72 0.16 25)',
            }}
          />
          <EditText path="finalCta.label" defaultValue="READY WHEN YOU ARE" />
        </div>
        <EditText
          as="h2"
          path="finalCta.title"
          defaultValue="Start free. Continue when you're ready."
          multiline
          style={{
            fontSize: 'calc(clamp(36px, 5vw, 64px) * var(--type-scale, 1))',
            fontWeight: 'var(--h-weight, 600)',
            letterSpacing: 'calc(var(--h-tracking, 0em) - 0.04em)',
            lineHeight: 1.02,
            margin: '0 0 14px',
            color: 'white',
            fontFamily: HEADING_VAR,
          }}
        />
        <EditText
          as="p"
          path="finalCta.subtitle"
          defaultValue={
            freeCount > 0
              ? `The first ${freeCount} ${plural(
                  freeCount,
                  'lesson is',
                  'lessons are',
                )} free to preview. No card required.`
              : 'Enroll any time. No card required to peek.'
          }
          multiline
          style={{
            fontSize: 15,
            color: 'rgba(255,255,255,0.50)',
            margin: '0 0 36px',
            lineHeight: 1.55,
          }}
        />
        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'center',
            marginBottom: 32,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={onEnroll}
            disabled={!canEnroll || enrolling}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 24px',
              borderRadius: 999,
              background: 'white',
              color: 'oklch(0.18 0.008 280)',
              fontSize: 14,
              fontWeight: 600,
              border: 'none',
              boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
              cursor: canEnroll ? (enrolling ? 'wait' : 'pointer') : 'default',
              fontFamily: 'inherit',
              opacity: enrolling ? 0.7 : 1,
            }}
          >
            {enrolling
              ? 'Loading…'
              : `Enroll${priceLabel ? ` for ${priceLabel}` : ''} →`}
          </button>
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '14px 22px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.10)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.16)',
              color: 'white',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'default',
              fontFamily: 'inherit',
            }}
          >
            ▶{' '}
            <EditText
              path="finalCta.secondary"
              defaultValue="Start free preview"
            />
          </button>
        </div>
      </div>
    </section>
  )
}

// ── Footer ─────────────────────────────────────────────────────────────────

function Footer({ organizationName }: { organizationName: string }) {
  return (
    <footer
      style={{
        padding: '40px 32px',
        maxWidth: 1320,
        margin: '0 auto',
        fontFamily: FONT_VAR,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 24,
          borderTop: '1px solid oklch(0.92 0.003 280)',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'oklch(0.18 0.008 280)',
            }}
          >
            Spaire
          </span>
          <span style={{ fontSize: 11.5, color: 'oklch(0.66 0.006 280)' }}>
            {organizationName} · © {new Date().getFullYear()}
          </span>
        </div>
        <span style={{ fontSize: 12, color: 'oklch(0.66 0.006 280)' }}>
          Premium courses, sold by creators.
        </span>
      </div>
    </footer>
  )
}

