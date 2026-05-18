'use client'

import {
  NewsletterRow,
  useNewsletters,
} from '@/hooks/queries/newsletters'
import Button from '@spaire/ui/components/atoms/Button'
import { schemas } from '@spaire/client'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icon } from '../../email-marketing/_components/Icon'

const FONT_VAR = 'var(--font-body, "Poppins", system-ui, sans-serif)'
const HEADING_VAR = `var(--font-heading, ${FONT_VAR})`

// Top-level entry point for the newsletter feature. When the org has
// no newsletters yet we take over the screen with a full-bleed hero
// card — same structure the courses index uses for its empty state.
// Once any newsletters exist, the page returns to a normal grid with a
// "New newsletter" CTA in the top right.

export function NewslettersListScreen({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const { data: newsletters, isLoading, error } = useNewsletters(organization.id)
  const hasAny = (newsletters?.length ?? 0) > 0

  if (!isLoading && !hasAny && !error) {
    return (
      <NewslettersEmptyHero
        onBack={() => router.push(`/dashboard/${organization.slug}`)}
        onStart={() =>
          router.push(`/dashboard/${organization.slug}/newsletters/new`)
        }
      />
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            Newsletters
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Publish editorial issues to email subscribers and the web
            archive in one flow.
          </p>
        </div>
        <Link href={`/dashboard/${organization.slug}/newsletters/new`}>
          <Button>
            <Icon name="plus" size={14} /> New newsletter
          </Button>
        </Link>
      </header>

      {isLoading ? (
        <LoadingGrid />
      ) : error ? (
        <ErrorState
          message={error instanceof Error ? error.message : String(error)}
        />
      ) : (
        <NewslettersGrid
          organizationSlug={organization.slug}
          newsletters={newsletters!}
        />
      )}
    </div>
  )
}

// ── Hero empty state — clones the structure used by courses ──────────

function NewslettersEmptyHero({
  onBack,
  onStart,
}: {
  onBack: () => void
  onStart: () => void
}) {
  return (
    <>
      <style>{`
        [data-dashboard-sidebar],
        [data-dashboard-mobile-nav],
        [data-catalog-tabs] { display: none !important; }
      `}</style>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          background: 'oklch(0.985 0.001 280)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
          padding: '20px',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to dashboard"
          style={{
            position: 'absolute',
            left: 24,
            top: 20,
            zIndex: 5,
            width: 40,
            height: 40,
            borderRadius: 999,
            background: 'white',
            border: '1px solid oklch(0.92 0.003 280)',
            color: 'oklch(0.14 0.006 280)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <ArrowBackOutlined sx={{ fontSize: 20 }} />
        </button>

        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <section
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 1280,
              height: 'min(90vh, 820px)',
              minHeight: 600,
              borderRadius: 'calc(28px * var(--radius-mul, 1))',
              overflow: 'hidden',
              background: '#0d0d10',
              isolation: 'isolate',
              border: '1px solid oklch(0.92 0.003 280)',
              boxShadow:
                '0 2px 6px rgba(0,0,0,0.06), 0 24px 60px rgba(0,0,0,0.10)',
            }}
          >
            {/* Hero image. /assets/newsletters-empty-hero.jpg is the
                asset we should commission to match the courses card;
                until it lands, the gradient + masthead layer below is
                a deliberate fallback so the screen still ships. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/newsletters-empty-hero.jpg"
              alt=""
              aria-hidden="true"
              onError={(e) => {
                // Hide a missing asset cleanly — the gradient + headline
                // background still reads.
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />

            {/* Fallback typographic backdrop. Sits behind the real image
                so when the asset arrives it occludes this. */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(ellipse at 20% 30%, rgba(255,255,255,0.06), transparent 50%), linear-gradient(140deg, #0d0d10 0%, #1a1820 60%, #2b2233 100%)',
                color: 'rgba(255,255,255,0.04)',
                fontFamily: 'Georgia, serif',
                fontSize: 220,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                letterSpacing: '-0.04em',
              }}
            >
              N
            </div>

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
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: '0.18em',
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.85)',
                  fontFamily: FONT_VAR,
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
                  NEWSLETTER BUILDER
                </span>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Built with Spaire
                </span>
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                  2 min setup
                </span>
              </div>

              <h1
                style={{
                  fontSize:
                    'calc(clamp(48px, 6.5vw, 84px) * var(--type-scale, 1))',
                  fontWeight: 'var(--h-weight, 700)',
                  fontStyle: 'var(--h-italic, normal)',
                  letterSpacing:
                    'calc(var(--h-tracking, 0em) - 0.045em)',
                  lineHeight: 'calc(var(--h-leading, 1) * 0.95)',
                  margin: '0 0 18px',
                  color: 'white',
                  maxWidth: '14ch',
                  textShadow: '0 2px 30px oklch(0 0 0 / 0.35)',
                  fontFamily: HEADING_VAR,
                }}
              >
                Publish a newsletter people read
              </h1>

              <div
                style={{
                  fontSize: 'clamp(14px, 1.3vw, 18px)',
                  fontWeight: 400,
                  color: 'rgba(255,255,255,0.88)',
                  maxWidth: 640,
                  marginBottom: 30,
                  lineHeight: 1.5,
                }}
              >
                Spaire turns long-form writing into a publication you
                own — email, web archive, free and paid tiers, and a
                clean editorial canvas. Bring your audience, keep your
                voice.
              </div>

              <button
                type="button"
                onClick={onStart}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '13px 22px',
                  background: 'white',
                  color: 'oklch(0.14 0.006 280)',
                  borderRadius: 999,
                  boxShadow: '0 8px 28px oklch(0 0 0 / 0.4)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1,
                }}
              >
                Start your newsletter →
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

// ── Grid ─────────────────────────────────────────────────────────────

function NewslettersGrid({
  organizationSlug,
  newsletters,
}: {
  organizationSlug: string
  newsletters: NewsletterRow[]
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {newsletters.map((n) => (
        <NewsletterCard
          key={n.id}
          newsletter={n}
          organizationSlug={organizationSlug}
        />
      ))}
    </div>
  )
}

function NewsletterCard({
  organizationSlug,
  newsletter,
}: {
  organizationSlug: string
  newsletter: NewsletterRow
}) {
  return (
    <Link
      href={`/dashboard/${organizationSlug}/newsletters/${newsletter.id}`}
      className="group block rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-medium text-gray-900">
            {newsletter.name}
          </div>
          {newsletter.masthead && (
            <div className="mt-1 truncate font-mono text-[11px] uppercase tracking-wider text-gray-500">
              {newsletter.masthead}
            </div>
          )}
        </div>
        {newsletter.product_id && (
          <span
            title="Paid newsletter"
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-600"
          >
            Paid
          </span>
        )}
      </div>
      {newsletter.description && (
        <p className="mt-3 line-clamp-2 text-sm text-gray-500">
          {newsletter.description}
        </p>
      )}
      <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
        <span className="font-mono">/{newsletter.slug}</span>
      </div>
    </Link>
  )
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-xl bg-gray-100"
        />
      ))}
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-red-50 p-4 text-red-600">{message}</div>
  )
}
