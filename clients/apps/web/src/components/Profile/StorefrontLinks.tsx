'use client'

import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined'
import YouTube from '@mui/icons-material/YouTube'
import MusicNoteOutlined from '@mui/icons-material/MusicNoteOutlined'
import Instagram from '@mui/icons-material/Instagram'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import { useState } from 'react'

export type StorefrontLinkItem = {
  id: string
  url: string
  title?: string | null
  type: 'standard' | 'embedded'
  platform?: string | null
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

function getYouTubeEmbedUrl(url: string): string | null {
  const videoId = url.match(
    /(?:v=|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/,
  )?.[1]
  return videoId ? `https://www.youtube.com/embed/${videoId}?rel=0` : null
}

function getSpotifyEmbedUrl(url: string): string | null {
  const match = url.match(
    /open\.spotify\.com\/(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)/,
  )
  return match
    ? `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator`
    : null
}

function getSoundCloudEmbedUrl(url: string): string {
  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`
}

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    width="1em"
    height="1em"
  >
    <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" />
  </svg>
)

const PLATFORM_ICONS: Record<string, React.FC<{ className?: string }>> = {
  youtube: ({ className }) => <YouTube className={className} style={{ fontSize: 18 }} />,
  spotify: ({ className }) => <MusicNoteOutlined className={className} style={{ fontSize: 18 }} />,
  soundcloud: ({ className }) => <MusicNoteOutlined className={className} style={{ fontSize: 18 }} />,
  tiktok: ({ className }) => <TikTokIcon className={className} />,
  instagram: ({ className }) => <Instagram className={className} style={{ fontSize: 18 }} />,
}

const StandardCard = ({ link }: { link: StorefrontLinkItem }) => {
  const [faviconFailed, setFaviconFailed] = useState(false)
  const domain = getDomain(link.url)
  const title = link.title || domain
  const PlatformIcon = link.platform ? PLATFORM_ICONS[link.platform] : null

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-[220px] shrink-0 items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 transition-colors hover:bg-gray-50"
    >
      {PlatformIcon ? (
        <PlatformIcon className="shrink-0 text-gray-500" />
      ) : faviconFailed ? (
        <LinkOutlined style={{ fontSize: 18 }} className="shrink-0 text-gray-400" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
          alt=""
          width={20}
          height={20}
          className="h-5 w-5 shrink-0 rounded"
          onError={() => setFaviconFailed(true)}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{title}</p>
        <p className="truncate text-xs text-gray-400">{domain}</p>
      </div>
      <OpenInNewOutlined style={{ fontSize: 14 }} className="shrink-0 text-gray-300" />
    </a>
  )
}

const YouTubeCard = ({ link }: { link: StorefrontLinkItem }) => {
  const embedUrl = getYouTubeEmbedUrl(link.url)
  if (!embedUrl) return <StandardCard link={link} />
  return (
    <div className="w-[280px] shrink-0 overflow-hidden rounded-2xl shadow-sm">
      <iframe
        src={embedUrl}
        width="280"
        height="157"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="block"
        title={link.title ?? 'YouTube video'}
      />
    </div>
  )
}

const SpotifyCard = ({ link }: { link: StorefrontLinkItem }) => {
  const embedUrl = getSpotifyEmbedUrl(link.url)
  if (!embedUrl) return <StandardCard link={link} />
  return (
    <div className="w-[280px] shrink-0 overflow-hidden rounded-2xl shadow-sm">
      <iframe
        src={embedUrl}
        width="280"
        height="80"
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        className="block"
        title={link.title ?? 'Spotify'}
      />
    </div>
  )
}

const SoundCloudCard = ({ link }: { link: StorefrontLinkItem }) => {
  const embedUrl = getSoundCloudEmbedUrl(link.url)
  return (
    <div className="w-[280px] shrink-0 overflow-hidden rounded-2xl shadow-sm">
      <iframe
        width="280"
        height="116"
        scrolling="no"
        frameBorder="no"
        src={embedUrl}
        className="block"
        title={link.title ?? 'SoundCloud'}
      />
    </div>
  )
}

const LinkCard = ({ link }: { link: StorefrontLinkItem }) => {
  if (link.type !== 'embedded') return <StandardCard link={link} />
  switch (link.platform) {
    case 'youtube':
      return <YouTubeCard link={link} />
    case 'spotify':
      return <SpotifyCard link={link} />
    case 'soundcloud':
      return <SoundCloudCard link={link} />
    default:
      return <StandardCard link={link} />
  }
}

export const StorefrontLinks = ({
  links,
}: {
  links: StorefrontLinkItem[]
}) => {
  if (links.length === 0) return null

  // Duplicate items enough times so the carousel has enough content to loop
  const minItems = Math.max(links.length * 2, 6)
  const factor = Math.ceil(minItems / links.length)
  const loopItems = Array.from({ length: factor * 2 }, () => links).flat()

  // Speed: ~70px/s, each card ~260px avg width + 12px gap = 272px
  const singleSetWidth = links.length * 272
  const duration = Math.max(12, singleSetWidth / 70)

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/60 bg-white/40 px-3.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-xl">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-700">
          Links
        </span>
      </div>

      <style>{`
        @keyframes sf-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .sf-marquee-track:hover { animation-play-state: paused !important; }
      `}</style>

      <div className="overflow-hidden">
        <div
          className="sf-marquee-track flex items-center gap-3"
          style={{
            width: 'max-content',
            animation: `sf-marquee ${duration}s linear infinite`,
          }}
        >
          {loopItems.map((link, i) => (
            <LinkCard key={`${link.id}-${i}`} link={link} />
          ))}
        </div>
      </div>
    </div>
  )
}
