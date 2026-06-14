'use client'

// WatchHome — the customer portal's course page, built on the Spaire
// Originals v2 design (now-playing marquee hero + catalog lesson rail).
// All logic is real:
//
//   completion   → server (data.progress.completed + mark-complete)
//   position     → per-device (localStorage spaire_watch:{courseId}) —
//                  drives the Netflix-style bar under started lessons,
//                  Resume labels, and the player's start position
//   playback     → mints a signed playback URL per play (quota-enforced),
//                  then opens the v2 WatchPlayer
//   comments     → real lesson comments API (enrolled customers)
//   bookmarks    → localStorage in the BookmarksPage's SavedBookmark shape
//   overview     → lesson.content overview/takeaways/attachments
//   theme        → the course's landing theme (dark landing → dark page)

import {
  useLessonComments,
  useCreateLessonComment,
  useLikeLessonComment,
  useDeleteLessonComment,
  usePinLessonComment,
  useInstructorHeartComment,
  useMintLessonPlaybackUrl,
  type CustomerCourseDetail,
} from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Glyph, SF, fmtTime } from './WatchGlyphs'
import { WatchPageStyles } from './WatchPageStyles'
import { WatchPlayer } from './WatchPlayer'
import {
  CommentsPanel,
  OverviewSheet,
  type WatchComment,
  type WatchOverview,
} from './WatchSheets'

export type WatchLessonData = {
  id: string
  title: string
  description?: string | null
  position: number
  duration_seconds?: number | null
  thumbnail_url?: string | null
  thumbnail_object_position?: string | null
  mux_playback_id?: string | null
  mux_status?: string | null
  completed: boolean
  locked?: boolean
  content_type: string
  content: Record<string, unknown> | null
  comments_mode?: 'visible' | 'hidden' | 'locked'
}

/* ── per-device partial-position store (shared key with the landing) ── */
type WatchState = { p: Record<string, number>; done: string[] }
function readWatchState(courseId: string): WatchState {
  try {
    const raw = window.localStorage.getItem(`spaire_watch:${courseId}`)
    if (raw) return JSON.parse(raw) as WatchState
  } catch {
    /* ignore */
  }
  return { p: {}, done: [] }
}
function writeWatchState(courseId: string, s: WatchState) {
  try {
    window.localStorage.setItem(`spaire_watch:${courseId}`, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

/* ── bookmarks — EXACTLY the shape BookmarksPage reads ── */
type SavedBookmark = {
  lessonId: string
  courseId: string
  organizationSlug: string
  lessonTitle: string
  courseTitle: string | null
  thumbnailUrl: string | null
  durationSeconds: number | null
  savedAt: string
  storageKey: string
}
const bookmarkKey = (lessonId: string) => `polar:bookmark:${lessonId}`
function readBookmarks(courseId: string): Set<string> {
  const ids = new Set<string>()
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key?.startsWith('polar:bookmark:')) continue
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const b = JSON.parse(raw) as SavedBookmark
      if (b.courseId === courseId) ids.add(b.lessonId)
    }
  } catch {
    /* ignore */
  }
  return ids
}

function relTime(iso: string): string {
  const then = new Date(iso).getTime()
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

function fmtRuntime(secs: number): string {
  if (secs <= 0) return '0 min'
  const h = Math.floor(secs / 3600)
  const m = Math.round((secs % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m} min`
}

function lessonOverview(l: WatchLessonData): WatchOverview {
  const c = (l.content ?? {}) as {
    overview?: string
    takeaways?: string[]
    attachments?: {
      id: string
      filename: string
      url: string
      size: number
      content_type: string
    }[]
  }
  const body = c.overview
    ? c.overview.split(/\n{2,}/).filter(Boolean)
    : l.description
      ? [l.description]
      : []
  return {
    body,
    learn: (c.takeaways ?? []).filter(Boolean),
    resources: (c.attachments ?? []).map((a) => ({
      name: a.filename,
      type: a.content_type?.includes('pdf')
        ? 'pdf'
        : a.content_type?.startsWith('audio')
          ? 'audio'
          : a.content_type?.startsWith('video')
            ? 'video'
            : 'pdf',
      meta: `${(a.content_type?.split('/').pop() ?? 'file').toUpperCase()} · ${
        a.size > 1048576
          ? `${(a.size / 1048576).toFixed(1)} MB`
          : `${Math.max(1, Math.round(a.size / 1024))} KB`
      }`,
      url: a.url,
    })),
  }
}

export function WatchHome({
  organization,
  data,
  lessons,
  token,
  onOpenTextLesson,
  onMarkComplete,
}: {
  organization: schemas['CustomerOrganization']
  data: CustomerCourseDetail
  lessons: WatchLessonData[]
  token: string
  onOpenTextLesson: (lessonId: string) => void
  onMarkComplete: (lessonId: string) => void
}) {
  const course = data.course
  const courseId = course.id
  const dark = course.landing_overrides?.theme_mode === 'dark'
  const isEpisodic = course.format === 'series'
  const unitCap = isEpisodic ? 'Episode' : 'Lesson'
  // Honor the hero the creator chose at onboarding — the public landing
  // already does this, the portal used to hard-render the marquee. 'cover'
  // is the full-bleed lower-left layout; 'marquee' is the frosted band.
  const heroVariant: 'marquee' | 'cover' =
    course.hero_variant === 'marquee' ? 'marquee' : 'cover'
  // Render whichever lesson-card the creator chose at onboarding, same as
  // the landing — Spotlight (text over the image) or Catalog (text under).
  const cardVariant: 'spotlight' | 'catalog' =
    course.lesson_card_variant === 'spotlight' ? 'spotlight' : 'catalog'

  const completedIds = useMemo(
    () => new Set(Object.keys(data.progress?.completed ?? {})),
    [data.progress],
  )

  /* ── per-device positions + bookmarks ── */
  const [watchState, setWatchState] = useState<WatchState>({ p: {}, done: [] })
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set())
  useEffect(() => {
    setWatchState(readWatchState(courseId))
    setBookmarks(readBookmarks(courseId))
  }, [courseId])

  const fractionOf = useCallback(
    (l: WatchLessonData): number | null => {
      if (completedIds.has(l.id) || l.completed) return null
      const f = watchState.p[l.id]
      return f != null && f > 0.01 && f < 0.99 ? f : null
    },
    [completedIds, watchState],
  )

  const statusOf = useCallback(
    (l: WatchLessonData): 'watched' | 'progress' | 'unwatched' => {
      if (completedIds.has(l.id) || l.completed) return 'watched'
      return fractionOf(l) != null ? 'progress' : 'unwatched'
    },
    [completedIds, fractionOf],
  )

  /* ── focus: the lesson the hero shows — first unfinished by default ── */
  const defaultFocus = useMemo(() => {
    const inProgress = lessons.findIndex(
      (l) => statusOf(l) === 'progress' && !l.locked,
    )
    if (inProgress >= 0) return inProgress
    const firstUnwatched = lessons.findIndex(
      (l) => statusOf(l) === 'unwatched' && !l.locked,
    )
    return firstUnwatched >= 0 ? firstUnwatched : 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons.length])
  const [focus, setFocus] = useState(defaultFocus)
  useEffect(() => setFocus(defaultFocus), [defaultFocus])

  const ep = lessons[Math.min(focus, Math.max(0, lessons.length - 1))]
  const status = ep ? statusOf(ep) : 'unwatched'
  const epFraction = ep ? fractionOf(ep) : null

  /* ── toast ── */
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((m: string) => {
    setToastMsg(m)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(null), 2400)
  }, [])

  /* ── bookmarks ── */
  const toggleBookmark = useCallback(
    (l: WatchLessonData) => {
      setBookmarks((prev) => {
        const next = new Set(prev)
        try {
          if (next.has(l.id)) {
            next.delete(l.id)
            window.localStorage.removeItem(bookmarkKey(l.id))
            showToast('Bookmark removed')
          } else {
            next.add(l.id)
            const b: SavedBookmark = {
              lessonId: l.id,
              courseId,
              organizationSlug: organization.slug,
              lessonTitle: l.title,
              courseTitle: course.title,
              thumbnailUrl: l.thumbnail_url ?? null,
              durationSeconds: l.duration_seconds ?? null,
              savedAt: new Date().toISOString(),
              storageKey: bookmarkKey(l.id),
            }
            window.localStorage.setItem(bookmarkKey(l.id), JSON.stringify(b))
            showToast('Lesson bookmarked')
          }
        } catch {
          /* ignore quota */
        }
        return next
      })
    },
    [courseId, organization.slug, course.title, showToast],
  )

  /* ── comments (focused lesson) ── */
  const { data: rawComments } = useLessonComments(token, courseId, ep?.id ?? '')
  const createComment = useCreateLessonComment(token, courseId, ep?.id ?? '')
  const likeComment = useLikeLessonComment(token, courseId, ep?.id ?? '')
  const deleteComment = useDeleteLessonComment(token, courseId, ep?.id ?? '')
  const pinComment = usePinLessonComment(token, courseId, ep?.id ?? '')
  const heartComment = useInstructorHeartComment(token, courseId, ep?.id ?? '')
  // Build the threaded list: root comments with their replies nested, the
  // pinned comment hoisted to the top (YouTube semantics). Replies to
  // soft-deleted parents fall back to root level so they stay reachable.
  const comments: WatchComment[] = useMemo(() => {
    const mapOne = (c: NonNullable<typeof rawComments>[number]): WatchComment => ({
      id: c.id,
      name: c.author?.name?.trim() || 'Student',
      avatarUrl: c.author?.avatar_url ?? null,
      time: relTime(c.created_at),
      text: c.content,
      likes: c.likes ?? 0,
      liked: c.liked ?? false,
      isOwn: c.is_own,
      isInstructor: c.author?.is_instructor ?? false,
      pinned: c.pinned ?? false,
      instructorHearted: c.instructor_hearted ?? false,
      replies: [],
    })
    const live = (rawComments ?? []).filter((c) => !c.deleted)
    const roots = new Map<string, WatchComment>()
    for (const c of live) {
      if (!c.parent_id) roots.set(c.id, mapOne(c))
    }
    const orphans: WatchComment[] = []
    for (const c of live) {
      if (!c.parent_id) continue
      const parent = roots.get(c.parent_id)
      if (parent) parent.replies!.push(mapOne(c))
      else orphans.push(mapOne(c))
    }
    const list = [...roots.values(), ...orphans]
    list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
    return list
  }, [rawComments])
  const viewerIsInstructor = useMemo(
    () => (rawComments ?? []).some((c) => c.viewer_is_instructor),
    [rawComments],
  )
  const commentsVisible = (ep?.comments_mode ?? 'visible') === 'visible'
  const [showComments, setShowComments] = useState(false)
  const postComment = useCallback(
    (text: string, parentId?: string | null) => {
      createComment.mutate(
        { content: text, parent_id: parentId ?? null },
        { onError: () => showToast('Could not post comment') },
      )
    },
    [createComment, showToast],
  )
  // One like per customer (the mutation is idempotent server-side); guard
  // against a second in-flight toggle while the first resolves.
  const onLikeComment = useCallback(
    (id: string) => {
      if (likeComment.isPending) return
      likeComment.mutate(id)
    },
    [likeComment],
  )
  // Moderation + own-comment delete. Pin and the creator heart are
  // instructor-only (the buttons only render when viewerIsInstructor, and
  // the server enforces it regardless).
  const onDeleteComment = useCallback(
    (id: string) => {
      deleteComment.mutate(id, {
        onError: () => showToast('Could not delete comment'),
      })
    },
    [deleteComment, showToast],
  )
  const onPinComment = useCallback(
    (id: string) => {
      if (pinComment.isPending) return
      pinComment.mutate(id, {
        onError: () => showToast('Could not pin comment'),
      })
    },
    [pinComment, showToast],
  )
  const onHeartComment = useCallback(
    (id: string) => {
      if (heartComment.isPending) return
      heartComment.mutate(id, {
        onError: () => showToast('Could not heart comment'),
      })
    },
    [heartComment, showToast],
  )

  /* ── overview sheet ── */
  const [overviewFor, setOverviewFor] = useState<WatchLessonData | null>(null)

  /* ── playback — mint a signed URL per play, then open the player ── */
  const mintUrl = useMintLessonPlaybackUrl(token, courseId)
  const [playing, setPlaying] = useState<{
    lesson: WatchLessonData
    playbackUrl: string | null
    playbackId: string | null
    startSec: number
  } | null>(null)

  const playLesson = useCallback(
    async (l: WatchLessonData) => {
      if (l.locked) {
        showToast('This lesson unlocks later')
        return
      }
      if (l.content_type !== 'video') {
        // Text / quiz lessons use the reading view.
        onOpenTextLesson(l.id)
        return
      }
      if (!l.mux_playback_id) {
        // A published video lesson whose video isn't playable yet. The old
        // behavior routed to the legacy lesson player, which dead-ended —
        // say what's actually happening instead.
        showToast(
          l.mux_status
            ? 'The video is still processing — check back in a few minutes'
            : 'No video has been uploaded for this lesson yet',
        )
        return
      }
      const frac = fractionOf(l) ?? 0
      const startSec = frac * (l.duration_seconds ?? 0)
      try {
        const minted = await mintUrl.mutateAsync(l.id)
        setPlaying({
          lesson: l,
          playbackUrl: minted.mux_playback_url ?? null,
          playbackId: minted.mux_playback_id ?? l.mux_playback_id,
          startSec,
        })
      } catch {
        showToast('Could not start playback')
      }
    },
    [fractionOf, mintUrl, onOpenTextLesson, showToast],
  )

  const onPlayerProgress = useCallback(
    (lessonId: string, frac: number) => {
      setWatchState((s) => {
        const next = { ...s, p: { ...s.p, [lessonId]: frac } }
        writeWatchState(courseId, next)
        return next
      })
    },
    [courseId],
  )
  const onPlayerComplete = useCallback(
    (lessonId: string) => {
      setWatchState((s) => {
        const p = { ...s.p }
        delete p[lessonId]
        const next = { ...s, p }
        writeWatchState(courseId, next)
        return next
      })
      onMarkComplete(lessonId)
    },
    [courseId, onMarkComplete],
  )

  /* ── rail arrows ── */
  const stripRef = useRef<HTMLDivElement | null>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(true)
  const updateArrows = useCallback(() => {
    const s = stripRef.current
    if (!s) return
    setCanPrev(s.scrollLeft > 2)
    setCanNext(s.scrollLeft < s.scrollWidth - s.clientWidth - 2)
  }, [])
  useEffect(() => {
    updateArrows()
    window.addEventListener('resize', updateArrows)
    return () => window.removeEventListener('resize', updateArrows)
  }, [updateArrows])
  const scrollBy = (dir: number) =>
    stripRef.current?.scrollBy({
      left: dir * stripRef.current.clientWidth,
      behavior: 'smooth',
    })

  if (!ep) {
    return (
      <div className={`sow${dark ? ' dark' : ''}`}>
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            minHeight: '60vh',
            color: 'var(--text-2)',
            fontSize: 14,
          }}
        >
          No lessons yet.
        </div>
        <WatchPageStyles />
      </div>
    )
  }

  const lessonsDone = lessons.filter((l) => statusOf(l) === 'watched').length
  const totalRuntime = lessons.reduce(
    (s, l) => s + (l.duration_seconds ?? 0),
    0,
  )
  const playLabel =
    status === 'watched' ? 'Replay' : status === 'progress' ? 'Resume' : 'Play'
  const isBookmarked = bookmarks.has(ep.id)
  const epN = focus + 1

  const kicker =
    status === 'watched' ? (
      <span>
        Watched · {unitCap} {epN} of {lessons.length}
      </span>
    ) : status === 'progress' ? (
      <>
        <span className="nowbars">
          <i />
          <i />
          <i />
        </span>
        <span>
          Continue · {unitCap} {epN} of {lessons.length}
        </span>
      </>
    ) : (
      <span>
        {unitCap} {epN} of {lessons.length}
      </span>
    )

  return (
    <div className={`sow${dark ? ' dark' : ''}`}>
      {/* ════════ now-playing hero ════════ */}
      <header className={`panel${heroVariant === 'cover' ? ' cover' : ''}`}>
        {lessons.map((l, i) => {
          // The hero shows the lesson's own cover when it has one, else the
          // course cover. Honor whichever image's saved focal point
          // (thumbnail_object_position) so the framing matches what the
          // creator set in "Reposition in portal" — falling back to the
          // template default (center 24%) only when nothing was saved.
          const usingLessonImage = !!l.thumbnail_url
          const heroImage = l.thumbnail_url ?? course.thumbnail_url
          const heroPos = usingLessonImage
            ? l.thumbnail_object_position
            : course.thumbnail_object_position
          return (
            <div
              key={l.id}
              className={`hero-layer${i === focus ? ' show' : ''}${
                heroImage ? '' : ' ph'
              }`}
              style={
                heroImage
                  ? {
                      backgroundImage: `url("${heroImage}")`,
                      ...(heroPos ? { backgroundPosition: heroPos } : null),
                    }
                  : undefined
              }
            />
          )
        })}
        <div className="panel-scrim" />
        <div className="panel-grain" />

        <div className="panel-brand">
          <span className="dot" />
          Spaire Originals
        </div>
        <div className="top-controls">
          <span className="member-chip">
            <Glyph d={SF.check} size={13} stroke={2.6} />
            Enrolled
          </span>
        </div>

        {heroVariant === 'cover' ? (
          /* ════ cover hero — ported 1:1 from the public landing's cover hero
             (.hero in "Course Page Empty State.html"): lower-left meta/title/
             desc stack over the full-bleed still, with the portal's playback
             buttons + progress (same set as the marquee band). ════ */
          <div className="hero-content">
            <div className="hero-meta">
              <span className={`badge${status === 'watched' ? ' done' : ''}`}>
                {status === 'watched'
                  ? 'Watched'
                  : status === 'progress'
                    ? 'Continue'
                    : `${unitCap} ${epN}`}
              </span>
              <span className="meta-line">
                <span>{course.title}</span>
                <span className="sep">·</span>
                <span>
                  {lessons.length} {unitCap.toLowerCase()}
                  {lessons.length === 1 ? '' : 's'}
                </span>
                <span className="sep">·</span>
                <span>{fmtRuntime(totalRuntime)}</span>
                {ep.duration_seconds ? (
                  <>
                    <span className="sep">·</span>
                    <span>{fmtTime(ep.duration_seconds)}</span>
                  </>
                ) : null}
              </span>
            </div>
            <h1 className="hero-title">{ep.title}</h1>
            {ep.description ? (
              <p className="hero-desc">{ep.description}</p>
            ) : null}
            <div className="hero-actions">
              <button
                className="abtn play"
                type="button"
                onClick={() => void playLesson(ep)}
              >
                <span className="play">
                  <Glyph d={SF.play} size={15} fill="currentColor" />
                </span>{' '}
                {playLabel} {unitCap} {epN}
              </button>
              <button
                className="abtn glass"
                type="button"
                onClick={() => setOverviewFor(ep)}
              >
                <Glyph d={SF.doc} size={18} stroke={1.9} /> Overview
              </button>
              <div className="icon-row">
                <button
                  className={`icon-glass${isBookmarked ? ' on' : ''}`}
                  type="button"
                  aria-label="Bookmark lesson"
                  onClick={() => toggleBookmark(ep)}
                >
                  <Glyph
                    d={SF.bookmark}
                    size={19}
                    fill={isBookmarked ? 'currentColor' : 'none'}
                    stroke={isBookmarked ? 0 : 2}
                  />
                </button>
                {commentsVisible && (
                  <button
                    className="icon-glass"
                    type="button"
                    aria-label="Discussion"
                    onClick={() => setShowComments(true)}
                  >
                    <Glyph d={SF.bubble} size={19} stroke={2} />
                    {comments.length > 0 && (
                      <span className="icon-badge">{comments.length}</span>
                    )}
                  </button>
                )}
              </div>
            </div>
            <div className="cv-progress">
              <div className="cv-pt">
                <span>Your progress</span>
                <span>
                  {lessonsDone} of {lessons.length}
                </span>
              </div>
              <div className="cv-pbar">
                <i
                  style={{
                    width: `${
                      lessons.length
                        ? Math.round((lessonsDone / lessons.length) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <>
        <div className="panel-title">
          <div className={`pt-kicker${status === 'watched' ? ' done' : ''}`}>
            {kicker}
          </div>
          <h1 className="pt-h">{ep.title}</h1>
        </div>

        <div className="band">
          <div className="band-actions">
            <button
              className="abtn play"
              type="button"
              onClick={() => void playLesson(ep)}
            >
              <Glyph d={SF.play} size={17} fill="currentColor" /> {playLabel}{' '}
              {unitCap} {epN}
            </button>
            <button
              className="abtn glass"
              type="button"
              onClick={() => setOverviewFor(ep)}
            >
              <Glyph d={SF.doc} size={18} stroke={1.9} /> Overview
            </button>
            <div className="icon-row">
              <button
                className={`icon-glass${isBookmarked ? ' on' : ''}`}
                type="button"
                aria-label="Bookmark lesson"
                onClick={() => toggleBookmark(ep)}
              >
                <Glyph
                  d={SF.bookmark}
                  size={19}
                  fill={isBookmarked ? 'currentColor' : 'none'}
                  stroke={isBookmarked ? 0 : 2}
                />
              </button>
              {commentsVisible && (
                <button
                  className="icon-glass"
                  type="button"
                  aria-label="Discussion"
                  onClick={() => setShowComments(true)}
                >
                  <Glyph d={SF.bubble} size={19} stroke={2} />
                  {comments.length > 0 && (
                    <span className="icon-badge">{comments.length}</span>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="band-desc">
            <p className="bd-text">{ep.description ?? ''}</p>
            <div className="bd-meta">
              {course.title}&nbsp;&nbsp;·&nbsp;&nbsp;{lessons.length}{' '}
              {unitCap.toLowerCase()}
              {lessons.length === 1 ? '' : 's'}&nbsp;&nbsp;·&nbsp;&nbsp;
              {fmtRuntime(totalRuntime)}
              {ep.duration_seconds
                ? `  ·  ${fmtTime(ep.duration_seconds)}`
                : ''}
            </div>
          </div>

          <div className="band-cast">
            <div className="bc-row">
              {organization.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="bc-av"
                  src={organization.avatar_url}
                  alt={course.instructor_name ?? organization.name}
                />
              ) : (
                <div className="bc-av" />
              )}
              <div>
                <div className="bc-k">Instructor</div>
                <div className="bc-v">
                  {course.instructor_name ?? organization.name}
                </div>
              </div>
            </div>
            {course.instructor_bio && (
              <div className="bc-sub">{course.instructor_bio}</div>
            )}
            <div className="bc-progress">
              <div className="bc-pt">
                <span>Your progress</span>
                <span>
                  {lessonsDone} of {lessons.length}
                </span>
              </div>
              <div className="bc-pbar">
                <i
                  style={{
                    width: `${
                      lessons.length
                        ? Math.round((lessonsDone / lessons.length) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
          </>
        )}
      </header>

      {/* ════════ lesson rail ════════ */}
      <section className="lessons">
        <div className="row-head">
          <span className="rh">{unitCap}s</span>
          <span className="rh-meta">
            {lessons.length} {unitCap.toLowerCase()}
            {lessons.length === 1 ? '' : 's'}
            {lessonsDone > 0 ? ` · ${lessonsDone} watched` : ''}
          </span>
        </div>
        <div className="strip-wrap" onMouseEnter={updateArrows}>
          <button
            className={`arrow prev${canPrev ? ' show' : ''}`}
            type="button"
            aria-label="Previous"
            onClick={() => scrollBy(-1)}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 5l-6.5 7 6.5 7" />
            </svg>
          </button>
          <button
            className={`arrow next${canNext ? ' show' : ''}`}
            type="button"
            aria-label="Next"
            onClick={() => scrollBy(1)}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 5l6.5 7-6.5 7" />
            </svg>
          </button>
          <div className="grid" ref={stripRef} onScroll={updateArrows}>
            {lessons.map((l, i) => {
              const st = statusOf(l)
              const frac = fractionOf(l)
              const imgStyle =
                l.thumbnail_url || course.thumbnail_url
                  ? {
                      backgroundImage: `url("${
                        l.thumbnail_url ?? course.thumbnail_url
                      }")`,
                    }
                  : undefined
              const overlays = (
                <>
                  {l.locked ? (
                    <div className="lc-state lc-lock">
                      <Glyph d={SF.locksm} size={11} stroke={2.1} />
                    </div>
                  ) : st === 'watched' ? (
                    <div className="lc-state lc-done">
                      <Glyph d={SF.check} size={11} stroke={2.8} />
                    </div>
                  ) : null}
                  {l.duration_seconds ? (
                    <div className="lc-dur">
                      <Glyph d={SF.play2} size={11} fill="currentColor" stroke={0} />
                      <span>{fmtTime(l.duration_seconds)}</span>
                    </div>
                  ) : null}
                  {frac != null && (
                    <div className="lc-progbar">
                      <i style={{ width: `${frac * 100}%` }} />
                    </div>
                  )}
                  <div className="lc-play">
                    <div className="lc-play-btn">
                      <Glyph d={SF.play} size={18} fill="currentColor" />
                    </div>
                  </div>
                  <button
                    className="lc-ovbtn"
                    type="button"
                    aria-label="Lesson overview"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFocus(i)
                      setOverviewFor(l)
                    }}
                  >
                    <Glyph d={SF.info} size={17} stroke={1.9} />
                  </button>
                </>
              )
              const meta =
                st === 'watched' ? (
                  <span className="ok">
                    <Glyph d={SF.check} size={13} stroke={2.6} />
                    Watched
                  </span>
                ) : st === 'progress' ? (
                  <span>Continue · {Math.round((frac ?? 0) * 100)}%</span>
                ) : (
                  <>
                    <Glyph d={SF.play2} size={12} fill="currentColor" stroke={0} />
                    <span>
                      {l.duration_seconds ? fmtTime(l.duration_seconds) : '—'}
                    </span>
                  </>
                )

              if (cardVariant === 'spotlight') {
                return (
                  <div
                    className="lc-spot"
                    key={l.id}
                    onMouseEnter={() => setFocus(i)}
                    onClick={() => void playLesson(l)}
                  >
                    <div className={`spot-card${imgStyle ? '' : ' ph'}`}>
                      <div className="img" style={imgStyle} />
                      <div className="spot-shade" />
                      {overlays}
                      <div className="spot-info">
                        <div className="lc-num">
                          {unitCap} {i + 1}
                          {bookmarks.has(l.id) ? ' · Saved' : ''}
                        </div>
                        <div className="spot-title">{l.title}</div>
                        {l.description && (
                          <div className="spot-desc">{l.description}</div>
                        )}
                        <div className="lc-meta">{meta}</div>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  className="lc-catalog"
                  key={l.id}
                  onMouseEnter={() => setFocus(i)}
                  onClick={() => void playLesson(l)}
                >
                  <div className="lc-card">
                    <div className="lc-thumb">
                      <div className={`img${imgStyle ? '' : ' ph'}`} style={imgStyle} />
                      {overlays}
                    </div>
                    <div className="lc-info">
                      <div className="lc-num">
                        {unitCap} {i + 1}
                        {bookmarks.has(l.id) ? ' · Saved' : ''}
                      </div>
                      <div className="lc-title">{l.title}</div>
                      <div className="lc-desc">{l.description ?? ''}</div>
                      <div className="lc-meta">{meta}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {toastMsg && (
        <div className="toast">
          <span className="tk">
            <Glyph d={SF.check} size={15} stroke={2.6} />
          </span>
          {toastMsg}
        </div>
      )}

      {/* ════════ overlays ════════ */}
      {overviewFor && (
        <OverviewSheet
          lessonN={lessons.findIndex((l) => l.id === overviewFor.id) + 1}
          title={overviewFor.title}
          durLabel={
            overviewFor.duration_seconds
              ? fmtTime(overviewFor.duration_seconds)
              : null
          }
          instructorName={course.instructor_name ?? organization.name}
          imageUrl={overviewFor.thumbnail_url ?? course.thumbnail_url}
          dark={dark}
          overview={lessonOverview(overviewFor)}
          onClose={() => setOverviewFor(null)}
          onPlay={() => {
            const l = overviewFor
            setOverviewFor(null)
            void playLesson(l)
          }}
        />
      )}

      {showComments && !playing && (
        <CommentsPanel
          lessonLabel={`${unitCap} ${epN} · ${ep.title}`}
          comments={comments}
          viewerAvatarUrl={data.customer_avatar_url}
          dark={dark}
          canModerate={viewerIsInstructor}
          instructorName={course.instructor_name ?? organization.name}
          onClose={() => setShowComments(false)}
          onLike={onLikeComment}
          onPost={commentsVisible ? postComment : undefined}
          onDelete={onDeleteComment}
          onPin={viewerIsInstructor ? onPinComment : undefined}
          onHeart={viewerIsInstructor ? onHeartComment : undefined}
        />
      )}

      {playing && (
        <WatchPlayer
          lesson={{
            n: lessons.findIndex((l) => l.id === playing.lesson.id) + 1,
            title: playing.lesson.title,
            description: playing.lesson.description,
            thumbnailUrl: playing.lesson.thumbnail_url,
            muxPlaybackId: playing.playbackId,
            playbackUrl: playing.playbackUrl,
          }}
          courseTitle={course.title ?? ''}
          instructorName={course.instructor_name ?? organization.name}
          startSec={playing.startSec}
          comments={commentsVisible ? comments : undefined}
          canModerateComments={viewerIsInstructor}
          onPostComment={commentsVisible ? postComment : undefined}
          onLikeComment={onLikeComment}
          onDeleteComment={onDeleteComment}
          onPinComment={viewerIsInstructor ? onPinComment : undefined}
          onHeartComment={viewerIsInstructor ? onHeartComment : undefined}
          onClose={() => setPlaying(null)}
          onProgress={(f) => onPlayerProgress(playing.lesson.id, f)}
          onComplete={() => onPlayerComplete(playing.lesson.id)}
        />
      )}

      <WatchPageStyles />
    </div>
  )
}

export default WatchHome
