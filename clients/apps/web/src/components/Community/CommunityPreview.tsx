'use client'

import {
  type CommunityPostRead,
  type CommunitySortProperty,
  type FeedFilters,
  useCreatorCommunityFeed,
  useCreatorCommunitySettings,
  useCreatorCommunityTags,
} from '@/hooks/queries/community'
import { useMemo, useState } from 'react'
import styles from './community.module.css'
import { IconImage, IconPin } from './icons'
import { PostCard } from './PostCard'

type Props = {
  courseId: string
}

// Read-only preview of the student-facing feed for the course-editor
// pane. Calls the creator-side endpoints (which use the dashboard
// session cookie) instead of the customer-portal hooks, so the
// creator never needs a customer_session_token to see what their
// students see. Composer / share / post-menu are hidden; reactions
// + comments render but their click handlers no-op (PostCard's
// previewMode prop).
export function CommunityPreview({ courseId }: Props) {
  // Sort + module + lesson are local-state-only in the preview — the
  // creator can scope what they see without touching anything
  // mutable. (setSort is reserved for a future sort dropdown; for now
  // 'recent' matches what students land on by default.)
  const [sort] = useState<CommunitySortProperty>('recent')
  const [moduleId] = useState<string | null>(null)
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [tagId, setTagId] = useState<string | null>(null)

  const filters: FeedFilters = useMemo(
    () => ({ sort, module_id: moduleId, lesson_id: lessonId, tag_id: tagId }),
    [sort, moduleId, lessonId, tagId],
  )

  const settingsQ = useCreatorCommunitySettings(courseId)
  const tagsQ = useCreatorCommunityTags(courseId)
  const feedQ = useCreatorCommunityFeed(courseId, filters)

  const settings = settingsQ.data
  const tags = tagsQ.data ?? []

  const allPosts: CommunityPostRead[] = useMemo(() => {
    const pages = feedQ.data?.pages ?? []
    const seen = new Set<string>()
    const out: CommunityPostRead[] = []
    for (const page of pages) {
      for (const p of page.items) {
        if (seen.has(p.id)) continue
        seen.add(p.id)
        out.push(p)
      }
    }
    return out
  }, [feedQ.data])

  const promptPostId = settings?.prompt_of_week_post_id ?? null
  const promptPost = useMemo(
    () =>
      promptPostId
        ? (allPosts.find((p) => p.id === promptPostId) ?? null)
        : null,
    [allPosts, promptPostId],
  )

  if (settingsQ.isLoading) {
    return (
      <div className={styles.root}>
        <main className={styles.main} style={{ padding: '24px' }}>
          <div
            style={{
              height: 240,
              borderRadius: 20,
              background: 'var(--c-panel)',
            }}
          />
        </main>
      </div>
    )
  }

  if (settings && !settings.enabled) {
    return (
      <div className={styles.root}>
        <div className={styles.disabledBanner}>
          Community is off. Toggle{' '}
          <strong>Community enabled</strong> on the left to render the
          student-facing view here.
        </div>
      </div>
    )
  }

  const heroThumbnailUrl = settings?.hero_thumbnail_url ?? null

  return (
    <div className={styles.root}>
      <main className={styles.main} style={{ padding: '24px' }}>
        {/* Eyebrow tag so the creator knows this is the read-only
            simulation, not the live page. */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--c-muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '4px 10px',
            borderRadius: 999,
            background: 'var(--c-panel)',
            marginBottom: 16,
          }}
        >
          Preview · read-only
        </div>

        <header className={styles.feedHeader}>
          <div className={styles.feedEyebrow}>
            {settings?.feed_eyebrow_override ?? 'Community'}
          </div>
          <h1 className={styles.feedTitle}>
            {settings?.feed_title_override ?? 'Community'}
          </h1>
        </header>

        <div
          className={styles.thumb}
          style={
            heroThumbnailUrl
              ? { backgroundImage: `url(${heroThumbnailUrl})` }
              : undefined
          }
        >
          {!heroThumbnailUrl && (
            <IconImage size={56} className={styles.thumbIcon} />
          )}
        </div>

        {promptPost && (
          <div className={styles.prompt}>
            <span className={styles.pinTag}>
              <IconPin size={10} /> Prompt of the week
            </span>
            <h2 className={styles.promptQ}>
              {promptPost.title ?? promptPost.body.slice(0, 140)}
            </h2>
          </div>
        )}

        <div className={styles.filterbar}>
          <button
            type="button"
            className={`${styles.filterChip} ${tagId == null ? styles.active : ''}`}
            onClick={() => setTagId(null)}
          >
            All
          </button>
          {tags.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`${styles.filterChip} ${tagId === t.id ? styles.active : ''}`}
              onClick={() => setTagId(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.feedList}>
          {feedQ.isLoading && allPosts.length === 0 ? (
            <div className={styles.empty}>Loading…</div>
          ) : allPosts.length === 0 ? (
            <div className={styles.empty}>
              {tagId
                ? 'No posts match this filter.'
                : 'No posts yet — when a student writes one, it shows here.'}
            </div>
          ) : (
            allPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                token=""
                courseId={courseId}
                reactionsEnabled={settings?.reactions_enabled ?? true}
                previewMode
                onLessonChipClick={setLessonId}
              />
            ))
          )}
        </div>

        {feedQ.hasNextPage && (
          <button
            type="button"
            className={styles.loadMore}
            onClick={() => feedQ.fetchNextPage()}
            disabled={feedQ.isFetchingNextPage}
          >
            {feedQ.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        )}
      </main>
    </div>
  )
}
