'use client'

import { schemas } from '@spaire/client'
import Avatar from '@spaire/ui/components/atoms/Avatar'
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
    <div className="flex w-full flex-col items-center">
      {/* Banner */}
      {showHeader && (
        <div className="relative w-full overflow-hidden rounded-none bg-gray-100 dark:bg-black"
          style={{ aspectRatio: '16 / 3' }}
        >
          {headerImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={headerImageUrl}
              alt="Store banner"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <canvas
              id="gradient-canvas"
              className="absolute inset-0 h-full w-full"
            />
          )}
          {showLogo && (
            <Avatar
              className="dark:border-polar-950 absolute -bottom-10 left-1/2 h-20 w-20 -translate-x-1/2 border-4 border-white text-lg md:text-3xl"
              name={organization.name}
              avatar_url={organization.avatar_url}
            />
          )}
        </div>
      )}

      {/* If no header but logo, show avatar centered */}
      {!showHeader && showLogo && (
        <Avatar
          className="h-20 w-20 text-lg md:text-3xl"
          name={organization.name}
          avatar_url={organization.avatar_url}
        />
      )}

      {/* Name + Description */}
      <div
        className={`flex flex-col items-center gap-y-2 ${showHeader && showLogo ? 'mt-14' : 'mt-4'}`}
      >
        {showName && (
          <h1 className="text-xl font-bold dark:text-white">
            {organization.name}
          </h1>
        )}
        {showDescription && description && (
          <p className="dark:text-polar-400 max-w-lg text-center text-sm text-gray-500">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}
