'use client'

import {
  type CommunityPostRead,
  type FeedFilters,
  useCommunityFeed,
  useCommunitySettings,
} from '@/hooks/queries/community'
import { useCustomerCourse } from '@/hooks/queries/courses'
import { useEffect, useMemo, useState } from 'react'
import { Avatar } from './Avatar'
import { Composer } from './Composer'
import { LeftRail, type RailModule } from './LeftRail'
import { PostCard } from './PostCard'
import styles from './community.module.css'
import { IconImage, IconPin } from './icons'

type Props = {
  courseId: string
  customerSessionToken: string
}

export function CommunityFeed({ courseId, customerSessionToken }: Props) {
  const [moduleId, setModuleId] = useState<string | null>(null)
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [composerForceOpen, setComposerForceOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const filters: FeedFilters = useMemo(
    () => ({
      sort: 'recent',
      module_id: moduleId,
      lesson_id: lessonId,
      tag_id: null,
    }),
    [moduleId, lessonId],
  )

  const settingsQ = useCommunitySettings(customerSessionToken, courseId)
  const courseQ = useCustomerCourse(customerSessionToken, courseId)
  const feedQ = useCommunityFeed(customerSessionToken, courseId, filters)

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

  const railModules: RailModule[] = useMemo(
    () =>
      modules.map((m) => ({
        id: m.id,
        label: settings?.module_label_overrides?.[m.id] ?? m.title,
        count: m.lessons?.length ?? 0,
      })),
    [modules, settings?.module_label_overrides],
  )

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

  // The prompt post is featured in the hero AND stays in the feed.
  // Filtering it out broke the "Share your answer" CTA — it scrolled
  // to an element that wasn't rendered. The hero is the question + a
  // jump-link; the post card below carries the body, reactions, and
  // the comment composer. Slight duplication, working behavior.
  const feedPosts = allPosts

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
  const instructorName = courseDetail?.course.instructor_name ?? null

  const heroThumbnailUrl =
    settings?.hero_thumbnail_url ?? courseDetail?.course.thumbnail_url ?? null

  const handleLessonChipClick = (lessonIdFromChip: string) => {
    // Filter the feed to this specific lesson — the chip says
    // "re: Module 2 — Hydration", clicking it should narrow to
    // *that lesson's* posts, not all of Module 2's. The rail's
    // module filter is cleared since lesson is a strict subset.
    setLessonId(lessonIdFromChip)
    setModuleId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleModuleChange = (next: string | null) => {
    // Changing the module filter always clears any active lesson
    // filter — they're alternatives, not stackable.
    setModuleId(next)
    setLessonId(null)
  }

  // ---------- Render ----------

  return (
    <div className={styles.root}>
      <div className={styles.layout}>
        <LeftRail
          moduleId={moduleId}
          onModuleChange={handleModuleChange}
          modules={railModules}
          presence={
            instructorName || settings?.presence_blurb
              ? {
                  instructorName,
                  instructorAvatarUrl: null,
                  blurb: settings?.presence_blurb ?? null,
                }
              : null
          }
        />

        <main className={styles.main}>
          {/* Feed header */}
          <header className={styles.feedHeader}>
            <div className={styles.feedEyebrow}>
              <span className={styles.feedEyebrowDot} />
              {settings?.feed_eyebrow_override ?? courseTitle}
            </div>
            <h1 className={styles.feedTitle}>
              {settings?.feed_title_override ?? 'Community'}
            </h1>
            <p className={styles.feedSub}>
              Discussions, wins, and questions across the course. Share what
              you&apos;re working on, ask for feedback, and reply to anyone in
              the cohort.
            </p>
          </header>

          {/* Course thumbnail */}
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
                    const el = document.getElementById(`post-${promptPost.id}`)
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  Share your answer
                </button>
              </div>
            </div>
          )}

          {/* Composer — collapsed pill (click to open modal) */}
          <Composer
            token={customerSessionToken}
            courseId={courseId}
            selfName={courseDetail?.customer_name}
            modules={railModules.map(({ id, label }) => ({ id, label }))}
            defaultModuleId={moduleId}
            forceOpen={composerForceOpen}
            onOpenChange={setComposerForceOpen}
            onPosted={() => {
              setComposerForceOpen(false)
              setToast('Posted')
            }}
          />

          {/* Feed list */}
          <div className={styles.feedList}>
            {feedQ.isLoading && allPosts.length === 0 ? (
              <div className={styles.empty}>Loading…</div>
            ) : feedPosts.length === 0 && !promptPost ? (
              <div className={styles.empty}>
                {moduleId
                  ? 'No posts match this filter yet.'
                  : 'No posts yet — be the first to start a conversation.'}
              </div>
            ) : (
              feedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  token={customerSessionToken}
                  courseId={courseId}
                  selfName={courseDetail?.customer_name}
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
        </main>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}
