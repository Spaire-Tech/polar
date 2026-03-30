'use client'

import { schemas } from '@spaire/client'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import { useEffect, useMemo } from 'react'
import { Gradient } from './GradientMesh'
import { computeComplementaryColor } from './utils'

const SOCIAL_LABELS: Record<string, string> = {
  x: 'Twitter',
  github: 'GitHub',
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  other: 'Website',
}

interface StorefrontHeaderProps {
  organization: schemas['Organization']
}

export const StorefrontHeader = ({ organization }: StorefrontHeaderProps) => {
  const accentColor =
    organization.profile_settings?.accent_color || '#6366f1'

  const gradient = useMemo(
    () => (typeof window !== 'undefined' ? new Gradient() : undefined),
    [],
  )

  useEffect(() => {
    if (!gradient) {
      return
    }

    const root = document.documentElement
    const [a, b, c, d] = computeComplementaryColor(accentColor)

    root.style.setProperty('--gradient-color-1', `#${a.toHex()}`)
    root.style.setProperty('--gradient-color-2', `#${b.toHex()}`)
    root.style.setProperty('--gradient-color-3', `#${c.toHex()}`)
    root.style.setProperty('--gradient-color-4', `#${d.toHex()}`)

    /* @ts-ignore */
    gradient.initGradient('#gradient-canvas')
  }, [gradient, accentColor, organization])

  const description = organization.profile_settings?.description
  const socials = organization.socials ?? []

  return (
    <div className="flex w-full flex-col items-center">
      {/* Banner */}
      <div className="relative w-full overflow-hidden rounded-2xl md:rounded-3xl">
        <div className="relative aspect-[3/1] w-full md:aspect-[4/1]">
          <canvas
            id="gradient-canvas"
            className="absolute inset-0 h-full w-full"
          />
        </div>

        {/* Avatar overlapping banner bottom */}
        <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 md:-bottom-16">
          <Avatar
            className="h-28 w-28 border-[6px] border-gray-50 text-3xl shadow-lg md:h-32 md:w-32 md:text-5xl dark:border-spaire-950"
            name={organization.name}
            avatar_url={organization.avatar_url}
          />
        </div>
      </div>

      {/* Store info */}
      <div className="mt-16 flex flex-col items-center gap-y-3 text-center md:mt-20">
        <h1 className="text-2xl font-semibold text-gray-900 md:text-3xl dark:text-white">
          {organization.name}
        </h1>

        {description && (
          <p className="max-w-lg text-base leading-relaxed text-gray-500 dark:text-spaire-500">
            {description}
          </p>
        )}

        {/* Social links */}
        {socials.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-1">
            {socials.map((social, index) => (
              <span key={social.url} className="flex items-center">
                {index > 0 && (
                  <span className="mx-1 text-gray-300 dark:text-spaire-700">
                    /
                  </span>
                )}
                <a
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-gray-900 underline decoration-gray-300 underline-offset-2 transition-colors hover:decoration-gray-900 dark:text-white dark:decoration-spaire-700 dark:hover:decoration-white"
                >
                  {SOCIAL_LABELS[social.platform] || social.platform}
                </a>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
