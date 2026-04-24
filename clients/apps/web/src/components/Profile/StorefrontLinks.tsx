'use client'

import LinkOutlined from '@mui/icons-material/LinkOutlined'
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined'

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
  autoplay = false,
  fullHeight = false,
}: {
  link: StorefrontLinkItem
  autoplay?: boolean
  fullHeight?: boolean
}) => {
  const platform = link.platform ?? ''
  const src = buildEmbedUrl(link.url, platform, autoplay)
  if (!src) return null

  // Embeds render at full container width. YouTube keeps a 16:9 aspect ratio,
  // Spotify/SoundCloud have native fixed heights.
  if (platform === 'youtube') {
    return (
      <div className="relative w-full overflow-hidden pt-[56.25%]">
        <iframe
          key={autoplay ? 'play' : 'pause'}
          src={src}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
          className="absolute inset-0 block h-full w-full"
          title={link.title ?? platform}
        />
      </div>
    )
  }

  const heights: Record<string, number> = {
    spotify: 80,
    soundcloud: 116,
  }
  const h = heights[platform] ?? (fullHeight ? 240 : 180)

  return (
    <iframe
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

// ─── URL row (classic) ───────────────────────────────────────────────────────

const UrlRow = ({ link }: { link: StorefrontLinkItem }) => (
  <a
    href={link.url}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm transition-all hover:shadow-md"
  >
    <Thumb link={link} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-gray-900">
        {link.title || getDomain(link.url)}
      </p>
      {link.description && (
        <p className="truncate text-xs text-gray-500">{link.description}</p>
      )}
      <p className="mt-0.5 truncate text-[11px] text-gray-400">
        {getDomain(link.url)}
      </p>
    </div>
    <OpenInNewOutlined
      style={{ fontSize: 16 }}
      className="shrink-0 text-gray-300"
    />
  </a>
)

const UrlList = ({ links }: { links: StorefrontLinkItem[] }) => (
  <div className="flex flex-col gap-3">
    {links.map((link) => (
      <UrlRow key={link.id} link={link} />
    ))}
  </div>
)

// ─── Embed card (full-width) ─────────────────────────────────────────────────
// Embeds always take the full container width so they make full use of the
// right-side space column.

const EmbedCard = ({ link }: { link: StorefrontLinkItem }) => {
  const canEmbed =
    link.type === 'embedded' &&
    link.platform &&
    buildEmbedUrl(link.url, link.platform, false)

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {canEmbed ? (
        <EmbedFrame link={link} />
      ) : (
        <Thumb link={link} className="aspect-[16/9] w-full object-cover" />
      )}
      {(link.title || link.description) && (
        <div className="flex flex-col gap-1.5 p-4">
          {link.title && (
            <h3 className="text-base font-bold text-gray-900">{link.title}</h3>
          )}
          {link.description && (
            <p className="line-clamp-2 text-sm text-gray-500">
              {link.description}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

const EmbedList = ({ links }: { links: StorefrontLinkItem[] }) => (
  <div className="flex w-full flex-col gap-5">
    {links.map((link) => (
      <EmbedCard key={link.id} link={link} />
    ))}
  </div>
)

// ─── Section label ───────────────────────────────────────────────────────────

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/60 bg-white/40 px-3.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-xl">
    <span className="text-[11px] font-semibold tracking-[0.14em] text-gray-700 uppercase">
      {children}
    </span>
  </div>
)

// ─── Main export ─────────────────────────────────────────────────────────────
// Each link's rendering is derived from its type: URLs render as classic
// rows, embeds as full-width cards. The legacy `layout` prop is accepted for
// backwards compatibility but ignored.

export const StorefrontLinks = ({
  links,
}: {
  links: StorefrontLinkItem[]
  layout?: LinksLayout
}) => {
  if (links.length === 0) return null

  const urlLinks = links.filter((l) => l.type !== 'embedded')
  const embedLinks = links.filter((l) => l.type === 'embedded')

  return (
    <div className="flex w-full flex-col gap-8">
      {embedLinks.length > 0 && (
        <div className="flex flex-col gap-4">
          <SectionLabel>Featured</SectionLabel>
          <EmbedList links={embedLinks} />
        </div>
      )}
      {urlLinks.length > 0 && (
        <div className="flex flex-col gap-4">
          <SectionLabel>Links</SectionLabel>
          <UrlList links={urlLinks} />
        </div>
      )}
    </div>
  )
}
