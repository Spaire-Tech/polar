'use client'

import LogoType from '@/components/Brand/LogoType'
import { schemas } from '@spaire/client'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import Facebook from '@mui/icons-material/Facebook'
import GitHub from '@mui/icons-material/GitHub'
import Instagram from '@mui/icons-material/Instagram'
import LinkedIn from '@mui/icons-material/LinkedIn'
import Public from '@mui/icons-material/Public'
import Verified from '@mui/icons-material/Verified'
import X from '@mui/icons-material/X'
import YouTube from '@mui/icons-material/YouTube'
import TranslateOutlined from '@mui/icons-material/TranslateOutlined'
import Link from 'next/link'

interface ProfileCardProps {
  organization: schemas['Organization']
}

const getSocialIcon = (platform: string) => {
  const cls = 'h-6 w-6'
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
  const profileTitle = settings?.profile_title ?? null
  const skills = settings?.skills ?? []
  const languages = settings?.languages ?? []
  const availableForWork = settings?.available_for_work ?? false

  const MAX_VISIBLE_SKILLS = 4

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
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
            <div className="aspect-[16/5] w-full bg-gradient-to-br from-gray-800 to-gray-900" />
          )}
        </div>
      )}

      <div className="relative flex flex-col gap-y-4 px-6 pb-6">
        {/* Avatar — overlapping banner */}
        {showLogo && (
          <div className={showHeader ? '-mt-10' : 'mt-6'}>
            <Avatar
              className="h-20 w-20 border-4 border-white text-lg"
              name={organization.name}
              avatar_url={organization.avatar_url}
            />
          </div>
        )}

        {/* Profile title + Name with verified badge */}
        {showName && (
          <div className={!showLogo ? 'mt-6' : ''}>
            {profileTitle && (
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {profileTitle}
              </span>
            )}
            <div className="flex flex-row items-center gap-x-2">
              <h1 className="text-2xl font-bold text-gray-950">
                {organization.name}
              </h1>
              <Verified className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        )}

        {/* Description */}
        {showDescription && description && (
          <p className="text-sm leading-relaxed text-gray-600">
            {description}
          </p>
        )}

        {/* Available for work + Languages */}
        {(availableForWork || languages.length > 0) && (
          <div className="flex flex-row flex-wrap items-center gap-2">
            {availableForWork && (
              <span className="rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                Available for work
              </span>
            )}
            {languages.length > 0 && (
              <span className="flex flex-row items-center gap-x-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600">
                <TranslateOutlined style={{ fontSize: 14 }} />
                {languages.length <= 2
                  ? languages.join(', ')
                  : `${languages[0]}, ${languages.length - 1} more`}
              </span>
            )}
          </div>
        )}

        {/* Skill tags */}
        {skills.length > 0 && (
          <div className="flex flex-row flex-wrap gap-2">
            {skills.slice(0, MAX_VISIBLE_SKILLS).map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700"
              >
                {skill}
              </span>
            ))}
            {skills.length > MAX_VISIBLE_SKILLS && (
              <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-500">
                +{skills.length - MAX_VISIBLE_SKILLS}
              </span>
            )}
          </div>
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
                className="text-gray-700 transition-colors hover:text-gray-950"
              >
                {getSocialIcon(social.platform)}
              </Link>
            ))}
          </div>
        )}

        {/* Powered by Spaire */}
        <div className="mt-2 border-t border-gray-100 pt-4">
          <Link
            href="https://spairehq.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-row items-center gap-x-1.5 text-xs text-gray-400 transition-colors hover:text-gray-600"
          >
            <span>powered by</span>
            <LogoType className="text-gray-500" width={48} />
          </Link>
        </div>
      </div>
    </div>
  )
}
