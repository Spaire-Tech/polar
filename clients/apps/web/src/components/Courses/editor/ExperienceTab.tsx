'use client'

// ExperienceTab — creator-side dashboard surface for the Phase 1
// submission loop. Two views, toggle at top:
//
//   Challenges — list, edit title + prompt + thumbnail per challenge,
//                regenerate via AI from the original outline data.
//   Submissions — newest-first feed of student submissions; emoji
//                react, hide / unhide, see media inline.
//
// Visual language inherits from SettingsTab: rounded-2xl card shells,
// p-6 padding, header icons in a chip, gray-900 primary actions.

import { uploadChallengeThumbnail } from '@/hooks/queries/challenges'
import { CourseRead } from '@/hooks/queries/courses'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined'
import CollectionsBookmarkOutlined from '@mui/icons-material/CollectionsBookmarkOutlined'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined'
import { experimental_useObject as useObject } from '@ai-sdk/react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { outlineSchema } from '@/components/Courses/schemas'
import { useRef, useState } from 'react'

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
  thumbnail_url: string | null
  thumbnail_object_position: string | null
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
  thumbnail_url?: string | null
  thumbnail_object_position?: string | null
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

export function ExperienceTab({
  course,
  organization,
}: {
  course: CourseRead
  organization: { slug: string; name: string }
}) {
  const [view, setView] = useState<ExperienceView>('challenges')
  const challengesQ = useCourseChallenges(course.id)
  const challenges = challengesQ.data ?? []
  const submissionsQ = useCourseSubmissions(course.id)
  const submissions = submissionsQ.data ?? []
  const updateChallenge = useUpdateChallenge(course.id)

  // Order by the underlying module's position so the list reads in the
  // same order the student sees on the landing — server response is
  // already module-position-ordered via the repository statement.
  const modulesById = Object.fromEntries(
    (course.modules ?? []).map((m) => [m.id, m]),
  )

  // Regenerate via AI: hits the existing outline route, then PATCHes
  // each existing challenge's title + prompt from the streamed result.
  // We orchestrate from the frontend (rather than a new backend route)
  // because the AI SDK lives on the Next.js side; this also lets us
  // show live progress to the creator via useObject.object as the
  // stream arrives.
  const regen = useObject({
    api: `/dashboard/${organization.slug}/courses/outline`,
    schema: outlineSchema,
    onFinish: async ({ object }) => {
      if (!object) return
      const newChallenges = object.challenges ?? []
      // Order existing challenges the same way the server does
      // (module position, then position) so the mapping by index is
      // stable across regen calls.
      const ordered = [...challenges].sort((a, b) => {
        const ma = modulesById[a.module_id]?.position ?? 0
        const mb = modulesById[b.module_id]?.position ?? 0
        if (ma !== mb) return ma - mb
        return a.position - b.position
      })
      for (let i = 0; i < ordered.length && i < newChallenges.length; i++) {
        const nc = newChallenges[i]
        if (!nc?.title) continue
        await updateChallenge.mutateAsync({
          challengeId: ordered[i].id,
          patch: { title: nc.title, prompt: nc.prompt ?? '' },
        })
      }
    },
  })

  const handleRegenerate = () => {
    if (regen.isLoading) return
    regen.submit({
      title: course.title ?? '',
      description: course.description ?? null,
      instructorName: course.instructor_name ?? null,
      instructorBio: course.instructor_bio ?? null,
      paywallEnabled: course.paywall_enabled ?? false,
      format: course.format ?? 'course',
    })
  }

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
          {/* Regenerate strip — matches the SettingsTab card-with-icon
              header pattern (rounded-2xl, p-6, icon chip on the left)
              so the Experience tab reads as a sibling of the others. */}
          <section className="mb-4 rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <AutoAwesomeOutlined sx={{ fontSize: 18 }} />
              </span>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900">
                  Regenerate from outline
                </h3>
                <p className="mt-0.5 text-sm text-gray-500">
                  Replays the outline AI on the course&apos;s current
                  title, description, and instructor bio, then
                  overwrites each challenge&apos;s title and prompt in
                  place. Thumbnails stay.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={regen.isLoading || challenges.length === 0}
                className="rounded-md bg-gray-900 px-3.5 py-[7px] text-[12px] font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {regen.isLoading ? 'Regenerating…' : 'Regenerate'}
              </button>
            </div>
          </section>

          {challengesQ.isLoading && (
            <div className="h-32 animate-pulse rounded-2xl bg-gray-100" />
          )}

          {!challengesQ.isLoading && challenges.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-gray-400 shadow-sm">
                <CollectionsBookmarkOutlined sx={{ fontSize: 20 }} />
              </span>
              <p className="text-sm font-medium text-gray-900">
                No challenges yet for this course.
              </p>
              <p className="max-w-md text-xs text-gray-500">
                New courses get four challenges automatically during the
                AI outline step. To bring them in for an existing
                course, hit Regenerate above.
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
  // the map's key), not via a useEffect resync.
  const [title, setTitle] = useState(challenge.title)
  const [prompt, setPrompt] = useState(challenge.prompt)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
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

  // Two-step thumbnail upload — same shape as the customer-side
  // submission picker but writes directly to the challenge row via
  // PATCH on success. Errors are surfaced inline so the creator sees
  // exactly why an upload failed (size cap, mime, S3 5xx).
  const onPickThumbnail = async (file: File) => {
    setUploadError(null)
    setUploading(true)
    try {
      const url = await uploadChallengeThumbnail(file)
      await update.mutateAsync({
        challengeId: challenge.id,
        patch: { thumbnail_url: url, thumbnail_object_position: null },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed.'
      setUploadError(msg)
    } finally {
      setUploading(false)
    }
  }

  const onRemoveThumbnail = () => {
    update.mutate({
      challengeId: challenge.id,
      patch: { thumbnail_url: null, thumbnail_object_position: null },
    })
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
          <CollectionsBookmarkOutlined sx={{ fontSize: 18 }} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-gray-900">
              {challenge.title || `Challenge ${index + 1}`}
            </h3>
            {challenge.ai_generated && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                AI suggested
              </span>
            )}
            {!challenge.published && (
              <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] font-semibold text-yellow-700">
                Draft
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-gray-500">
            Challenge {String(index + 1).padStart(2, '0')} · {moduleTitle}
          </p>
        </div>
        <div className="shrink-0 text-xs text-gray-400">
          {challenge.submission_count} submission
          {challenge.submission_count === 1 ? '' : 's'}
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        {/* Thumbnail picker — left rail on desktop, stacks on
            narrower viewports so the form below it gets full width. */}
        <div className="md:w-40 md:shrink-0">
          <span className="mb-1.5 block text-xs font-medium text-gray-600">
            Cover
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onPickThumbnail(f)
              e.target.value = ''
            }}
          />
          {challenge.thumbnail_url ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={challenge.thumbnail_url}
                alt=""
                className="aspect-[3/2] w-full rounded-xl border border-gray-200 object-cover"
              />
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || update.isPending}
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={onRemoveThumbnail}
                  disabled={uploading || update.isPending}
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  title="Remove cover"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || update.isPending}
              className="flex aspect-[3/2] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              <ImageOutlined sx={{ fontSize: 22 }} />
              <span className="text-[11px] font-medium">
                {uploading ? 'Uploading…' : 'Add cover'}
              </span>
            </button>
          )}
          {uploadError && (
            <p className="mt-2 text-[11px] text-red-600">{uploadError}</p>
          )}
        </div>

        {/* Title + prompt on the right. */}
        <div className="flex flex-1 flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="What should the student do?"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">Prompt</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="One or two sentences. Name what they capture and how they submit it."
            />
          </label>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
        {dirty && (
          <button
            type="button"
            onClick={() => {
              setTitle(challenge.title)
              setPrompt(challenge.prompt)
            }}
            className="rounded-md px-3 py-[7px] text-[12px] font-medium text-gray-500 hover:bg-gray-100"
          >
            Discard
          </button>
        )}
        <button
          type="button"
          disabled={!canSave || update.isPending}
          onClick={onSave}
          className="rounded-md bg-gray-900 px-3.5 py-[7px] text-[12px] font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </section>
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
    return <div className="h-32 animate-pulse rounded-2xl bg-gray-100" />
  }
  if (submissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-gray-400 shadow-sm">
          <ChatBubbleOutlineOutlined sx={{ fontSize: 20 }} />
        </span>
        <p className="text-sm font-medium text-gray-900">
          No submissions yet.
        </p>
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
    <section
      className={
        'rounded-2xl border border-gray-200 bg-white p-6' +
        (isHidden ? ' opacity-70' : '')
      }
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-xs text-gray-500">
          <span className="truncate text-sm font-semibold text-gray-900">
            {submission.author.display_name}
          </span>
          <span className="text-gray-300">·</span>
          <span className="truncate">{challengeTitle}</span>
          <span className="text-gray-300">·</span>
          <span className="shrink-0">
            {submission.submitted_at
              ? new Date(submission.submitted_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
              : '—'}
          </span>
          {isHidden && (
            <span className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
              <VisibilityOffOutlined sx={{ fontSize: 11 }} /> Hidden
            </span>
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
          className="shrink-0 rounded-md border border-gray-200 bg-white px-3 py-[7px] text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          disabled={setVisibility.isPending}
        >
          {isHidden ? 'Unhide' : 'Hide'}
        </button>
      </div>

      {(() => {
        const image = submission.media.find(
          (m) => m.kind === 'image' && m.url,
        )
        if (!image?.url) return null
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt=""
            className="mb-3 block max-h-96 w-full rounded-lg border border-gray-200 object-cover"
          />
        )
      })()}
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
    </section>
  )
}
