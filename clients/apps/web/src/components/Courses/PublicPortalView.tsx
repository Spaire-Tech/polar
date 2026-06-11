'use client'

// PublicPortalView — the public course page IS the portal now. Renders
// GeneratedPortalPage (the surface composed 1:1 from the course-page
// designs) with real behavior wired in:
//
//   • hero_variant / lesson_card_variant / trial_mode / format → layout
//   • landing_overrides.ai_hero → the AI-written hero copy
//   • landing_overrides.theme_mode → the creator's light/dark choice
//   • per-lesson thumbnails when they exist; the designs' liquid-glass
//     placeholder otherwise — NEVER the cover photo smeared on tiles
//   • sample payload (when configured + ready) → playable Free Sample screen
//   • free-preview lessons play inline (Mux); locked tiles → checkout
//   • enrolled visitors are pointed at their portal

import type {
  CourseLandingLesson,
  CourseLandingPageData,
} from '@/hooks/queries/courses'
import { api } from '@/utils/client'
import { CONFIG } from '@/utils/config'
import { schemas } from '@spaire/client'
import { useCallback, useMemo, useState } from 'react'
import { toast } from '../Toast/use-toast'
import { formatProductPrice } from './editor/EditableCourseLandingView'
import {
  GeneratedPortalPage,
  type GeneratedGroup,
} from './editor/GeneratedPortalPage'
import { HlsVideo } from './HlsVideo'

type PlayingClip = {
  title: string
  mux_playback_id?: string | null
  thumbnail_url?: string | null
  trailer?: boolean
}

export function PublicPortalView({
  organization,
  product,
  landing,
}: {
  organization: schemas['Organization']
  product: schemas['ProductStorefront']
  landing: CourseLandingPageData
}) {
  const isEpisodic = landing.format === 'series'
  const unit = isEpisodic ? 'episode' : 'lesson'
  const unitCap = isEpisodic ? 'Episode' : 'Lesson'
  const heroVariant = landing.hero_variant ?? 'cover'
  const cardVariant = landing.lesson_card_variant ?? 'catalog'
  const trialMode = landing.trial_mode ?? 'free_preview'
  const hasAccess = landing.has_access
  const paywallEnabled = (landing.paywall_enabled ?? false) && !hasAccess

  const priceLabel =
    formatProductPrice(product as unknown as schemas['Product']) || 'Free'
  const isFreeProduct = priceLabel === 'Free' || !landing.paywall_enabled
  const recurring = (
    product as unknown as { prices?: { type?: string }[] }
  ).prices?.some((p) => p.type === 'recurring')

  // ── Checkout (mirrors the enroll flow the old landing used) ──────────────
  const [enrolling, setEnrolling] = useState(false)
  const enroll = useCallback(async () => {
    if (enrolling) return
    setEnrolling(true)
    try {
      const { data: checkout, error } = await api.POST(
        '/v1/checkouts/client/',
        { body: { product_id: product.id } },
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
      setEnrolling(false)
    }
  }, [enrolling, product.id])

  const goToPortal = useCallback(() => {
    window.location.href = `/${organization.slug}/portal/courses/${landing.id}`
  }, [organization.slug, landing.id])

  // ── Lightbox (free preview / trailer / sample) ───────────────────────────
  const [playing, setPlaying] = useState<PlayingClip | null>(null)

  const isLocked = useCallback(
    (l: CourseLandingLesson) =>
      !hasAccess && (landing.paywall_enabled ?? false) && !l.is_free_preview,
    [hasAccess, landing.paywall_enabled],
  )

  const onLessonSelect = useCallback(
    (lesson: CourseLandingLesson) => {
      if (hasAccess) {
        goToPortal()
        return
      }
      if (!isLocked(lesson) && lesson.mux_playback_id) {
        setPlaying({
          title: lesson.title,
          mux_playback_id: lesson.mux_playback_id,
          thumbnail_url: lesson.thumbnail_url,
        })
        return
      }
      void enroll()
    },
    [hasAccess, goToPortal, isLocked, enroll],
  )

  // ── Labels — same vocabulary the wizard preview used ─────────────────────
  const freeCount = useMemo(
    () => landing.lessons.filter((l) => l.is_free_preview).length,
    [landing.lessons],
  )
  const cadence = recurring ? 'cancel anytime' : 'one-time purchase'
  const sample = landing.sample
  const samplePlayable = Boolean(sample?.mux_playback_id)

  const playLabel = hasAccess
    ? 'Continue Watching'
    : isFreeProduct
      ? 'Start Watching'
      : trialMode === 'lesson_sample'
        ? 'Play Sample'
        : freeCount > 0
          ? `Play ${unitCap} 1 Free`
          : 'Watch Preview'
  const buyLabel = hasAccess
    ? 'Open Portal'
    : isFreeProduct
      ? 'Enroll Free'
      : recurring
        ? `Subscribe — ${priceLabel}`
        : `Buy — ${priceLabel}`
  const freeLine = hasAccess
    ? 'You own this Original'
    : isFreeProduct
      ? 'Free for everyone'
      : trialMode === 'lesson_sample'
        ? `Sample clip free · ${cadence}`
        : freeCount > 0
          ? `${freeCount} ${unit}${freeCount === 1 ? '' : 's'} free · ${cadence}`
          : cadence

  // Sample playback is INLINE on the sample screen (clip-windowed,
  // scroll-aware) — handled inside GeneratedPortalPage via the
  // samplePlayback* props + playStartsSample. No lightbox for it.
  const onPlay = useCallback(() => {
    if (hasAccess) {
      goToPortal()
      return
    }
    const firstFree = landing.lessons.find(
      (l) => l.is_free_preview && l.mux_playback_id,
    )
    if (firstFree) {
      setPlaying({
        title: firstFree.title,
        mux_playback_id: firstFree.mux_playback_id,
        thumbnail_url: firstFree.thumbnail_url,
      })
    } else void enroll()
  }, [hasAccess, goToPortal, landing.lessons, enroll])

  const onBuy = useCallback(() => {
    if (hasAccess) goToPortal()
    else void enroll()
  }, [hasAccess, goToPortal, enroll])

  const onTrailer = useCallback(() => {
    if (landing.trailer_url) {
      setPlaying({ title: landing.title ?? 'Trailer', trailer: true })
    } else {
      onPlay()
    }
  }, [landing.trailer_url, landing.title, onPlay])

  // ── AI hero copy — prefer ai_hero over the creator's raw description ─────
  const aiHero = landing.landing_overrides?.ai_hero ?? null
  const heroDesc = aiHero?.description || landing.description || ''
  const heroByline = aiHero?.byline || landing.instructor_bio || ''
  const heroEyebrow = aiHero?.eyebrow || 'A Spaire Original'
  const heroBadge =
    aiHero?.badge || (isEpisodic ? 'New Series' : 'New Course')
  const heroTitleLines =
    aiHero?.titleLines && aiHero.titleLines.length > 0
      ? aiHero.titleLines
      : null

  // The creator's persisted theme choice drives the public page.
  const dark = landing.landing_overrides?.theme_mode === 'dark'
  const aiInstructor = landing.landing_overrides?.ai_instructor ?? null
  const aiFaq = landing.landing_overrides?.ai_faq ?? []
  const portraitUrl = landing.landing_overrides?.portrait_url ?? null

  // ── Groups — per-lesson media only; placeholder otherwise ────────────────
  const flatLessons = landing.lessons
  const groups: GeneratedGroup[] = useMemo(() => {
    const toGenerated = (l: CourseLandingLesson, flatIdx: number) => ({
      title: l.title,
      description: l.description ?? '',
      flatIdx,
      imageUrl: l.thumbnail_url ?? null,
      durationLabel: l.duration_seconds
        ? `${Math.max(1, Math.round(l.duration_seconds / 60))}m`
        : null,
      free: !isLocked(l),
      locked: isLocked(l),
    })
    if (isEpisodic || !landing.modules?.length) {
      return [{ title: null, lessons: flatLessons.map(toGenerated) }]
    }
    const byModule = new Map<string, CourseLandingLesson[]>()
    for (const l of flatLessons) {
      const key = l.module_id ?? 'unknown'
      if (!byModule.has(key)) byModule.set(key, [])
      byModule.get(key)!.push(l)
    }
    const out: GeneratedGroup[] = []
    let flatIdx = 0
    for (const m of [...landing.modules].sort(
      (a, b) => a.position - b.position,
    )) {
      const lessons = byModule.get(m.id)
      if (lessons?.length) {
        out.push({
          title: m.title,
          lessons: lessons.map((l) => toGenerated(l, flatIdx++)),
        })
      }
      byModule.delete(m.id)
    }
    for (const lessons of byModule.values()) {
      if (lessons.length) {
        out.push({
          title: null,
          lessons: lessons.map((l) => toGenerated(l, flatIdx++)),
        })
      }
    }
    return out
  }, [isEpisodic, landing.modules, flatLessons, isLocked])

  const flatForClick = useMemo(
    () => groups.flatMap((g) => g.lessons),
    [groups],
  )
  const onLessonClick = useCallback(
    (flatIdx: number) => {
      const gen = flatForClick.find((l) => l.flatIdx === flatIdx)
      if (!gen) return
      const lesson = flatLessons.find((l) => l.title === gen.title)
      if (lesson) onLessonSelect(lesson)
    },
    [flatForClick, flatLessons, onLessonSelect],
  )

  return (
    <div className="gpp-fullbleed" data-gpp-fullbleed>
      <GeneratedPortalPage
        brand={organization.name ?? 'Spaire Originals'}
        title={landing.title ?? product.name}
        titleLines={heroTitleLines}
        eyebrow={heroEyebrow}
        badge={heroBadge}
        desc={heroDesc}
        byline={heroByline}
        instructorName={landing.instructor_name ?? organization.name ?? ''}
        heroVariant={heroVariant}
        cardVariant={cardVariant}
        structure={isEpisodic ? 'episodic' : 'modules'}
        trialMode={trialMode}
        paywallEnabled={paywallEnabled}
        freeLessons={freeCount}
        playLabel={playLabel}
        buyLabel={buyLabel}
        freeLine={freeLine}
        coverUrl={landing.thumbnail_url}
        coverPosition={landing.thumbnail_object_position}
        sampleImageUrl={sample?.thumbnail_url ?? null}
        samplePlayable={samplePlayable}
        samplePlaybackId={sample?.mux_playback_id ?? null}
        samplePlaybackUrl={sample?.mux_playback_url ?? null}
        sampleStart={sample?.start_seconds ?? 0}
        sampleDuration={sample?.duration_seconds ?? 0}
        playStartsSample={
          !hasAccess && trialMode === 'lesson_sample' && samplePlayable
        }
        avatarUrl={organization.avatar_url ?? null}
        instructorSub={aiInstructor?.sub ?? ''}
        instructorBio={aiInstructor?.bio ?? []}
        portraitUrl={portraitUrl}
        portraitCaption={aiInstructor?.caption ?? ''}
        faq={aiFaq}
        groups={groups}
        lessonCount={landing.lesson_count}
        unit={unit}
        dark={dark}
        showTrailerButton={
          !!landing.trailer_url ||
          (trialMode === 'lesson_sample' && samplePlayable)
        }
        onPlay={onPlay}
        onBuy={enrolling ? undefined : onBuy}
        onTrailer={onTrailer}
        onLessonClick={onLessonClick}
      />

      {/* Lightbox — free preview / trailer / sample */}
      {playing && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPlaying(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 120,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(1100px, 96vw)' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {playing.title}
              </span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setPlaying(null)}
                style={{
                  color: '#fff',
                  background: 'rgba(255,255,255,0.12)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 34,
                  height: 34,
                  cursor: 'pointer',
                  fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>
            {playing.trailer ? (
              <video
                src={landing.trailer_url ?? undefined}
                controls
                autoPlay
                playsInline
                style={{ width: '100%', borderRadius: 12, background: '#000' }}
              />
            ) : (
              <HlsVideo
                playbackId={playing.mux_playback_id ?? null}
                poster={playing.thumbnail_url}
                controls
                autoPlay
                className="w-full rounded-xl bg-black"
              />
            )}
          </div>
        </div>
      )}

      {/* Full-bleed escape — the storefront layout frames content in a
          padded max-width column; the course page owns the whole viewport.
          The horizontal breakout is self-contained (no ancestor knowledge);
          `:has()` zeroes the wrapper's vertical padding so the hero also
          reaches the top. `overflow-x: clip` on body absorbs the 100vw vs
          scrollbar-width difference without breaking sticky positioning. */}
      <style jsx global>{`
        body:has([data-gpp-fullbleed]) {
          overflow-x: clip;
        }
        .gpp-fullbleed {
          width: 100vw;
          position: relative;
          left: 50%;
          right: 50%;
          margin-left: -50vw;
          margin-right: -50vw;
        }
        /* Collapse the storefront column's own vertical spacing above the
           page so the hero starts at the very top. */
        :has(> [data-gpp-fullbleed]),
        :has(> div > [data-gpp-fullbleed]),
        :has(> main > div > [data-gpp-fullbleed]),
        :has(> div > main > div > [data-gpp-fullbleed]) {
          padding-top: 0 !important;
          margin-top: 0 !important;
        }
      `}</style>
    </div>
  )
}

export default PublicPortalView
