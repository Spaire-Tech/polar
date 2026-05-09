'use client'

import { getDomain } from '@/components/Profile/linkPlatforms'
import { useEffect, useState } from 'react'

type Preview = {
  url: string
  host: string
  title: string | null
  description: string | null
  image_url: string | null
  glyph: string
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

  useEffect(() => {
    const url = normalize(raw)
    if (!url) {
      setPreview(null)
      return
    }
    const controller = new AbortController()
    const handle = window.setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/link-preview?url=${encodeURIComponent(url)}`,
          { signal: controller.signal },
        )
        if (res.ok) {
          const meta = await res.json()
          const host = getDomain(url)
          setPreview({
            url,
            host,
            title: meta.title ?? null,
            description: meta.description ?? null,
            image_url: meta.image_url ?? null,
            glyph: host[0]?.toUpperCase() ?? '•',
          })
        } else {
          const host = getDomain(url)
          setPreview({
            url,
            host,
            title: null,
            description: null,
            image_url: null,
            glyph: host[0]?.toUpperCase() ?? '•',
          })
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
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
    <div className="wg-tab">
      <p className="wg-help">
        Paste a URL — Spaire fetches the title, favicon and preview.
      </p>
      <div className="wg-input-pill">
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
          className="wg-add-btn"
          disabled={!ready}
          onClick={submit}
          aria-label="Add"
          title={ready ? 'Add link' : 'Enter a URL first'}
        >
          +
        </button>
      </div>
      {preview && !loading && (
        <button
          type="button"
          className="wg-card preview-card"
          onClick={submit}
          style={{ cursor: 'pointer' }}
        >
          <div
            className="wg-art"
            style={
              preview.image_url
                ? { backgroundImage: `url(${preview.image_url})` }
                : { background: 'linear-gradient(135deg, #c9c5bb, #7d7a73)' }
            }
          >
            {!preview.image_url && preview.glyph}
          </div>
          <div className="wg-meta">
            <div className="wg-card-title">{preview.title || preview.host}</div>
            <div className="wg-card-sub">{preview.host}</div>
          </div>
          <span className="wg-add-btn small" aria-label="Add">
            +
          </span>
        </button>
      )}
      {!preview && !loading && (
        <div className="wg-empty">
          <div className="wg-empty-shape" />
          <div>A clean preview will appear here.</div>
        </div>
      )}
      {loading && (
        <div className="wg-empty">
          <div className="wg-empty-shape" />
          <div>Fetching preview…</div>
        </div>
      )}
    </div>
  )
}
