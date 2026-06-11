'use client'

// WizardPortalPreview — the wizard's final step. Replaces the old AI-landing
// editor: instead of a generated sales page, the creator sees how their
// Original's PORTAL will look — the same surface buyers and students get —
// assembled from every choice they made in onboarding:
//
//   • hero variant   (marquee | cover)      → which hero renders up top
//   • card variant   (spotlight | catalog)  → how each lesson tile renders
//   • structure      (modules | episodic)   → grouped chapters vs flat season
//   • trial          (free_preview N | lesson_sample) → which tiles are locked
//   • pricing        → the hero's buy label
//
// Nothing here is decorative: the exact same fields are persisted on the
// course at Create, and the public portal reads them to render this same way.

import { LessonCard } from '@/app/(main)/[organization]/portal/courses/[courseId]/CoursePortalView'
import type { CustomerLessonRead } from '@/hooks/queries/courses'
import type { schemas } from '@spaire/client'
import { MarqueeHero } from './MarqueeHero'
import { SpotlightLessonCard } from './SpotlightLessonCard'

export type WizardPortalOutline = {
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

export type WizardPortalDraft = {
  title: string
  /** AI-written hero description (not the creator's raw blob). */
  desc: string
  /** AI-written hero copy — fall back to derived/empty when streaming. */
  eyebrow?: string | null
  badge?: string | null
  byline?: string | null
  titleLines?: string[] | null
  instructorName: string
  instructorBio: string
  heroVariant: 'marquee' | 'cover'
  cardVariant: 'spotlight' | 'catalog'
  structure: 'modules' | 'episodic'
  trialMode: 'free_preview' | 'lesson_sample'
  freeLessons: number
  paywallEnabled: boolean
  /** e.g. "$89", "Free", "$12 / month" — computed by the wizard. */
  priceLabel: string
  buyLabel: string
  playLabel: string
  freeLine: string
  heroImageUrl: string | null
}

const FALLBACK_GRADIENT =
  'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'

// Read-only port of the existing boxed "Cover" hero (the landing/portal hero
// we already ship). Static by design — the real editable component drags the
// entire landing view with it; this preview only needs the hero's look.
// Exported so the public portal-style landing (PublicPortalView) renders the
// same hero the wizard previewed.
export function CoverHeroStatic({ draft, unit, lessonCount }: {
  draft: WizardPortalDraft
  unit: string
  lessonCount: number
}) {
  return (
    <section
      style={{
        position: 'relative',
        height: 'min(80vh, 680px)',
        minHeight: 520,
        margin: '20px 20px 0',
        borderRadius: 28,
        overflow: 'hidden',
        background: '#000',
        isolation: 'isolate',
        border: '1px solid oklch(0.92 0.003 280)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.06), 0 24px 60px rgba(0,0,0,0.10)',
        fontFamily: "'Poppins', var(--font-poppins), system-ui, sans-serif",
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: draft.heroImageUrl
            ? `center / cover no-repeat url(${draft.heroImageUrl})`
            : FALLBACK_GRADIENT,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(180deg, oklch(0 0 0 / 0.2) 0%, oklch(0 0 0 / 0) 30%, oklch(0 0 0 / 0) 45%, oklch(0 0 0 / 0.6) 80%, oklch(0 0 0 / 0.92) 100%)',
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
        <span
          style={{
            fontSize: 11,
            letterSpacing: '0.18em',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          SPAIRE ORIGINAL
        </span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '40px 48px 52px',
          color: 'white',
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
          <span
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
          >
            {(draft.badge ||
              (draft.structure === 'episodic'
                ? 'New Series'
                : 'New Original')).toUpperCase()}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>
            {lessonCount} {unit}
            {lessonCount === 1 ? '' : 's'}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>All levels</span>
        </div>
        <h1
          style={{
            fontSize: 'clamp(48px, 7vw, 88px)',
            fontWeight: 700,
            letterSpacing: '-0.045em',
            lineHeight: 0.95,
            margin: '0 0 18px',
            color: 'white',
            maxWidth: '14ch',
            textShadow: '0 2px 30px oklch(0 0 0 / 0.35)',
          }}
        >
          {draft.titleLines && draft.titleLines.length > 0
            ? draft.titleLines.map((line, i) => (
                <span key={i} style={{ display: 'block' }}>
                  {line}
                </span>
              ))
            : draft.title || 'Untitled Original'}
        </h1>
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
          {draft.desc}
          {draft.instructorName && (
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>
              {' '}
              — with {draft.instructorName}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '13px 22px 13px 14px',
              background: 'white',
              color: 'oklch(0.14 0.006 280)',
              borderRadius: 999,
              boxShadow: '0 8px 28px oklch(0 0 0 / 0.4)',
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
              {draft.playLabel}
            </span>
          </span>
          <span
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
            }}
          >
            {draft.buyLabel} →
          </span>
        </div>
      </div>
    </section>
  )
}

export function WizardPortalPreview({
  organization,
  draft,
  outline,
  onBack,
  onPublish,
  publishing,
}: {
  organization: schemas['Organization']
  draft: WizardPortalDraft
  outline: WizardPortalOutline
  onBack: () => void
  onPublish: () => void | Promise<void>
  publishing?: boolean
}) {
  const isEpisodic = draft.structure === 'episodic'
  const unit = isEpisodic ? 'episode' : 'lesson'
  const unitCap = isEpisodic ? 'Episode' : 'Lesson'

  // Flatten the outline into render-ready groups. Mirrors finalizeCourse's
  // filter (title-only) so what's previewed is exactly what gets created.
  type Group = {
    title: string
    lessons: { title: string; description: string; flatIdx: number }[]
  }
  const groups: Group[] = []
  let flat = 0
  for (const m of outline.modules ?? []) {
    if (!m?.title) continue
    const lessons = (m.lessons ?? [])
      .filter((l): l is { title: string; description?: string } =>
        Boolean(l?.title),
      )
      .map((l) => ({
        title: l.title,
        description: l.description ?? '',
        flatIdx: flat++,
      }))
    groups.push({ title: m.title, lessons })
  }
  const lessonCount = flat

  const isLocked = (flatIdx: number): boolean => {
    if (!draft.paywallEnabled) return false
    if (draft.trialMode === 'lesson_sample') return true
    return flatIdx >= draft.freeLessons
  }

  const trialSummary = !draft.paywallEnabled
    ? `Every ${unit} is open — this Original is free.`
    : draft.trialMode === 'free_preview'
      ? `Free preview: the first ${draft.freeLessons} ${unit}${
          draft.freeLessons === 1 ? '' : 's'
        } play in full. The rest unlock on purchase.`
      : `Lesson Sample: prospects watch a short clip — every full ${unit} unlocks on purchase.`

  const catalogLesson = (
    title: string,
    description: string,
    flatIdx: number,
  ): CustomerLessonRead => ({
    id: `preview-${flatIdx}`,
    title,
    content_type: 'video',
    content: null,
    position: flatIdx,
    duration_seconds: null,
    is_free_preview: !isLocked(flatIdx),
    mux_playback_id: null,
    mux_status: null,
    thumbnail_url: null,
    completed: false,
    description,
    locked: isLocked(flatIdx),
    locked_until: null,
  })

  const renderCards = (lessons: Group['lessons']) =>
    draft.cardVariant === 'spotlight' ? (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        {lessons.map((l) => (
          <SpotlightLessonCard
            key={l.flatIdx}
            episodeLabel={`${unitCap} ${l.flatIdx + 1}${
              !isLocked(l.flatIdx) && draft.paywallEnabled ? ' · Free' : ''
            }`}
            title={l.title}
            description={l.description}
            time=""
            imageUrl={draft.heroImageUrl ?? undefined}
            locked={isLocked(l.flatIdx)}
          />
        ))}
      </div>
    ) : (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 24,
        }}
      >
        {lessons.map((l) => (
          <LessonCard
            key={l.flatIdx}
            lesson={catalogLesson(l.title, l.description, l.flatIdx)}
            globalIndex={l.flatIdx + 1}
            hue={(l.flatIdx * 47) % 360}
            isInProgress={false}
            fallbackThumbnailUrl={draft.heroImageUrl}
            fallbackObjectPosition={null}
            onSelect={() => {}}
          />
        ))}
      </div>
    )

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Top bar — same shell as the rest of the wizard's final step. */}
      <div className="flex h-12 flex-shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md px-2 py-1 text-[12px] font-medium text-gray-600 hover:bg-gray-50"
          >
            ← Back
          </button>
          <span className="text-[12px] text-gray-500">Portal preview</span>
          <span className="text-[13px] text-gray-400">›</span>
          <span className="truncate text-[13px] font-medium text-gray-900">
            {draft.title || 'Untitled Original'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-[12px] text-gray-400 sm:block">
            This is what buyers and students will see
          </span>
          <button
            type="button"
            disabled={publishing}
            onClick={() => onPublish()}
            className="rounded-md bg-gray-900 px-3.5 py-[7px] text-[12px] font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {publishing ? 'Creating…' : 'Create Original'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ background: '#fafafa' }}>
        {/* Hero — the variant the creator picked. */}
        {draft.heroVariant === 'marquee' ? (
          <div
            style={{
              position: 'relative',
              // MarqueeHero is 100vw/100vh by design; cap it inside the
              // preview scroller so the episode shelf peeks above the fold.
              height: 'min(86vh, 740px)',
              minHeight: 560,
              overflow: 'hidden',
            }}
          >
            <MarqueeHero
              brand={organization.name ?? 'Spaire Originals'}
              eyebrow={draft.eyebrow || 'A Spaire Original'}
              title={draft.title || 'Untitled Original'}
              description={draft.desc || ''}
              metaLine={`${new Date().getFullYear()}  ·  ${lessonCount} ${unitCap}${
                lessonCount === 1 ? '' : 's'
              }  ·  Self-paced`}
              badges={['All Levels', 'Self-paced', 'Mobile & TV']}
              instructorName={draft.instructorName || organization.name || ''}
              instructorSub={draft.byline || draft.instructorBio || ''}
              playLabel={draft.playLabel}
              buyLabel={draft.buyLabel}
              freeLine={draft.freeLine}
              imageUrl={draft.heroImageUrl ?? undefined}
              showTrailer={false}
              onPlay={() => {}}
              onBuy={() => {}}
            />
          </div>
        ) : (
          <CoverHeroStatic draft={draft} unit={unit} lessonCount={lessonCount} />
        )}

        {/* Episode / lesson shelf — the card variant the creator picked,
            with the trial choice reflected as locked vs free tiles. */}
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: '48px 32px 96px',
            fontFamily: "'Poppins', var(--font-poppins), system-ui, sans-serif",
          }}
        >
          <div style={{ marginBottom: 8 }}>
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

          {groups.length === 0 ? (
            <p style={{ color: '#86868b', fontSize: 14, marginTop: 24 }}>
              No {unit}s yet — go back and generate an outline.
            </p>
          ) : isEpisodic ? (
            <div style={{ marginTop: 28 }}>
              {renderCards(groups.flatMap((g) => g.lessons))}
            </div>
          ) : (
            groups.map((g, gi) => (
              <div key={gi} style={{ marginTop: 36 }}>
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
                {renderCards(g.lessons)}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default WizardPortalPreview
