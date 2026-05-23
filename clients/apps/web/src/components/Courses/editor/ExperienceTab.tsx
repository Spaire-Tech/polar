'use client'

// ExperienceTab — creator-side dashboard surface for the Phase 1 v0.1
// submission loop.
//
// v0.1 ships the "Challenges" view only: list AI-generated /
// creator-edited challenges, edit title + prompt inline. The
// "Submissions inbox" view ships next.
//
// Data layer: small inline hooks against the existing creator
// endpoints (/v1/courses/{id}/challenges). No SDK regen needed; same
// fetch helper the rest of the courses hooks use.

import { CourseRead } from '@/hooks/queries/courses'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useState } from 'react'

type ChallengeRead = {
  id: string
  course_id: string
  module_id: string
  position: number
  title: string
  prompt: string
  accepts_media: boolean
  accepts_video: boolean
  accepts_text: boolean
  due_after_days: number | null
  published: boolean
  ai_generated: boolean
  created_at: string
  modified_at: string | null
  submission_count: number
}

type ChallengeUpdate = {
  title?: string
  prompt?: string
  accepts_media?: boolean
  accepts_video?: boolean
  accepts_text?: boolean
  due_after_days?: number | null
  published?: boolean
}

// Direct fetch — the @spaire/client SDK doesn't include the new
// challenge endpoints until the next codegen pass. Same shape as the
// existing courseApiFetch helper in hooks/queries/courses.ts.
async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

function useCourseChallenges(courseId: string) {
  return useQuery<ChallengeRead[]>({
    queryKey: ['course-challenges', courseId],
    queryFn: () => fetchJson(`/v1/courses/${courseId}/challenges`),
    enabled: !!courseId,
  })
}

function useUpdateChallenge(courseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      challengeId,
      patch,
    }: {
      challengeId: string
      patch: ChallengeUpdate
    }) =>
      fetchJson<ChallengeRead>(`/v1/courses/challenges/${challengeId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-challenges', courseId] })
    },
  })
}

// ── Submission inbox hooks ──────────────────────────────────────────────

type ReactionRead = {
  id: string
  actor_type: 'creator' | 'student'
  actor_user_id: string
  emoji: string
}

type CreatorSubmissionRead = {
  id: string
  challenge_id: string
  course_id: string
  enrollment_id: string
  status: 'draft' | 'submitted' | 'hidden'
  submitted_at: string | null
  caption: string
  media: Array<{ id: string; kind: string; url: string | null }>
  reactions: ReactionRead[]
  author: { display_name: string; avatar_url: string | null }
  challenge_title: string | null
  created_at: string
  modified_at: string | null
}

function useCourseSubmissions(courseId: string) {
  return useQuery<CreatorSubmissionRead[]>({
    queryKey: ['course-submissions', courseId],
    queryFn: () => fetchJson(`/v1/courses/${courseId}/submissions`),
    enabled: !!courseId,
  })
}

function useSetReaction(courseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      submissionId,
      emoji,
    }: {
      submissionId: string
      emoji: string
    }) =>
      fetchJson<ReactionRead>(
        `/v1/courses/submissions/${submissionId}/reaction`,
        { method: 'PUT', body: JSON.stringify({ emoji }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-submissions', courseId] })
    },
  })
}

function useClearReaction(courseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (submissionId: string) =>
      fetchJson<void>(
        `/v1/courses/submissions/${submissionId}/reaction`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-submissions', courseId] })
    },
  })
}

function useSetVisibility(courseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      submissionId,
      hidden,
    }: {
      submissionId: string
      hidden: boolean
    }) =>
      fetchJson(
        `/v1/courses/submissions/${submissionId}/visibility`,
        { method: 'PATCH', body: JSON.stringify({ hidden }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-submissions', courseId] })
    },
  })
}

type ExperienceView = 'challenges' | 'submissions'

export function ExperienceTab({ course }: { course: CourseRead }) {
  const [view, setView] = useState<ExperienceView>('challenges')
  const challengesQ = useCourseChallenges(course.id)
  const challenges = challengesQ.data ?? []
  const submissionsQ = useCourseSubmissions(course.id)
  const submissions = submissionsQ.data ?? []

  // Order by the underlying module's position so the list reads in the
  // same order the student sees on the landing — server response is
  // already module-position-ordered via the repository statement.
  const modulesById = Object.fromEntries(
    (course.modules ?? []).map((m) => [m.id, m]),
  )

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">
          Experience
        </h2>
        <p className="text-sm text-gray-500">
          Shape what students do alongside the lessons, and react to
          what they share. The cards on the landing show the
          challenges; the inbox shows every submission as it comes in.
        </p>
      </div>

      <div className="mb-6 inline-flex rounded-full border border-gray-200 bg-white p-1 text-xs font-medium">
        <button
          type="button"
          onClick={() => setView('challenges')}
          className={
            view === 'challenges'
              ? 'rounded-full bg-gray-900 px-3 py-1.5 text-white'
              : 'rounded-full px-3 py-1.5 text-gray-600 hover:bg-gray-100'
          }
        >
          Challenges
        </button>
        <button
          type="button"
          onClick={() => setView('submissions')}
          className={
            view === 'submissions'
              ? 'rounded-full bg-gray-900 px-3 py-1.5 text-white'
              : 'rounded-full px-3 py-1.5 text-gray-600 hover:bg-gray-100'
          }
        >
          Submissions{' '}
          <span className="font-mono text-[10px] opacity-60">
            {submissions.length}
          </span>
        </button>
      </div>

      {view === 'challenges' && (
        <>
          {challengesQ.isLoading && (
            <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
          )}

          {!challengesQ.isLoading && challenges.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
              <p className="text-sm text-gray-700">
                No challenges yet for this course.
              </p>
              <p className="max-w-md text-xs text-gray-500">
                New courses generate four challenges automatically
                during the AI outline step. Older courses need them
                added by hand — the “Regenerate from outline”
                affordance lands in the next pass.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {challenges.map((c, i) => (
              <ChallengeRow
                key={`${c.id}::${c.modified_at ?? c.created_at}`}
                challenge={c}
                index={i}
                moduleTitle={modulesById[c.module_id]?.title ?? '—'}
                courseId={course.id}
              />
            ))}
          </div>
        </>
      )}

      {view === 'submissions' && (
        <SubmissionsInbox
          courseId={course.id}
          submissions={submissions}
          isLoading={submissionsQ.isLoading}
          challengesById={Object.fromEntries(
            challenges.map((c) => [c.id, c]),
          )}
        />
      )}
    </div>
  )
}

function ChallengeRow({
  challenge,
  index,
  moduleTitle,
  courseId,
}: {
  challenge: ChallengeRead
  index: number
  moduleTitle: string
  courseId: string
}) {
  // Local edit buffer — only flushed to the server when the creator
  // hits Save. Server-side changes (regenerate / cross-tab edit) reset
  // the buffer via the key prop on this component in the parent (see
  // the map's key), not via a useEffect resync — keeps the component
  // pure and skirts the set-state-in-effect anti-pattern.
  const [title, setTitle] = useState(challenge.title)
  const [prompt, setPrompt] = useState(challenge.prompt)
  const update = useUpdateChallenge(courseId)

  const dirty =
    title.trim() !== challenge.title || prompt.trim() !== challenge.prompt
  const canSave = dirty && title.trim().length > 0

  const onSave = () => {
    if (!canSave) return
    update.mutate({
      challengeId: challenge.id,
      patch: { title: title.trim(), prompt: prompt.trim() },
    })
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
          <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gray-600">
            Challenge {String(index + 1).padStart(2, '0')}
          </span>
          <span className="text-gray-400">·</span>
          <span>Module: {moduleTitle}</span>
          {challenge.ai_generated && (
            <>
              <span className="text-gray-400">·</span>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                AI suggested
              </span>
            </>
          )}
          {!challenge.published && (
            <>
              <span className="text-gray-400">·</span>
              <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] font-semibold text-yellow-700">
                Draft
              </span>
            </>
          )}
        </div>
        <div className="text-xs text-gray-400">
          {challenge.submission_count} submission
          {challenge.submission_count === 1 ? '' : 's'}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            placeholder="What should the student do?"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Prompt</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            placeholder="One or two sentences. Name what they capture and how they submit it."
          />
        </label>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        {dirty && (
          <button
            type="button"
            onClick={() => {
              setTitle(challenge.title)
              setPrompt(challenge.prompt)
            }}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100"
          >
            Discard
          </button>
        )}
        <button
          type="button"
          disabled={!canSave || update.isPending}
          onClick={onSave}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── Submissions inbox ──────────────────────────────────────────────────

const QUICK_EMOJI = ['❤️', '🔥', '👏', '🙌', '✨', '💯']

function SubmissionsInbox({
  courseId,
  submissions,
  isLoading,
  challengesById,
}: {
  courseId: string
  submissions: CreatorSubmissionRead[]
  isLoading: boolean
  challengesById: Record<string, ChallengeRead>
}) {
  if (isLoading) {
    return <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
  }
  if (submissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
        <p className="text-sm text-gray-700">No submissions yet.</p>
        <p className="max-w-md text-xs text-gray-500">
          Once enrolled students start posting their work, you’ll see
          every submission here — newest first. React with an emoji or
          hide a post if it doesn’t fit.
        </p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {submissions.map((s) => (
        <SubmissionRow
          key={s.id}
          submission={s}
          courseId={courseId}
          challengeTitle={
            challengesById[s.challenge_id]?.title ?? s.challenge_title ?? '—'
          }
        />
      ))}
    </div>
  )
}

function SubmissionRow({
  submission,
  courseId,
  challengeTitle,
}: {
  submission: CreatorSubmissionRead
  courseId: string
  challengeTitle: string
}) {
  const setReaction = useSetReaction(courseId)
  const clearReaction = useClearReaction(courseId)
  const setVisibility = useSetVisibility(courseId)
  const creatorReaction = submission.reactions.find(
    (r) => r.actor_type === 'creator',
  )
  const isHidden = submission.status === 'hidden'

  return (
    <div
      className={
        'rounded-2xl border border-gray-200 bg-white p-5' +
        (isHidden ? ' opacity-70' : '')
      }
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="text-sm font-semibold text-gray-900">
            {submission.author.display_name}
          </span>
          <span className="text-gray-400">·</span>
          <span>{challengeTitle}</span>
          <span className="text-gray-400">·</span>
          <span>
            {submission.submitted_at
              ? new Date(submission.submitted_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
              : '—'}
          </span>
          {isHidden && (
            <>
              <span className="text-gray-400">·</span>
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                Hidden
              </span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() =>
            setVisibility.mutate({
              submissionId: submission.id,
              hidden: !isHidden,
            })
          }
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100"
          disabled={setVisibility.isPending}
        >
          {isHidden ? 'Unhide' : 'Hide'}
        </button>
      </div>

      <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
        {submission.caption || (
          <em className="text-gray-400">(no caption)</em>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {QUICK_EMOJI.map((emoji) => {
          const active = creatorReaction?.emoji === emoji
          return (
            <button
              key={emoji}
              type="button"
              disabled={setReaction.isPending || clearReaction.isPending}
              onClick={() => {
                if (active) {
                  clearReaction.mutate(submission.id)
                } else {
                  setReaction.mutate({
                    submissionId: submission.id,
                    emoji,
                  })
                }
              }}
              className={
                active
                  ? 'rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-base'
                  : 'rounded-full border border-gray-200 bg-white px-3 py-1 text-base hover:border-gray-300'
              }
              title={active ? 'Remove your reaction' : `React with ${emoji}`}
            >
              {emoji}
            </button>
          )
        })}
        {creatorReaction && (
          <span className="ml-2 text-xs text-gray-500">
            You reacted with {creatorReaction.emoji}
          </span>
        )}
      </div>
    </div>
  )
}
