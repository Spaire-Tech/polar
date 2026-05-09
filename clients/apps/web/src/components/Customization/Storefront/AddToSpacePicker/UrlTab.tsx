'use client'

import { getDomain } from '@/components/Profile/linkPlatforms'
import { useEffect, useState } from 'react'

type Preview = {
  url: string
  host: string
  title: string | null
  description: string | null
  image_url: string | null
}

export type UrlPickPayload = {
  url: string
  title: string | null
  description: string | null
  image_url: string | null
}

const normalize = (raw: string): string | null => {
  const trimmed = raw.trim()
  if (!trimmed) return null
  let candidate = trimmed
  if (!/^https?:\/\//i.test(candidate)) candidate = 'https://' + candidate
  try {
    const u = new URL(candidate)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

export const UrlTab = ({ onPick }: { onPick: (p: UrlPickPayload) => void }) => {
  const [raw, setRaw] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounced preview fetch as the user types.
  useEffect(() => {
    const url = normalize(raw)
    if (!url) {
      setPreview(null)
      setError(null)
      return
    }
    const controller = new AbortController()
    const handle = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/link-preview?url=${encodeURIComponent(url)}`,
          { signal: controller.signal },
        )
        if (!res.ok) {
          setError('Could not fetch preview')
          setPreview(null)
        } else {
          const meta = await res.json()
          setPreview({
            url,
            host: getDomain(url),
            title: meta.title ?? null,
            description: meta.description ?? null,
            image_url: meta.image_url ?? null,
          })
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setError('Could not fetch preview')
          setPreview(null)
        }
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => {
      controller.abort()
      window.clearTimeout(handle)
    }
  }, [raw])

  const submit = () => {
    const url = normalize(raw)
    if (!url) return
    onPick({
      url,
      title: preview?.title ?? null,
      description: preview?.description ?? null,
      image_url: preview?.image_url ?? null,
    })
  }

  const ready = !!normalize(raw)

  return (
    <div className="atsp-tab-panel">
      <p className="atsp-help">
        Paste a URL — Spaire fetches the title, description and cover.
      </p>

      <div className="atsp-input-pill">
        <input
          autoFocus
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && ready) submit()
          }}
          placeholder="https://"
        />
        <button
          type="button"
          className="atsp-add-btn"
          disabled={!ready}
          onClick={submit}
          aria-label="Add link"
          title={ready ? 'Add link' : 'Enter a URL first'}
        >
          +
        </button>
      </div>

      {loading && (
        <div
          className="atsp-pill-card static"
          style={{ opacity: 0.6, pointerEvents: 'none' }}
        >
          <div className="atsp-art dashed">…</div>
          <div className="min-w-0 flex-1">
            <div className="atsp-tile-title">Fetching preview…</div>
          </div>
        </div>
      )}

      {!loading && preview && (
        <button type="button" onClick={submit} className="atsp-pill-card">
          <div
            className="atsp-art"
            style={
              preview.image_url
                ? {
                    backgroundImage: `url(${preview.image_url})`,
                  }
                : undefined
            }
          >
            {!preview.image_url && (preview.host[0]?.toUpperCase() ?? '•')}
          </div>
          <div className="min-w-0 flex-1">
            <div className="atsp-tile-title">
              {preview.title || preview.host}
            </div>
            {preview.description && (
              <div className="atsp-tile-sub">{preview.description}</div>
            )}
            <div
              className="atsp-tile-sub"
              style={{ fontSize: 11, marginTop: 2 }}
            >
              {preview.host}
            </div>
          </div>
          <span className="atsp-add-btn small">+</span>
        </button>
      )}

      {!loading && !preview && !error && raw && !ready && (
        <p className="atsp-help" style={{ color: 'var(--atsp-muted-2)' }}>
          That doesn&apos;t look like a URL yet.
        </p>
      )}

      {error && (
        <p className="atsp-help" style={{ color: '#b00020' }}>
          {error}
        </p>
      )}
    </div>
  )
}
