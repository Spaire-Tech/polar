'use client'

import { StorefrontLinkItem, StorefrontLinks } from '@/components/Profile/StorefrontLinks'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import YouTube from '@mui/icons-material/YouTube'
import MusicNoteOutlined from '@mui/icons-material/MusicNoteOutlined'
import Instagram from '@mui/icons-material/Instagram'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'
import { schemas } from '@spaire/client'
import { useCallback, useState } from 'react'
import { useFormContext } from 'react-hook-form'

// ─── Platform helpers ────────────────────────────────────────────────────────

function detectPlatform(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace('www.', '')
    if (host === 'youtube.com' || host === 'youtu.be') return 'youtube'
    if (host === 'open.spotify.com') return 'spotify'
    if (host === 'tiktok.com') return 'tiktok'
    if (host === 'soundcloud.com') return 'soundcloud'
    if (host === 'instagram.com') return 'instagram'
  } catch {}
  return null
}

const EMBEDDABLE = new Set(['youtube', 'spotify', 'soundcloud'])

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em">
    <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" />
  </svg>
)

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  youtube: <YouTube style={{ fontSize: 16 }} />,
  spotify: <MusicNoteOutlined style={{ fontSize: 16 }} />,
  soundcloud: <MusicNoteOutlined style={{ fontSize: 16 }} />,
  tiktok: <TikTokIcon />,
  instagram: <Instagram style={{ fontSize: 16 }} />,
}

// ─── Link edit card ───────────────────────────────────────────────────────────

const LinkEditCard = ({
  link,
  isLoading,
  isExpanded,
  onToggle,
  onUpdate,
  onRemove,
}: {
  link: StorefrontLinkItem
  isLoading?: boolean
  isExpanded: boolean
  onToggle: () => void
  onUpdate: (link: StorefrontLinkItem) => void
  onRemove: () => void
}) => {
  const domain = getDomain(link.url)
  const icon = link.platform ? PLATFORM_ICONS[link.platform] : <LinkOutlined style={{ fontSize: 16 }} />

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* Collapsed header */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        {link.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={link.image_url}
            alt=""
            className="h-10 w-10 shrink-0 rounded-lg object-cover"
          />
        ) : isLoading ? (
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-gray-100" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
            {icon}
          </div>
        )}

        <div className="min-w-0 flex-1">
          {isLoading ? (
            <div className="h-3 w-32 animate-pulse rounded bg-gray-100" />
          ) : (
            <p className="truncate text-sm font-medium text-gray-900">
              {link.title || domain}
            </p>
          )}
          <p className="truncate text-xs text-gray-400">{domain}</p>
        </div>

        {link.type === 'embedded' && (
          <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-600">
            Embed
          </span>
        )}

        <button
          type="button"
          onClick={onToggle}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100"
        >
          {isExpanded ? (
            <ExpandLessOutlined style={{ fontSize: 18 }} />
          ) : (
            <ExpandMoreOutlined style={{ fontSize: 18 }} />
          )}
        </button>

        <button
          type="button"
          onClick={onRemove}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <DeleteOutlined style={{ fontSize: 16 }} />
        </button>
      </div>

      {/* Expanded edit form */}
      {isExpanded && (
        <div className="flex flex-col gap-3 border-t border-gray-100 px-3 pb-4 pt-3">
          {/* Image URL */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">
              Image URL
            </label>
            <input
              type="url"
              value={link.image_url ?? ''}
              onChange={(e) =>
                onUpdate({ ...link, image_url: e.target.value || null })
              }
              placeholder="https://example.com/image.jpg"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
            />
          </div>

          {/* Title */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Title</label>
            <input
              type="text"
              value={link.title ?? ''}
              onChange={(e) =>
                onUpdate({ ...link, title: e.target.value || null })
              }
              placeholder={domain}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">
              Description
            </label>
            <textarea
              value={link.description ?? ''}
              onChange={(e) =>
                onUpdate({ ...link, description: e.target.value || null })
              }
              placeholder="Short description…"
              rows={2}
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export const StorefrontLinksPanel = ({
  organization,
  onBack,
}: {
  organization: schemas['Organization']
  onBack: () => void
}) => {
  const { watch, setValue, getValues } =
    useFormContext<schemas['OrganizationUpdate']>()
  const settings = watch('storefront_settings')
  const storefrontLinks: StorefrontLinkItem[] =
    ((settings as any)?.storefront_links ?? []) as StorefrontLinkItem[]
  const linksLayout = (settings as any)?.links_layout ?? 'carousel'

  const [newUrl, setNewUrl] = useState('')
  const [fetchingId, setFetchingId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const setLinks = useCallback(
    (links: StorefrontLinkItem[]) => {
      const current = getValues('storefront_settings') as any
      setValue(
        'storefront_settings',
        { ...(current ?? {}), storefront_links: links } as any,
        { shouldDirty: true },
      )
    },
    [getValues, setValue],
  )

  const addLink = useCallback(async () => {
    const url = newUrl.trim()
    if (!url) return
    const platform = detectPlatform(url)
    const type = platform && EMBEDDABLE.has(platform) ? 'embedded' : 'standard'
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const newLink: StorefrontLinkItem = {
      id, url, title: null, description: null, image_url: null, type, platform,
    }

    setNewUrl('')
    setFetchingId(id)
    setExpandedIds((prev) => new Set([...prev, id]))

    // Optimistically add the link
    const current = (getValues('storefront_settings') as any)?.storefront_links ?? []
    const withNew = [...current, newLink]
    setLinks(withNew)

    // Fetch metadata
    try {
      const res = await fetch(
        `/api/link-preview?url=${encodeURIComponent(url)}`,
      )
      if (res.ok) {
        const meta = await res.json()
        const latest = (getValues('storefront_settings') as any)?.storefront_links ?? []
        setLinks(
          (latest as StorefrontLinkItem[]).map((l) =>
            l.id === id
              ? {
                  ...l,
                  title: meta.title ?? null,
                  description: meta.description ?? null,
                  image_url: meta.image_url ?? null,
                }
              : l,
          ),
        )
      }
    } catch {}

    setFetchingId(null)
  }, [newUrl, getValues, setLinks])

  const updateLink = useCallback(
    (updated: StorefrontLinkItem) => {
      const current = (getValues('storefront_settings') as any)?.storefront_links ?? []
      setLinks(
        (current as StorefrontLinkItem[]).map((l) =>
          l.id === updated.id ? updated : l,
        ),
      )
    },
    [getValues, setLinks],
  )

  const removeLink = useCallback(
    (id: string) => {
      const current = (getValues('storefront_settings') as any)?.storefront_links ?? []
      setLinks((current as StorefrontLinkItem[]).filter((l) => l.id !== id))
      setExpandedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    },
    [getValues, setLinks],
  )

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <ArrowBackOutlined style={{ fontSize: 18 }} />
        </button>
        <h2 className="text-base font-semibold text-gray-900">Links</h2>
        <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {storefrontLinks.length}
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
        {/* URL input */}
        <div className="flex gap-2">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void addLink() }
            }}
            placeholder="Paste a URL to add a link…"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void addLink()}
            disabled={!newUrl.trim()}
            className="flex h-[42px] items-center gap-1 rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-default disabled:opacity-40"
          >
            <AddOutlined style={{ fontSize: 16 }} />
            Add
          </button>
        </div>

        {/* Links list */}
        {storefrontLinks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <LinkOutlined style={{ fontSize: 32 }} className="text-gray-200" />
            <p className="text-sm text-gray-400">
              Paste a URL above to add your first link
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {storefrontLinks.map((link) => (
              <LinkEditCard
                key={link.id}
                link={link}
                isLoading={fetchingId === link.id}
                isExpanded={expandedIds.has(link.id)}
                onToggle={() => toggleExpanded(link.id)}
                onUpdate={updateLink}
                onRemove={() => removeLink(link.id)}
              />
            ))}
          </div>
        )}

        {/* Live preview of the links in chosen layout */}
        {storefrontLinks.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Preview
            </p>
            <StorefrontLinks links={storefrontLinks} layout={linksLayout} />
          </div>
        )}
      </div>
    </div>
  )
}
