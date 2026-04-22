'use client'

import ChevronLeftOutlined from '@mui/icons-material/ChevronLeftOutlined'
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined'
import { useState } from 'react'

export type StorefrontLinkItem = {
  id: string
  url: string
  title?: string | null
  description?: string | null
  image_url?: string | null
  type: 'standard' | 'embedded'
  platform?: string | null
}

export type LinksLayout = 'classic' | 'carousel' | 'image_grid' | 'card'

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

function buildEmbedUrl(
  url: string,
  platform: string,
  autoplay: boolean,
): string | null {
  switch (platform) {
    case 'youtube': {
      const videoId = url.match(
        /(?:v=|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/,
      )?.[1]
      if (!videoId) return null
      const p = new URLSearchParams({ rel: '0', modestbranding: '1' })
      if (autoplay) {
        p.set('autoplay', '1')
        p.set('mute', '1')
      }
      return `https://www.youtube.com/embed/${videoId}?${p}`
    }
    case 'spotify': {
      const m = url.match(
        /open\.spotify\.com\/(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)/,
      )
      if (!m) return null
      const p = new URLSearchParams({ utm_source: 'generator' })
      if (autoplay) p.set('autoplay', '1')
      return `https://open.spotify.com/embed/${m[1]}/${m[2]}?${p}`
    }
    case 'soundcloud': {
      const p = new URLSearchParams({
        url,
        color: '#ff5500',
        auto_play: autoplay ? 'true' : 'false',
        hide_related: 'true',
        show_comments: 'false',
        show_user: 'true',
        show_reposts: 'false',
        show_teaser: 'false',
      })
      return `https://w.soundcloud.com/player/?${p}`
    }
    default:
      return null
  }
}

// ─── Embed iframe ───────────────────────────────────────────────────────────

const EmbedFrame = ({
  link,
  autoplay,
  fullWidth = false,
}: {
  link: StorefrontLinkItem
  autoplay: boolean
  fullWidth?: boolean
}) => {
  const platform = link.platform ?? ''
  const src = buildEmbedUrl(link.url, platform, autoplay)
  if (!src) return null

  const heights: Record<string, number> = {
    youtube: fullWidth ? 380 : 200,
    spotify: 80,
    soundcloud: 116,
  }
  const h = heights[platform] ?? 160

  return (
    <iframe
      // key forces remount (and thus autoplay) when autoplay prop changes
      key={autoplay ? 'play' : 'pause'}
      src={src}
      width="100%"
      height={h}
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
      scrolling={platform === 'soundcloud' ? 'no' : undefined}
      loading="lazy"
      className="block w-full"
      title={link.title ?? platform}
    />
  )
}

// ─── Shared thumbnail ───────────────────────────────────────────────────────

const Thumb = ({
  link,
  className,
}: {
  link: StorefrontLinkItem
  className?: string
}) =>
  link.image_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={link.image_url} alt="" className={className} />
  ) : (
    <div
      className={`flex items-center justify-center bg-gray-100 ${className ?? ''}`}
    >
      <LinkOutlined style={{ fontSize: 24 }} className="text-gray-300" />
    </div>
  )

// ─── Classic layout ─────────────────────────────────────────────────────────

const ClassicLayout = ({ links }: { links: StorefrontLinkItem[] }) => (
  <div className="flex flex-col gap-3">
    {links.map((link) => (
      <a
        key={link.id}
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 transition-all hover:shadow-sm"
      >
        <Thumb
          link={link}
          className="h-12 w-12 shrink-0 rounded-xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">
            {link.title || getDomain(link.url)}
          </p>
          {link.description && (
            <p className="truncate text-xs text-gray-500">{link.description}</p>
          )}
        </div>
        <OpenInNewOutlined
          style={{ fontSize: 16 }}
          className="shrink-0 text-gray-300"
        />
      </a>
    ))}
  </div>
)

// ─── Carousel layout ────────────────────────────────────────────────────────

const CarouselCard = ({
  link,
  isActive,
}: {
  link: StorefrontLinkItem
  isActive: boolean
}) => {
  const hasEmbed =
    link.type === 'embedded' && link.platform && buildEmbedUrl(link.url, link.platform, false)

  return (
    <div className="flex w-full min-w-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {hasEmbed ? (
        <EmbedFrame link={link} autoplay={isActive} />
      ) : (
        <Thumb link={link} className="h-48 w-full object-cover" />
      )}
      <div className="flex flex-col gap-1 p-4">
        <p className="font-semibold text-gray-900">
          {link.title || getDomain(link.url)}
        </p>
        {link.description && (
          <p className="line-clamp-2 text-sm text-gray-500">
            {link.description}
          </p>
        )}
        {link.type === 'standard' && (
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-1 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700"
          >
            {getDomain(link.url)}
            <OpenInNewOutlined style={{ fontSize: 11 }} />
          </a>
        )}
      </div>
    </div>
  )
}

const CarouselLayout = ({ links }: { links: StorefrontLinkItem[] }) => {
  const [current, setCurrent] = useState(0)

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {links.map((link, i) => (
            <CarouselCard key={link.id} link={link} isActive={i === current} />
          ))}
        </div>

        {current > 0 && (
          <button
            type="button"
            aria-label="Previous"
            onClick={() => setCurrent((c) => c - 1)}
            className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur-sm transition hover:bg-white"
          >
            <ChevronLeftOutlined style={{ fontSize: 20 }} />
          </button>
        )}
        {current < links.length - 1 && (
          <button
            type="button"
            aria-label="Next"
            onClick={() => setCurrent((c) => c + 1)}
            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur-sm transition hover:bg-white"
          >
            <ChevronRightOutlined style={{ fontSize: 20 }} />
          </button>
        )}
      </div>

      {links.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {links.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === current ? 'w-4 bg-gray-900' : 'w-1.5 bg-gray-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Image grid layout ───────────────────────────────────────────────────────

const ImageGridLayout = ({ links }: { links: StorefrontLinkItem[] }) => (
  <div className="grid grid-cols-2 gap-3">
    {links.map((link) => (
      <a
        key={link.id}
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
      >
        <Thumb
          link={link}
          className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="p-3">
          <p className="line-clamp-2 text-[13px] font-semibold text-gray-900">
            {link.title || getDomain(link.url)}
          </p>
        </div>
      </a>
    ))}
  </div>
)

// ─── Card layout ─────────────────────────────────────────────────────────────

const CardLayout = ({ links }: { links: StorefrontLinkItem[] }) => {
  const [current, setCurrent] = useState(0)
  const link = links[current]

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        {link.type === 'embedded' && link.platform ? (
          <EmbedFrame link={link} autoplay fullWidth />
        ) : (
          <Thumb link={link} className="h-56 w-full object-cover" />
        )}
        <div className="flex flex-col gap-2 p-6">
          <h3 className="text-lg font-bold text-gray-900">
            {link.title || getDomain(link.url)}
          </h3>
          {link.description && (
            <p className="text-sm text-gray-500">{link.description}</p>
          )}
          {link.type === 'standard' && (
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            >
              Visit <OpenInNewOutlined style={{ fontSize: 14 }} />
            </a>
          )}
        </div>
      </div>

      {links.length > 1 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronLeftOutlined style={{ fontSize: 18 }} />
          </button>
          <span className="text-xs text-gray-400">
            {current + 1} / {links.length}
          </span>
          <button
            type="button"
            onClick={() => setCurrent((c) => Math.min(links.length - 1, c + 1))}
            disabled={current === links.length - 1}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronRightOutlined style={{ fontSize: 18 }} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────

export const StorefrontLinks = ({
  links,
  layout = 'carousel',
}: {
  links: StorefrontLinkItem[]
  layout?: LinksLayout
}) => {
  if (links.length === 0) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/60 bg-white/40 px-3.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-xl">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-700">
          Links
        </span>
      </div>

      {layout === 'classic' && <ClassicLayout links={links} />}
      {layout === 'carousel' && <CarouselLayout links={links} />}
      {layout === 'image_grid' && <ImageGridLayout links={links} />}
      {layout === 'card' && <CardLayout links={links} />}
    </div>
  )
}
