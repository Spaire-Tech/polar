'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './community.module.css'
import {
  IconCamera,
  IconChat,
  IconImage,
  IconPaperclip,
  IconPlus,
  IconSend,
  IconVideo,
  IconX,
} from './icons'

// Activities are the per-channel hands-on prompts the instructor opens
// for the cohort ("upload a photo of your bake", "record a 1-min demo"
// etc.). Persisted via /community/{course_id}/activities — host creates
// + closes; students submit + view; submission media reuses the
// existing community post image + Mux video pipeline.

export type ActivityChannel = {
  id: string
  // What the form's "Channel" select shows for this entry. For series
  // courses this is an episode title, for course format it's a module
  // title.
  label: string
}

export type SubmissionType = 'photo' | 'video' | 'text' | 'link'
export type ActivityStatus = 'open' | 'closed'

const TYPE_LABEL: Record<SubmissionType, string> = {
  photo: 'Photo + Text',
  video: 'Video',
  text: 'Write-up',
  link: 'Link',
}

export type CommunityActivity = {
  id: string
  channelKind: 'module' | 'lesson'
  channelId: string | null
  channelLabel: string
  title: string
  desc: string
  submissionType: SubmissionType
  status: ActivityStatus
  pinFeed: boolean
  notify: boolean
  submissionCount: number
  distinctSubmitters: number
  totalMembers: number
  hasOwnSubmission: boolean
}

// Modal payload — what the host submits when publishing an activity.
export type CommunityActivityCreateInput = {
  channelKind: 'module' | 'lesson'
  channelId: string
  channelLabel: string
  title: string
  desc: string
  submissionType: SubmissionType
  pinFeed: boolean
  notify: boolean
}

// Submission payload — what a student submits to an activity.
export type ActivitySubmissionInput = {
  submissionType: SubmissionType
  body?: string
  fileId?: string
  muxUploadId?: string
  linkUrl?: string
}

type Props = {
  // Label shown next to the section header — "Episodes" or "Modules"
  // depending on course format.
  channelKind: 'episode' | 'module'
  channels: ActivityChannel[]
  activities: CommunityActivity[]
  onCreate: (a: CommunityActivityCreateInput) => void
  onSubmit: (
    activityId: string,
    submission: ActivitySubmissionInput,
  ) => Promise<void> | void
  onViewSubmissions: (activityId: string) => void
  totalMembers: number
  canCreate: boolean
}

export function ActivitiesView({
  channelKind,
  channels,
  activities,
  onCreate,
  onSubmit,
  onViewSubmissions,
  totalMembers,
  canCreate,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false)
  const [submitFor, setSubmitFor] = useState<CommunityActivity | null>(null)
  const [filter, setFilter] = useState<'all' | string | 'mine'>('all')

  const channelLabelAll =
    channelKind === 'episode' ? 'All episodes' : 'All modules'

  const filters: { id: typeof filter; label: string; count?: number }[] = [
    { id: 'all', label: channelLabelAll, count: activities.length },
    ...channels.map((c) => ({
      id: c.id,
      label: c.label,
      count: activities.filter((a) => a.channelId === c.id).length,
    })),
    { id: 'mine', label: 'Submitted by me' },
  ]

  const visible =
    filter === 'mine'
      ? activities.filter((a) => a.hasOwnSubmission)
      : activities.filter((a) => filter === 'all' || a.channelId === filter)

  return (
    <>
      <header className={styles.feedHeader}>
        <div className={styles.feedEyebrow}>
          {activities.length === 0
            ? 'No activities yet'
            : `${activities.length} ${activities.length === 1 ? 'activity' : 'activities'}`}
        </div>
        <h1 className={styles.feedTitle}>Activities</h1>
        <p className={styles.feedSub}>
          Hands-on prompts tied to each {channelKind}. Submit a photo, video, or
          write-up — the cohort sees your work and the instructor leaves
          feedback.
        </p>
      </header>

      <div className={styles.eventsToolbar}>
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`${styles.filterChip} ${filter === f.id ? styles.active : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            {f.count != null && (
              <span className={styles.filterChipCount}>{f.count}</span>
            )}
          </button>
        ))}
        <span className={styles.filterSpacer} />
        {canCreate && (
          <button
            type="button"
            className={styles.newEventBtn}
            onClick={() => setCreateOpen(true)}
          >
            <IconPlus size={13} /> Create activity
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className={styles.eventsEmpty}>
          <div className={styles.eventsEmptyIcon}>
            <IconCamera size={28} />
          </div>
          <div>
            <div className={styles.eventsEmptyTitle}>
              {filter === 'mine'
                ? 'You haven’t submitted to an activity yet'
                : activities.length === 0
                  ? 'No activities yet'
                  : `No activities for this ${channelKind} yet`}
            </div>
            <p className={styles.eventsEmptySub}>
              {filter === 'mine'
                ? 'Submit to an open activity above — your work will show up in the cohort gallery and the instructor will leave feedback.'
                : canCreate
                  ? `Create the first activity ${channelKind === 'episode' ? 'for an episode' : 'for a module'} — the cohort gets notified.`
                  : 'Your instructor hasn’t opened any activities yet — check back soon.'}
            </p>
          </div>
          <div className={styles.eventsEmptyActions}>
            {filter === 'mine' ? (
              <button
                type="button"
                className={styles.eventsEmptyBtn}
                onClick={() => setFilter('all')}
              >
                See all activities
              </button>
            ) : canCreate ? (
              <button
                type="button"
                className={styles.eventsEmptyBtn}
                onClick={() => setCreateOpen(true)}
              >
                <IconPlus size={13} /> Create activity
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className={styles.eventsSection}>
          {visible.map((a) => (
            <ActivityListCard
              key={a.id}
              activity={a}
              channelKind={channelKind}
              canSubmit={!canCreate && a.status === 'open'}
              onSubmit={() => setSubmitFor(a)}
              onViewSubmissions={() => onViewSubmissions(a.id)}
            />
          ))}
        </div>
      )}

      {canCreate && (
        <CreateActivityModal
          open={createOpen}
          channelKind={channelKind}
          channels={channels}
          onClose={() => setCreateOpen(false)}
          onCreate={(payload) => {
            onCreate(payload)
            setCreateOpen(false)
          }}
        />
      )}

      <SubmitModal
        activity={submitFor}
        onClose={() => setSubmitFor(null)}
        onSubmit={async (sub) => {
          if (submitFor) {
            await onSubmit(submitFor.id, sub)
            setSubmitFor(null)
          }
        }}
      />
    </>
  )
}

// ---------------------------------------------------------------------
// Activity list card
// ---------------------------------------------------------------------

function ActivityListCard({
  activity,
  channelKind,
  canSubmit,
  onSubmit,
  onViewSubmissions,
}: {
  activity: CommunityActivity
  channelKind: 'episode' | 'module'
  canSubmit: boolean
  onSubmit: () => void
  onViewSubmissions: () => void
}) {
  const pct =
    activity.totalMembers > 0
      ? Math.round((activity.distinctSubmitters / activity.totalMembers) * 100)
      : 0
  const closed = activity.status === 'closed'

  return (
    <div className={styles.activityListCard}>
      <div className={styles.activityListTop}>
        <span className={styles.activityChannelChip}>
          {channelKind === 'episode' ? 'Episode' : 'Module'} ·{' '}
          {activity.channelLabel}
        </span>
        <span
          className={`${styles.activityStatus} ${closed ? '' : styles.activityStatusActive}`}
        >
          <span className={styles.activityStatusDot} />{' '}
          {closed ? 'Closed' : 'Open'}
        </span>
        <span className={styles.activitySubmitType}>
          {activity.submissionType === 'video' ? (
            <IconVideo size={11} />
          ) : activity.submissionType === 'text' ? (
            <IconChat size={11} />
          ) : activity.submissionType === 'link' ? (
            <IconPaperclip size={11} />
          ) : (
            <IconImage size={11} />
          )}
          {TYPE_LABEL[activity.submissionType]}
        </span>
      </div>

      <div className={styles.activityListTitle}>{activity.title}</div>
      {activity.desc && (
        <div className={styles.activityListDesc}>{activity.desc}</div>
      )}

      <div className={styles.activityListFoot}>
        <div className={styles.activityListProgress}>
          <div>
            <div style={{ marginBottom: 4 }}>
              <strong style={{ color: 'var(--c-ink)', fontWeight: 600 }}>
                {activity.distinctSubmitters}
              </strong>{' '}
              of {activity.totalMembers} submitted
            </div>
            <div className={styles.activityProgressBar}>
              <div
                className={styles.activityProgressFill}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
        <div className={styles.activityListActions}>
          <button
            type="button"
            className={styles.activityViewBtn}
            onClick={onViewSubmissions}
          >
            View submissions ({activity.submissionCount})
          </button>
          {canSubmit && (
            <button
              type="button"
              className={styles.activitySubmitBtn}
              onClick={onSubmit}
            >
              <IconCamera size={13} />{' '}
              {activity.hasOwnSubmission ? 'Submit again' : 'Submit'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Create activity modal
// ---------------------------------------------------------------------

function CreateActivityModal({
  open,
  channelKind,
  channels,
  onClose,
  onCreate,
}: {
  open: boolean
  channelKind: 'episode' | 'module'
  channels: ActivityChannel[]
  onClose: () => void
  onCreate: (payload: CommunityActivityCreateInput) => void
}) {
  const [title, setTitle] = useState('')
  const [channelId, setChannelId] = useState<string>('')
  const [submissionType, setSubmissionType] = useState<SubmissionType>('photo')
  const [desc, setDesc] = useState('')
  const [notify, setNotify] = useState(true)
  const [pinFeed, setPinFeed] = useState(true)
  const titleRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      setTitle('')
      setChannelId(channels[0]?.id ?? '')
      setSubmissionType('photo')
      setDesc('')
      setNotify(true)
      setPinFeed(true)
      setTimeout(() => titleRef.current?.focus(), 50)
    }
  }, [open, channels])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const submitTypes: {
    id: SubmissionType
    label: string
    icon: React.ReactNode
  }[] = [
    { id: 'photo', label: 'Photo', icon: <IconImage size={15} /> },
    { id: 'video', label: 'Video', icon: <IconVideo size={15} /> },
    { id: 'text', label: 'Write-up', icon: <IconChat size={15} /> },
    { id: 'link', label: 'Link', icon: <IconPaperclip size={15} /> },
  ]

  const canSubmit = title.trim().length > 0 && !!channelId

  const submit = () => {
    if (!canSubmit) return
    const channel = channels.find((c) => c.id === channelId)
    onCreate({
      channelKind: channelKind === 'episode' ? 'lesson' : 'module',
      channelId,
      channelLabel: channel?.label ?? '',
      title: title.trim(),
      desc: desc.trim(),
      submissionType,
      pinFeed,
      notify,
    })
  }

  return (
    <div
      className={styles.modalBackdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.ceModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.ceHead}>
          <div className={styles.ceTitle}>Create activity</div>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close"
          >
            <IconX size={18} />
          </button>
        </div>
        <div className={styles.ceBody}>
          <div className={styles.ceField}>
            <span className={styles.ceLabel}>
              {channelKind === 'episode' ? 'Episode' : 'Module'}
            </span>
            <select
              className={styles.ceInput}
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
            >
              {channels.length === 0 ? (
                <option value="">No {channelKind}s yet</option>
              ) : (
                channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className={styles.ceField}>
            <input
              ref={titleRef}
              className={`${styles.ceInput} ${styles.ceInputTitle}`}
              placeholder="What should they do?…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className={styles.ceField}>
            <span className={styles.ceLabel}>Prompt</span>
            <textarea
              className={styles.ceInput}
              style={{ minHeight: 100, resize: 'none' }}
              placeholder="Give context. What exactly should they upload? What questions should they answer?"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>

          <div className={styles.ceField}>
            <span className={styles.ceLabel}>Submission type</span>
            <div className={styles.ceTypeGrid}>
              {submitTypes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.ceType} ${submissionType === t.id ? styles.active : ''}`}
                  onClick={() => setSubmissionType(t.id)}
                >
                  <span className={styles.ceTypeIco}>{t.icon}</span>
                  <span className={styles.ceTypeLabel}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.ceToggleRow}>
            <div>
              <div className={styles.ceToggleText}>
                Pin to the community feed
              </div>
              <div className={styles.ceToggleSub}>
                Pinned at the top of Home until you close the activity.
              </div>
            </div>
            <button
              type="button"
              className={`${styles.ceSwitch} ${pinFeed ? styles.ceSwitchOn : ''}`}
              onClick={() => setPinFeed((v) => !v)}
              aria-pressed={pinFeed}
              aria-label="Pin to feed"
            />
          </div>

          <div className={styles.ceToggleRow}>
            <div>
              <div className={styles.ceToggleText}>
                Notify everyone in the {channelKind}
              </div>
              <div className={styles.ceToggleSub}>
                Sends an email + in-app ping when the activity opens.
              </div>
            </div>
            <button
              type="button"
              className={`${styles.ceSwitch} ${notify ? styles.ceSwitchOn : ''}`}
              onClick={() => setNotify((v) => !v)}
              aria-pressed={notify}
              aria-label="Notify everyone"
            />
          </div>
        </div>
        <div className={styles.ceFoot}>
          <div className={styles.ceFootLeft}>Posted as you</div>
          <div className={styles.ceActions}>
            <button
              type="button"
              className={`${styles.ceBtn} ${styles.ceBtnGhost}`}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`${styles.ceBtn} ${styles.ceBtnPrimary}`}
              disabled={!canSubmit}
              onClick={submit}
            >
              <IconSend size={13} /> Publish activity
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Submit-to-activity modal
// ---------------------------------------------------------------------

function SubmitModal({
  activity,
  onClose,
  onSubmit,
}: {
  activity: CommunityActivity | null
  onClose: () => void
  onSubmit: (input: ActivitySubmissionInput) => Promise<void>
}) {
  const [body, setBody] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [fileId, setFileId] = useState<string | null>(null)
  const [muxUploadId, setMuxUploadId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!activity) {
      setBody('')
      setLinkUrl('')
      setFileId(null)
      setMuxUploadId(null)
      setError(null)
    }
  }, [activity])

  if (!activity) return null

  const st = activity.submissionType
  const canSubmit =
    (st === 'text' && body.trim().length > 0) ||
    (st === 'link' && linkUrl.trim().length > 0) ||
    (st === 'photo' && !!fileId) ||
    (st === 'video' && (!!muxUploadId || !!fileId))

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        submissionType: st,
        body: body.trim() || undefined,
        fileId: fileId ?? undefined,
        muxUploadId: muxUploadId ?? undefined,
        linkUrl: linkUrl.trim() || undefined,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={styles.modalBackdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.ceModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.ceHead}>
          <div className={styles.ceTitle}>Submit: {activity.title}</div>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close"
          >
            <IconX size={18} />
          </button>
        </div>
        <div className={styles.ceBody}>
          {activity.desc && (
            <div
              className={styles.ceField}
              style={{
                fontSize: 13,
                opacity: 0.8,
                whiteSpace: 'pre-wrap',
              }}
            >
              {activity.desc}
            </div>
          )}

          {(st === 'photo' || st === 'video') && (
            <div className={styles.ceField}>
              <span className={styles.ceLabel}>
                {st === 'photo' ? 'Image' : 'Video'}
              </span>
              <div
                style={{
                  padding: 16,
                  border: '1px dashed var(--c-line, #e5e7eb)',
                  borderRadius: 12,
                  textAlign: 'center',
                  fontSize: 13,
                  opacity: 0.7,
                }}
              >
                {fileId || muxUploadId
                  ? '✓ File attached'
                  : `Upload UI lands with the media-upload integration. For now, paste a ${st === 'photo' ? 'file_id' : 'mux_upload_id'} below.`}
              </div>
              <input
                className={styles.ceInput}
                style={{ marginTop: 8 }}
                placeholder={st === 'photo' ? 'file_id' : 'mux_upload_id'}
                value={st === 'photo' ? (fileId ?? '') : (muxUploadId ?? '')}
                onChange={(e) =>
                  st === 'photo'
                    ? setFileId(e.target.value || null)
                    : setMuxUploadId(e.target.value || null)
                }
              />
            </div>
          )}

          {st === 'link' && (
            <div className={styles.ceField}>
              <span className={styles.ceLabel}>Link</span>
              <input
                className={styles.ceInput}
                placeholder="https://…"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
          )}

          <div className={styles.ceField}>
            <span className={styles.ceLabel}>
              {st === 'text' ? 'Your submission' : 'Notes (optional)'}
            </span>
            <textarea
              className={styles.ceInput}
              style={{ minHeight: 100, resize: 'none' }}
              placeholder={
                st === 'text'
                  ? 'Write your response…'
                  : 'Add context for the instructor or cohort.'
              }
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          {error && (
            <div
              style={{
                color: 'var(--c-danger, #dc2626)',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}
        </div>
        <div className={styles.ceFoot}>
          <div className={styles.ceFootLeft}>
            Visible to the cohort + the instructor
          </div>
          <div className={styles.ceActions}>
            <button
              type="button"
              className={`${styles.ceBtn} ${styles.ceBtnGhost}`}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`${styles.ceBtn} ${styles.ceBtnPrimary}`}
              disabled={!canSubmit || submitting}
              onClick={submit}
            >
              <IconSend size={13} /> {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
