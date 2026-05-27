'use client'

// v5 notifications view for the host inside the community editor.
// Surfaces recent posts + (when wired) comments / submissions as a
// unified notif stream.
//
// Today the only data source is creator-side posts via
// useCreatorCommunityPosts — the org-side instructor notification
// stream isn't on the API yet. We synthesize a notification row per
// recent post so the v5 markup has something to render against;
// when the real stream lands swap the data source here, keep the
// render contract.
//
// Design: __design/Community-v5.html — `.notif-head`, `.notif-tabs`,
// `.notif-list`, `.notif-row`, `.notif-badge`, `.notif-empty`.

import {
  type CommunityPostRead,
  useCreatorCommunityPosts,
} from '@/hooks/queries/community'
import { useMemo, useState } from 'react'
import { Avatar } from './Avatar'
import styles from './community.module.css'
import { IconBell, IconChat, IconCheck, IconHeart } from './icons'

type FilterId = 'all' | 'unread' | 'comments' | 'activity'

type NotifKind = 'post' | 'comment' | 'reaction'
type NotifBucket = 'new' | 'yesterday' | 'earlier'

type NotifItem = {
  id: string
  kind: NotifKind
  bucket: NotifBucket
  authorName: string
  authorAvatarUrl: string | null
  authorIsInstructor: boolean
  text: string
  target: string | null
  quote: string | null
  when: string
  unread: boolean
}

const HOUR = 1000 * 60 * 60
const DAY = HOUR * 24

const formatRelative = (iso: string): string => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString()
}

const bucketFor = (iso: string): NotifBucket => {
  const age = Date.now() - new Date(iso).getTime()
  if (age < 8 * HOUR) return 'new'
  if (age < 2 * DAY) return 'yesterday'
  return 'earlier'
}

const buildNotifs = (posts: CommunityPostRead[]): NotifItem[] =>
  posts.map((p) => {
    const iso = p.published_at ?? p.created_at
    const authorName =
      p.author.name ??
      (p.author.kind === 'instructor' ? 'Instructor' : 'Member')
    return {
      id: p.id,
      kind: 'post' as const,
      bucket: bucketFor(iso),
      authorName,
      authorAvatarUrl: p.author.avatar_url ?? null,
      authorIsInstructor: p.author.kind === 'instructor',
      text: 'posted',
      target: p.title ?? p.body.slice(0, 80),
      quote: p.title ? p.body.slice(0, 160) : null,
      when: formatRelative(iso),
      // First three rows are "new" (matches the design's unread dot
      // emphasis on the most-recent slice); the rest are read-state.
      // Wire this to a real read receipt once the API lands.
      unread: bucketFor(iso) === 'new',
    }
  })

export function CommunityNotificationsView({ courseId }: { courseId: string }) {
  const postsQ = useCreatorCommunityPosts(courseId)
  const [filter, setFilter] = useState<FilterId>('all')

  const items: NotifItem[] = useMemo(
    () => buildNotifs(postsQ.data?.pages.flatMap((p) => p.items) ?? []),
    [postsQ.data],
  )

  const counts = useMemo(
    () => ({
      all: items.length,
      unread: items.filter((i) => i.unread).length,
      comments: items.filter((i) => i.kind === 'comment').length,
      activity: items.filter((i) => i.kind === 'reaction').length,
    }),
    [items],
  )

  const visible = useMemo(() => {
    if (filter === 'all') return items
    if (filter === 'unread') return items.filter((i) => i.unread)
    if (filter === 'comments') return items.filter((i) => i.kind === 'comment')
    if (filter === 'activity') return items.filter((i) => i.kind === 'reaction')
    return items
  }, [items, filter])

  const grouped = useMemo(() => {
    const order: { key: NotifBucket; label: string }[] = [
      { key: 'new', label: 'New' },
      { key: 'yesterday', label: 'Yesterday' },
      { key: 'earlier', label: 'This week' },
    ]
    return order
      .map((b) => ({
        ...b,
        items: visible.filter((v) => v.bucket === b.key),
      }))
      .filter((g) => g.items.length > 0)
  }, [visible])

  const filters: {
    id: FilterId
    label: string
    count: number
    icon: typeof IconHeart | null
  }[] = [
    { id: 'all', label: 'All', count: counts.all, icon: null },
    { id: 'unread', label: 'Unread', count: counts.unread, icon: null },
    {
      id: 'comments',
      label: 'Comments',
      count: counts.comments,
      icon: IconChat,
    },
    {
      id: 'activity',
      label: 'Reactions',
      count: counts.activity,
      icon: IconHeart,
    },
  ]

  return (
    <div data-screen-label="Notifications">
      <div className={styles.notifHead}>
        <div className={styles.notifHeadTitleRow}>
          <h1 className={styles.notifHeadTitle}>Notifications</h1>
          {counts.unread > 0 && (
            <span className={styles.notifHeadUnreadPill}>
              <span className={styles.dot} /> {counts.unread} new
            </span>
          )}
        </div>
        <div className={styles.notifHeadSub}>
          {counts.unread > 0
            ? `You have ${counts.unread} unread — mostly recent posts in your community.`
            : "You're all caught up. Lovely."}
        </div>
        <div className={styles.notifHeadActions}>
          <button
            type="button"
            className={styles.notifHeadBtn}
            disabled={counts.unread === 0}
          >
            <IconCheck size={13} /> Mark all read
          </button>
        </div>
      </div>

      <div className={styles.notifTabs}>
        {filters.map((f) => {
          const Icon = f.icon
          return (
            <button
              key={f.id}
              type="button"
              className={`${styles.notifTab} ${filter === f.id ? styles.notifTabActive : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {Icon && <Icon size={13} />}
              {f.label}
              <span className={styles.ct}>{f.count}</span>
            </button>
          )
        })}
      </div>

      {postsQ.isLoading ? (
        <div className={styles.notifEmpty}>
          <div className={styles.notifEmptyTitle}>Loading…</div>
        </div>
      ) : grouped.length === 0 ? (
        <div className={styles.notifEmpty}>
          <div className={styles.notifEmptyIcon}>
            <IconBell size={22} />
          </div>
          <div className={styles.notifEmptyTitle}>Nothing here yet</div>
          <div className={styles.notifEmptySub}>
            {filter === 'unread'
              ? "You're all caught up — nice work staying on top of feedback."
              : `No ${filter === 'all' ? 'notifications' : filter} to show right now.`}
          </div>
        </div>
      ) : (
        grouped.map((g) => (
          <div key={g.key}>
            <div className={styles.notifSectionTitle}>
              <span>{g.label}</span>
              <span className={styles.ct}>{g.items.length}</span>
              <span className={styles.notifSectionTitleDivider} />
            </div>
            <div className={styles.notifList}>
              {g.items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`${styles.notifRow} ${n.unread ? styles.notifRowUnread : ''}`}
                >
                  <div className={styles.notifAvatar}>
                    <Avatar
                      name={n.authorName}
                      avatarUrl={n.authorAvatarUrl ?? undefined}
                      size={44}
                    />
                    <span
                      className={`${styles.notifBadge} ${
                        n.kind === 'reaction'
                          ? styles.notifBadgeHeart
                          : n.kind === 'comment'
                            ? styles.notifBadgeComment
                            : styles.notifBadgeActivity
                      }`}
                    >
                      {n.kind === 'reaction' ? (
                        <IconHeart size={10} />
                      ) : n.kind === 'comment' ? (
                        <IconChat size={10} />
                      ) : (
                        <IconBell size={10} />
                      )}
                    </span>
                  </div>

                  <div className={styles.notifBody}>
                    <div className={styles.notifText}>
                      <strong>{n.authorName}</strong>{' '}
                      {n.authorIsInstructor && (
                        <span
                          style={{
                            display: 'inline-block',
                            fontSize: 9,
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 999,
                            background: 'var(--c-ink)',
                            color: '#fff',
                            letterSpacing: '0.05em',
                            verticalAlign: 'middle',
                            marginRight: 4,
                          }}
                        >
                          INSTR
                        </span>
                      )}
                      {n.text}
                      {n.target && (
                        <>
                          {' '}
                          <span className={styles.target}>{n.target}</span>
                        </>
                      )}
                    </div>
                    {n.quote && (
                      <div className={styles.notifQuote}>{n.quote}</div>
                    )}
                  </div>

                  <div className={styles.notifRight}>
                    <span className={styles.notifTime}>{n.when}</span>
                    {n.unread && <span className={styles.notifUnreadDot} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
