'use client'

import {
  type CommunityActivityRead,
  type CommunityEventRead,
  type CommunityPostRead,
  type CommunitySortProperty,
  type FeedFilters,
  useCommunityActivities,
  useCommunityEvents,
  useCommunityFeed,
  useCommunityMembers,
  useCommunitySettings,
  useCommunityTags,
  useCreateCommunityActivity,
  useCreateCommunityEvent,
  useRsvpCommunityEvent,
  useSubmitToCommunityActivity,
} from '@/hooks/queries/community'
import { useCustomerCourse } from '@/hooks/queries/courses'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivitiesView,
  type ActivitySubmissionInput,
  type CommunityActivity,
  type CommunityActivityCreateInput,
} from './ActivitiesView'
import { Avatar } from './Avatar'
import { Composer } from './Composer'
import {
  type CommunityEvent,
  type CommunityEventCreateInput,
  EventsView,
} from './EventsView'
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
  // Activities + events are both backed by their respective endpoints.
  const activitiesQ = useCommunityActivities(
    customerSessionToken,
    courseId,
    'customer',
  )
  const createActivityMut = useCreateCommunityActivity(
    customerSessionToken,
    courseId,
    'customer',
  )
  const submitActivityMut = useSubmitToCommunityActivity(
    customerSessionToken,
    courseId,
  )

  const eventsQ = useCommunityEvents(customerSessionToken, courseId, 'customer')
  const createEventMut = useCreateCommunityEvent(
    customerSessionToken,
    courseId,
    'customer',
  )
  const rsvpMut = useRsvpCommunityEvent(customerSessionToken, courseId)
  const events: CommunityEvent[] = useMemo(
    () => (eventsQ.data ?? []).map(mapEventReadToUI),
    [eventsQ.data],
  )

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
  const selfAvatarUrl = courseDetail?.customer_avatar_url ?? null
  const members = membersQ.data ?? []
  const memberCount = members.length
  const tags = tagsQ.data ?? []
  const upcomingEventCount = events.filter((e) => !e.past).length
  const activities: CommunityActivity[] = (activitiesQ.data ?? []).map((a) =>
    mapActivityReadToUI(a, memberCount),
  )

  const handleLessonChipClick = (lessonIdFromChip: string) => {
    setLessonId(lessonIdFromChip)
    setTagId(null)
    setView('home')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onCreateEvent = async (input: CommunityEventCreateInput) => {
    try {
      await createEventMut.mutateAsync(buildEventCreateBody(input))
      setToast('Event created')
    } catch (e) {
      setToast('Could not create event')
    }
  }

  const onToggleGoing = (id: string) => {
    const ev = events.find((e) => e.id === id)
    if (!ev) return
    rsvpMut.mutate({ eventId: id, going: !ev.going })
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
              canCreate={false}
            />
          ) : view === 'activities' ? (
            <ActivitiesView
              channelKind={discussionsKind}
              channels={composerCategories}
              activities={activities}
              totalMembers={memberCount}
              canCreate={false}
              onCreate={async (input: CommunityActivityCreateInput) => {
                try {
                  await createActivityMut.mutateAsync(
                    buildActivityCreateBody(input),
                  )
                  setToast('Activity created')
                } catch {
                  setToast('Could not create activity')
                }
              }}
              onSubmit={async (
                activityId: string,
                sub: ActivitySubmissionInput,
              ) => {
                await submitActivityMut.mutateAsync({
                  activityId,
                  body: buildSubmissionBody(sub),
                })
                setToast('Submitted')
              }}
              onViewSubmissions={() => {
                /* TODO: gallery modal. The submissions endpoint exists
                   on the API; wiring the gallery UI is the next slice. */
                setToast('Submissions view coming next')
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
                selfAvatarUrl={selfAvatarUrl}
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
                      selfAvatarUrl={selfAvatarUrl}
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

// ---------------------------------------------------------------------
// Event mappers — translate server CommunityEventRead into the
// UI-shaped CommunityEvent that EventsView consumes, and translate the
// modal's input back into the server's create payload.
// ---------------------------------------------------------------------

function mapEventReadToUI(e: CommunityEventRead): CommunityEvent {
  return {
    id: e.id,
    title: e.title,
    type: e.type,
    desc: e.description ?? '',
    startAt: e.start_at,
    timezone: e.timezone || 'UTC',
    duration: String(e.duration_minutes),
    location: e.location ?? '',
    meetingUrl: e.meeting_url,
    replayUrl: e.replay_url,
    hostName: e.host.name,
    rsvpCount: e.rsvp_count,
    going: e.going,
    live: e.live,
    past: e.past,
  }
}

function buildEventCreateBody(input: CommunityEventCreateInput) {
  // The host picked `date + startTime` as wall-clock in `input.timezone`.
  // Convert that to a UTC instant by serializing through Intl: take the
  // naive datetime, interpret the same wall clock in the target tz, and
  // compute the offset.
  const start_at = wallClockInTzToUtcIso(
    input.date,
    input.startTime,
    input.timezone,
  )
  return {
    title: input.title,
    type: input.type,
    description: input.desc || null,
    start_at,
    timezone: input.timezone,
    duration_minutes: parseInt(input.duration, 10) || 60,
    meeting_url: input.meetingUrl || null,
    location: input.location || null,
    notify_on_publish: input.notify,
    recurring_weekly: input.recurring,
  }
}

// Convert "YYYY-MM-DD HH:mm in IANA tz X" to the UTC ISO instant.
// Uses Intl to compute the offset of `tz` at that wall clock.
function wallClockInTzToUtcIso(date: string, time: string, tz: string): string {
  // First, build a UTC interpretation of the wall clock as a starting
  // point.
  const naiveUtc = new Date(`${date}T${time || '00:00'}:00Z`)
  // Format that instant *as if* it were viewed in `tz` — the parts tell
  // us what UTC reads as in tz. The drift is exactly the offset we need
  // to subtract from naiveUtc to get the real UTC instant.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(naiveUtc)
  const get = (t: string) =>
    parseInt(parts.find((p) => p.type === t)?.value ?? '0', 10)
  const asTz = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  )
  const offsetMs = asTz - naiveUtc.getTime()
  return new Date(naiveUtc.getTime() - offsetMs).toISOString()
}

// ---------------------------------------------------------------------
// Activity mappers — translate server CommunityActivityRead to the
// UI-shaped CommunityActivity, and translate the modal's input back
// into the server's create payload.
// ---------------------------------------------------------------------

function mapActivityReadToUI(
  a: CommunityActivityRead,
  totalMembers: number,
): CommunityActivity {
  return {
    id: a.id,
    channelKind: a.channel_kind,
    channelId: a.module_id ?? a.lesson_id,
    channelLabel: a.channel_label ?? '',
    title: a.title,
    desc: a.description ?? '',
    submissionType: a.submission_type,
    status: a.status,
    pinFeed: a.pin_to_feed,
    notify: a.notify_on_publish,
    submissionCount: a.submission_count,
    distinctSubmitters: a.distinct_submitter_count,
    totalMembers,
    hasOwnSubmission: a.has_own_submission,
  }
}

function buildActivityCreateBody(input: CommunityActivityCreateInput) {
  return {
    channel_kind: input.channelKind,
    module_id: input.channelKind === 'module' ? input.channelId : null,
    lesson_id: input.channelKind === 'lesson' ? input.channelId : null,
    title: input.title,
    description: input.desc || null,
    submission_type: input.submissionType,
    pin_to_feed: input.pinFeed,
    notify_on_publish: input.notify,
  }
}

function buildSubmissionBody(sub: ActivitySubmissionInput) {
  return {
    submission_type: sub.submissionType,
    body: sub.body ?? null,
    file_id: sub.fileId ?? null,
    mux_upload_id: sub.muxUploadId ?? null,
    link_url: sub.linkUrl ?? null,
  }
}
