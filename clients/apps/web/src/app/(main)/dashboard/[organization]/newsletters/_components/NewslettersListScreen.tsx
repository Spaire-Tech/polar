'use client'

import {
  NewsletterRow,
  useNewsletters,
} from '@/hooks/queries/newsletters'
import Button from '@spaire/ui/components/atoms/Button'
import { schemas } from '@spaire/client'
import Link from 'next/link'
import { Icon } from '../../email-marketing/_components/Icon'

// Top-level entry point for the newsletter feature. Cards-grid of all
// newsletters in the org, with an empty state that ushers first-time
// users into the create flow.

export function NewslettersListScreen({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const { data: newsletters, isLoading, error } = useNewsletters(organization.id)

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
        <ErrorState message={error instanceof Error ? error.message : String(error)} />
      ) : !newsletters || newsletters.length === 0 ? (
        <EmptyState organizationSlug={organization.slug} />
      ) : (
        <NewslettersGrid
          organizationSlug={organization.slug}
          newsletters={newsletters}
        />
      )}
    </div>
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

// ── States ───────────────────────────────────────────────────────────

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

function EmptyState({ organizationSlug }: { organizationSlug: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-20 text-center">
      <div className="mb-2 text-xl font-medium text-gray-900">
        Start your first newsletter
      </div>
      <p className="mb-6 max-w-md text-sm text-gray-500">
        A newsletter is a publication you send to subscribers by email
        and host on the web. You write posts, choose who they reach,
        and Polar handles delivery and analytics.
      </p>
      <Link href={`/dashboard/${organizationSlug}/newsletters/new`}>
        <Button>
          <Icon name="plus" size={14} /> Create your first newsletter
        </Button>
      </Link>
      <Steps />
    </div>
  )
}

function Steps() {
  const steps: { num: number; title: string; body: string }[] = [
    {
      num: 1,
      title: 'Set up your brand',
      body: 'Name, masthead, default sender, theme colours.',
    },
    {
      num: 2,
      title: 'Write your first post',
      body: 'Title, cover, blocks. Press / to insert anything.',
    },
    {
      num: 3,
      title: 'Publish to email + web',
      body: 'Pick the audience, hit send, see the issue go out.',
    },
  ]
  return (
    <div className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-4 px-6 sm:grid-cols-3">
      {steps.map((s) => (
        <div
          key={s.num}
          className="rounded-xl border border-gray-200 bg-white p-4 text-left"
        >
          <div className="mb-1.5 text-xs font-mono text-gray-400">
            0{s.num}
          </div>
          <div className="text-sm font-medium text-gray-900">{s.title}</div>
          <div className="mt-1 text-xs text-gray-500">{s.body}</div>
        </div>
      ))}
    </div>
  )
}
