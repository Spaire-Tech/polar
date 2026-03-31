'use client'

import { schemas } from '@spaire/client'
import Facebook from '@mui/icons-material/Facebook'
import GitHub from '@mui/icons-material/GitHub'
import Instagram from '@mui/icons-material/Instagram'
import LinkedIn from '@mui/icons-material/LinkedIn'
import Public from '@mui/icons-material/Public'
import X from '@mui/icons-material/X'
import YouTube from '@mui/icons-material/YouTube'
import LanguageOutlined from '@mui/icons-material/LanguageOutlined'
import EmailOutlined from '@mui/icons-material/EmailOutlined'
import Link from 'next/link'

interface AboutContentProps {
  organization: schemas['Organization']
}

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
    default:
      return <Public className={cls} />
  }
}

const getPlatformLabel = (platform: string) => {
  const labels: Record<string, string> = {
    x: 'X (Twitter)',
    instagram: 'Instagram',
    facebook: 'Facebook',
    github: 'GitHub',
    youtube: 'YouTube',
    linkedin: 'LinkedIn',
    tiktok: 'TikTok',
  }
  return labels[platform] ?? 'Website'
}

export const AboutContent = ({ organization }: AboutContentProps) => {
  const description =
    organization.storefront_settings?.description ?? null

  const hasSocials = organization.socials.length > 0
  const hasWebsite = !!organization.website
  const hasEmail = !!organization.email
  const hasAnyInfo = description || hasSocials || hasWebsite || hasEmail

  if (!hasAnyInfo) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="dark:text-polar-500 text-gray-500">
          No information available yet
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-8">
      {/* Description */}
      {description && (
        <div className="flex flex-col gap-y-3">
          <h2 className="text-lg font-medium text-gray-950 dark:text-white">
            About
          </h2>
          <p className="dark:text-polar-400 leading-relaxed text-gray-600">
            {description}
          </p>
        </div>
      )}

      {/* Links & Socials */}
      {(hasSocials || hasWebsite || hasEmail) && (
        <div className="flex flex-col gap-y-3">
          <h2 className="text-lg font-medium text-gray-950 dark:text-white">
            Links
          </h2>
          <div className="flex flex-col gap-y-3">
            {hasWebsite && (
              <Link
                href={organization.website!}
                target="_blank"
                rel="noopener noreferrer"
                className="dark:text-polar-400 flex flex-row items-center gap-x-3 text-sm text-gray-600 transition-colors hover:text-gray-900 dark:hover:text-white"
              >
                <LanguageOutlined className="h-5 w-5" />
                <span>{organization.website}</span>
              </Link>
            )}
            {hasEmail && (
              <Link
                href={`mailto:${organization.email}`}
                className="dark:text-polar-400 flex flex-row items-center gap-x-3 text-sm text-gray-600 transition-colors hover:text-gray-900 dark:hover:text-white"
              >
                <EmailOutlined className="h-5 w-5" />
                <span>{organization.email}</span>
              </Link>
            )}
            {organization.socials.map((social, i) => (
              <Link
                key={i}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="dark:text-polar-400 flex flex-row items-center gap-x-3 text-sm text-gray-600 transition-colors hover:text-gray-900 dark:hover:text-white"
              >
                {getSocialIcon(social.platform)}
                <span>{getPlatformLabel(social.platform)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
