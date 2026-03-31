'use client'

import LogoIcon from '@/components/Brand/LogoIcon'
import LogoType from '@/components/Brand/LogoType'
import { schemas } from '@spaire/client'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import Facebook from '@mui/icons-material/Facebook'
import GitHub from '@mui/icons-material/GitHub'
import Instagram from '@mui/icons-material/Instagram'
import LinkedIn from '@mui/icons-material/LinkedIn'
import Public from '@mui/icons-material/Public'
import X from '@mui/icons-material/X'
import YouTube from '@mui/icons-material/YouTube'
import Link from 'next/link'

interface ProfileCardProps {
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

export const ProfileCard = ({ organization }: ProfileCardProps) => {
  const settings = organization.storefront_settings
  const showHeader = settings?.show_header ?? true
  const showLogo = settings?.show_logo ?? true
  const showName = settings?.show_name ?? true
  const showDescription = settings?.show_description ?? true
  const description = settings?.description ?? null

  return (
    <div className="dark:border-polar-700 dark:bg-polar-900 flex w-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {/* Banner */}
      {showHeader && (
        <div className="relative">
          {settings?.header_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.header_image_url}
              alt=""
              className="aspect-[16/5] w-full object-cover"
            />
          ) : (
            <div className="aspect-[16/5] w-full bg-gray-900 dark:bg-black" />
          )}
        </div>
      )}

      <div className="relative flex flex-col gap-y-4 px-6 pb-6">
        {/* Avatar — overlapping banner */}
        {showLogo && (
          <div className={showHeader ? '-mt-10' : 'mt-6'}>
            <Avatar
              className="dark:border-polar-900 h-20 w-20 border-4 border-white text-lg"
              name={organization.name}
              avatar_url={organization.avatar_url}
            />
          </div>
        )}

        {/* Name */}
        {showName && (
          <div className={!showLogo ? 'mt-6' : ''}>
            <h1 className="text-xl font-bold text-gray-950 dark:text-white">
              {organization.name}
            </h1>
          </div>
        )}

        {/* Description */}
        {showDescription && description && (
          <p className="dark:text-polar-400 text-sm leading-relaxed text-gray-500">
            {description}
          </p>
        )}

        {/* Social icons */}
        {organization.socials.length > 0 && (
          <div className="flex flex-row items-center gap-x-3">
            {organization.socials.map((social, i) => (
              <Link
                key={i}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="dark:text-polar-400 text-gray-500 transition-colors hover:text-gray-900 dark:hover:text-white"
              >
                {getSocialIcon(social.platform)}
              </Link>
            ))}
          </div>
        )}

        {/* Powered by Spaire */}
        <div className="mt-2 border-t border-gray-100 pt-4 dark:border-polar-700">
          <Link
            href="https://spairehq.com"
            target="_blank"
            rel="noopener noreferrer"
            className="dark:text-polar-500 flex flex-row items-center gap-x-1.5 text-xs text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
          >
            <span>powered by</span>
            <LogoType className="dark:text-polar-400 text-gray-500" width={48} />
          </Link>
        </div>
      </div>
    </div>
  )
}
