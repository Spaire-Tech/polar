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
import { useIsMobile } from '@/utils/mobile'
import type { schemas } from '@spaire/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from '../../Toast/use-toast'
import { HlsVideo } from '../HlsVideo'
import {
  MobileEpisodes,
  MobileFinalCta,
  MobileFooter,
  MobileHero,
  MobileInstructor,
  MobileSectionsRoadmap,
} from './EditableCourseLandingViewMobile'
import { useEditor } from './EditorContext'
import { EditBlock, EditMedia, EditText } from './EditPrimitives'
import { HeroMedia } from './HeroMedia'
import { SectionModuleSheet } from './SectionModuleSheet'
import { SeriesSampleBlock } from './SeriesSampleBlock'

// Imperative handlers wired by the host (CustomizeTab) so episode tiles can
// persist edits to the actual course lesson — title, description, thumbnail
// and video — instead of only updating landing_overrides. When omitted (e.g.
// in the wizard preview) the tiles fall back to the legacy slot-based
// EditMedia flow that just stores into landing_overrides.
export type LessonHandlers = {
  updateLesson: (
    lessonId: string,
    patch: {
      title?: string
      description?: string | null
      thumbnail_object_position?: string | null
    },
  ) => Promise<void>
  uploadThumbnail: (lessonId: string, file: File) => Promise<void>
  uploadVideo: (
    lessonId: string,
    file: File,
    onProgress?: (pct: number) => void,
  ) => Promise<void>
  /**
   * Optional escape hatch for wizard-style hosts that buffer the uploaded
   * video locally (no Mux playback id yet). When provided, the episode tile
   * will use a plain <video src=...> for the hover peek + lightbox so the
   * user still sees what they uploaded.
   */
  getLocalVideoUrl?: (lessonId: string) => string | undefined
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
  // Mobile layout kicks in when the studio device toggle is set to mobile OR
  // when the page is being viewed on a real phone (public storefront). The
  // viewport check is intentionally skipped while the studio is forcing a
  // non-default device so the desktop preview stays available at any width.
  const viewportIsMobile = useIsMobile().isMobile
  const isMobile =
    ed.device === 'mobile' ||
    (ed.device === 'desktop' && viewportIsMobile)

  const paywallAt =
    course.paywall_enabled && course.paywall_position != null
      ? Math.min(course.paywall_position, flatLessons.length)
      : null
  const freeLessons =
    paywallAt != null ? flatLessons.slice(0, paywallAt) : flatLessons
  const paidLessons = paywallAt != null ? flatLessons.slice(paywallAt) : []
  const lockedCount = paidLessons.length

  const sectionMap: Record<string, { label: string; node: React.ReactNode }> =
    isMobile
      ? {
          hero: {
            label: 'Hero',
            node: (
              <MobileHero
                course={course}
                flatLessons={flatLessons}
                priceLabel={priceLabel}
                onEnroll={enroll}
                enrolling={enrolling}
                canEnroll={canEnroll}
              />
            ),
          },
          sample: {
            label: 'Episode sample',
            node: (
              <SeriesSampleBlock
                course={course}
                flatLessons={flatLessons}
                priceLabel={priceLabel}
                onEnroll={enroll}
                enrolling={enrolling}
                canEnroll={canEnroll}
              />
            ),
          },
          sections: {
            label: 'Sections',
            node: (
              <MobileSectionsRoadmap
                course={course}
                flatLessons={flatLessons}
              />
            ),
          },
          lessons: {
            label: 'Free preview',
            node: (
              <MobileEpisodes
                freeLessons={freeLessons}
                paidLessons={paidLessons}
                lockedCount={lockedCount}
                priceLabel={priceLabel}
                onEnroll={enroll}
                enrolling={enrolling}
                canEnroll={canEnroll}
                courseThumbnailUrl={course.thumbnail_url ?? null}
                courseThumbnailObjectPosition={
                  course.thumbnail_object_position ?? null
                }
              />
            ),
          },
          instructor: {
            label: 'Instructor',
            node: <MobileInstructor course={course} />,
          },
          finalCta: {
            label: 'Final CTA',
            node: (
              <MobileFinalCta
                priceLabel={priceLabel}
                onEnroll={enroll}
                enrolling={enrolling}
                canEnroll={canEnroll}
              />
            ),
          },
        }
      : {
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
          sample: {
            label: 'Episode sample',
            node: (
              <SeriesSampleBlock
                course={course}
                flatLessons={flatLessons}
                priceLabel={priceLabel}
                onEnroll={enroll}
                enrolling={enrolling}
                canEnroll={canEnroll}
              />
            ),
          },
          sections: {
            label: 'Sections',
            node: (
              <CourseSections course={course} flatLessons={flatLessons} />
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
          instructor: {
            label: 'Instructor',
            node: <Instructor course={course} />,
          },
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
      {isMobile ? (
        <MobileFooter organizationName={organizationName} />
      ) : (
        <Footer organizationName={organizationName} />
      )}
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
        boxShadow: '0 2px 6px rgba(0,0,0,0.06), 0 24px 60px rgba(0,0,0,0.10)',
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
          fallbackImageObjectPosition={course.thumbnail_object_position ?? null}
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
            {flatLessons.length}{' '}
            {plural(flatLessons.length, 'lesson', 'lessons')}
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
              {' '}
              — with{' '}
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
              <EditText
                path="hero.cta_secondary"
                defaultValue="Watch trailer"
              />
            </span>
          </button>
          <button
            type="button"
            onClick={onEnroll}
            disabled={!canEnroll || enrolling}
            title={
              !canEnroll
                ? 'Enroll is disabled in edit mode — switch to preview to test the checkout flow.'
                : undefined
            }
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
              opacity: enrolling ? 0.7 : !canEnroll ? 0.55 : 1,
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
export function TrailerModal({
  url,
  onClose,
}: {
  url: string
  onClose: () => void
}) {
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

  // Render via a portal into document.body so the modal always escapes any
  // ancestor that creates a containing block (the customize tab's iPhone
  // preview frame has isolation/overflow chrome; on real iOS Safari,
  // ancestors with backdrop-filter or transforms can clip a position:fixed
  // child too). Without the portal, the modal renders trapped inside the
  // landing's stacking context — and the user sees the page content
  // "inside" the trailer.
  if (typeof document === 'undefined') return null
  return createPortal(
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
    </div>,
    document.body,
  )
}

// Surface that reads media from the editor state first (so uploads show
// immediately) and falls back to the course's persisted thumbnail / trailer.
function HeroMediaSurface({
  fallbackImageUrl,
  fallbackTrailerUrl,
  fallbackImageObjectPosition,
}: {
  fallbackImageUrl: string | null
  fallbackTrailerUrl: string | null
  fallbackImageObjectPosition?: string | null
}) {
  const ed = useEditor()
  const heroImage = ed.m('hero.backdrop')
  const heroTrailer = ed.m('hero.trailer')
  const imageUrl =
    heroImage && heroImage.kind === 'image' ? heroImage.url : fallbackImageUrl
  // Prefer the override slot's position when present (so dragging on the
  // landing canvas wins), fall back to the persisted course field.
  const imageObjectPosition =
    (heroImage && heroImage.kind === 'image'
      ? heroImage.objectPosition
      : null) ?? fallbackImageObjectPosition ?? null
  const trailerUrl =
    heroTrailer && heroTrailer.kind === 'video'
      ? heroTrailer.url
      : heroImage && heroImage.kind === 'video'
        ? heroImage.url
        : fallbackTrailerUrl
  return (
    <HeroMedia
      imageUrl={imageUrl}
      imageObjectPosition={imageObjectPosition}
      trailerUrl={trailerUrl}
      peekSeconds={10}
    />
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
  const [reposMode, setReposMode] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const trailerInputRef = useRef<HTMLInputElement>(null)
  if (ed.mode !== 'edit') return null

  const heroImage = ed.m('hero.backdrop')
  const heroTrailer = ed.m('hero.trailer')
  const hasImage = !!heroImage && heroImage.kind === 'image'
  const hasTrailer =
    !!heroTrailer || (!!heroImage && heroImage.kind === 'video')

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
    <>
      {reposMode && hasImage && heroImage && heroImage.kind === 'image' && (
        <ImageReposOverlay
          currentPosition={heroImage.objectPosition ?? '50% 50%'}
          onChange={(next) =>
            ed.setMedia('hero.backdrop', { ...heroImage, objectPosition: next })
          }
          onDone={() => setReposMode(false)}
        />
      )}
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
      {hasImage && (
        <button
          type="button"
          onClick={() => setReposMode(true)}
          style={pillBtn(false)}
          title="Drag to reposition the hero image. Saves automatically."
        >
          ⤧ Reposition
        </button>
      )}
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
    </>
  )
}

// ── Course Sections (zigzag roadmap) ──────────────────────────────────────
//
// Apple-TV-styled section roadmap that mirrors the course's actual modules.
// Each card shows the module title with a replaceable image (per-module slot
// `sections.module.<id>.image`). Cards alternate above/below a dotted spine.
// Below the lg breakpoint we collapse to a stacked column so it stays
// readable on narrow viewports.

function SectionThumbPlaceholder({ hue, n }: { hue: number; n: number }) {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(135deg, oklch(0.32 0.06 ${hue}) 0%, oklch(0.18 0.04 ${(hue + 30) % 360}) 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 8px, transparent 8px 16px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '15%',
          top: '10%',
          width: '55%',
          height: '70%',
          background: `radial-gradient(ellipse, oklch(0.85 0.06 ${hue} / 0.18), transparent 70%)`,
          filter: 'blur(20px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          fontSize: 9.5,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.50)',
          fontWeight: 500,
        }}
      >
        portrait · §{n}
      </div>
    </>
  )
}

function SectionCard({
  module: mod,
  index,
  pointer,
  onClick,
}: {
  module: CourseRead['modules'][number]
  index: number
  pointer: 'top' | 'bottom'
  onClick?: () => void
}) {
  const isAbove = pointer === 'bottom'
  const hue = [35, 195, 285, 145, 25, 320][index % 6]
  const thumbRadius = isAbove ? '13px 13px 0 0' : '0 0 13px 13px'
  const thumb = (
    <EditMedia
      id={`sections.module.${mod.id}.image`}
      label={`Section ${index + 1} image`}
      style={{
        position: 'relative',
        aspectRatio: '4 / 3',
        overflow: 'hidden',
        borderRadius: thumbRadius,
        background: '#111',
      }}
      placeholder={<SectionThumbPlaceholder hue={hue} n={index + 1} />}
    />
  )
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      style={{
        position: 'relative',
        width: '100%',
        background: 'white',
        borderRadius: 16,
        overflow: 'visible',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.08)',
        border: '1px solid oklch(0.945 0.003 280)',
        display: 'flex',
        flexDirection: 'column',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 220ms cubic-bezier(0.2, 0.9, 0.3, 1.1), box-shadow 220ms ease',
      }}
    >
      {isAbove && thumb}
      <div style={{ padding: '20px 24px 22px' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'oklch(0.66 0.006 280)',
            marginBottom: 8,
            letterSpacing: '-0.005em',
          }}
        >
          Section {index + 1}
        </div>
        <EditText
          path={`sections.module.${mod.id}.title`}
          defaultValue={mod.title}
          style={{
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '-0.018em',
            color: 'oklch(0.18 0.008 280)',
            lineHeight: 1.3,
            display: 'block',
            fontFamily: HEADING_VAR,
          }}
        />
      </div>
      {!isAbove && thumb}
      <div
        style={{
          position: 'absolute',
          left: 36,
          width: 0,
          height: 0,
          borderLeft: '9px solid transparent',
          borderRight: '9px solid transparent',
          filter: 'drop-shadow(0 1px 0 oklch(0.945 0.003 280))',
          ...(isAbove
            ? {
                bottom: -9,
                top: 'auto',
                borderTop: '9px solid white',
                borderBottom: 'none',
              }
            : {
                top: -9,
                bottom: 'auto',
                borderBottom: '9px solid white',
                borderTop: 'none',
              }),
        }}
      />
    </div>
  )
}

function SectionZigzagRow({
  modules,
  startIndex,
  totalColumns,
  onOpen,
}: {
  modules: CourseRead['modules']
  startIndex: number
  totalColumns: number
  onOpen?: (absoluteIndex: number) => void
}) {
  // Always lay out `totalColumns` cells so cards keep the same width
  // whether the row is fully populated or only partially filled. Empty
  // cells render as spacers; the dotted spine only spans the active
  // portion of the row.
  const columns = totalColumns
  const filled = modules.length
  const halfCol = 100 / columns / 2
  const lineLeft = halfCol
  const lineRight = (columns - filled + 0.5) * (100 / columns)
  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 20,
          minHeight: 360,
          alignItems: 'end',
        }}
      >
        {Array.from({ length: columns }).map((_, i) => {
          const mod = modules[i]
          if (!mod) return <div key={`top-empty-${i}`} />
          const absoluteIndex = startIndex + i
          return absoluteIndex % 2 === 0 ? (
            <div
              key={mod.id}
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-end',
              }}
            >
              <SectionCard
                module={mod}
                index={absoluteIndex}
                pointer="bottom"
                onClick={onOpen ? () => onOpen(absoluteIndex) : undefined}
              />
            </div>
          ) : (
            <div key={mod.id} />
          )
        })}
      </div>

      <div
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 20,
          height: 24,
          alignItems: 'center',
          margin: '6px 0',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: `calc(${lineLeft}% - 6px)`,
            right: `calc(${lineRight}% - 6px)`,
            top: '50%',
            transform: 'translateY(-50%)',
            height: 1.5,
            background: 'oklch(0.92 0.003 280)',
          }}
        />
        {Array.from({ length: columns }).map((_, i) => {
          const mod = modules[i]
          if (!mod) return <div key={`dot-empty-${i}`} />
          return (
            <div
              key={mod.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: 'var(--bg-0, #fff)',
                  border: '1.5px solid oklch(0.66 0.006 280)',
                }}
              />
            </div>
          )
        })}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 20,
          minHeight: 360,
          alignItems: 'start',
        }}
      >
        {Array.from({ length: columns }).map((_, i) => {
          const mod = modules[i]
          if (!mod) return <div key={`bot-empty-${i}`} />
          const absoluteIndex = startIndex + i
          return absoluteIndex % 2 !== 0 ? (
            <div
              key={mod.id}
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
              }}
            >
              <SectionCard
              module={mod}
              index={absoluteIndex}
              pointer="top"
              onClick={onOpen ? () => onOpen(absoluteIndex) : undefined}
            />
            </div>
          ) : (
            <div key={mod.id} />
          )
        })}
      </div>
    </div>
  )
}

function CourseSections({
  course,
  flatLessons,
}: {
  course: CourseRead
  flatLessons: CourseLessonRead[]
}) {
  const modules = [...course.modules].sort((a, b) => a.position - b.position)
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  if (modules.length === 0) return null
  // Series are flat episode lists — the zigzag-of-modules roadmap has no
  // referent for them. The series landing prompt also returns an empty
  // sections array, but we gate on format here so the strip stays hidden
  // even for series that pre-date the prompt change.
  if (course.format === 'series') return null
  // Cap each row at 4 cards so the cards stay readable. With more modules,
  // the zigzag stacks into multiple rows — but every row reuses the same
  // column count so cards stay the same width whether a row is full or
  // only partially populated.
  const MAX_PER_ROW = 4
  const rowColumns = Math.min(modules.length, MAX_PER_ROW)
  const chunks: (typeof modules)[] = []
  for (let i = 0; i < modules.length; i += MAX_PER_ROW) {
    chunks.push(modules.slice(i, i + MAX_PER_ROW))
  }
  // Group flatLessons by module so the section sheet can list the lessons
  // for the clicked section without having to refetch. Falls back to
  // `module.lessons` when flatLessons doesn't carry module_id (e.g. the
  // wizard preview's fake lesson list).
  const lessonsByModule = new Map<string, CourseLessonRead[]>()
  for (const lesson of flatLessons) {
    if (!lesson.module_id) continue
    const list = lessonsByModule.get(lesson.module_id)
    if (list) list.push(lesson)
    else lessonsByModule.set(lesson.module_id, [lesson])
  }
  const lessonsFor = (mod: CourseRead['modules'][number]) => {
    const grouped = lessonsByModule.get(mod.id)
    if (grouped && grouped.length > 0) return grouped
    return mod.lessons ?? []
  }
  const openModule = openIdx !== null ? modules[openIdx] : null

  return (
    <section
      style={{
        padding: '88px 32px 24px',
        maxWidth: 1480,
        margin: '0 auto',
        fontFamily: FONT_VAR,
      }}
    >
      <div style={{ marginBottom: 56, maxWidth: 640 }}>
        <EditText
          path="sections.eyebrow"
          defaultValue="The course"
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'oklch(0.66 0.006 280)',
            marginBottom: 14,
          }}
        />
        <EditText
          as="h2"
          path="sections.heading"
          defaultValue={`${
            modules.length === 1
              ? 'One section'
              : modules.length === 2
                ? 'Two sections'
                : modules.length === 3
                  ? 'Three sections'
                  : modules.length === 4
                    ? 'Four sections'
                    : modules.length === 5
                      ? 'Five sections'
                      : modules.length === 6
                        ? 'Six sections'
                        : `${modules.length} sections`
          }, in order`}
          style={{
            fontSize: 'calc(clamp(26px, 3vw, 38px) * var(--type-scale, 1))',
            fontWeight: 'var(--h-weight, 600)',
            letterSpacing: 'calc(var(--h-tracking, 0em) - 0.03em)',
            lineHeight: 1.05,
            margin: '0 0 10px',
            color: 'oklch(0.18 0.008 280)',
            fontFamily: HEADING_VAR,
          }}
        />
        <EditText
          as="p"
          path="sections.subheading"
          defaultValue="Each section builds on the last — watch in order or skip ahead once you enroll."
          multiline
          style={{
            fontSize: 14.5,
            color: 'oklch(0.52 0.008 280)',
            margin: 0,
            fontWeight: 400,
            lineHeight: 1.55,
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
        {chunks.map((chunk, ci) => (
          <SectionZigzagRow
            key={ci}
            modules={chunk}
            startIndex={ci * MAX_PER_ROW}
            totalColumns={rowColumns}
            onOpen={(i) => setOpenIdx(i)}
          />
        ))}
      </div>
      {openModule && openIdx !== null && (
        <SectionModuleSheet
          module={openModule}
          index={openIdx}
          lessons={lessonsFor(openModule)}
          onClose={() => setOpenIdx(null)}
        />
      )}
    </section>
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

      {/* Paywall — Apple liquid-glass card. Light, dimensional, glass-on-glass. */}
      {course.paywall_enabled && lockedCount > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 72,
            marginTop: 24,
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 1080,
              borderRadius: 'calc(28px * var(--radius-mul, 1))',
              overflow: 'hidden',
              isolation: 'isolate',
              padding: '64px 64px 56px',
              background: `
                linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.55) 100%),
                radial-gradient(140% 100% at 12% -10%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 55%),
                radial-gradient(120% 90% at 100% 110%, oklch(0.96 0.003 280) 0%, oklch(0.92 0.004 280) 80%)
              `,
              backdropFilter: 'blur(30px) saturate(170%)',
              WebkitBackdropFilter: 'blur(30px) saturate(170%)',
              border: '1px solid rgba(255,255,255,0.75)',
              boxShadow: `
                inset 0 1px 0 rgba(255,255,255,1),
                inset 0 0 0 1px rgba(255,255,255,0.55),
                inset 0 -1px 0 rgba(255,255,255,0.55),
                inset 0 -20px 40px rgba(0,0,0,0.02),
                0 1px 1px rgba(0,0,0,0.04),
                0 2px 6px rgba(0,0,0,0.05),
                0 12px 28px rgba(20,18,40,0.08),
                0 36px 80px rgba(20,18,40,0.10),
                0 60px 120px rgba(20,18,40,0.06)
              `,
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: '-15%',
                top: '-50%',
                width: '70%',
                height: '160%',
                background:
                  'radial-gradient(ellipse, rgba(255,255,255,0.7) 0%, transparent 60%)',
                filter: 'blur(36px)',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />
            <div
              aria-hidden
              style={{
                position: 'absolute',
                right: '-20%',
                bottom: '-50%',
                width: '60%',
                height: '150%',
                background:
                  'radial-gradient(ellipse, rgba(255,255,255,0.35) 0%, transparent 65%)',
                filter: 'blur(28px)',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                height: 1.5,
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(255,255,255,1) 25%, rgba(255,255,255,1) 75%, transparent 100%)',
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: 1,
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(40,30,80,0.06) 50%, transparent 100%)',
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />

            <div
              style={{
                position: 'relative',
                zIndex: 1,
                textAlign: 'center',
                marginBottom: 24,
              }}
            >
              <EditText
                path="paywall.eyebrow"
                defaultValue="Members only"
                style={{
                  display: 'block',
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: '0.20em',
                  textTransform: 'uppercase',
                  color: 'oklch(0.66 0.006 280)',
                  marginBottom: 16,
                }}
              />
              <EditText
                path="paywall.title"
                defaultValue={`${lockedCount} more ${plural(
                  lockedCount,
                  'lesson',
                  'lessons',
                )}, unlocked when you enroll`}
                multiline
                style={{
                  fontSize:
                    'calc(clamp(28px, 3.2vw, 40px) * var(--type-scale, 1))',
                  fontWeight: 'var(--h-weight, 600)',
                  letterSpacing: 'calc(var(--h-tracking, 0em) - 0.03em)',
                  lineHeight: 1.1,
                  color: 'oklch(0.18 0.008 280)',
                  marginBottom: 12,
                  display: 'block',
                  fontFamily: HEADING_VAR,
                }}
              />
              <EditText
                path="paywall.subtitle"
                defaultValue="Lifetime access. Workshops with feedback. Certificate. 30-day refund."
                multiline
                style={{
                  fontSize: 15,
                  color: 'oklch(0.52 0.008 280)',
                  lineHeight: 1.55,
                  maxWidth: 540,
                  margin: '0 auto',
                  display: 'block',
                }}
              />
            </div>

            <div
              aria-hidden
              style={{
                position: 'relative',
                zIndex: 1,
                height: 1,
                margin: '4px -64px 22px',
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.07) 50%, transparent 100%)',
              }}
            />

            <div
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 20,
                marginBottom: 26,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                }}
              >
                {priceLabel && (
                  <span
                    style={{
                      fontSize: 32,
                      fontWeight: 700,
                      letterSpacing: '-0.03em',
                      color: 'oklch(0.18 0.008 280)',
                      lineHeight: 1,
                    }}
                  >
                    {priceLabel}
                  </span>
                )}
                <EditText
                  path="paywall.priceSub"
                  defaultValue="one-time · lifetime access"
                  style={{
                    fontSize: 12,
                    color: 'oklch(0.66 0.006 280)',
                    marginTop: 6,
                    display: 'block',
                  }}
                />
              </div>
              <button
                type="button"
                onClick={onEnroll}
                disabled={!canEnroll || enrolling}
                title={
                  !canEnroll
                    ? 'Enroll is disabled in edit mode — switch to preview to test the checkout flow.'
                    : undefined
                }
                style={{
                  padding: '14px 28px',
                  borderRadius: 999,
                  background:
                    'linear-gradient(180deg, oklch(0.28 0.008 280) 0%, oklch(0.16 0.008 280) 100%)',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  border: 'none',
                  cursor: canEnroll
                    ? enrolling
                      ? 'wait'
                      : 'pointer'
                    : 'default',
                  fontFamily: 'inherit',
                  opacity: enrolling ? 0.7 : !canEnroll ? 0.55 : 1,
                  boxShadow: `
                    inset 0 1px 0 rgba(255,255,255,0.18),
                    inset 0 -1px 0 rgba(0,0,0,0.4),
                    0 1px 2px rgba(0,0,0,0.15),
                    0 6px 16px rgba(0,0,0,0.18),
                    0 12px 30px rgba(0,0,0,0.10)
                  `,
                }}
              >
                {enrolling ? (
                  'Loading…'
                ) : (
                  <EditText path="paywall.cta" defaultValue="Enroll now" />
                )}
              </button>
            </div>

            {/* Locked episode strip — glass on glass */}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(paidLessons.length, 4)}, minmax(0, 1fr))${lockedCount > 4 ? ' auto' : ''}`,
                gap: 14,
                padding: '16px 18px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.45)',
                border: '1px solid rgba(255,255,255,0.7)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(0,0,0,0.03)',
                alignItems: 'center',
              }}
            >
              {paidLessons.slice(0, 4).map((lesson, i) => (
                <LockedGlassItem
                  key={lesson.id}
                  lesson={lesson}
                  index={freeLessons.length + i + 1}
                  hue={thumbHues[i % thumbHues.length]}
                  fallbackThumbnailUrl={course.thumbnail_url ?? null}
                  fallbackObjectPosition={
                    course.thumbnail_object_position ?? null
                  }
                />
              ))}
              {lockedCount > 4 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    padding: '0 10px',
                    alignSelf: 'stretch',
                    borderLeft: '1px solid rgba(0,0,0,0.06)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 600,
                      color: 'oklch(0.32 0.008 280)',
                      letterSpacing: '-0.025em',
                      lineHeight: 1,
                    }}
                  >
                    +{lockedCount - 4}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'oklch(0.66 0.006 280)',
                      textAlign: 'center',
                      lineHeight: 1.3,
                    }}
                  >
                    more {plural(lockedCount - 4, 'lesson', 'lessons')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {openLesson && (
        <LessonLightbox
          lesson={openLesson}
          onClose={() => setOpenLessonId(null)}
          localVideoUrl={lessonHandlers?.getLocalVideoUrl?.(openLesson.id)}
        />
      )}
    </section>
  )
}

function LessonLightbox({
  lesson,
  onClose,
  localVideoUrl,
}: {
  lesson: CourseLessonRead
  onClose: () => void
  localVideoUrl?: string
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
        ) : localVideoUrl ? (
          <video
            src={localVideoUrl}
            poster={lesson.thumbnail_url ?? undefined}
            controls
            autoPlay
            playsInline
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              background: '#000',
            }}
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

  // Reposition mode — when active, an inline drag overlay tracks the
  // user's pointer over the thumbnail and commits the new
  // thumbnail_object_position to the lesson on release. The same lesson
  // record drives every other place the thumbnail shows (outline, mobile
  // landing, customer portal), so the change is visible everywhere.
  const [reposMode, setReposMode] = useState(false)
  const [livePos, setLivePos] = useState<string | null>(null)
  const repositionCommitRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const playbackId =
    lesson.mux_playback_id && lesson.mux_status === 'ready'
      ? lesson.mux_playback_id
      : null
  const localVideoUrl = lessonHandlers?.getLocalVideoUrl?.(lesson.id) ?? null
  const hasPeekVideo = !!playbackId || !!localVideoUrl
  const thumbnailUrl = lesson.thumbnail_url ?? null
  const effectivePosition =
    livePos ?? lesson.thumbnail_object_position ?? '50% 50%'

  const commitPosition = (next: string) => {
    if (!lessonHandlers) return
    if (repositionCommitRef.current) {
      clearTimeout(repositionCommitRef.current)
    }
    repositionCommitRef.current = setTimeout(() => {
      lessonHandlers
        .updateLesson(lesson.id, { thumbnail_object_position: next })
        .catch((err) => {
          toast({
            title: 'Failed to save thumbnail position',
            description: err instanceof Error ? err.message : String(err),
          })
        })
    }, 250)
  }

  useEffect(
    () => () => {
      if (repositionCommitRef.current) {
        clearTimeout(repositionCommitRef.current)
      }
    },
    [],
  )

  // Drive the hover-triggered peek. Re-evaluate when `hovered` flips.
  useEffect(() => {
    if (peekTimerRef.current) {
      clearTimeout(peekTimerRef.current)
      peekTimerRef.current = null
    }
    if (hovered && hasPeekVideo) {
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
  }, [hovered, hasPeekVideo])

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
            objectPosition: effectivePosition,
            opacity: peekActive ? 0 : 1,
            transition: 'opacity 400ms ease',
            zIndex: 1,
          }}
        />
      )}
      {hasPeekVideo && peekActive && (
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
          {playbackId ? (
            <HlsVideo
              playbackId={playbackId}
              poster={thumbnailUrl}
              controls={false}
              autoPlay
              muted
              loop
              className="h-full w-full object-cover"
            />
          ) : localVideoUrl ? (
            <video
              src={localVideoUrl}
              poster={thumbnailUrl ?? undefined}
              autoPlay
              muted
              loop
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : null}
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
          {hovered && !reposMode && (
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
              {thumbnailUrl && (
                <button
                  type="button"
                  onClick={() => setReposMode(true)}
                  style={lessonPillBtn}
                  title="Drag to reposition the thumbnail. Saves automatically."
                >
                  Reposition
                </button>
              )}
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
          {reposMode && thumbnailUrl && (
            <ImageReposOverlay
              currentPosition={effectivePosition}
              onChange={(next) => {
                setLivePos(next)
                commitPosition(next)
              }}
              onDone={() => setReposMode(false)}
            />
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

// Inline reposition overlay for the lesson card. Same drag-on-image UX
// as the EditMedia ReposOverlay but persists via `lessonHandlers` so the
// new position lands on the actual lesson record (where every other
// surface — outline grid, mobile landing, customer portal — reads it).
function ImageReposOverlay({
  currentPosition,
  onChange,
  onDone,
}: {
  currentPosition: string
  onChange: (next: string) => void
  onDone: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(() => {
    const parts = currentPosition.trim().split(/\s+/)
    const x = parseFloat(parts[0])
    const y = parseFloat(parts[1])
    return {
      x: Number.isFinite(x) ? Math.min(100, Math.max(0, x)) : 50,
      y: Number.isFinite(y) ? Math.min(100, Math.max(0, y)) : 50,
    }
  })
  const [dragging, setDragging] = useState(false)
  const setFromPoint = (clientX: number, clientY: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100))
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100))
    setPos({ x, y })
    onChange(`${x.toFixed(1)}% ${y.toFixed(1)}%`)
  }
  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      e.preventDefault()
      setFromPoint(e.clientX, e.clientY)
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') onDone()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone])
  return (
    <>
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setFromPoint(e.clientX, e.clientY)
          setDragging(true)
        }}
        onTouchStart={(e) => {
          const t = e.touches[0]
          if (t) setFromPoint(t.clientX, t.clientY)
        }}
        onTouchMove={(e) => {
          const t = e.touches[0]
          if (t) setFromPoint(t.clientX, t.clientY)
        }}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 7,
          cursor: dragging ? 'grabbing' : 'grab',
          background:
            'radial-gradient(circle at var(--rp-x) var(--rp-y), rgba(99,102,241,0.18) 0%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.55) 100%)',
          ...({
            '--rp-x': `${pos.x}%`,
            '--rp-y': `${pos.y}%`,
          } as React.CSSProperties),
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          width: 14,
          height: 14,
          marginLeft: -7,
          marginTop: -7,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.95)',
          border: '2px solid #6366f1',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          zIndex: 8,
          pointerEvents: 'none',
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          right: 10,
          top: 10,
          zIndex: 9,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 8px 6px 12px',
          borderRadius: 999,
          background: 'rgba(20,20,22,0.92)',
          color: 'white',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <span style={{ fontSize: 11.5, fontWeight: 600 }}>
          Drag to reposition · {pos.x.toFixed(0)}% × {pos.y.toFixed(0)}%
        </span>
        <button
          type="button"
          onClick={onDone}
          style={{
            ...lessonPillBtn,
            background: 'white',
            color: '#111',
            padding: '5px 11px',
          }}
        >
          Done
        </button>
      </div>
    </>
  )
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

  // Keep `titleEditing` true until the mutation + refetch complete. Flipping
  // it false before the refetch lets the DOM-sync effect run while
  // `lessonTitle` still holds the stale value, which clobbers the user's edit
  // visually and looks like "the save didn't take". Same shape for description.
  const persistTitle = async () => {
    if (!persistsToLesson || !lessonHandlers) {
      setTitleEditing(false)
      return
    }
    const next = (titleRef.current?.innerText ?? '').trim()
    if (!next) {
      if (titleRef.current) titleRef.current.innerText = lessonTitle
      setTitleEditing(false)
      return
    }
    if (next === lessonTitle) {
      setTitleEditing(false)
      return
    }
    try {
      await lessonHandlers.updateLesson(lesson.id, { title: next })
    } catch (e) {
      toast({
        title: 'Failed to save title',
        description: (e as Error).message ?? '',
      })
    } finally {
      setTitleEditing(false)
    }
  }

  const persistDesc = async () => {
    if (!persistsToLesson || !lessonHandlers) {
      setDescEditing(false)
      return
    }
    const next = (descRef.current?.innerText ?? '').replace(/\n+$/, '')
    if (next === lessonDesc) {
      setDescEditing(false)
      return
    }
    try {
      await lessonHandlers.updateLesson(lesson.id, {
        description: next.length > 0 ? next : null,
      })
    } catch (e) {
      toast({
        title: 'Failed to save description',
        description: (e as Error).message ?? '',
      })
    } finally {
      setDescEditing(false)
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
                  if (descRef.current) descRef.current.innerText = lessonDesc
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
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
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

function LockedGlassItem({
  lesson,
  index,
  hue,
  fallbackThumbnailUrl,
  fallbackObjectPosition,
}: {
  lesson: CourseLessonRead
  index: number
  hue: number
  fallbackThumbnailUrl?: string | null
  fallbackObjectPosition?: string | null
}) {
  // Prefer the lesson's own cover so each locked card reads like a real
  // episode tile; fall back to the course thumbnail so the paywall doesn't
  // end up showing a row of identical color-swatch placeholders. The hue
  // gradient stays as the last-resort backdrop.
  const coverUrl = lesson.thumbnail_url ?? fallbackThumbnailUrl ?? null
  const coverPosition =
    lesson.thumbnail_object_position ?? fallbackObjectPosition ?? '50% 50%'
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 0,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 10',
          borderRadius: 8,
          overflow: 'hidden',
          background: 'rgba(0,0,0,0.04)',
          border: '1px solid rgba(255,255,255,0.7)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: coverPosition,
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(150deg, oklch(0.78 0.05 ${hue}) 0%, oklch(0.86 0.02 280) 100%)`,
            }}
          />
        )}
        {/* Darkening layer + soft saturation drop so the image reads as
            "members only" without going fully opaque. With no image, the
            same overlay just dims the placeholder gradient. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: coverUrl
              ? 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.55) 100%)'
              : 'rgba(255,255,255,0.45)',
            backdropFilter: coverUrl
              ? 'saturate(0.7)'
              : 'blur(10px) saturate(150%)',
            WebkitBackdropFilter: coverUrl
              ? 'saturate(0.7)'
              : 'blur(10px) saturate(150%)',
          }}
        />
        {/* Lock icon centered on top */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: coverUrl ? 'rgba(255,255,255,0.92)' : 'oklch(0.45 0.012 280)',
          }}
          aria-hidden
        >
          <LockedItemLockIcon />
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: '0.08em',
            color: 'oklch(0.66 0.006 280)',
            textTransform: 'uppercase',
            marginBottom: 3,
          }}
        >
          Episode {index}
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'oklch(0.32 0.008 280)',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {lesson.title}
        </div>
      </div>
    </div>
  )
}

function LockedItemLockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))',
      }}
    >
      <rect x="3.25" y="7" width="9.5" height="6.5" rx="1.3" />
      <path d="M5.25 7V5a2.75 2.75 0 015.5 0v2" />
    </svg>
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
                    i === 1 ? 'none' : '1px solid oklch(0.92 0.003 280)',
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
        display: 'flex',
        justifyContent: 'center',
        padding: '0 32px',
        margin: '40px 0 80px',
        fontFamily: FONT_VAR,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 1080,
          borderRadius: 'calc(28px * var(--radius-mul, 1))',
          overflow: 'hidden',
          isolation: 'isolate',
          padding: '88px 64px 72px',
          textAlign: 'center',
          background: `
            linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.55) 100%),
            radial-gradient(140% 100% at 12% -10%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 55%),
            radial-gradient(120% 90% at 100% 110%, oklch(0.96 0.003 280) 0%, oklch(0.92 0.004 280) 80%)
          `,
          backdropFilter: 'blur(30px) saturate(170%)',
          WebkitBackdropFilter: 'blur(30px) saturate(170%)',
          border: '1px solid rgba(255,255,255,0.75)',
          boxShadow: `
            inset 0 1px 0 rgba(255,255,255,1),
            inset 0 0 0 1px rgba(255,255,255,0.55),
            inset 0 -1px 0 rgba(255,255,255,0.55),
            inset 0 -20px 40px rgba(0,0,0,0.02),
            0 1px 1px rgba(0,0,0,0.04),
            0 2px 6px rgba(0,0,0,0.05),
            0 12px 28px rgba(20,18,40,0.08),
            0 36px 80px rgba(20,18,40,0.10),
            0 60px 120px rgba(20,18,40,0.06)
          `,
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
                  left: '-15%',
                  top: '-50%',
                  width: '70%',
                  height: '160%',
                  background:
                    'radial-gradient(ellipse, rgba(255,255,255,0.7) 0%, transparent 60%)',
                  filter: 'blur(36px)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: '-20%',
                  bottom: '-50%',
                  width: '60%',
                  height: '150%',
                  background:
                    'radial-gradient(ellipse, rgba(255,255,255,0.35) 0%, transparent 65%)',
                  filter: 'blur(28px)',
                }}
              />
            </>
          }
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 1.5,
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,1) 25%, rgba(255,255,255,1) 75%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 1,
            background:
              'linear-gradient(90deg, transparent 0%, rgba(40,30,80,0.06) 50%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <EditText
            path="finalCta.label"
            defaultValue="READY WHEN YOU ARE"
            style={{
              display: 'block',
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: '0.20em',
              textTransform: 'uppercase',
              color: 'oklch(0.66 0.006 280)',
              marginBottom: 22,
            }}
          />
          <EditText
            as="h2"
            path="finalCta.title"
            defaultValue="Start free. Continue when you're ready."
            multiline
            style={{
              fontSize: 'calc(clamp(36px, 5vw, 60px) * var(--type-scale, 1))',
              fontWeight: 'var(--h-weight, 600)',
              letterSpacing: 'calc(var(--h-tracking, 0em) - 0.04em)',
              lineHeight: 1.02,
              margin: '0 0 18px',
              color: 'oklch(0.18 0.008 280)',
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
              fontSize: 15.5,
              color: 'oklch(0.52 0.008 280)',
              margin: '0 auto 36px',
              lineHeight: 1.55,
              maxWidth: 480,
              display: 'block',
            }}
          />
          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'center',
              marginBottom: 26,
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={onEnroll}
              disabled={!canEnroll || enrolling}
              style={{
                padding: '14px 28px',
                borderRadius: 999,
                background:
                  'linear-gradient(180deg, oklch(0.28 0.008 280) 0%, oklch(0.16 0.008 280) 100%)',
                color: 'white',
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                border: 'none',
                cursor: canEnroll
                  ? enrolling
                    ? 'wait'
                    : 'pointer'
                  : 'default',
                fontFamily: 'inherit',
                opacity: enrolling ? 0.7 : 1,
                boxShadow: `
                  inset 0 1px 0 rgba(255,255,255,0.18),
                  inset 0 -1px 0 rgba(0,0,0,0.4),
                  0 1px 2px rgba(0,0,0,0.15),
                  0 6px 16px rgba(0,0,0,0.18),
                  0 12px 30px rgba(0,0,0,0.10)
                `,
              }}
            >
              {enrolling
                ? 'Loading…'
                : `Enroll${priceLabel ? ` for ${priceLabel}` : ''}`}
            </button>
            <button
              type="button"
              style={{
                padding: '14px 24px',
                borderRadius: 999,
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0.55))',
                border: '1px solid rgba(255,255,255,0.9)',
                color: 'oklch(0.18 0.008 280)',
                fontSize: 13.5,
                fontWeight: 500,
                cursor: 'default',
                fontFamily: 'inherit',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,1), 0 1px 2px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.06)',
              }}
            >
              <EditText
                path="finalCta.secondary"
                defaultValue="Start free preview"
              />
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: 12,
              color: 'oklch(0.66 0.006 280)',
            }}
          >
            <EditText path="finalCta.guarantee1" defaultValue="30-day refund" />
            <span
              style={{
                width: 3,
                height: 3,
                borderRadius: '50%',
                background: 'oklch(0.92 0.003 280)',
              }}
            />
            <EditText
              path="finalCta.guarantee2"
              defaultValue="Lifetime access"
            />
            <span
              style={{
                width: 3,
                height: 3,
                borderRadius: '50%',
                background: 'oklch(0.92 0.003 280)',
              }}
            />
            <EditText path="finalCta.guarantee3" defaultValue="Any device" />
            <span
              style={{
                width: 3,
                height: 3,
                borderRadius: '50%',
                background: 'oklch(0.92 0.003 280)',
              }}
            />
            <EditText path="finalCta.guarantee4" defaultValue="Certificate" />
          </div>
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
