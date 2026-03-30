'use client'

import { schemas } from '@spaire/client'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import Link from 'next/link'
import { useEffect, useMemo } from 'react'
import { Gradient } from './GradientMesh'
import { computeComplementaryColor } from './utils'

interface StorefrontHeaderProps {
  organization: schemas['Organization']
  storefrontSettings?: schemas['OrganizationStorefrontSettings'] | null
}

export const StorefrontHeader = ({
  organization,
  storefrontSettings,
}: StorefrontHeaderProps) => {
  const settings = storefrontSettings ?? organization.storefront_settings
  const showHeader = settings?.show_header ?? true
  const showLogo = settings?.show_logo ?? true
  const showName = settings?.show_name ?? true
  const showDescription = settings?.show_description ?? true
  const headerImageUrl = settings?.header_image_url
  const description = settings?.description
  const accentColor = settings?.accent_color

  const gradient = useMemo(
    () => (typeof window !== 'undefined' ? new Gradient() : undefined),
    [],
  )

  useEffect(() => {
    if (!gradient || !showHeader || headerImageUrl) {
      return
    }

    const root = document.documentElement
    const baseColor = accentColor || '#121316'

    const [a, b, c, d] = computeComplementaryColor(baseColor)

    root.style.setProperty('--gradient-color-1', `#${a.toHex()}`)
    root.style.setProperty('--gradient-color-2', `#${b.toHex()}`)
    root.style.setProperty('--gradient-color-3', `#${c.toHex()}`)
    root.style.setProperty('--gradient-color-4', `#${d.toHex()}`)

    /* @ts-ignore */
    gradient.initGradient('#gradient-canvas')
  }, [gradient, organization, showHeader, headerImageUrl, accentColor])

  return (
    <div className="flex w-full grow flex-col items-center gap-y-6">
      {showHeader && (
        <div className="relative aspect-3/1 w-full rounded-2xl bg-gray-100 md:aspect-4/1 md:rounded-4xl dark:bg-black">
          {headerImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={headerImageUrl}
              alt="Store banner"
              className="absolute top-0 right-0 bottom-0 left-0 h-full w-full rounded-2xl object-cover md:rounded-4xl"
            />
          ) : (
            <canvas
              id="gradient-canvas"
              className="absolute top-0 right-0 bottom-0 left-0 h-full w-full rounded-2xl md:rounded-4xl"
            />
          )}
          {showLogo && (
            <Avatar
              className="dark:border-polar-950 absolute -bottom-16 left-1/2 h-32 w-32 -translate-x-1/2 border-8 border-white text-lg md:text-5xl"
              name={organization.name}
              avatar_url={organization.avatar_url}
            />
          )}
        </div>
      )}

      {/* If no header but logo, show avatar centered without banner */}
      {!showHeader && showLogo && (
        <Avatar
          className="h-24 w-24 text-lg md:text-4xl"
          name={organization.name}
          avatar_url={organization.avatar_url}
        />
      )}

      <div
        className={`flex grow flex-col items-center ${showHeader && showLogo ? 'mt-16' : 'mt-4'}`}
      >
        <div className="flex flex-col items-center md:gap-y-1">
          {showName && (
            <h1 className="text-xl md:text-3xl">{organization.name}</h1>
          )}
          {showName && (
            <Link
              className="dark:text-polar-500 text-gray-500"
              href={`/${organization.slug}`}
              tabIndex={-1}
            >
              @{organization.slug}
            </Link>
          )}
        </div>
        {showDescription && description && (
          <p className="dark:text-polar-400 mt-3 max-w-lg text-center text-gray-500">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}
