'use client'

// OverviewSheet + CommentsPanel — ported 1:1 from the Spaire Originals v2
// design (originals2-parts.jsx). Data-tolerant: sections render only when
// the lesson actually carries them (overview note, takeaways, resources),
// so the sheet works today with just a description and lights up as the
// lesson editor starts producing the richer fields.

import { useEffect, useRef, useState } from 'react'
import { Glyph, SF } from './WatchGlyphs'
import { WatchStyles } from './WatchStyles'

function useEsc(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', h, true)
    return () => window.removeEventListener('keydown', h, true)
  }, [onClose])
}

export type WatchResource = {
  name: string
  /** "pdf" | "audio" | "video" | "link" — anything else falls back to pdf. */
  type?: string
  meta?: string
  url?: string
}

export type WatchOverview = {
  /** "Your note to students" paragraphs. */
  body: string[]
  /** "In this lesson" takeaways. */
  learn: string[]
  resources: WatchResource[]
}

const RES_ICON: Record<string, keyof typeof SF> = {
  pdf: 'pdf',
  audio: 'audio',
  video: 'videoclip',
  link: 'link',
}

export function OverviewSheet({
  brand = 'Spaire Originals',
  lessonN,
  title,
  durLabel,
  instructorName,
  imageUrl,
  locked,
  unlockLabel,
  overview,
  dark,
  onClose,
  onPlay,
}: {
  brand?: string
  lessonN: number
  title: string
  durLabel?: string | null
  instructorName?: string | null
  imageUrl?: string | null
  locked?: boolean
  unlockLabel?: string
  overview: WatchOverview
  dark?: boolean
  onClose: () => void
  onPlay: () => void
}) {
  useEsc(onClose)
  const sub = [durLabel, instructorName].filter(Boolean).join(' · ')
  return (
    <div
      className={`sov2 sheet-overlay${dark ? ' dark' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Lesson overview"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="x-sheet wide">
        <div className="xs-cover">
          <div
            className="xs-img"
            style={
              imageUrl ? { backgroundImage: `url("${imageUrl}")` } : undefined
            }
          />
          <div className="xs-shade" />
          <div className="xs-eyebrow">
            <span className="dot" />
            <span>
              {brand} · Lesson {lessonN}
              {locked ? ' · Locked' : ''}
            </span>
          </div>
          <div className="xs-title">
            {title}
            {sub && <div className="xs-titlesub">{sub}</div>}
          </div>
          <button className="xs-close" onClick={onClose} aria-label="Close">
            <Glyph d={SF.close} size={13} stroke={2.4} />
          </button>
        </div>
        <div className="xs-body">
          <div className="ov-chips">
            <button className="cta-main" onClick={onPlay}>
              {locked ? (
                <>
                  <Glyph d={SF.lock} size={17} stroke={2.1} />{' '}
                  {unlockLabel ?? 'Unlock'}
                </>
              ) : (
                <>
                  <Glyph d={SF.play} size={17} fill="currentColor" /> Play
                  lesson
                </>
              )}
            </button>
          </div>

          {overview.body.length > 0 && (
            <>
              <div className="ov-h">Lesson overview</div>
              {overview.body.map((p, i) => (
                <p className="ov-p" key={i}>
                  {p}
                </p>
              ))}
            </>
          )}

          {overview.learn.length > 0 && (
            <>
              <div className="ov-h">In this lesson</div>
              <ul className="ov-learn">
                {overview.learn.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </>
          )}

          {overview.resources.length > 0 && (
            <>
              <div className="ov-h">Resources</div>
              <div className="ov-res">
                {overview.resources.map((r, i) => {
                  const icon = SF[RES_ICON[r.type ?? 'pdf'] ?? 'pdf']
                  const inner = (
                    <>
                      <span className="ov-res-ico">
                        <Glyph d={icon} size={21} stroke={1.9} />
                      </span>
                      <span className="ov-res-main">
                        <span className="rn">{r.name}</span>
                        {r.meta && <span className="rm">{r.meta}</span>}
                      </span>
                      <span className="ov-res-dl">
                        <Glyph
                          d={r.type === 'link' ? SF.link : SF.download}
                          size={19}
                          stroke={2}
                        />
                      </span>
                    </>
                  )
                  return r.url ? (
                    <a
                      className="ov-res-row"
                      key={i}
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      download={r.type !== 'link' ? '' : undefined}
                    >
                      {inner}
                    </a>
                  ) : (
                    <div className="ov-res-row" key={i}>
                      {inner}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
      <WatchStyles />
    </div>
  )
}

/* ───────────────────────── discussion panel ───────────────────────── */

export type WatchComment = {
  id: string
  name: string
  avatarUrl?: string | null
  time: string
  text: string
  likes?: number
  liked?: boolean
}

function CommentRow({
  c,
  onLike,
}: {
  c: WatchComment
  onLike?: (id: string) => void
}) {
  return (
    <div className="cmt">
      {c.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="cmt-av" src={c.avatarUrl} alt={c.name} />
      ) : (
        <div className="cmt-av" />
      )}
      <div className="cmt-main">
        <div className="cmt-top">
          <span className="cmt-name">{c.name}</span>
          <span className="cmt-dot" />
          <span className="cmt-time">{c.time}</span>
        </div>
        <div className="cmt-text">{c.text}</div>
        {onLike && (
          <div className="cmt-actions">
            <button
              className={`cmt-like ${c.liked ? 'on' : ''}`}
              onClick={() => onLike(c.id)}
            >
              <Glyph
                d={SF.heart}
                size={15}
                fill={c.liked ? 'currentColor' : 'none'}
                stroke={c.liked ? 0 : 1.9}
              />
              {(c.likes ?? 0) > 0 && <span>{c.likes}</span>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function CommentsPanel({
  lessonLabel,
  comments,
  viewerAvatarUrl,
  dark,
  onClose,
  onLike,
  onPost,
}: {
  lessonLabel: string
  comments: WatchComment[]
  viewerAvatarUrl?: string | null
  dark?: boolean
  onClose: () => void
  onLike?: (id: string) => void
  onPost?: (text: string) => void
}) {
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement | null>(null)
  useEsc(onClose)
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [comments.length])
  const post = () => {
    if (!text.trim() || !onPost) return
    onPost(text.trim())
    setText('')
  }
  return (
    <div
      className={`sov2 cmt-overlay${dark ? ' dark' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Discussion"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <aside className="cmt-panel">
        <div className="cmt-head">
          <div>
            <div className="cmt-h-title">Discussion</div>
            <div className="cmt-h-sub">{lessonLabel}</div>
          </div>
          <button className="cmt-x" onClick={onClose} aria-label="Close">
            <Glyph d={SF.close} size={15} stroke={2.4} />
          </button>
        </div>
        <div className="cmt-count">
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </div>
        <div className="cmt-list" ref={listRef}>
          {comments.length === 0 ? (
            <div className="cmt-empty">
              <div className="ce-ico">
                <Glyph d={SF.bubble} size={28} stroke={1.6} />
              </div>
              Be the first to comment on this lesson.
            </div>
          ) : (
            comments.map((c) => <CommentRow key={c.id} c={c} onLike={onLike} />)
          )}
        </div>
        {onPost && (
          <div className="cmt-compose">
            {viewerAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="cmt-av sm" src={viewerAvatarUrl} alt="You" />
            ) : (
              <div className="cmt-av sm" />
            )}
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') post()
              }}
              placeholder="Add to the discussion…"
            />
            <button
              className="cmt-send"
              disabled={!text.trim()}
              onClick={post}
              aria-label="Post"
            >
              <Glyph d={SF.send} size={19} fill="currentColor" />
            </button>
          </div>
        )}
      </aside>
      <WatchStyles />
    </div>
  )
}
