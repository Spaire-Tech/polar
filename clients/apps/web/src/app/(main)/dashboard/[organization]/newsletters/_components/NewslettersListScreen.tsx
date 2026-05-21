'use client'

import {
  NewsletterRow,
  useNewsletters,
} from '@/hooks/queries/newsletters'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { schemas } from '@spaire/client'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import ArticleOutlined from '@mui/icons-material/ArticleOutlined'
import Button from '@spaire/ui/components/atoms/Button'
import { List, ListItem } from '@spaire/ui/components/atoms/List'
import Pill from '@spaire/ui/components/atoms/Pill'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const FONT_VAR = 'var(--font-body, "Poppins", system-ui, sans-serif)'
const HEADING_VAR = `var(--font-heading, ${FONT_VAR})`

// Two states:
//
//   1. No newsletters in the org yet → full-bleed hero card (same
//      structure as CoursesEmptyHero — fixed inset overlay, big
//      cover image, dark gradient, glass chip, single white pill
//      CTA).
//   2. At least one newsletter → DashboardBody + List + ListItem,
//      the same primitives the courses list and products list use.
//      No bespoke card grid.

export function NewslettersListScreen({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const { data: newsletters, isLoading, error } = useNewsletters(organization.id)
  const hasAny = (newsletters?.length ?? 0) > 0

  const handleCreate = () =>
    router.push(`/dashboard/${organization.slug}/newsletters/new`)
  const handleBackToDashboard = () =>
    router.push(`/dashboard/${organization.slug}`)

  if (!isLoading && !hasAny && !error) {
    return (
      <NewslettersEmptyHero
        onBack={handleBackToDashboard}
        onStart={handleCreate}
      />
    )
  }

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Newsletters
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Publish editorial issues to subscribers by email and on
              the web.
            </p>
          </div>
          <Button
            wrapperClassNames="md:w-fit"
            className="w-full md:w-fit"
            onClick={handleCreate}
          >
            <span>New</span>
          </Button>
        </div>

        {isLoading ? (
          <List size="small">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl bg-gray-100"
              />
            ))}
          </List>
        ) : error ? (
          <div className="rounded-xl bg-red-50 p-4 text-red-600">
            {error instanceof Error ? error.message : String(error)}
          </div>
        ) : (
          <List size="small">
            {(newsletters ?? []).map((n) => (
              <NewsletterRowItem
                key={n.id}
                newsletter={n}
                organization={organization}
              />
            ))}
          </List>
        )}
      </div>
    </DashboardBody>
  )
}

// One row, structured the same way ProductListItem renders — Link
// wrapping a ListItem with a left identity column and right meta
// column. No custom cards, no shadow grids; just the platform's
// primitives so it sits next to courses + products without looking
// out of place.

function NewsletterRowItem({
  newsletter,
  organization,
}: {
  newsletter: NewsletterRow
  organization: schemas['Organization']
}) {
  const href = `/dashboard/${organization.slug}/newsletters/${newsletter.id}`
  return (
    <Link href={href}>
      <ListItem className="flex flex-row items-center justify-between gap-x-6">
        <div className="flex min-w-0 grow flex-row items-center gap-x-4 text-sm">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-500">
            <ArticleOutlined fontSize="small" />
          </div>
          <div className="flex min-w-0 flex-col gap-y-0.5">
            <span className="truncate text-sm font-medium text-gray-900">
              {newsletter.name}
            </span>
            {newsletter.masthead && (
              <span className="truncate font-mono text-[10.5px] uppercase tracking-wider text-gray-500">
                {newsletter.masthead}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-row items-center gap-x-3 md:gap-x-4">
          {newsletter.product_id ? (
            <Pill color="blue" className="shrink-0 px-2 py-0.5 text-xs">
              Paid
            </Pill>
          ) : (
            <Pill color="gray" className="shrink-0 px-2 py-0.5 text-xs">
              Free
            </Pill>
          )}
          <span className="hidden font-mono text-xs text-gray-500 md:inline">
            /{newsletter.slug}
          </span>
        </div>
      </ListItem>
    </Link>
  )
}

// ── Empty hero — clone of CoursesEmptyHero structure ────────────────

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
            {/* Hero image. Drop /assets/newsletters-empty-hero.jpg into
                public/assets to match the courses card exactly. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/newsletters-empty-hero.jpg"
              alt=""
              aria-hidden="true"
              onError={(e) => {
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

            {/* Fallback backdrop until the asset lands. */}
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
                Write your own publication
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
                Spaire turns long-form writing into a newsletter you
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
