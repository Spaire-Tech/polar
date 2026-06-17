'use client'
/* eslint-disable @next/next/no-img-element */

/**
 * Community Hub — Activities tab (creator).
 *
 * The thing you ask members to make. Empty state → "+" → form (cover, the ask,
 * submission format, link-to-episode) → published card → full submissions page
 * where each submission renders like a post with its own comment thread. Wired
 * to the existing community_activity / submission endpoints. The activity's
 * channel (module|lesson) is derived from the course; "Photo + note" maps onto
 * the stored 'photo' type (the design treats format as a label).
 */
import { HlsVideo } from '@/components/Courses/HlsVideo'
import {
  type ActivityChannelKind,
  type ActivitySubmissionType,
  type CommunityActivityCreateBody,
  type CommunityActivityRead,
  type CommunityActivitySubmissionRead,
  useCommunityActivities,
  useCommunityActivitySubmissions,
  useCreateCommunityActivity,
  usePostSubmissionComment,
  useSubmissionComments,
  useSubmitToCommunityActivity,
  useUploadPostImage,
  useUploadPostVideo,
} from '@/hooks/queries/community'
import * as React from 'react'
import { CoverDrop, Field, Seg } from './atoms'
import { timeAgo } from './format'
import { Glyph } from './icons'
import { type ChannelOption, EpisodeSelect } from './pickers'

const { useMemo, useState } = React

/* format label ↔ stored submission_type */
const FORMATS: { label: string; type: ActivitySubmissionType; sub: string }[] = [
  { label: 'Video', type: 'video', sub: 'Members upload a clip they filmed.' },
  { label: 'Photo', type: 'photo', sub: 'Members add a single image.' },
  { label: 'Photo + note', type: 'photo', sub: 'Members add an image with a short caption.' },
  { label: 'Text', type: 'text', sub: 'Members write a passage.' },
  { label: 'Link', type: 'link', sub: 'Members paste a link to their work.' },
]
const formatByLabel = (l: string) => FORMATS.find((f) => f.label === l) || FORMATS[0]
const labelForType = (t: ActivitySubmissionType) =>
  ({ video: 'Video', photo: 'Photo', text: 'Text', link: 'Link' })[t]

export type CourseChannel = {
  kind: ActivityChannelKind
  noun: string
  options: ChannelOption[]
}

/* ---------- form ---------- */
function ActivityForm({
  courseId,
  channel,
  onCancel,
  onCreated,
  showToast,
}: {
  courseId: string
  channel: CourseChannel
  onCancel: (() => void) | null
  onCreated: () => void
  showToast: (m: string) => void
}) {
  const [prompt, setPrompt] = useState('')
  const [formatLabel, setFormatLabel] = useState('Video')
  const [channelId, setChannelId] = useState<string | null>(null)
  const [cover, setCover] = useState('')
  const [coverPos, setCoverPos] = useState('50% 50%')
  const [busy, setBusy] = useState(false)

  const uploadImg = useUploadPostImage(null, courseId, 'creator')
  const create = useCreateCommunityActivity(null, courseId, 'creator')
  const fmt = formatByLabel(formatLabel)
  const can = prompt.trim() && channel.options.length > 0 && !busy

  const onCover = async (file: File, dataUrl: string) => {
    setCover(dataUrl)
    try {
      const res = await uploadImg.mutateAsync(file)
      setCover(res.public_url)
    } catch {
      setCover('')
      showToast('Could not upload that image')
    }
  }

  const submit = async () => {
    if (!can) return
    // Backend requires a channel (module XOR lesson). Honour the chosen
    // episode, else fall back to the first available channel target.
    const targetId = channelId ?? channel.options[0]?.id
    if (!targetId) {
      showToast('Add a module or lesson to the course first')
      return
    }
    const title = prompt.trim().slice(0, 200)
    const body: CommunityActivityCreateBody = {
      channel_kind: channel.kind,
      module_id: channel.kind === 'module' ? targetId : null,
      lesson_id: channel.kind === 'lesson' ? targetId : null,
      title,
      description: prompt.trim().length > 200 ? prompt.trim() : null,
      cover_url: cover || null,
      cover_object_position: cover ? coverPos : null,
      submission_type: fmt.type,
      pin_to_feed: false,
      notify_on_publish: true,
    }
    setBusy(true)
    try {
      await create.mutateAsync(body)
      showToast('Activity published')
      onCreated()
    } catch {
      showToast('Could not publish that activity')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card form-card">
      <div className="form-title">Create an activity</div>
      <Field label="Cover image">
        <CoverDrop src={cover} onFile={onCover} pos={coverPos} onPos={setCoverPos} />
      </Field>
      <Field label="What you’re asking members to do">
        <textarea
          className="textarea"
          style={{ minHeight: 90, fontSize: 16 }}
          value={prompt}
          placeholder="e.g. Post a clip of one rep you want eyes on — a serve, a rally, a drill."
          onChange={(e) => setPrompt(e.target.value)}
        />
      </Field>
      <Field label="Submission format" hint={fmt.sub}>
        <Seg
          wide
          value={formatLabel}
          options={FORMATS.map((f) => f.label)}
          onChange={setFormatLabel}
        />
      </Field>
      <Field label={`Link to a ${channel.noun}`}>
        <EpisodeSelect
          value={channelId}
          options={channel.options}
          noun={channel.noun}
          onChange={setChannelId}
        />
      </Field>
      <div className="form-foot">
        <span className="sp" />
        {onCancel && (
          <button className="btn btn-quiet btn-sm" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          className="btn btn-primary"
          disabled={!can}
          style={!can ? { opacity: 0.4 } : undefined}
          onClick={submit}
        >
          {busy ? 'Publishing…' : 'Publish activity'}
        </button>
      </div>
    </div>
  )
}

/* ---------- card ---------- */
function ActivityCard({
  act,
  onOpen,
}: {
  act: CommunityActivityRead
  onOpen: (a: CommunityActivityRead) => void
}) {
  return (
    <button className="ev-card" onClick={() => onOpen(act)}>
      <div
        className="ev-card-cover"
        style={{
          backgroundImage: act.cover_url ? `url(${act.cover_url})` : undefined,
          backgroundPosition: act.cover_object_position || 'center',
        }}
      >
        <span className="ev-card-type">{labelForType(act.submission_type)}</span>
        {act.channel_label && (
          <span className="act-ep-tag">{act.channel_label}</span>
        )}
      </div>
      <div className="ev-card-body">
        <div className="ev-card-title act-card-title">{act.title}</div>
        <div className="act-card-foot">
          <span className="act-subs">
            <b>{act.submission_count}</b>{' '}
            {act.submission_count === 1 ? 'submission' : 'submissions'}
          </span>
        </div>
      </div>
    </button>
  )
}

/* ---------- submission media ---------- */
function SubmissionMedia({ s }: { s: CommunityActivitySubmissionRead }) {
  if (s.submission_type === 'photo' && s.file_url) {
    return (
      <div className="crf-imgs n1">
        <img
          src={s.file_url}
          alt=""
          style={{ objectPosition: s.image_object_position || 'center' }}
        />
      </div>
    )
  }
  if (s.submission_type === 'video') {
    if (s.mux_status === 'ready' && s.mux_playback_id) {
      return (
        <div className="crf-media crf-video">
          <HlsVideo playbackId={s.mux_playback_id} />
        </div>
      )
    }
    return (
      <div className="crf-media crf-video crf-video-pending">
        <div className="crf-video-encoding">
          <Glyph d="video" size={22} stroke={1.7} /> Processing video…
        </div>
      </div>
    )
  }
  if (s.submission_type === 'link' && s.link_url) {
    return (
      <a
        className="sub-link"
        href={s.link_url}
        target="_blank"
        rel="noreferrer"
      >
        <Glyph d="link" size={16} stroke={1.9} /> {s.link_url}
      </a>
    )
  }
  return null
}

/* ---------- submission card (post-like + comments) ---------- */
function SubmissionCard({
  s,
  courseId,
  activityId,
  selfName,
  selfAvatar,
}: {
  s: CommunityActivitySubmissionRead
  courseId: string
  activityId: string
  selfName: string
  selfAvatar?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const commentsQ = useSubmissionComments(
    null,
    courseId,
    activityId,
    open ? s.id : undefined,
    'creator',
  )
  const post = usePostSubmissionComment(null, courseId, activityId, s.id, 'creator')
  const comments = commentsQ.data ?? []
  const submit = () => {
    const t = text.trim()
    if (!t) return
    post.mutate({ body: t })
    setText('')
  }
  return (
    <article className="crf-post">
      <header className="crf-head">
        {s.author_avatar_url ? (
          <img className="crf-av" src={s.author_avatar_url} alt={s.author_name} />
        ) : (
          <span className="crf-av hub-av-fallback" />
        )}
        <div className="crf-id">
          <div className="crf-name">{s.author_name}</div>
          <div className="crf-meta">{timeAgo(s.created_at)}</div>
        </div>
      </header>
      {s.body && <div className="crf-text">{s.body}</div>}
      <SubmissionMedia s={s} />
      <div className="crf-bar">
        <button className="crf-act" onClick={() => setOpen((o) => !o)}>
          <Glyph d="comment" size={20} stroke={1.8} />
          <span>Comment</span>
        </button>
      </div>
      {open && (
        <div className="comments">
          {comments.map((c) => (
            <div className="cmt" key={c.id}>
              {c.author.avatar_url ? (
                <img className="cmt-av" src={c.author.avatar_url} alt={c.author.name ?? ''} />
              ) : (
                <span className="cmt-av hub-av-fallback" />
              )}
              <div className="cmt-main">
                <div className="cmt-bubble">
                  <div className="cmt-name">
                    {c.author.name ||
                      (c.author.kind === 'instructor' ? 'Host' : 'Member')}
                    {c.author.kind === 'instructor' && (
                      <span className="role">Host</span>
                    )}
                  </div>
                  <div className="cmt-text">{c.body}</div>
                </div>
                <div className="cmt-actions">
                  <span className="t">{timeAgo(c.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
          <div className="cmt-compose">
            {selfAvatar ? (
              <img src={selfAvatar} alt="" />
            ) : (
              <span className="hub-av-fallback" />
            )}
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
              placeholder={`Reply as ${selfName.split(' ')[0]}…`}
            />
            <button className="cmt-send" disabled={!text.trim()} onClick={submit}>
              Post
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

/* ---------- submission composer (adapts to the activity's format) ---------- */
function SubComposer({
  courseId,
  activity,
  selfAvatar,
  showToast,
}: {
  courseId: string
  activity: CommunityActivityRead
  selfAvatar?: string | null
  showToast: (m: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [link, setLink] = useState('')
  const [image, setImage] = useState<{ file_id: string; url: string } | null>(null)
  const [video, setVideo] = useState<{ upload_id: string; url: string; progress: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const imgInput = React.useRef<HTMLInputElement>(null)
  const vidInput = React.useRef<HTMLInputElement>(null)

  const uploadImg = useUploadPostImage(null, courseId, 'creator')
  const uploadVid = useUploadPostVideo(null, courseId, 'creator')
  const submitMut = useSubmitToCommunityActivity(null, courseId)

  const t = activity.submission_type
  const reset = () => {
    setText('')
    setLink('')
    setImage(null)
    setVideo(null)
    setOpen(false)
  }
  const pickImage = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const res = await uploadImg.mutateAsync(file)
      setImage({ file_id: res.file_id, url: res.public_url })
      setOpen(true)
    } catch {
      showToast('Could not upload that image')
    } finally {
      setBusy(false)
    }
  }
  const pickVideo = async (file: File | undefined) => {
    if (!file) return
    setVideo({ upload_id: '', url: URL.createObjectURL(file), progress: 0 })
    setOpen(true)
    setBusy(true)
    try {
      const res = await uploadVid.mutateAsync({
        file,
        onProgress: (f) => setVideo((v) => (v ? { ...v, progress: f } : v)),
      })
      setVideo((v) => (v ? { ...v, upload_id: res.upload_id, progress: 1 } : v))
    } catch {
      setVideo(null)
      showToast('Could not upload that video')
    } finally {
      setBusy(false)
    }
  }

  const canSubmit =
    !busy &&
    ((t === 'photo' && !!image) ||
      (t === 'video' && !!video?.upload_id) ||
      (t === 'link' && !!link.trim()) ||
      (t === 'text' && !!text.trim()))

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    try {
      await submitMut.mutateAsync({
        activityId: activity.id,
        body: {
          submission_type: t,
          body: text.trim() || null,
          file_id: t === 'photo' ? image?.file_id : null,
          mux_upload_id: t === 'video' ? video?.upload_id : null,
          link_url: t === 'link' ? link.trim() : null,
        },
      })
      reset()
      showToast('Posted to the activity')
    } catch {
      showToast('Could not post that')
    } finally {
      setBusy(false)
    }
  }

  const placeholder =
    t === 'text'
      ? 'Write your submission…'
      : 'Say something about it — what you worked on, what you want eyes on…'

  return (
    <div className={`card composer${open ? ' composer-open' : ''}`}>
      <div className="composer-row" style={open ? { alignItems: 'flex-start' } : undefined}>
        {selfAvatar ? <img src={selfAvatar} alt="You" /> : <span className="hub-av-fallback" />}
        {open ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
          />
        ) : (
          <button className="composer-fake" onClick={() => setOpen(true)}>
            Share your submission — a clip, a photo, or a note…
          </button>
        )}
        {!open && t === 'photo' && (
          <button
            className="sub-photo-btn"
            onClick={() => imgInput.current?.click()}
            aria-label="Add a photo"
          >
            <Glyph d="image" size={19} stroke={1.8} />
          </button>
        )}
      </div>

      {open && t === 'link' && (
        <input
          className="input"
          style={{ marginTop: 10 }}
          value={link}
          placeholder="https://…"
          onChange={(e) => setLink(e.target.value)}
        />
      )}
      {open && image && (
        <div className="sub-comp-media">
          <img src={image.url} alt="" />
          <button className="sub-comp-rm" onClick={() => setImage(null)} aria-label="Remove image">
            <Glyph d="close" size={15} stroke={2.2} />
          </button>
        </div>
      )}
      {open && video && (
        <div className="sub-comp-media">
          <video src={video.url} controls playsInline />
          {video.progress < 1 && (
            <div className="comp-att-prog">
              <span style={{ width: `${Math.round(video.progress * 100)}%` }} />
            </div>
          )}
          <button className="sub-comp-rm" onClick={() => setVideo(null)} aria-label="Remove video">
            <Glyph d="close" size={15} stroke={2.2} />
          </button>
        </div>
      )}

      {open && (
        <div className="composer-foot">
          {t === 'photo' && (
            <button className="text-btn" onClick={() => imgInput.current?.click()}>
              <Glyph d="image" size={16} stroke={1.8} /> {image ? 'Replace photo' : 'Add photo'}
            </button>
          )}
          {t === 'video' && (
            <button className="text-btn" onClick={() => vidInput.current?.click()}>
              <Glyph d="video" size={16} stroke={1.8} /> {video ? 'Replace video' : 'Add video'}
            </button>
          )}
          <span className="sp" />
          <button className="btn btn-quiet btn-sm" onClick={reset}>
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm"
            disabled={!canSubmit}
            style={!canSubmit ? { opacity: 0.4 } : undefined}
            onClick={submit}
          >
            {busy ? 'Posting…' : 'Post'}
          </button>
        </div>
      )}

      <input
        ref={imgInput}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          pickImage(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <input
        ref={vidInput}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          pickVideo(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}

/* ---------- activity page (submissions) ---------- */
function ActivityPage({
  act,
  courseId,
  selfName,
  selfAvatar,
  onBack,
  showToast,
}: {
  act: CommunityActivityRead
  courseId: string
  selfName: string
  selfAvatar?: string | null
  onBack: () => void
  showToast: (m: string) => void
}) {
  const subsQ = useCommunityActivitySubmissions(null, courseId, act.id, 'creator')
  const submissions = subsQ.data ?? []
  return (
    <div className="act-page">
      <button className="act-back" onClick={onBack}>
        <Glyph d="back" size={17} stroke={2.2} /> Activities
      </button>

      <div className="act-hero">
        <div
          className="act-hero-cover"
          style={{
            backgroundImage: act.cover_url ? `url(${act.cover_url})` : undefined,
            backgroundPosition: act.cover_object_position || 'center',
          }}
        />
        <div className="act-hero-body">
          <div className="act-hero-tags">
            <span className="act-fmt-tag">{labelForType(act.submission_type)}</span>
            {act.channel_label && (
              <span className="act-ep-chip">
                <Glyph d="doc" size={13} stroke={1.8} /> {act.channel_label}
              </span>
            )}
          </div>
          <h1 className="act-hero-title">{act.title}</h1>
          <div className="act-hero-meta">
            {submissions.length}{' '}
            {submissions.length === 1 ? 'submission' : 'submissions'}
          </div>
        </div>
      </div>

      <div className="act-feed">
        <SubComposer
          courseId={courseId}
          activity={act}
          selfAvatar={selfAvatar}
          showToast={showToast}
        />
        {submissions.length === 0 ? (
          <div className="card act-feed-empty">
            <span className="ev-empty-ic">
              <Glyph d="grid" size={24} stroke={1.7} />
            </span>
            <h3>No submissions yet</h3>
            <p>
              Be the first to post — share a clip, a photo, or a note and your
              members will follow.
            </p>
          </div>
        ) : (
          <div className="crf-stack">
            {submissions.map((s) => (
              <SubmissionCard
                key={s.id}
                s={s}
                courseId={courseId}
                activityId={act.id}
                selfName={selfName}
                selfAvatar={selfAvatar}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- tab ---------- */
export function ActivitiesTab({
  courseId,
  channel,
  selfName,
  selfAvatar,
  showToast,
}: {
  courseId: string
  channel: CourseChannel
  selfName: string
  selfAvatar?: string | null
  showToast: (m: string) => void
}) {
  const actsQ = useCommunityActivities(null, courseId, 'creator')
  const activities = useMemo(() => actsQ.data ?? [], [actsQ.data])
  const [showForm, setShowForm] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const openAct = useMemo(
    () => activities.find((a) => a.id === openId) || null,
    [activities, openId],
  )

  if (openAct) {
    return (
      <ActivityPage
        act={openAct}
        courseId={courseId}
        selfName={selfName}
        selfAvatar={selfAvatar}
        onBack={() => setOpenId(null)}
        showToast={showToast}
      />
    )
  }

  return (
    <>
      <div className="cr-head">
        <div>
          <div className="h">Activities</div>
          <div className="s">
            The thing you ask members to make and bring. Write one clear prompt —
            optionally tied to a {channel.noun} — then publish it. Members
            respond, and their submissions collect on the card.
          </div>
        </div>
        {!showForm && activities.length > 0 && (
          <button
            className="ev-add-btn"
            onClick={() => setShowForm(true)}
            aria-label="New activity"
          >
            <Glyph d="plus" size={20} stroke={2.2} />
          </button>
        )}
      </div>

      {showForm ? (
        <ActivityForm
          courseId={courseId}
          channel={channel}
          onCancel={activities.length > 0 ? () => setShowForm(false) : null}
          onCreated={() => setShowForm(false)}
          showToast={showToast}
        />
      ) : activities.length === 0 ? (
        <div className="card ev-empty">
          <span className="ev-empty-ic">
            <Glyph d="grid" size={26} stroke={1.7} />
          </span>
          <h3>No activities yet</h3>
          <p>
            Ask members to do something — post a rep, a win, a question. Link it
            to a {channel.noun} if you like. Publish, and submissions collect
            right here.
          </p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            Create an activity
          </button>
        </div>
      ) : (
        <div className="ev-grid">
          {activities.map((a) => (
            <ActivityCard key={a.id} act={a} onOpen={(x) => setOpenId(x.id)} />
          ))}
        </div>
      )}
    </>
  )
}
