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
// for the cohort ("upload a photo of your bake", "record a 1-min
// demo", etc.). The data is client-state only — Phase 4 will wire the
// `/community/{course_id}/activities` endpoints. Shipping the form
// first so creators see the flow they're getting.

export type ActivityChannel = {
  id: string
  // What the form's "Channel" select shows for this entry. For series
  // courses this is an episode title, for course format it's a module
  // title.
  label: string
}

type SubmissionType = 'photo' | 'video' | 'text' | 'link'

const TYPE_LABEL: Record<SubmissionType, string> = {
  photo: 'Photo + Text',
  video: 'Video',
  text: 'Write-up',
  link: 'Link',
}

export type CommunityActivity = {
  id: string
  channelId: string
  channelLabel: string
  title: string
  desc: string
  submissionType: SubmissionType
  pinFeed: boolean
  notify: boolean
  submissionCount: number
  totalMembers: number
}

type Props = {
  // Label shown next to the section header — "Episodes" or "Modules"
  // depending on course format.
  channelKind: 'episode' | 'module'
  channels: ActivityChannel[]
  activities: CommunityActivity[]
  onCreate: (activity: CommunityActivity) => void
  totalMembers: number
}

export function ActivitiesView({
  channelKind,
  channels,
  activities,
  onCreate,
  totalMembers,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false)
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
      ? []
      : activities.filter((a) => filter === 'all' || a.channelId === filter)

  return (
    <>
      <header className={styles.feedHeader}>
        <div className={styles.feedEyebrow}>
          {activities.length === 0
            ? 'No activities yet'
            : `${activities.length} ${activities.length === 1 ? 'activity' : 'activities'} · all open`}
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
        <button
          type="button"
          className={styles.newEventBtn}
          onClick={() => setCreateOpen(true)}
        >
          <IconPlus size={13} /> Create activity
        </button>
      </div>

      {filter === 'mine' || visible.length === 0 ? (
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
                : `Create the first activity ${channelKind === 'episode' ? 'for an episode' : 'for a module'} — anyone can post a prompt.`}
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
            ) : (
              <button
                type="button"
                className={styles.eventsEmptyBtn}
                onClick={() => setCreateOpen(true)}
              >
                <IconPlus size={13} /> Create activity
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.eventsSection}>
          {visible.map((a) => (
            <ActivityListCard
              key={a.id}
              activity={a}
              channelKind={channelKind}
            />
          ))}
        </div>
      )}

      <CreateActivityModal
        open={createOpen}
        channelKind={channelKind}
        channels={channels}
        totalMembers={totalMembers}
        onClose={() => setCreateOpen(false)}
        onCreate={(a) => {
          onCreate(a)
          setCreateOpen(false)
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
}: {
  activity: CommunityActivity
  channelKind: 'episode' | 'module'
}) {
  const pct =
    activity.totalMembers > 0
      ? Math.round((activity.submissionCount / activity.totalMembers) * 100)
      : 0

  return (
    <div className={styles.activityListCard}>
      <div className={styles.activityListTop}>
        <span className={styles.activityChannelChip}>
          {channelKind === 'episode' ? 'Episode' : 'Module'} ·{' '}
          {activity.channelLabel}
        </span>
        <span
          className={`${styles.activityStatus} ${styles.activityStatusActive}`}
        >
          <span className={styles.activityStatusDot} /> Open
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
                {activity.submissionCount}
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
          <span style={{ fontSize: 11.5 }}>Always open · submit anytime</span>
        </div>
        <div className={styles.activityListActions}>
          <button type="button" className={styles.activityViewBtn}>
            View submissions
          </button>
          <button type="button" className={styles.activitySubmitBtn}>
            <IconCamera size={13} /> Submit
          </button>
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
  totalMembers,
  onClose,
  onCreate,
}: {
  open: boolean
  channelKind: 'episode' | 'module'
  channels: ActivityChannel[]
  totalMembers: number
  onClose: () => void
  onCreate: (a: CommunityActivity) => void
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
      id: `act-${Date.now()}`,
      channelId,
      channelLabel: channel?.label ?? '',
      title: title.trim(),
      desc: desc.trim(),
      submissionType,
      pinFeed,
      notify,
      submissionCount: 0,
      totalMembers,
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
                Pin to the activity feed
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
