'use client'

import {
  NewsletterPostRow,
  useCreateNewsletterPost,
  useNewsletter,
  useNewsletterPosts,
  useNewsletterStats,
} from '@/hooks/queries/newsletters'
import Button from '@spaire/ui/components/atoms/Button'
import { schemas } from '@spaire/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../../email-marketing/_components/Icon'

// Newsletter "home". Surfaces the brand chrome, a single primary
// "New post" CTA (Substack-style: click → land in the editor), and a
// list of every post in this newsletter grouped by status.

export function NewsletterDetailScreen({
  organization,
  newsletterId,
}: {
  organization: schemas['Organization']
  newsletterId: string
}) {
  const router = useRouter()
  const { data: newsletter, isLoading: nlLoading, error: nlError } =
    useNewsletter(newsletterId)
  const { data: posts = [], isLoading: postsLoading } =
    useNewsletterPosts(newsletterId)
  const createPost = useCreateNewsletterPost()
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  // Tab state + subscriber stats — declared at the top of the
  // component so the hook order is stable across renders (the
  // newsletter loading branch below returns early, which would
  // otherwise put these hooks on the conditional side of the
  // rules-of-hooks check).
  const [tab, setTab] = useState<'posts' | 'subscribers' | 'analytics'>(
    'posts',
  )
  const { data: stats } = useNewsletterStats(newsletterId)

  const onNewPost = useCallback(async () => {
    if (!newsletter || creating) return
    setCreating(true)
    setCreateError(null)
    try {
      // Substack-style: no modal. We pick a unique-enough default slug
      // from a timestamp so the API doesn't reject duplicates on rapid
      // clicks; the user can rename + reslug from inside the editor
      // once the post exists.
      const stamp = new Date()
        .toISOString()
        .replace(/[-:T.Z]/g, '')
        .slice(0, 12)
      const post = await createPost.mutateAsync({
        newsletter_id: newsletter.id,
        slug: `draft-${stamp}`,
        // Required (NOT NULL on the model) but kept blank so the
        // editor's title input is the first thing the user types into.
        title: '',
      })
      router.push(
        `/dashboard/${organization.slug}/newsletters/${newsletter.id}/posts/${post.id}`,
      )
    } catch (e) {
      setCreating(false)
      setCreateError(e instanceof Error ? e.message : 'Failed to create post')
    }
  }, [newsletter, creating, createPost, router, organization.slug])

  if (nlLoading || !newsletter) {
    return (
      <Shell>
        {nlError ? (
          <div className="rounded-xl bg-red-50 p-4 text-red-600">
            {nlError instanceof Error ? nlError.message : 'Newsletter not found'}
          </div>
        ) : (
          <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
        )}
      </Shell>
    )
  }

  const drafts = posts.filter((p) => p.status === 'draft')
  const published = posts.filter((p) =>
    ['published', 'scheduled', 'sending'].includes(p.status),
  )
  const archived = posts.filter((p) =>
    ['archived', 'failed'].includes(p.status),
  )

  return (
    <Shell>
      <Link
        href={`/dashboard/${organization.slug}/newsletters`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <Icon name="arrow-left" size={13} /> All newsletters
      </Link>

      <PaymentsPendingBanner organizationSlug={organization.slug} />

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {newsletter.masthead && (
            <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-gray-500">
              {newsletter.masthead}
            </div>
          )}
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            {newsletter.name}
          </h1>
          {newsletter.description && (
            <p className="mt-2 max-w-2xl text-sm text-gray-500">
              {newsletter.description}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="font-mono">/{newsletter.slug}</span>
            <span className="opacity-40">·</span>
            <span>
              {posts.length} post{posts.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/${organization.slug}/newsletters/${newsletter.id}/settings`}
          >
            <Button variant="secondary">
              <Icon name="settings" size={13} /> Settings
            </Button>
          </Link>
          <Button onClick={onNewPost} disabled={creating}>
            <Icon name="plus" size={13} /> {creating ? 'Creating…' : 'New post'}
          </Button>
        </div>
      </header>

      {createError && (
        <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {createError}
        </div>
      )}

      <Tabs
        tab={tab}
        setTab={setTab}
        stats={stats}
        publishedCount={published.length}
      />

      {tab === 'subscribers' ? (
        <SubscribersTab
          organizationSlug={organization.slug}
          newsletterId={newsletter.id}
          stats={stats}
        />
      ) : tab === 'analytics' ? (
        <AnalyticsTab
          organizationSlug={organization.slug}
          publishedPosts={published}
        />
      ) : postsLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl bg-gray-100"
            />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyPosts onCreate={onNewPost} creating={creating} />
      ) : (
        <div className="space-y-8">
          {drafts.length > 0 && (
            <PostSection
              title="Drafts"
              posts={drafts}
              organizationSlug={organization.slug}
              newsletterId={newsletter.id}
            />
          )}
          {published.length > 0 && (
            <PostSection
              title="Published"
              posts={published}
              organizationSlug={organization.slug}
              newsletterId={newsletter.id}
            />
          )}
          {archived.length > 0 && (
            <PostSection
              title="Archived"
              posts={archived}
              organizationSlug={organization.slug}
              newsletterId={newsletter.id}
            />
          )}
        </div>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
}

// ── Tabs ─────────────────────────────────────────────────────────────

function Tabs({
  tab,
  setTab,
  stats,
  publishedCount,
}: {
  tab: 'posts' | 'subscribers' | 'analytics'
  setTab: (t: 'posts' | 'subscribers' | 'analytics') => void
  stats: { free: number; paid: number; total: number } | undefined
  publishedCount: number
}) {
  const items: {
    id: 'posts' | 'subscribers' | 'analytics'
    label: string
    count: number | null
  }[] = [
    { id: 'posts', label: 'Posts', count: null },
    {
      id: 'subscribers',
      label: 'Subscribers',
      count: stats ? stats.free + stats.paid : null,
    },
    { id: 'analytics', label: 'Analytics', count: publishedCount },
  ]
  return (
    <div className="mb-6 flex items-center gap-1 border-b border-gray-200">
      {items.map((it) => {
        const on = it.id === tab
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => setTab(it.id)}
            className={
              'relative -mb-px inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ' +
              (on
                ? 'border-b-2 border-gray-900 text-gray-900'
                : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700')
            }
          >
            {it.label}
            {it.count != null && (
              <span
                className={
                  'rounded-md px-1.5 py-0.5 text-[10px] font-mono ' +
                  (on ? 'bg-gray-100 text-gray-700' : 'text-gray-400')
                }
              >
                {it.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Subscribers tab ─────────────────────────────────────────────────
// Surfaces the stats roll-up; deep-links to the email-marketing
// subscribers screen for the full list (filtered by this newsletter
// once the `newsletter_id` query param lands on that screen — see
// fix #4 in the audit response). For now the deep-link goes to the
// unfiltered list with a note.

function SubscribersTab({
  organizationSlug,
  newsletterId,
  stats,
}: {
  organizationSlug: string
  newsletterId: string
  stats: { free: number; paid: number; unsubscribed: number; total: number } | undefined
}) {
  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Free" value={stats?.free} />
        <StatTile label="Paid" value={stats?.paid} />
        <StatTile label="Unsubscribed" value={stats?.unsubscribed} tone="muted" />
      </div>
      <Link
        href={`/dashboard/${organizationSlug}/email-marketing/subscribers?newsletter_id=${newsletterId}`}
        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
      >
        View subscribers in Marketing
        <Icon name="arrow-right" size={13} />
      </Link>
      <p className="mt-3 text-xs text-gray-500">
        The full subscriber list lives in Email Marketing. Filtering
        Marketing&apos;s view by this newsletter is part of the next
        polish pass.
      </p>
    </div>
  )
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string
  value: number | undefined
  tone?: 'muted'
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div
        className={
          'text-2xl font-semibold tabular-nums ' +
          (tone === 'muted' ? 'text-gray-500' : 'text-gray-900')
        }
      >
        {value == null ? '—' : value.toLocaleString()}
      </div>
    </div>
  )
}

// ── Analytics tab ───────────────────────────────────────────────────
// Each published post links to its underlying EmailBroadcast (which
// has full open/click/unsubscribe analytics in the email-marketing
// dashboard). We render a thin table here as the entry point.

function AnalyticsTab({
  organizationSlug,
  publishedPosts,
}: {
  organizationSlug: string
  publishedPosts: NewsletterPostRow[]
}) {
  if (publishedPosts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
        <div className="text-sm font-medium text-gray-900">
          No analytics yet
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Once you publish a post, open and click rates show up here.
        </p>
      </div>
    )
  }
  return (
    <ul className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white">
      {publishedPosts.map((p) => (
        <li key={p.id}>
          {p.broadcast_id ? (
            <Link
              href={`/dashboard/${organizationSlug}/email-marketing/broadcasts/${p.broadcast_id}`}
              className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-900">
                  {p.title || 'Untitled'}
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {p.published_at
                    ? new Date(p.published_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—'}
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                View analytics <Icon name="arrow-right" size={11} />
              </span>
            </Link>
          ) : (
            <div className="flex items-center gap-3 px-5 py-4 opacity-60">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-900">
                  {p.title || 'Untitled'}
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {p.status === 'sending'
                    ? 'Sending now — analytics will appear once delivery completes'
                    : 'No analytics available'}
                </div>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

function EmptyPosts({
  onCreate,
  creating,
}: {
  onCreate: () => void
  creating: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
      <div className="mb-2 text-lg font-medium text-gray-900">
        Write your first issue
      </div>
      <p className="mb-5 max-w-md text-sm text-gray-500">
        Posts are the issues you send to subscribers. Start one and
        we&apos;ll drop you in the editor.
      </p>
      <Button onClick={onCreate} disabled={creating}>
        <Icon name="plus" size={13} /> {creating ? 'Creating…' : 'New post'}
      </Button>
    </div>
  )
}

function PostSection({
  title,
  posts,
  organizationSlug,
  newsletterId,
}: {
  title: string
  posts: NewsletterPostRow[]
  organizationSlug: string
  newsletterId: string
}) {
  return (
    <section>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.08em] text-gray-500">
        {title}
      </div>
      <ul className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {posts.map((p) => (
          <li key={p.id}>
            <Link
              href={`/dashboard/${organizationSlug}/newsletters/${newsletterId}/posts/${p.id}`}
              className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-900">
                  {p.title || 'Untitled'}
                </div>
                {p.subtitle && (
                  <div className="mt-0.5 truncate text-xs text-gray-500">
                    {p.subtitle}
                  </div>
                )}
              </div>
              <StatusBadge status={p.status} />
              <PostDate post={p} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function StatusBadge({ status }: { status: NewsletterPostRow['status'] }) {
  const map: Record<
    NewsletterPostRow['status'],
    { label: string; className: string }
  > = {
    draft: {
      label: 'Draft',
      className: 'bg-gray-100 text-gray-700',
    },
    scheduled: {
      label: 'Scheduled',
      className: 'bg-blue-50 text-blue-700',
    },
    sending: {
      label: 'Sending',
      className: 'bg-blue-50 text-blue-700',
    },
    published: {
      label: 'Live',
      className: 'bg-green-50 text-green-700',
    },
    failed: {
      label: 'Failed',
      className: 'bg-red-50 text-red-700',
    },
    archived: {
      label: 'Archived',
      className: 'bg-gray-100 text-gray-500',
    },
  }
  const cfg = map[status]
  return (
    <span
      className={
        'rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ' +
        cfg.className
      }
    >
      {cfg.label}
    </span>
  )
}

function PostDate({ post }: { post: NewsletterPostRow }) {
  const iso = post.published_at || post.scheduled_at || post.created_at
  if (!iso) return null
  let label: string
  try {
    label = new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    label = ''
  }
  return (
    <span className="hidden whitespace-nowrap font-mono text-[11px] text-gray-500 sm:inline">
      {label}
    </span>
  )
}


// Banner shown when the wizard finished creating the newsletter but
// the paid-tier setup deferred (most commonly: the org has no
// connected payments account, so the Product create downstream
// returns 422). The wizard redirects to `#payments-pending` to
// trigger this — once the user wires up payments they can re-run
// setup from the settings page.

function PaymentsPendingBanner({
  organizationSlug,
}: {
  organizationSlug: string
}) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash === '#payments-pending') {
      setShow(true)
      // Strip the hash so a refresh doesn't loop the banner forever.
      const url = new URL(window.location.href)
      url.hash = ''
      window.history.replaceState({}, '', url.toString())
    }
  }, [])
  if (!show) return null
  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
        <Icon name="info" size={14} />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-amber-900">
          Newsletter created — connect payments to enable the paid tier
        </div>
        <p className="mt-1 text-xs text-amber-700">
          Your newsletter is live as a free publication. To start charging
          subscribers, finish setting up payments in the organisation
          settings and we&apos;ll wire the paid tier up automatically.
        </p>
        <div className="mt-3">
          <Link
            href={`/dashboard/${organizationSlug}/finance/account`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
          >
            Connect payments
            <Icon name="arrow-right" size={11} />
          </Link>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setShow(false)}
        aria-label="Dismiss"
        className="text-amber-700 hover:text-amber-900"
      >
        <Icon name="x" size={13} />
      </button>
    </div>
  )
}
