'use client'

// PublicPortalView — the public course page IS the portal now. No AI sales
// landing: anonymous visitors get the same streaming-style surface students
// get — the hero variant + lesson-card variant the creator picked during
// onboarding — with the trial choice expressed as free vs locked tiles.
//
//   • hero_variant   marquee | cover     → which hero renders up top
//   • lesson_card_variant spotlight | catalog → how lesson tiles render
//   • trial_mode + paywall_position      → which tiles are free vs locked
//   • has_access (enrolled)              → everything unlocks, CTA → portal
//
// Free-preview lessons play inline (public Mux playback id); locked tiles
// route to checkout. Enrolled visitors are pointed at their portal.

import { LessonCard } from '@/app/(main)/[organization]/portal/courses/[courseId]/CoursePortalView'
import type {
  CourseLandingLesson,
  CourseLandingPageData,
  CustomerLessonRead,
} from '@/hooks/queries/courses'
import { api } from '@/utils/client'
import { CONFIG } from '@/utils/config'
import { schemas } from '@spaire/client'
import { useCallback, useMemo, useState } from 'react'
import { toast } from '../Toast/use-toast'
import { formatProductPrice } from './editor/EditableCourseLandingView'
import { MarqueeHero } from './editor/MarqueeHero'
import {
  CoverHeroStatic,
  type WizardPortalDraft,
} from './editor/WizardPortalPreview'
import { SpotlightLessonCard } from './editor/SpotlightLessonCard'
import { HlsVideo } from './HlsVideo'

function fmtDuration(secs: number) {
  if (!secs) return null
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m} min`
}

function fmtMinSec(secs?: number | null) {
  if (!secs) return ''
  const m = Math.floor(secs / 60)
  return `${m} min`
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
  const paywallEnabled = landing.paywall_enabled ?? false

  const priceLabel =
    formatProductPrice(product as unknown as schemas['Product']) || 'Free'
  const isFreeProduct = priceLabel === 'Free' || !paywallEnabled
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

  // ── Free-preview lightbox ────────────────────────────────────────────────
  const [playing, setPlaying] = useState<CourseLandingLesson | null>(null)

  const onLessonClick = useCallback(
    (lesson: CourseLandingLesson, locked: boolean) => {
      if (hasAccess) {
        goToPortal()
        return
      }
      if (!locked && lesson.mux_playback_id) {
        setPlaying(lesson)
        return
      }
      void enroll()
    },
    [hasAccess, goToPortal, enroll],
  )

  // ── Hero labels — same vocabulary the wizard preview used ────────────────
  const freeCount = useMemo(
    () => landing.lessons.filter((l) => l.is_free_preview).length,
    [landing.lessons],
  )
  const cadence = recurring ? 'cancel anytime' : 'one-time purchase'
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

  const onPlay = useCallback(() => {
    if (hasAccess) {
      goToPortal()
      return
    }
    const firstFree = landing.lessons.find(
      (l) => l.is_free_preview && l.mux_playback_id,
    )
    if (firstFree) setPlaying(firstFree)
    else void enroll()
  }, [hasAccess, goToPortal, landing.lessons, enroll])

  const onBuy = useCallback(() => {
    if (hasAccess) goToPortal()
    else void enroll()
  }, [hasAccess, goToPortal, enroll])

  // AI-synthesised hero copy (from generation). Prefer it over the creator's
  // raw description so the hero reads like a streaming detail page. Each field
  // falls back to the plain course data when the AI didn't write it.
  const aiHero = landing.landing_overrides?.ai_hero ?? null
  const heroDesc = aiHero?.description || landing.description || ''
  const heroByline = aiHero?.byline || landing.instructor_bio || ''
  const heroEyebrow = aiHero?.eyebrow || 'A Spaire Original'
  const heroTitleLines =
    aiHero?.titleLines && aiHero.titleLines.length > 0
      ? aiHero.titleLines
      : null

  const durationLabel = fmtDuration(landing.total_duration_seconds)
  const metaLine = [
    `${new Date().getFullYear()}`,
    `${landing.lesson_count} ${unitCap}${landing.lesson_count === 1 ? '' : 's'}`,
    durationLabel,
    'Self-paced',
  ]
    .filter(Boolean)
    .join('  ·  ')

  const coverDraft: WizardPortalDraft = {
    title: landing.title ?? product.name,
    desc: heroDesc,
    instructorName: landing.instructor_name ?? organization.name ?? '',
    instructorBio: heroByline,
    eyebrow: aiHero?.eyebrow ?? null,
    badge: aiHero?.badge ?? null,
    byline: aiHero?.byline ?? null,
    titleLines: heroTitleLines,
    heroVariant: 'cover',
    cardVariant,
    structure: isEpisodic ? 'episodic' : 'modules',
    trialMode,
    freeLessons: freeCount,
    paywallEnabled: paywallEnabled && !hasAccess,
    priceLabel,
    buyLabel,
    playLabel,
    freeLine,
    heroImageUrl: landing.thumbnail_url,
  }

  // ── Lesson grouping — modules vs flat season ─────────────────────────────
  type Group = { title: string | null; lessons: CourseLandingLesson[] }
  const groups: Group[] = useMemo(() => {
    if (isEpisodic || !landing.modules?.length) {
      return [{ title: null, lessons: landing.lessons }]
    }
    const byModule = new Map<string, CourseLandingLesson[]>()
    for (const l of landing.lessons) {
      const key = l.module_id ?? 'unknown'
      if (!byModule.has(key)) byModule.set(key, [])
      byModule.get(key)!.push(l)
    }
    const out: Group[] = []
    for (const m of [...landing.modules].sort(
      (a, b) => a.position - b.position,
    )) {
      const lessons = byModule.get(m.id)
      if (lessons?.length) out.push({ title: m.title, lessons })
      byModule.delete(m.id)
    }
    // Lessons whose module wasn't in the public module list still render.
    for (const lessons of byModule.values()) {
      if (lessons.length) out.push({ title: null, lessons })
    }
    return out
  }, [isEpisodic, landing.modules, landing.lessons])

  const isLocked = (l: CourseLandingLesson) =>
    !hasAccess && paywallEnabled && !l.is_free_preview

  const toCatalogLesson = (
    l: CourseLandingLesson,
    flatIdx: number,
  ): CustomerLessonRead => ({
    id: l.id,
    title: l.title,
    content_type: l.content_type,
    content: null,
    position: l.position ?? flatIdx,
    duration_seconds: l.duration_seconds,
    is_free_preview: l.is_free_preview,
    mux_playback_id: l.mux_playback_id ?? null,
    mux_status: null,
    thumbnail_url: l.thumbnail_url,
    completed: false,
    description: l.description,
    locked: isLocked(l),
    locked_until: null,
  })

  let flatIdx = 0
  const renderCards = (lessons: CourseLandingLesson[]) => {
    const startIdx = flatIdx
    flatIdx += lessons.length
    return cardVariant === 'spotlight' ? (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        {lessons.map((l, i) => {
          const locked = isLocked(l)
          const n = startIdx + i + 1
          return (
            <SpotlightLessonCard
              key={l.id}
              episodeLabel={`${unitCap} ${n}${
                !locked && paywallEnabled && !hasAccess ? ' · Free' : ''
              }`}
              title={l.title}
              description={l.description ?? ''}
              time={fmtMinSec(l.duration_seconds)}
              imageUrl={l.thumbnail_url ?? landing.thumbnail_url ?? undefined}
              locked={locked}
              onClick={() => onLessonClick(l, locked)}
            />
          )
        })}
      </div>
    ) : (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 24,
        }}
      >
        {lessons.map((l, i) => {
          const locked = isLocked(l)
          return (
            <LessonCard
              key={l.id}
              lesson={toCatalogLesson(l, startIdx + i)}
              globalIndex={startIdx + i + 1}
              hue={((startIdx + i) * 47) % 360}
              isInProgress={false}
              fallbackThumbnailUrl={landing.thumbnail_url}
              fallbackObjectPosition={
                landing.thumbnail_object_position ?? null
              }
              onSelect={() => onLessonClick(l, locked)}
            />
          )
        })}
      </div>
    )
  }

  const trialSummary = hasAccess
    ? `You're enrolled — every ${unit} is yours.`
    : !paywallEnabled
      ? `Every ${unit} is open — this Original is free.`
      : trialMode === 'lesson_sample'
        ? `Watch the sample, then unlock every ${unit}.`
        : freeCount > 0
          ? `The first ${freeCount} ${unit}${freeCount === 1 ? '' : 's'} play free. The rest unlock when you join.`
          : `Unlock every ${unit} when you join.`

  return (
    <div style={{ background: '#fafafa', minHeight: '100vh' }}>
      {/* Hero — the variant the creator picked during onboarding. */}
      {heroVariant === 'marquee' ? (
        <div
          style={{
            position: 'relative',
            height: 'min(88vh, 760px)',
            minHeight: 560,
            overflow: 'hidden',
          }}
        >
          <MarqueeHero
            brand={organization.name ?? 'Spaire Originals'}
            eyebrow={heroEyebrow}
            title={landing.title ?? product.name}
            description={heroDesc}
            metaLine={metaLine}
            badges={['All Levels', 'Self-paced', 'Mobile & TV']}
            instructorName={landing.instructor_name ?? organization.name ?? ''}
            instructorSub={heroByline}
            playLabel={playLabel}
            buyLabel={buyLabel}
            freeLine={freeLine}
            imageUrl={landing.thumbnail_url ?? undefined}
            showTrailer={!!landing.trailer_url}
            hideBuy={false}
            onPlay={onPlay}
            onBuy={onBuy}
            onTrailer={
              landing.trailer_url
                ? () =>
                    setPlaying({
                      id: '__trailer__',
                      title: landing.title ?? 'Trailer',
                      description: null,
                      content_type: 'video',
                      position: -1,
                      is_free_preview: true,
                      duration_seconds: null,
                      thumbnail_url: landing.thumbnail_url,
                    } as CourseLandingLesson)
                : undefined
            }
          />
        </div>
      ) : (
        <div
          onClick={onBuy}
          style={{ cursor: 'pointer' }}
          role="button"
          aria-label={buyLabel}
        >
          <CoverHeroStatic
            draft={coverDraft}
            unit={unit}
            lessonCount={landing.lesson_count}
          />
        </div>
      )}

      {/* Lesson / episode shelf — the card variant the creator picked. */}
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '48px 32px 96px',
          fontFamily: "'Poppins', var(--font-poppins), system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 8,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: '#1d1d1f',
                margin: 0,
              }}
            >
              {isEpisodic ? 'Episodes' : 'Lessons'}
            </h2>
            <p style={{ fontSize: 14, color: '#86868b', margin: '6px 0 0' }}>
              {trialSummary}
            </p>
          </div>
          <button
            type="button"
            onClick={onBuy}
            disabled={enrolling}
            style={{
              background: '#1d1d1f',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              padding: '11px 24px',
              borderRadius: 980,
              border: 'none',
              cursor: 'pointer',
              opacity: enrolling ? 0.6 : 1,
            }}
          >
            {enrolling ? 'Loading…' : buyLabel}
          </button>
        </div>

        {groups.map((g, gi) => (
          <div key={gi} style={{ marginTop: g.title ? 36 : 28 }}>
            {g.title && (
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#1d1d1f',
                  margin: '0 0 16px',
                }}
              >
                {g.title}
              </h3>
            )}
            {renderCards(g.lessons)}
          </div>
        ))}
      </div>

      {/* Free-preview / trailer lightbox */}
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
            {playing.id === '__trailer__' ? (
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
    </div>
  )
}

export default PublicPortalView
