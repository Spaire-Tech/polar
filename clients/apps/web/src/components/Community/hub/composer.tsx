'use client'
/* eslint-disable @next/next/no-img-element */

/**
 * Community Hub — shared rich composer (Feed + Activities).
 *
 * Ported from the design handoff RichComposer. Wires to the real post-create
 * pipeline: text, photo (S3 upload → file_id), video (Mux direct upload →
 * mux_upload_id), and emoji insertion. Poll / GIF / event-link tools land
 * alongside their backend in the next slice.
 */
import {
  type CommunityIOMode,
  type CommunityPostCreateBody,
  useUploadPostImage,
  useUploadPostVideo,
} from '@/hooks/queries/community'
import * as React from 'react'
import { Glyph } from './icons'

const { useState, useRef } = React

const EMOJI = [
  '😀','😄','😍','😎','🥳','🤩','😅','😂','🥹','🤔','😴','😮','🙌','👏','💪',
  '🙏','👍','👀','🔥','✨','💯','❤️','🎾','🏆','⚡','🎉','📣','✅','🙂','😉','🤝','💥',
]

type Props = {
  courseId: string
  mode?: CommunityIOMode
  avatar?: string | null
  authorName?: string | null
  placeholder?: string
  cta?: string
  /** Performs the actual create mutation; the composer owns upload state. */
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
  const [busy, setBusy] = useState(false)
  const [emoji, setEmoji] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const imgInput = useRef<HTMLInputElement>(null)
  const vidInput = useRef<HTMLInputElement>(null)

  const uploadImg = useUploadPostImage(null, courseId, mode)
  const uploadVid = useUploadPostVideo(null, courseId, mode)

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
    setEmoji(false)
    setOpen(false)
  }

  const onPickImage = async (file: File | undefined) => {
    if (!file) return
    setVideo(null)
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
    const localUrl = URL.createObjectURL(file)
    setVideo({ upload_id: '', url: localUrl, progress: 0 })
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

  const insertEmoji = (e: string) => {
    setText((t) => t + e)
    setEmoji(false)
    setTimeout(() => taRef.current?.focus(), 0)
  }

  const hasContent = !!text.trim() || !!image || !!(video && video.upload_id)
  const submit = async () => {
    if (!hasContent || busy) return
    const body: CommunityPostCreateBody = { body: text.trim() || ' ' }
    if (video && video.upload_id) {
      body.type = 'video'
      body.media = [
        { media_type: 'video', mux_upload_id: video.upload_id, position: 0 },
      ]
    } else if (image) {
      body.media = [
        { media_type: 'image', file_id: image.file_id, position: 0 },
      ]
    }
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
              title="Emoji"
              className={emoji ? 'on' : ''}
              onClick={() => setEmoji((v) => !v)}
            >
              <Glyph d="smiley" size={20} stroke={1.8} />
            </button>
            {emoji && (
              <>
                <div className="pop-scrim" onClick={() => setEmoji(false)} />
                <div className="pop pop-emoji">
                  <div className="emoji-grid">
                    {EMOJI.map((e, i) => (
                      <button key={i} onClick={() => insertEmoji(e)}>
                        {e}
                      </button>
                    ))}
                  </div>
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
