'use client'

import { useState } from 'react'
import {
  EMBED_PLATFORMS,
  EmbedPlatform,
  detectEmbedPlatform,
} from './platforms'

export type EmbedPickPayload = {
  url: string
  platform: EmbedPlatform
}

export const EmbedTab = ({
  onPick,
}: {
  onPick: (p: EmbedPickPayload) => void
}) => {
  const [picked, setPicked] = useState<EmbedPlatform | null>(null)
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (picked) {
    const submit = () => {
      const trimmed = url.trim()
      if (!trimmed) return
      const candidate = /^https?:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`
      const detected = detectEmbedPlatform(candidate)
      if (!detected || detected.id !== picked.id) {
        setError(`That doesn't look like a ${picked.label} URL.`)
        return
      }
      setError(null)
      onPick({ url: candidate, platform: picked })
    }

    return (
      <div className="wg-tab">
        <button
          type="button"
          className="wg-back"
          onClick={() => {
            setPicked(null)
            setUrl('')
            setError(null)
          }}
        >
          ← All platforms
        </button>
        <div className="wg-card" style={{ cursor: 'default', marginTop: 8 }}>
          <div className="wg-art" style={{ background: picked.bg }}>
            <picked.Icon className="h-5 w-5" />
          </div>
          <div className="wg-meta">
            <div className="wg-card-title">{picked.label}</div>
            <div className="wg-card-sub">
              {picked.sub}
              {!picked.canEmbed && ' · renders as a stylized link card'}
            </div>
          </div>
        </div>
        <div className="wg-input-pill" style={{ marginTop: 14 }}>
          <input
            autoFocus
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            placeholder={`Paste a ${picked.label} URL`}
          />
          <button
            type="button"
            className="wg-add-btn"
            disabled={!url.trim()}
            onClick={submit}
            aria-label="Embed"
          >
            +
          </button>
        </div>
        {error && (
          <p className="wg-help" style={{ color: '#b00020' }}>
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="wg-tab">
      <p className="wg-help">
        Pick a platform — videos, posts, tracks all embed live where supported.
      </p>
      <div className="wg-grid two embed">
        {EMBED_PLATFORMS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="wg-card"
            onClick={() => setPicked(p)}
          >
            <div className="wg-art" style={{ background: p.bg }}>
              <p.Icon className="h-5 w-5" />
            </div>
            <div className="wg-meta">
              <div className="wg-card-title">{p.label}</div>
              <div className="wg-card-sub">{p.sub}</div>
            </div>
            <span className="wg-add-btn small ghost" aria-hidden>
              +
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
