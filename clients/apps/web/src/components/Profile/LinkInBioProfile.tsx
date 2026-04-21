'use client'

import { getServerURL } from '@/utils/api'
import CalendarTodayOutlined from '@mui/icons-material/CalendarTodayOutlined'
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined'
import EmailOutlined from '@mui/icons-material/EmailOutlined'
import Facebook from '@mui/icons-material/Facebook'
import GitHub from '@mui/icons-material/GitHub'
import Instagram from '@mui/icons-material/Instagram'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import LinkedIn from '@mui/icons-material/LinkedIn'
import PlayCircleOutlined from '@mui/icons-material/PlayCircleOutlined'
import Public from '@mui/icons-material/Public'
import ShoppingBagOutlined from '@mui/icons-material/ShoppingBagOutlined'
import X from '@mui/icons-material/X'
import YouTube from '@mui/icons-material/YouTube'
import { schemas } from '@spaire/client'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'

interface PublicLink {
  id: string
  label: string
  url: string
  icon: string | null
  description: string | null
  button_label: string | null
}

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    width="20"
    height="20"
  >
    <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" />
  </svg>
)

const getSocialIcon = (platform: string) => {
  const cls = 'h-5 w-5'
  switch (platform) {
    case 'x':
      return <X className={cls} />
    case 'instagram':
      return <Instagram className={cls} />
    case 'facebook':
      return <Facebook className={cls} />
    case 'github':
      return <GitHub className={cls} />
    case 'youtube':
      return <YouTube className={cls} />
    case 'linkedin':
      return <LinkedIn className={cls} />
    case 'tiktok':
      return <TikTokIcon className={cls} />
    default:
      return <Public className={cls} />
  }
}

const getLinkIcon = (icon: string | null) => {
  const cls = 'h-6 w-6'
  switch (icon) {
    case 'calendar':
      return <CalendarTodayOutlined className={cls} />
    case 'email':
      return <EmailOutlined className={cls} />
    case 'document':
      return <DescriptionOutlined className={cls} />
    case 'video':
      return <PlayCircleOutlined className={cls} />
    case 'shop':
      return <ShoppingBagOutlined className={cls} />
    default:
      return <LinkOutlined className={cls} />
  }
}

interface ThemeClasses {
  isDark: boolean
  page: string
  primaryText: string
  mutedText: string
  cardBg: string
  cardBorder: string
  iconBg: string
  buttonBg: string
  buttonText: string
  buttonBorder: string
  divider: string
}

const getThemeClasses = (theme: 'light' | 'dark'): ThemeClasses => {
  if (theme === 'dark') {
    return {
      isDark: true,
      page: 'bg-gray-950 text-white',
      primaryText: 'text-white',
      mutedText: 'text-gray-400',
      cardBg: 'bg-gray-900',
      cardBorder: 'border-gray-800',
      iconBg: 'bg-gray-900 border-gray-800',
      buttonBg: 'bg-gray-800',
      buttonText: 'text-white',
      buttonBorder: 'border-gray-700',
      divider: 'border-gray-800',
    }
  }
  return {
    isDark: false,
    page: 'bg-white text-gray-900',
    primaryText: 'text-gray-900',
    mutedText: 'text-gray-500',
    cardBg: 'bg-white',
    cardBorder: 'border-gray-200',
    iconBg: 'bg-white border-gray-200',
    buttonBg: 'bg-white',
    buttonText: 'text-gray-900',
    buttonBorder: 'border-gray-200',
    divider: 'border-gray-100',
  }
}

const ProductRow = ({
  product,
  slug,
  t,
}: {
  product: schemas['ProductStorefront']
  slug: string
  t: ThemeClasses
}) => {
  const thumb = product.medias?.[0]?.public_url
  return (
    <Link
      href={`/${slug}/products/${product.id}`}
      className={`flex flex-row items-center gap-4 rounded-2xl border ${t.cardBorder} ${t.cardBg} p-3 transition-colors hover:opacity-90`}
    >
      <div
        className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border ${t.cardBorder} ${t.iconBg}`}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <ShoppingBagOutlined className={`h-5 w-5 ${t.mutedText}`} />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={`truncate text-sm font-semibold ${t.primaryText}`}>
          {product.name}
        </span>
        {product.description && (
          <span className={`truncate text-xs ${t.mutedText}`}>
            {product.description}
          </span>
        )}
      </div>
      <span
        className={`shrink-0 rounded-xl border ${t.buttonBorder} ${t.buttonBg} px-4 py-2 text-xs font-medium ${t.buttonText}`}
      >
        View
      </span>
    </Link>
  )
}

export const LinkInBioProfile = ({
  organization,
  products,
}: {
  organization: schemas['Organization']
  products: schemas['ProductStorefront'][]
}) => {
  const settings = organization.storefront_settings
  const theme = ((settings as { theme?: string } | null)?.theme ?? 'light') as
    | 'light'
    | 'dark'
  const t = getThemeClasses(theme)

  const description = settings?.description ?? null
  const featuredIds = settings?.featured_product_ids ?? []
  const featured = (
    featuredIds.length > 0
      ? products.filter((p) => featuredIds.includes(p.id))
      : products
  ).slice(0, 2)

  const linksQuery = useQuery({
    queryKey: ['public_organization_links', organization.slug],
    queryFn: async () => {
      const res = await fetch(
        getServerURL(`/v1/organization-links/public/${organization.slug}`),
        { credentials: 'include' },
      )
      if (!res.ok) return [] as PublicLink[]
      return (await res.json()) as PublicLink[]
    },
    retry: false,
  })

  const links = linksQuery.data ?? []
  const hasMoreProducts = products.length > featured.length

  return (
    <div className={`min-h-screen ${t.page}`}>
      <div className="mx-auto flex w-full max-w-xl flex-col items-center px-5 py-12 sm:py-16">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-6 text-center">
          {organization.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organization.avatar_url}
              alt={organization.name}
              className="h-24 w-24 rounded-full object-cover"
            />
          ) : (
            <Avatar
              className="h-24 w-24 rounded-full text-2xl"
              name={organization.name}
              avatar_url={null}
            />
          )}
          <div className="flex flex-col items-center gap-3">
            <h1 className={`text-3xl font-bold ${t.primaryText}`}>
              {organization.name}
            </h1>
            {description && (
              <p className={`max-w-md text-sm leading-relaxed ${t.mutedText}`}>
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Social icons row */}
        {organization.socials.length > 0 && (
          <div className="mt-6 flex flex-row flex-wrap items-center justify-center gap-2">
            {organization.socials.map((social, i) => (
              <a
                key={i}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.platform}
                className={`flex h-11 w-11 items-center justify-center rounded-xl border ${t.iconBg} ${t.primaryText} transition-opacity hover:opacity-70`}
              >
                {getSocialIcon(social.platform)}
              </a>
            ))}
          </div>
        )}

        {/* Link cards */}
        {links.length > 0 && (
          <div className="mt-8 flex w-full flex-col gap-3">
            {links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex flex-row items-center gap-4 rounded-2xl border ${t.cardBorder} ${t.cardBg} p-3 transition-colors hover:opacity-90`}
              >
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border ${t.cardBorder} ${t.iconBg} ${t.primaryText}`}
                >
                  {getLinkIcon(link.icon)}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={`truncate text-sm font-semibold ${t.primaryText}`}
                  >
                    {link.label}
                  </span>
                  {link.description && (
                    <span className={`truncate text-xs ${t.mutedText}`}>
                      {link.description}
                    </span>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-xl border ${t.buttonBorder} ${t.buttonBg} px-4 py-2 text-xs font-medium ${t.buttonText}`}
                >
                  {link.button_label?.trim() || 'View'}
                </span>
              </a>
            ))}
          </div>
        )}

        {/* Featured products */}
        {featured.length > 0 && (
          <div className="mt-10 flex w-full flex-col gap-3">
            <div className="flex flex-row items-center justify-between">
              <h2 className={`text-sm font-semibold ${t.primaryText}`}>
                Featured Products
              </h2>
            </div>
            {featured.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                slug={organization.slug}
                t={t}
              />
            ))}
            {hasMoreProducts && (
              <Link
                href={`/${organization.slug}/products`}
                className={`mt-1 flex w-full items-center justify-center rounded-2xl border ${t.buttonBorder} ${t.buttonBg} px-4 py-3 text-sm font-medium ${t.buttonText} transition-opacity hover:opacity-80`}
              >
                Visit their Spaire space
              </Link>
            )}
          </div>
        )}

        {/* Powered by */}
        <div
          className={`mt-14 flex flex-row items-center gap-x-1.5 border-t ${t.divider} pt-6 text-[11px] ${t.mutedText}`}
        >
          Powered by Spaire
        </div>
      </div>
    </div>
  )
}
