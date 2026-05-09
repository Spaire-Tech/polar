'use client'

import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
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
      <div className="atsp-tab-panel">
        <button
          type="button"
          className="atsp-back"
          onClick={() => {
            setPicked(null)
            setUrl('')
            setError(null)
          }}
        >
          <ArrowBackOutlined style={{ fontSize: 16 }} />
          All platforms
        </button>

        <div className="atsp-pill-card static">
          <div className="atsp-art" style={{ background: picked.bg }}>
            <picked.Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="atsp-tile-title">{picked.label}</div>
            <div className="atsp-tile-sub">
              {picked.sub}
              {!picked.canEmbed && ' · renders as a stylized link card'}
            </div>
          </div>
        </div>

        <div className="atsp-input-pill">
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
            className="atsp-add-btn"
            disabled={!url.trim()}
            onClick={submit}
            aria-label="Embed"
          >
            +
          </button>
        </div>

        {error && (
          <p className="atsp-help" style={{ color: '#b00020' }}>
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="atsp-tab-panel">
      <p className="atsp-help">
        Pick a platform — videos, posts, tracks all embed live where supported.
      </p>
      <div className="atsp-grid two">
        {EMBED_PLATFORMS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="atsp-pill-card"
            onClick={() => setPicked(p)}
          >
            <div className="atsp-art" style={{ background: p.bg }}>
              <p.Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="atsp-tile-title">{p.label}</div>
              <div className="atsp-tile-sub">{p.sub}</div>
            </div>
            <span className="atsp-add-btn small ghost" aria-hidden>
              +
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
