'use client'

import AddOutlined from '@mui/icons-material/AddOutlined'
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
      // Validate the URL points to the picked platform.
      const detected = detectEmbedPlatform(
        /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
      )
      if (!detected || detected.id !== picked.id) {
        setError(`That doesn't look like a ${picked.label} URL.`)
        return
      }
      setError(null)
      onPick({
        url: /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
        platform: picked,
      })
    }

    return (
      <div className="flex flex-col gap-5 px-1 pt-2">
        <button
          type="button"
          onClick={() => {
            setPicked(null)
            setUrl('')
            setError(null)
          }}
          className="flex w-fit items-center gap-1 self-start rounded-full px-2 py-1 text-[13px] text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowBackOutlined className="h-4 w-4" />
          All platforms
        </button>

        <div className="atsp-pill-card" style={{ cursor: 'default' }}>
          <div className="atsp-art" style={{ background: picked.bg }}>
            <picked.Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-gray-900">
              {picked.label}
            </div>
            <div className="truncate text-[12.5px] text-gray-500">
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
            className="atsp-add-btn bg-blue-600"
            disabled={!url.trim()}
            onClick={submit}
            aria-label="Embed"
          >
            <AddOutlined className="h-5 w-5" />
          </button>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 px-1 pt-2">
      <p className="text-sm text-gray-500">
        Pick a platform — videos, posts, tracks all embed live where supported.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <div className="truncate text-sm font-medium text-gray-900">
                {p.label}
              </div>
              <div className="truncate text-[12.5px] text-gray-500">
                {p.sub}
              </div>
            </div>
            <span className="atsp-add-btn small ghost" aria-hidden>
              <AddOutlined className="h-4 w-4" />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
