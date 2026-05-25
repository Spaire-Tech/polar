'use client'

import {
  type CommunityPostRead,
  type CommunitySortProperty,
  type FeedFilters,
  useCreatorCommunityFeed,
  useCreatorCommunityMembers,
  useCreatorCommunitySettings,
  useCreatorCommunityTags,
} from '@/hooks/queries/community'
import { useMemo, useState } from 'react'
import { type CommunityEvent, EventsView } from './EventsView'
import { type CommunityView, LeftRail, type RailLesson } from './LeftRail'
import { MembersView } from './MembersView'
import { PostCard } from './PostCard'
import styles from './community.module.css'
import { IconPin } from './icons'

type Props = {
  courseId: string
  // Per-course lesson list lifted from the editor's course query so the
  // preview rail shows the same "Discussions" channels students see.
  lessons?: RailLesson[]
  // Read-only fallback header copy when settings haven't loaded yet.
  courseTitle?: string
}

// Read-only preview of the student-facing feed for the course-editor
// pane. Calls the creator-side endpoints (which use the dashboard
// session cookie) instead of the customer-portal hooks, so the creator
// never needs a customer_session_token to see what their students see.
// Composer is hidden entirely; reactions + comments render but their
// click handlers no-op (PostCard's previewMode prop).
export function CommunityPreview({
  courseId,
  lessons = [],
  courseTitle,
}: Props) {
  const [view, setView] = useState<CommunityView>('home')
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [tagId, setTagId] = useState<string | null>(null)
  const [sort] = useState<CommunitySortProperty>('recent')
  const [events, setEvents] = useState<CommunityEvent[]>([])

  const filters: FeedFilters = useMemo(
    () => ({ sort, module_id: null, lesson_id: lessonId, tag_id: tagId }),
    [sort, lessonId, tagId],
  )

  const settingsQ = useCreatorCommunitySettings(courseId)
  const feedQ = useCreatorCommunityFeed(courseId, filters)
  const tagsQ = useCreatorCommunityTags(courseId)
  const membersQ = useCreatorCommunityMembers(courseId)

  const settings = settingsQ.data

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
          Community is off. Toggle <strong>Community enabled</strong> on the
          left to render the student-facing view here.
        </div>
      </div>
    )
  }

  const members = membersQ.data ?? []
  const memberCount = members.length
  const tags = tagsQ.data ?? []
  const upcomingEventCount = events.filter((e) => !e.past).length
  const displayCourseTitle = courseTitle ?? 'Course'

  return (
    <div className={styles.root}>
      <div className={styles.layout}>
        <LeftRail
          view={view}
          onViewChange={setView}
          lessons={lessons}
          lessonId={lessonId}
          onLessonChange={setLessonId}
          memberCount={memberCount}
          eventCount={upcomingEventCount}
        />

        <main className={styles.main}>
          {/* Read-only badge so the creator knows this is the
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

          {view === 'members' ? (
            <MembersView members={members} isLoading={membersQ.isLoading} />
          ) : view === 'events' ? (
            <EventsView
              hostName="You"
              events={events}
              onCreate={(e) => setEvents((prev) => [e, ...prev])}
              onToggleGoing={(id) =>
                setEvents((prev) =>
                  prev.map((e) =>
                    e.id === id
                      ? {
                          ...e,
                          going: !e.going,
                          rsvpCount: Math.max(
                            0,
                            e.rsvpCount + (e.going ? -1 : 1),
                          ),
                        }
                      : e,
                  ),
                )
              }
            />
          ) : (
            <>
              <header className={styles.feedHeader}>
                <div className={styles.feedEyebrow}>
                  {memberCount} {memberCount === 1 ? 'member' : 'members'}
                </div>
                <h1 className={styles.feedTitle}>
                  {settings?.feed_title_override ?? 'Community'}
                </h1>
                <p className={styles.feedSub}>
                  {settings?.feed_eyebrow_override ??
                    `Discussions, wins, and questions for ${displayCourseTitle}.`}
                </p>
              </header>

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

              {/* Tag filter chips — same UX as the live feed, just
                  doesn't let the creator type anything. */}
              <div className={styles.filterbar}>
                <button
                  type="button"
                  className={`${styles.filterChip} ${
                    tagId == null ? styles.active : ''
                  }`}
                  onClick={() => setTagId(null)}
                >
                  All
                </button>
                {tags.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`${styles.filterChip} ${
                      tagId === t.id ? styles.active : ''
                    }`}
                    onClick={() => setTagId(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
                <span className={styles.filterSpacer} />
                <button type="button" className={styles.sortBtn} disabled>
                  Recent ↓
                </button>
              </div>

              <div className={styles.feedList}>
                {feedQ.isLoading && allPosts.length === 0 ? (
                  <div className={styles.empty}>Loading…</div>
                ) : allPosts.length === 0 ? (
                  <div className={styles.empty}>
                    No posts yet — when a student writes one, it shows here.
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
            </>
          )}
        </main>
      </div>
    </div>
  )
}
