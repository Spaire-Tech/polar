'use client'

/**
 * Community Hub — Settings tab (creator).
 *
 * Apple grouped-list: Identity, the linked masterclass, posting & moderation,
 * events, notifications, danger zone. Wired to the creator settings endpoint —
 * identity maps onto existing fields (feed_title_override / feed_eyebrow_override
 * / hero_thumbnail_*), the rest to the community_settings columns added for the
 * hub.
 */
import {
  type CommunitySettingsRead,
  useCreatorCommunitySettings,
  useUpdateCommunitySettings,
  useUploadPostImage,
} from '@/hooks/queries/community'
import * as React from 'react'
import { CoverDrop, Field, Seg, Toggle } from './atoms'
import { ProviderSelect, type ProviderKey } from './pickers'

const { useEffect, useState } = React

/** Text row whose value persists on blur (and on Enter). */
function TextRow({
  label,
  hint,
  value,
  onCommit,
}: {
  label: string
  hint: string
  value: string
  onCommit: (v: string) => void
}) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const commit = () => {
    if (v !== value) onCommit(v)
  }
  return (
    <div className="grow">
      <div className="grow-main">
        <div className="gl">{label}</div>
        <div className="gs">{hint}</div>
      </div>
      <div className="grow-ctl">
        <input
          className="input"
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        />
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  on,
  onToggle,
}: {
  label: string
  hint: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <div className="grow">
      <div className="grow-main">
        <div className="gl">{label}</div>
        <div className="gs">{hint}</div>
      </div>
      <div className="grow-ctl">
        <Toggle on={on} onClick={onToggle} />
      </div>
    </div>
  )
}

export function SettingsTab({
  courseId,
  courseTitle,
  brandName,
  courseCoverUrl,
  defaultTagline,
  lessonsCount,
  onViewCourse,
  showToast,
}: {
  courseId: string
  courseTitle: string
  brandName: string
  courseCoverUrl?: string | null
  defaultTagline: string
  lessonsCount: number
  onViewCourse: () => void
  showToast: (m: string) => void
}) {
  const settingsQ = useCreatorCommunitySettings(courseId)
  const update = useUpdateCommunitySettings(courseId)
  const uploadImg = useUploadPostImage(null, courseId, 'creator')
  const s = settingsQ.data

  const [coverOverride, setCoverOverride] = useState<{
    url?: string
    pos?: string
  }>({})

  if (!s) {
    return (
      <>
        <div className="cr-head">
          <div>
            <div className="h">Settings</div>
            <div className="s">Loading…</div>
          </div>
        </div>
        <div className="card" style={{ height: 200 }} />
      </>
    )
  }

  const patch = (p: Partial<CommunitySettingsRead>) => update.mutate(p)

  const cover = coverOverride.url ?? s.hero_thumbnail_url ?? courseCoverUrl
  const coverPos =
    coverOverride.pos ?? s.hero_thumbnail_object_position ?? '50% 50%'
  const onCoverPos = (pos: string) => {
    setCoverOverride((o) => ({ ...o, pos }))
    patch({ hero_thumbnail_object_position: pos })
  }
  const onCoverFile = async (file: File, dataUrl: string) => {
    setCoverOverride((o) => ({ ...o, url: dataUrl }))
    try {
      const res = await uploadImg.mutateAsync(file)
      setCoverOverride((o) => ({ ...o, url: res.public_url }))
      patch({ hero_thumbnail_url: res.public_url })
      showToast('Cover updated')
    } catch {
      setCoverOverride((o) => ({ ...o, url: undefined }))
      showToast('Could not upload that image')
    }
  }

  return (
    <>
      <div className="cr-head">
        <div>
          <div className="h">Settings</div>
          <div className="s">
            Everything that shapes how your community looks, who gets in, and how
            it runs day to day. Members never see these controls — they just
            experience the room they create.
          </div>
        </div>
      </div>

      {/* Identity */}
      <div className="glist-label">Identity</div>
      <div className="card form-card" style={{ marginBottom: 14 }}>
        <Field
          label="Cover image"
          hint="Shown across the top of your community. Click to replace, drag the image to reposition."
        >
          <CoverDrop
            src={cover}
            onFile={onCoverFile}
            pos={coverPos}
            onPos={onCoverPos}
          />
        </Field>
      </div>
      <div className="card glist" style={{ marginBottom: 26 }}>
        <TextRow
          label="Name"
          hint="The title across the top of the room"
          value={s.feed_title_override ?? courseTitle}
          onCommit={(v) => patch({ feed_title_override: v.trim() || null })}
        />
        <TextRow
          label="Tagline"
          hint="One line under the name"
          value={s.feed_eyebrow_override ?? defaultTagline}
          onCommit={(v) => patch({ feed_eyebrow_override: v.trim() || null })}
        />
      </div>

      {/* The masterclass */}
      <div className="glist-label">The masterclass</div>
      <div className="card glist" style={{ marginBottom: 26 }}>
        <div className="grow">
          <div className="set-course">
            <span
              className="set-course-ic"
              style={{
                backgroundImage: courseCoverUrl
                  ? `url(${courseCoverUrl})`
                  : undefined,
              }}
            />
            <div className="grow-main">
              <div className="gl">{courseTitle}</div>
              <div className="gs">
                {brandName} · {lessonsCount}{' '}
                {lessonsCount === 1 ? 'lesson' : 'lessons'} · the course this
                community belongs to
              </div>
            </div>
          </div>
          <div className="grow-ctl">
            <button className="btn btn-quiet btn-sm" onClick={onViewCourse}>
              View course
            </button>
          </div>
        </div>
      </div>

      {/* Posting & moderation */}
      <div className="glist-label">Posting &amp; moderation</div>
      <div className="card glist" style={{ marginBottom: 26 }}>
        <div className="grow">
          <div className="grow-main">
            <div className="gl">Who can post</div>
            <div className="gs">Who can start a submission or thread</div>
          </div>
          <div className="grow-ctl">
            <Seg
              value={s.who_can_post === 'approved' ? 'Approved' : 'Everyone'}
              options={['Everyone', 'Approved']}
              onChange={(v) =>
                patch({ who_can_post: v === 'Approved' ? 'approved' : 'everyone' })
              }
            />
          </div>
        </div>
        <ToggleRow
          label="Review first post from new members"
          hint="Catch spam before it reaches the feed"
          on={s.moderate_new_members}
          onToggle={() => patch({ moderate_new_members: !s.moderate_new_members })}
        />
        <ToggleRow
          label="Members can comment on work"
          hint="Critique stays attached to each submission"
          on={s.comments_mode !== 'locked'}
          onToggle={() =>
            patch({
              comments_mode: s.comments_mode === 'locked' ? 'visible' : 'locked',
            })
          }
        />
        <ToggleRow
          label="Reactions on posts"
          hint="Let members like and react to each other’s work"
          on={s.reactions_enabled}
          onToggle={() => patch({ reactions_enabled: !s.reactions_enabled })}
        />
        <ToggleRow
          label="Profanity filter"
          hint="Automatically hide flagged language"
          on={s.profanity_filter}
          onToggle={() => patch({ profanity_filter: !s.profanity_filter })}
        />
      </div>

      {/* Events */}
      <div className="glist-label">Events</div>
      <div
        className="card glist"
        style={{ marginBottom: 26, overflow: 'visible', position: 'relative', zIndex: 5 }}
      >
        <div className="grow">
          <div className="grow-main">
            <div className="gl">Default meeting provider</div>
            <div className="gs">Pre-selected when you schedule a live moment</div>
          </div>
          <div className="grow-ctl">
            <ProviderSelect
              value={s.default_meeting_provider as ProviderKey}
              onChange={(v) => patch({ default_meeting_provider: v })}
            />
          </div>
        </div>
        <ToggleRow
          label="Members can RSVP"
          hint="Show who’s coming and send reminders"
          on={s.member_rsvp}
          onToggle={() => patch({ member_rsvp: !s.member_rsvp })}
        />
      </div>

      {/* Notifications */}
      <div className="glist-label">Notifications</div>
      <div className="card glist" style={{ marginBottom: 26 }}>
        <ToggleRow
          label="Email me new submissions"
          hint="A note whenever a member posts work"
          on={s.notify_new_submissions}
          onToggle={() =>
            patch({ notify_new_submissions: !s.notify_new_submissions })
          }
        />
        <ToggleRow
          label="Email me new comments"
          hint="Stay on top of the conversation"
          on={s.notify_new_comments}
          onToggle={() => patch({ notify_new_comments: !s.notify_new_comments })}
        />
        <ToggleRow
          label="Weekly digest to members"
          hint="A Monday recap of the best work and what’s coming"
          on={s.weekly_digest}
          onToggle={() => patch({ weekly_digest: !s.weekly_digest })}
        />
      </div>

      {/* Danger zone */}
      <div className="glist-label danger">Danger zone</div>
      <div className="card glist danger-zone">
        <div className="grow">
          <div className="grow-main">
            <div className="gl">{s.archived ? 'Restore community' : 'Archive community'}</div>
            <div className="gs">
              Hide it from members and pause all activity — you can restore it
              later
            </div>
          </div>
          <div className="grow-ctl">
            <button
              className="btn btn-quiet btn-sm"
              onClick={() => {
                patch({ archived: !s.archived })
                showToast(s.archived ? 'Community restored' : 'Community archived')
              }}
            >
              {s.archived ? 'Restore' : 'Archive'}
            </button>
          </div>
        </div>
        <div className="grow">
          <div className="grow-main">
            <div className="gl">Delete community</div>
            <div className="gs">
              Permanently remove the room and everything in it. This can’t be
              undone.
            </div>
          </div>
          <div className="grow-ctl">
            <button
              className="btn btn-danger btn-sm"
              onClick={() => showToast('Type the name to confirm deletion')}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
