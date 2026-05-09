'use client'

import { getDomain } from '@/components/Profile/linkPlatforms'
import AddOutlined from '@mui/icons-material/AddOutlined'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
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

  // Debounced fetch as the user types.
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
    <div className="flex flex-col gap-5 px-1 pt-2">
      <p className="text-sm text-gray-500">
        Paste a URL — Spaire fetches the title, description and cover.
      </p>

      <div className="atsp-input-pill">
        <LinkOutlined className="h-5 w-5 shrink-0 text-gray-400" />
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
          className="atsp-add-btn bg-blue-600"
          disabled={!ready}
          onClick={submit}
          aria-label="Add link"
          title={ready ? 'Add link' : 'Enter a URL first'}
        >
          <AddOutlined className="h-5 w-5" />
        </button>
      </div>

      {loading && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
          Fetching preview…
        </div>
      )}

      {!loading && preview && (
        <button
          type="button"
          onClick={submit}
          className="atsp-pill-card"
          style={{ minHeight: 84 }}
        >
          <div
            className="atsp-art bg-gray-100"
            style={
              preview.image_url
                ? {
                    backgroundImage: `url(${preview.image_url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : undefined
            }
          >
            {!preview.image_url && (preview.host[0]?.toUpperCase() ?? '•')}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-gray-900">
              {preview.title || preview.host}
            </div>
            {preview.description && (
              <div className="truncate text-[12.5px] text-gray-500">
                {preview.description}
              </div>
            )}
            <div className="truncate text-[11px] text-gray-400">
              {preview.host}
            </div>
          </div>
          <span className="atsp-add-btn small bg-blue-600">
            <AddOutlined className="h-4 w-4" />
          </span>
        </button>
      )}

      {!loading && !preview && !error && raw && !ready && (
        <p className="text-xs text-gray-400">
          That doesn&apos;t look like a URL yet.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}
