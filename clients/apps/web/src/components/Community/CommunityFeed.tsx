'use client'

import {
  type CommunityPostRead,
  type CommunitySortProperty,
  type FeedFilters,
  useCommunityFeed,
  useCommunityMembers,
  useCommunitySettings,
  useCommunityTags,
} from '@/hooks/queries/community'
import { useCustomerCourse } from '@/hooks/queries/courses'
import { useEffect, useMemo, useState } from 'react'
import { ActivitiesView, type CommunityActivity } from './ActivitiesView'
import { Avatar } from './Avatar'
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
  customerSessionToken: string
}

export function CommunityFeed({ courseId, customerSessionToken }: Props) {
  const [view, setView] = useState<CommunityView>('home')
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [tagId, setTagId] = useState<string | null>(null)
  const [sort, setSort] = useState<CommunitySortProperty>('recent')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [composerForceOpen, setComposerForceOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  // Events + activities are client-state only — no backend yet. Persist
  // nothing across reloads in Phase 3; the UIs are functional but
  // ephemeral so creators can preview the flow.
  const [events, setEvents] = useState<CommunityEvent[]>([])
  const [activities, setActivities] = useState<CommunityActivity[]>([])

  const settingsQ = useCommunitySettings(customerSessionToken, courseId)
  const courseQ = useCustomerCourse(customerSessionToken, courseId)
  // We have to peek the courseDetail BEFORE the filters memo so we can
  // route the rail's selection to module_id (course format) vs
  // lesson_id (series). Both can't be set, so feed/repo logic stays
  // exactly the same.
  const isSeriesEarly = courseQ.data?.course.format === 'series'
  const filters: FeedFilters = useMemo(
    () => ({
      sort,
      module_id: isSeriesEarly ? null : lessonId,
      lesson_id: isSeriesEarly ? lessonId : null,
      tag_id: tagId,
    }),
    [sort, lessonId, tagId, isSeriesEarly],
  )

  const feedQ = useCommunityFeed(customerSessionToken, courseId, filters)
  const tagsQ = useCommunityTags(customerSessionToken, courseId)
  const membersQ = useCommunityMembers(customerSessionToken, courseId)

  // Toast auto-dismiss.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const settings = settingsQ.data
  const courseDetail = courseQ.data
  const modules = useMemo(
    () => courseDetail?.course.modules ?? [],
    [courseDetail],
  )

  // Series courses are flat episode lists — the rail shows lessons.
  // Course-format courses bucket the rail by module instead. Composer
  // mirrors the same kind so the category selector and the discussion
  // channels agree.
  const isSeries = isSeriesEarly
  const discussionsKind: DiscussionsKind = isSeries ? 'episode' : 'module'

  const railLessons: RailLesson[] = useMemo(() => {
    if (isSeries) {
      const out: RailLesson[] = []
      for (const m of modules) {
        for (const l of m.lessons ?? []) {
          out.push({ id: l.id, label: l.title })
        }
      }
      return out
    }
    return modules.map((m) => ({ id: m.id, label: m.title }))
  }, [modules, isSeries])

  // Composer's "Channel" selector — same source as the rail. We track
  // a single `categoryId` that the composer passes to the backend via
  // module_id or lesson_id depending on `discussionsKind`.
  const composerCategories = railLessons.map((l) => ({
    id: l.id,
    label: l.label,
  }))

  // Flatten the infinite query's pages into a single list. Computing
  // the prompt-of-week and feed-list slices inline keeps both memos
  // shallow enough that the React compiler can preserve them.
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

  // ---------- Loading / disabled states ----------

  if (settingsQ.isLoading || courseQ.isLoading) {
    return (
      <div className={styles.root}>
        <div className={styles.layout}>
          <div />
          <div className={styles.main}>
            <div
              style={{
                height: 200,
                borderRadius: 20,
                background: 'var(--c-panel)',
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  if (settingsQ.isError) {
    return (
      <div className={styles.root}>
        <div className={styles.disabledBanner}>
          Couldn&apos;t load the community. Try refreshing the page.
        </div>
      </div>
    )
  }

  if (settings && !settings.enabled) {
    return (
      <div className={styles.root}>
        <div className={styles.disabledBanner}>
          The instructor hasn&apos;t enabled the community for this course yet.
        </div>
      </div>
    )
  }

  // ---------- Computed display values ----------

  const courseTitle = courseDetail?.course.title ?? 'Course'
  const selfName = courseDetail?.customer_name ?? null
  const members = membersQ.data ?? []
  const memberCount = members.length
  const tags = tagsQ.data ?? []
  const upcomingEventCount = events.filter((e) => !e.past).length

  const handleLessonChipClick = (lessonIdFromChip: string) => {
    setLessonId(lessonIdFromChip)
    setTagId(null)
    setView('home')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onCreateEvent = (event: CommunityEvent) => {
    setEvents((prev) => [event, ...prev])
    setToast('Event created')
  }

  const onToggleGoing = (id: string) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              going: !e.going,
              rsvpCount: Math.max(0, e.rsvpCount + (e.going ? -1 : 1)),
            }
          : e,
      ),
    )
  }

  // ---------- Render ----------

  return (
    <div className={styles.root}>
      <div className={styles.layout}>
        <LeftRail
          view={view}
          onViewChange={setView}
          lessons={railLessons}
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
              onCreate={onCreateEvent}
              onToggleGoing={onToggleGoing}
            />
          ) : view === 'activities' ? (
            <ActivitiesView
              channelKind={discussionsKind}
              channels={composerCategories}
              activities={activities}
              totalMembers={memberCount}
              onCreate={(a) => {
                setActivities((prev) => [a, ...prev])
                setToast('Activity created')
              }}
            />
          ) : (
            <>
              {/* Feed header */}
              <header className={styles.feedHeader}>
                <div className={styles.feedEyebrow}>
                  {memberCount} {memberCount === 1 ? 'member' : 'members'}
                </div>
                <h1 className={styles.feedTitle}>
                  {settings?.feed_title_override ?? 'Community'}
                </h1>
                <p className={styles.feedSub}>
                  {settings?.feed_eyebrow_override ??
                    `Discussions, wins, and questions for ${courseTitle}. Share what you're working on, ask for feedback, and reply to anyone in the cohort.`}
                </p>
              </header>

              {/* Course thumbnail */}
              {/* Prompt of the week */}
              {promptPost && (
                <div className={styles.prompt}>
                  <span className={styles.pinTag}>
                    <IconPin size={10} /> Prompt of the week
                  </span>
                  <h2 className={styles.promptQ}>
                    {promptPost.title ?? promptPost.body.slice(0, 140)}
                  </h2>
                  <div className={styles.promptFoot}>
                    <div className={styles.promptBy}>
                      <Avatar
                        name={
                          promptPost.author.name ??
                          (promptPost.author.kind === 'instructor'
                            ? 'Instructor'
                            : 'Member')
                        }
                        avatarUrl={promptPost.author.avatar_url ?? undefined}
                        size={26}
                      />
                      <div className={styles.promptByText}>
                        <strong>
                          {promptPost.author.name ??
                            (promptPost.author.kind === 'instructor'
                              ? 'Instructor'
                              : 'Member')}
                        </strong>{' '}
                        · {promptPost.comment_count} replies
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.promptCta}
                      onClick={() => {
                        const el = document.getElementById(
                          `post-${promptPost.id}`,
                        )
                        el?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        })
                      }}
                    >
                      Share your answer
                    </button>
                  </div>
                </div>
              )}

              {/* Composer — collapsed pill (Photo/Video buttons open the
                  device picker directly; clicking the pill or Write opens
                  the modal) */}
              <Composer
                token={customerSessionToken}
                courseId={courseId}
                selfName={selfName}
                categories={composerCategories}
                categoryKind={discussionsKind}
                tags={tags}
                forceOpen={composerForceOpen}
                onOpenChange={setComposerForceOpen}
                onPosted={() => {
                  setComposerForceOpen(false)
                  setToast('Posted')
                }}
              />

              {/* Tag filter chips + sort */}
              {(tags.length > 0 || true) && (
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
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className={styles.sortBtn}
                      onClick={() => setSortMenuOpen((v) => !v)}
                      aria-haspopup="menu"
                      aria-expanded={sortMenuOpen}
                    >
                      {sort === 'recent'
                        ? 'Recent'
                        : sort === 'top_week'
                          ? 'Top this week'
                          : 'Unanswered'}{' '}
                      ↓
                    </button>
                    {sortMenuOpen && (
                      <div
                        className={styles.sortMenu}
                        role="menu"
                        onMouseLeave={() => setSortMenuOpen(false)}
                      >
                        {(
                          [
                            { id: 'recent', label: 'Recent' },
                            { id: 'top_week', label: 'Top this week' },
                            { id: 'unanswered', label: 'Unanswered' },
                          ] as { id: CommunitySortProperty; label: string }[]
                        ).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            role="menuitem"
                            className={styles.sortMenuItem}
                            onClick={() => {
                              setSort(s.id)
                              setSortMenuOpen(false)
                            }}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Feed list */}
              <div className={styles.feedList}>
                {feedQ.isLoading && allPosts.length === 0 ? (
                  <div className={styles.empty}>Loading…</div>
                ) : allPosts.length === 0 && !promptPost ? (
                  <div className={styles.empty}>
                    {lessonId || tagId
                      ? 'No posts match this filter yet.'
                      : 'No posts yet — be the first to start a conversation.'}
                  </div>
                ) : (
                  allPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      token={customerSessionToken}
                      courseId={courseId}
                      selfName={selfName}
                      selfEnrollmentId={courseDetail?.enrollment_id}
                      reactionsEnabled={settings?.reactions_enabled ?? true}
                      onLessonChipClick={handleLessonChipClick}
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
