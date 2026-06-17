'use client'
/* eslint-disable @next/next/no-img-element */

/**
 * Community Hub — shared rich composer (Feed).
 *
 * Wired to the real post-create pipeline: text, photo (S3 → file_id), video
 * (Mux direct upload → mux_upload_id), GIF (live GIPHY search → external_url),
 * Apple emoji (emoji-mart, set="apple"), polls (2–4 options), and event-link
 * (embed a scheduled event). The composer owns all upload/search state and
 * hands a finished CommunityPostCreateBody to `onCreate`.
 */
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import { GiphyFetch } from '@giphy/js-fetch-api'
import {
  type CommunityEventRead,
  type CommunityIOMode,
  type CommunityPostCreateBody,
  useCommunityEvents,
  useUploadPostImage,
  useUploadPostVideo,
} from '@/hooks/queries/community'
import * as React from 'react'
import { Glyph } from './icons'
import { fmtDateLabel, providerFromUrl, ProviderLogo } from './pickers'

const { useEffect, useRef, useState } = React

// GIPHY public dev key — override with NEXT_PUBLIC_GIPHY_API_KEY in production.
const GIPHY_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY || 'dc6zaTOxFJmzC'
const giphy = new GiphyFetch(GIPHY_KEY)

const TYPE_LABEL: Record<string, string> = {
  workshop: 'Workshop',
  office: 'Q&A',
  cohort: 'Watch Party',
  guest: 'Guest',
}

type GifPick = { preview: string; url: string }

/* ---------- GIF picker (live GIPHY search) ---------- */
function GifPicker({ onPick }: { onPick: (g: GifPick) => void }) {
  const [q, setQ] = useState('')
  const [gifs, setGifs] = useState<
    { id: string | number; preview: string; url: string }[]
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const run = async () => {
      try {
        const res = q.trim()
          ? await giphy.search(q.trim(), { limit: 24 })
          : await giphy.trending({ limit: 24 })
        if (!alive) return
        setGifs(
          res.data.map((g) => ({
            id: g.id,
            preview: g.images.fixed_width_small?.url || g.images.fixed_width.url,
            url: g.images.downsized_medium?.url || g.images.original.url,
          })),
        )
      } catch {
        if (alive) setGifs([])
      } finally {
        if (alive) setLoading(false)
      }
    }
    const t = setTimeout(run, q ? 300 : 0)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q])

  return (
    <div className="pop pop-gif">
      <input
        className="input gif-search"
        autoFocus
        value={q}
        placeholder="Search GIPHY…"
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="pop-grid gif-grid">
        {loading ? (
          <div className="gif-loading">Loading…</div>
        ) : gifs.length === 0 ? (
          <div className="gif-loading">No GIFs found</div>
        ) : (
          gifs.map((g) => (
            <button
              key={g.id}
              className="gif-cell"
              onClick={() => onPick({ preview: g.preview, url: g.url })}
            >
              <img src={g.preview} alt="" loading="lazy" />
            </button>
          ))
        )}
      </div>
    </div>
  )
}

/* ---------- compact event attach card ---------- */
function EventAttach({
  ev,
  onRemove,
}: {
  ev: CommunityEventRead
  onRemove?: () => void
}) {
  const provider = providerFromUrl(ev.meeting_url)
  return (
    <div className="ev-attach">
      <div
        className="ev-attach-cover"
        style={{
          backgroundImage: ev.cover_url ? `url(${ev.cover_url})` : undefined,
          backgroundPosition: ev.cover_object_position || 'center',
        }}
      >
        <span className="ev-attach-prov">
          <ProviderLogo k={provider} size={22} />
        </span>
      </div>
      <div className="ev-attach-body">
        <div className="ev-attach-type">{TYPE_LABEL[ev.type] ?? ev.type}</div>
        <div className="ev-attach-title">{ev.title || 'Untitled event'}</div>
        <div className="ev-attach-when">
          <Glyph d="calendar" size={13} stroke={1.9} />{' '}
          {fmtDateLabel(ev.start_at.slice(0, 10))}
        </div>
      </div>
      {onRemove && (
        <button
          className="ev-attach-rm"
          onClick={onRemove}
          aria-label="Remove"
        >
          <Glyph d="close" size={15} stroke={2.2} />
        </button>
      )}
    </div>
  )
}

type Props = {
  courseId: string
  mode?: CommunityIOMode
  avatar?: string | null
  authorName?: string | null
  placeholder?: string
  cta?: string
  onCreate: (body: CommunityPostCreateBody) => Promise<unknown>
  onPosted?: () => void
  showToast: (m: string) => void
}

export function Composer({
  courseId,
  mode = 'creator',
  avatar,
  authorName,
  placeholder = 'Share an update with your community…',
  cta = 'Post',
  onCreate,
  onPosted,
  showToast,
}: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [image, setImage] = useState<{ file_id: string; url: string } | null>(
    null,
  )
  const [video, setVideo] = useState<{
    upload_id: string
    url: string
    progress: number
  } | null>(null)
  const [gif, setGif] = useState<GifPick | null>(null)
  const [poll, setPoll] = useState<string[] | null>(null)
  const [event, setEvent] = useState<CommunityEventRead | null>(null)
  const [pop, setPop] = useState<'gif' | 'emoji' | 'event' | null>(null)
  const [busy, setBusy] = useState(false)

  const taRef = useRef<HTMLTextAreaElement>(null)
  const imgInput = useRef<HTMLInputElement>(null)
  const vidInput = useRef<HTMLInputElement>(null)

  const uploadImg = useUploadPostImage(null, courseId, mode)
  const uploadVid = useUploadPostVideo(null, courseId, mode)
  const eventsQ = useCommunityEvents(null, courseId, mode)
  const events = eventsQ.data ?? []

  const av = avatar || undefined
  const name = authorName || 'You'

  const expand = () => {
    setOpen(true)
    setTimeout(() => taRef.current?.focus(), 0)
  }
  const reset = () => {
    setText('')
    setImage(null)
    setVideo(null)
    setGif(null)
    setPoll(null)
    setEvent(null)
    setPop(null)
    setOpen(false)
  }

  const onPickImage = async (file: File | undefined) => {
    if (!file) return
    setVideo(null)
    setGif(null)
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
  const onPickVideo = async (file: File | undefined) => {
    if (!file) return
    setImage(null)
    setGif(null)
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

  const insertEmoji = (native: string) => {
    setText((t) => t + native)
    setPop(null)
    setTimeout(() => taRef.current?.focus(), 0)
  }

  const setPollOption = (i: number, v: string) =>
    setPoll((p) => (p ? p.map((o, j) => (j === i ? v : o)) : p))
  const addPollOption = () =>
    setPoll((p) => (p && p.length < 4 ? [...p, ''] : p))
  const rmPollOption = (i: number) =>
    setPoll((p) => (p && p.length > 2 ? p.filter((_, j) => j !== i) : p))

  const validPoll = !!poll && poll.filter((o) => o.trim()).length >= 2
  const hasContent =
    !!text.trim() ||
    !!image ||
    !!(video && video.upload_id) ||
    !!gif ||
    validPoll ||
    !!event

  const submit = async () => {
    if (!hasContent || busy) return
    const body: CommunityPostCreateBody = { body: text.trim() || ' ' }
    if (video && video.upload_id) {
      body.type = 'video'
      body.media = [
        { media_type: 'video', mux_upload_id: video.upload_id, position: 0 },
      ]
    } else {
      const media: NonNullable<CommunityPostCreateBody['media']> = []
      if (image)
        media.push({ media_type: 'image', file_id: image.file_id, position: 0 })
      if (gif)
        media.push({ media_type: 'gif', external_url: gif.url, position: 0 })
      if (media.length) body.media = media
    }
    if (validPoll && poll)
      body.poll = { options: poll.map((o) => o.trim()).filter(Boolean) }
    if (event) body.event_id = event.id

    setBusy(true)
    try {
      await onCreate(body)
      reset()
      onPosted?.()
      showToast('Posted to your community')
    } catch {
      showToast('Could not post that')
    } finally {
      setBusy(false)
    }
  }

  const hiddenInputs = (
    <>
      <input
        ref={imgInput}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          onPickImage(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <input
        ref={vidInput}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          onPickVideo(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </>
  )

  if (!open) {
    return (
      <div className="card crf-composer">
        <div className="crf-comp-row">
          {av ? <img src={av} alt="" /> : <span className="hub-av-fallback" />}
          <button className="crf-comp-fake" onClick={expand}>
            {placeholder}
          </button>
        </div>
        <div className="crf-comp-quick">
          <button onClick={() => imgInput.current?.click()}>
            <Glyph d="image" size={18} stroke={1.8} /> Photo
          </button>
          <button onClick={() => vidInput.current?.click()}>
            <Glyph d="video" size={18} stroke={1.8} /> Video
          </button>
          <button
            onClick={() => {
              setPoll((p) => p || ['', ''])
              expand()
            }}
          >
            <Glyph d="poll" size={18} stroke={1.9} /> Poll
          </button>
          <button
            onClick={() => {
              expand()
              setPop('event')
            }}
          >
            <Glyph d="calendar" size={18} stroke={1.8} /> Event
          </button>
        </div>
        {hiddenInputs}
      </div>
    )
  }

  return (
    <div className="card crf-composer open">
      <div className="crf-comp-head">
        {av ? <img src={av} alt="" /> : <span className="hub-av-fallback" />}
        <div className="crf-comp-who">
          <div className="n">{name}</div>
        </div>
        <button className="crf-more" onClick={reset} aria-label="Close">
          <Glyph d="close" size={18} stroke={2} />
        </button>
      </div>

      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
      />

      {image && (
        <div className="comp-att">
          <img src={image.url} alt="" />
          <button
            className="comp-att-rm"
            onClick={() => setImage(null)}
            aria-label="Remove"
          >
            <Glyph d="close" size={15} stroke={2.2} />
          </button>
        </div>
      )}
      {video && (
        <div className="comp-att">
          <video src={video.url} controls playsInline />
          {video.progress < 1 && (
            <div className="comp-att-prog">
              <span style={{ width: `${Math.round(video.progress * 100)}%` }} />
            </div>
          )}
          <button
            className="comp-att-rm"
            onClick={() => setVideo(null)}
            aria-label="Remove"
          >
            <Glyph d="close" size={15} stroke={2.2} />
          </button>
        </div>
      )}
      {gif && (
        <div className="comp-att">
          <img src={gif.preview} alt="GIF" />
          <span className="gif-badge">GIF</span>
          <button
            className="comp-att-rm"
            onClick={() => setGif(null)}
            aria-label="Remove"
          >
            <Glyph d="close" size={15} stroke={2.2} />
          </button>
        </div>
      )}
      {poll && (
        <div className="poll-build">
          <div className="poll-build-head">
            <span>Poll</span>
            <button onClick={() => setPoll(null)}>Remove</button>
          </div>
          {poll.map((o, i) => (
            <div key={i} className="poll-build-row">
              <input
                className="input"
                value={o}
                placeholder={`Option ${i + 1}`}
                maxLength={40}
                onChange={(e) => setPollOption(i, e.target.value)}
              />
              {poll.length > 2 && (
                <button
                  className="poll-build-rm"
                  onClick={() => rmPollOption(i)}
                  aria-label="Remove option"
                >
                  <Glyph d="close" size={14} stroke={2.2} />
                </button>
              )}
            </div>
          ))}
          {poll.length < 4 && (
            <button className="poll-build-add" onClick={addPollOption}>
              <Glyph d="plus" size={15} stroke={2} /> Add option
            </button>
          )}
        </div>
      )}
      {event && <EventAttach ev={event} onRemove={() => setEvent(null)} />}

      <div className="crf-comp-foot">
        <div className="crf-comp-tools">
          <button title="Photo" onClick={() => imgInput.current?.click()}>
            <Glyph d="image" size={20} stroke={1.8} />
          </button>
          <button title="Video" onClick={() => vidInput.current?.click()}>
            <Glyph d="video" size={20} stroke={1.8} />
          </button>
          <div className="tool-wrap">
            <button
              title="GIF"
              className={`tool-gif${pop === 'gif' ? ' on' : ''}`}
              onClick={() => setPop(pop === 'gif' ? null : 'gif')}
            >
              GIF
            </button>
            {pop === 'gif' && (
              <>
                <div className="pop-scrim" onClick={() => setPop(null)} />
                <GifPicker
                  onPick={(g) => {
                    setGif(g)
                    setImage(null)
                    setVideo(null)
                    setPop(null)
                  }}
                />
              </>
            )}
          </div>
          <div className="tool-wrap">
            <button
              title="Emoji"
              className={pop === 'emoji' ? 'on' : ''}
              onClick={() => setPop(pop === 'emoji' ? null : 'emoji')}
            >
              <Glyph d="smiley" size={20} stroke={1.8} />
            </button>
            {pop === 'emoji' && (
              <>
                <div className="pop-scrim" onClick={() => setPop(null)} />
                <div className="pop pop-emoji-mart">
                  <Picker
                    data={data}
                    set="apple"
                    theme="auto"
                    previewPosition="none"
                    onEmojiSelect={(e: { native: string }) =>
                      insertEmoji(e.native)
                    }
                  />
                </div>
              </>
            )}
          </div>
          <button
            title="Poll"
            className={poll ? 'on' : ''}
            onClick={() => setPoll((p) => p || ['', ''])}
          >
            <Glyph d="poll" size={20} stroke={1.9} />
          </button>
          <div className="tool-wrap">
            <button
              title="Event"
              className={event || pop === 'event' ? 'on' : ''}
              onClick={() => setPop(pop === 'event' ? null : 'event')}
            >
              <Glyph d="calendar" size={20} stroke={1.8} />
            </button>
            {pop === 'event' && (
              <>
                <div className="pop-scrim" onClick={() => setPop(null)} />
                <div className="pop pop-event">
                  <div className="pop-title">Link an event</div>
                  {events.length === 0 ? (
                    <div className="pop-empty">
                      No events yet — schedule one in the Events tab.
                    </div>
                  ) : (
                    <div className="event-pick">
                      {events.map((ev) => (
                        <button
                          key={ev.id}
                          className="event-pick-row"
                          onClick={() => {
                            setEvent(ev)
                            setPop(null)
                          }}
                        >
                          <span
                            className="event-pick-cover"
                            style={{
                              backgroundImage: ev.cover_url
                                ? `url(${ev.cover_url})`
                                : undefined,
                              backgroundPosition:
                                ev.cover_object_position || 'center',
                            }}
                          />
                          <span className="event-pick-main">
                            <b>{ev.title || 'Untitled event'}</b>
                            <span>
                              {TYPE_LABEL[ev.type] ?? ev.type} ·{' '}
                              {fmtDateLabel(ev.start_at.slice(0, 10))}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <span className="sp" />
        <button
          className="btn btn-primary btn-sm"
          disabled={!hasContent || busy}
          style={!hasContent || busy ? { opacity: 0.4 } : undefined}
          onClick={submit}
        >
          {busy ? 'Posting…' : cta}
        </button>
      </div>

      {hiddenInputs}
    </div>
  )
}
