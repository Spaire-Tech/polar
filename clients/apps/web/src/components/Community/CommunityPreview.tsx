'use client'

import {
  type CommunityPostRead,
  type CommunitySortProperty,
  type FeedFilters,
  useCreatorCommunityFeed,
  useCreatorCommunityIdentity,
  useCreatorCommunityMembers,
  useCreatorCommunitySettings,
  useCreatorCommunityTags,
} from '@/hooks/queries/community'
import { useEffect, useMemo, useState } from 'react'
import { ActivitiesView, type CommunityActivity } from './ActivitiesView'
import { Composer } from './Composer'
import { type CommunityEvent, EventsView } from './EventsView'
import {
  type CommunityView,
  type DiscussionsKind,
  LeftRail,
  type RailLesson,
} from './LeftRail'
import { MembersView } from './MembersView'
import { PostCard } from './PostCard'
import styles from './community.module.css'
import { IconPin } from './icons'

type Props = {
  courseId: string
  // Per-course rail items. For series we pass lessons; for course
  // format we pass modules. The label adapts in LeftRail.
  lessons?: RailLesson[]
  // 'episode' (series) vs 'module' (course) — drives the rail's
  // "All ..." label + the composer category dropdown's wording.
  discussionsKind?: DiscussionsKind
  // Read-only fallback header copy when settings haven't loaded yet.
  courseTitle?: string
}

// Live, interactive community surface embedded in the course editor.
// The admin sees + acts on the same posts students do, identified as
// themselves (kind='instructor', name pulled from course.instructor_name).
// All read/write hooks here are routed to the creator-side endpoints
// via mode='creator', so no customer_session_token is needed.
export function CommunityPreview({
  courseId,
  lessons = [],
  discussionsKind = 'module',
  courseTitle,
}: Props) {
  const [view, setView] = useState<CommunityView>('home')
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [tagId, setTagId] = useState<string | null>(null)
  const [sort] = useState<CommunitySortProperty>('recent')
  const [events, setEvents] = useState<CommunityEvent[]>([])
  const [activities, setActivities] = useState<CommunityActivity[]>([])
  const [composerForceOpen, setComposerForceOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const filters: FeedFilters = useMemo(
    () => ({ sort, module_id: null, lesson_id: lessonId, tag_id: tagId }),
    [sort, lessonId, tagId],
  )

  const settingsQ = useCreatorCommunitySettings(courseId)
  const feedQ = useCreatorCommunityFeed(courseId, filters)
  const tagsQ = useCreatorCommunityTags(courseId)
  const membersQ = useCreatorCommunityMembers(courseId)
  const meQ = useCreatorCommunityIdentity(courseId)

  // Toast auto-dismiss.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(t)
  }, [toast])

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
          left to render the live student-facing view here.
        </div>
      </div>
    )
  }

  const members = membersQ.data ?? []
  const memberCount = members.length
  const tags = tagsQ.data ?? []
  const upcomingEventCount = events.filter((e) => !e.past).length
  const displayCourseTitle = courseTitle ?? 'Course'

  // The admin's community identity. Resolved server-side from
  // course.instructor_name → user.account_username → email fallback,
  // so the composer/avatars show the editorial display name rather
  // than an email-local string.
  const me = meQ.data
  const selfName = me?.name ?? null
  const selfAvatarUrl = me?.avatar_url ?? null
  const selfUserId = me?.kind === 'instructor' ? me.user_id : null

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
          activityCount={activities.length}
          discussionsKind={discussionsKind}
        />

        <main className={styles.main}>
          {view === 'members' ? (
            <MembersView members={members} isLoading={membersQ.isLoading} />
          ) : view === 'events' ? (
            <EventsView
              hostName={selfName ?? 'You'}
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
          ) : view === 'activities' ? (
            <ActivitiesView
              channelKind={discussionsKind}
              channels={lessons.map((l) => ({ id: l.id, label: l.label }))}
              activities={activities}
              totalMembers={memberCount}
              onCreate={(a) => setActivities((prev) => [a, ...prev])}
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

              <Composer
                token=""
                courseId={courseId}
                selfName={selfName}
                selfAvatarUrl={selfAvatarUrl}
                categories={lessons.map((l) => ({
                  id: l.id,
                  label: l.label,
                }))}
                categoryKind={discussionsKind}
                tags={tags}
                mode="creator"
                forceOpen={composerForceOpen}
                onOpenChange={setComposerForceOpen}
                onPosted={() => {
                  setComposerForceOpen(false)
                  setToast('Posted')
                }}
              />

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
                    No posts yet — write the first one above.
                  </div>
                ) : (
                  allPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      token=""
                      courseId={courseId}
                      selfName={selfName}
                      selfAvatarUrl={selfAvatarUrl}
                      selfUserId={selfUserId}
                      reactionsEnabled={settings?.reactions_enabled ?? true}
                      mode="creator"
                      onLessonChipClick={setLessonId}
                      onShareToast={(m) => setToast(m)}
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

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}
