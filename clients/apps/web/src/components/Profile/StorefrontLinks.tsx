'use client'

import LinkOutlined from '@mui/icons-material/LinkOutlined'
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined'
import { SectionLabel } from './SectionLabel'
import {
  buildEmbedUrl,
  getDomain,
  getPlatformConfig,
} from './linkPlatforms'

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

// ─── Embed iframe ───────────────────────────────────────────────────────────
// Reads aspect ratio / fixed height from the platform config so adding a
// new embeddable platform is a one-file change in linkPlatforms.ts.

export const EmbedFrame = ({ link }: { link: StorefrontLinkItem }) => {
  const platform = link.platform ?? ''
  const src = buildEmbedUrl(link.url, platform)
  if (!src) return null
  const cfg = getPlatformConfig(platform)

  const commonProps = {
    src,
    frameBorder: '0',
    allow:
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen',
    allowFullScreen: true,
    loading: 'lazy' as const,
    title: link.title ?? platform,
  }

  if (cfg?.embedAspect) {
    // Responsive aspect-ratio iframe. paddingTop in % keeps the ratio
    // intact across container widths.
    const padding = (1 / cfg.embedAspect) * 100
    return (
      <div
        className="relative w-full overflow-hidden"
        style={{ paddingTop: `${padding}%` }}
      >
        <iframe
          {...commonProps}
          scrolling={platform === 'soundcloud' ? 'no' : undefined}
          className="absolute inset-0 block h-full w-full"
        />
      </div>
    )
  }

  return (
    <iframe
      {...commonProps}
      width="100%"
      height={cfg?.embedHeight ?? 180}
      scrolling={platform === 'soundcloud' ? 'no' : undefined}
      className="block w-full"
    />
  )
}

// ─── Shared thumbnail ───────────────────────────────────────────────────────

export const Thumb = ({
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

const ClassicList = ({ links }: { links: StorefrontLinkItem[] }) => (
  <div className="flex flex-col gap-3">
    {links.map((link) => (
      <UrlRow key={link.id} link={link} />
    ))}
  </div>
)

// ─── Card layout (large image + meta below) ──────────────────────────────────

const UrlCard = ({ link }: { link: StorefrontLinkItem }) => (
  <a
    href={link.url}
    target="_blank"
    rel="noopener noreferrer"
    className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md"
  >
    <Thumb link={link} className="aspect-[16/9] w-full object-cover" />
    <div className="flex flex-col gap-1 p-4">
      <p className="truncate text-base font-semibold text-gray-900">
        {link.title || getDomain(link.url)}
      </p>
      {link.description && (
        <p className="line-clamp-2 text-sm text-gray-500">{link.description}</p>
      )}
      <p className="mt-1 truncate text-[11px] text-gray-400">
        {getDomain(link.url)}
      </p>
    </div>
  </a>
)

const CardList = ({ links }: { links: StorefrontLinkItem[] }) => (
  <div className="flex flex-col gap-4">
    {links.map((link) => (
      <UrlCard key={link.id} link={link} />
    ))}
  </div>
)

// ─── Image grid layout (2-col square thumbs) ─────────────────────────────────

const UrlGridTile = ({ link }: { link: StorefrontLinkItem }) => (
  <a
    href={link.url}
    target="_blank"
    rel="noopener noreferrer"
    className="group relative block aspect-square overflow-hidden rounded-2xl bg-gray-100 shadow-sm transition-all hover:shadow-md"
  >
    <Thumb
      link={link}
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
    />
    <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 via-black/10 to-transparent p-3">
      <p className="line-clamp-2 text-sm font-semibold text-white">
        {link.title || getDomain(link.url)}
      </p>
      <p className="truncate text-[10px] text-white/70">
        {getDomain(link.url)}
      </p>
    </div>
  </a>
)

const ImageGrid = ({ links }: { links: StorefrontLinkItem[] }) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
    {links.map((link) => (
      <UrlGridTile key={link.id} link={link} />
    ))}
  </div>
)

// ─── Carousel layout (horizontal scroll snap) ────────────────────────────────

const UrlCarouselCard = ({ link }: { link: StorefrontLinkItem }) => (
  <a
    href={link.url}
    target="_blank"
    rel="noopener noreferrer"
    className="flex w-[240px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md"
  >
    <Thumb link={link} className="aspect-[4/3] w-full object-cover" />
    <div className="flex flex-col gap-1 p-3">
      <p className="line-clamp-2 text-sm font-semibold text-gray-900">
        {link.title || getDomain(link.url)}
      </p>
      <p className="truncate text-[11px] text-gray-400">
        {getDomain(link.url)}
      </p>
    </div>
  </a>
)

const Carousel = ({ links }: { links: StorefrontLinkItem[] }) => (
  <div
    className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2"
    style={{ scrollbarWidth: 'thin' }}
  >
    {links.map((link) => (
      <UrlCarouselCard key={link.id} link={link} />
    ))}
  </div>
)

const URL_LAYOUTS: Record<
  LinksLayout,
  React.ComponentType<{ links: StorefrontLinkItem[] }>
> = {
  classic: ClassicList,
  card: CardList,
  image_grid: ImageGrid,
  carousel: Carousel,
}

// ─── Embed card (full-width) ─────────────────────────────────────────────────
// Embeds always take the full container width so they make full use of the
// right-side space column.

export const EmbedCard = ({ link }: { link: StorefrontLinkItem }) => {
  const canEmbed =
    link.type === 'embedded' &&
    link.platform &&
    buildEmbedUrl(link.url, link.platform)

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

// ─── Main export ─────────────────────────────────────────────────────────────
// URL-typed links render in the chosen layout (classic, card, image_grid,
// carousel). Embedded links always render full-width because they need to
// play inline — a YouTube grid would just be tiny iframes.

export const StorefrontLinks = ({
  links,
  layout = 'classic',
}: {
  links: StorefrontLinkItem[]
  layout?: LinksLayout
}) => {
  if (links.length === 0) return null

  const urlLinks = links.filter((l) => l.type !== 'embedded')
  const embedLinks = links.filter((l) => l.type === 'embedded')

  const UrlRenderer = URL_LAYOUTS[layout] ?? ClassicList

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
          <UrlRenderer links={urlLinks} />
        </div>
      )}
    </div>
  )
}
