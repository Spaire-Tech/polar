'use client'

import {
  NewsletterPostRow,
  useCreateNewsletterPost,
  useNewsletter,
  useNewsletterPosts,
} from '@/hooks/queries/newsletters'
import Button from '@spaire/ui/components/atoms/Button'
import { schemas } from '@spaire/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { Icon } from '../../email-marketing/_components/Icon'
import { slugify } from './NewNewsletterScreen'

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

      {postsLoading ? (
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

// Silences the unused-import warning for slugify (kept exported for
// the settings screen, which lives in this folder too).
export const _slugify = slugify
