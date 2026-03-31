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
  products?: schemas['ProductStorefront'][] | schemas['Product'][]
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

export const ProfileCard = ({ organization, products = [] }: ProfileCardProps) => {
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
  const MAX_HIGHLIGHTS = 7

  // Get product images for highlights row
  const highlights = products
    .filter((p) => p.medias.length > 0)
    .slice(0, MAX_HIGHLIGHTS)

  return (
    <div className="flex w-full flex-col">
      {/* Main card */}
      <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
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
              <div className="aspect-[16/5] w-full bg-gradient-to-br from-gray-800 to-gray-950" />
            )}
          </div>
        )}

        <div className="relative flex flex-col px-6 pb-6">
          {/* Avatar — overlapping banner */}
          {showLogo && (
            <div className={showHeader ? '-mt-10' : 'mt-6'}>
              <Avatar
                className="h-20 w-20 rounded-xl border-4 border-white text-lg shadow-sm"
                name={organization.name}
                avatar_url={organization.avatar_url}
              />
            </div>
          )}

          {/* Profile title label + Name with verified badge */}
          {showName && (
            <div className={`flex flex-col gap-y-0.5 ${showLogo ? 'mt-5' : 'mt-6'}`}>
              {profileTitle && (
                <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600">
                  {profileTitle}
                </span>
              )}
              <div className="flex flex-row items-center gap-x-1.5">
                <h1 className="text-[26px] font-bold leading-tight text-gray-950">
                  {organization.name}
                </h1>
                <Verified className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          )}

          {/* Description */}
          {showDescription && description && (
            <p className="mt-4 text-[14px] leading-relaxed text-gray-500">
              {description}
            </p>
          )}

          {/* Available for work + Languages */}
          {(availableForWork || languages.length > 0) && (
            <div className="mt-4 flex flex-row flex-wrap items-center gap-2">
              {availableForWork && (
                <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[12px] font-medium text-green-600">
                  Available for work
                </span>
              )}
              {languages.length > 0 && (
                <span className="flex flex-row items-center gap-x-1.5 rounded-full border border-gray-200 px-3 py-1 text-[12px] text-gray-500">
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
            <div className="mt-3 flex flex-row flex-wrap gap-2">
              {skills.slice(0, MAX_VISIBLE_SKILLS).map((skill: string) => (
                <span
                  key={skill}
                  className="rounded-full border border-gray-200 px-3 py-1 text-[12px] text-gray-600"
                >
                  {skill}
                </span>
              ))}
              {skills.length > MAX_VISIBLE_SKILLS && (
                <span className="rounded-full border border-gray-200 px-3 py-1 text-[12px] text-gray-400">
                  +{skills.length - MAX_VISIBLE_SKILLS}
                </span>
              )}
            </div>
          )}

          {/* Social icons */}
          {organization.socials.length > 0 && (
            <div className="mt-4 flex flex-row items-center gap-x-3">
              {organization.socials.map((social, i) => (
                <Link
                  key={i}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-800 transition-colors hover:text-gray-950"
                >
                  {getSocialIcon(social.platform)}
                </Link>
              ))}
            </div>
          )}

          {/* Highlights — product thumbnail row */}
          {highlights.length > 0 && (
            <div className="mt-5 flex flex-row gap-2 overflow-hidden">
              {highlights.map((product) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={product.id}
                  src={product.medias[0].public_url}
                  alt={product.name}
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                />
              ))}
            </div>
          )}

          {/* CTA Buttons */}
          <div className="mt-5 flex flex-col gap-y-2.5">
            <button
              type="button"
              className="w-full rounded-xl bg-gray-100 px-4 py-3 text-[14px] font-medium text-gray-900 transition-colors hover:bg-gray-200"
            >
              Work with {organization.name}
            </button>
            <button
              type="button"
              className="w-full rounded-xl bg-gray-950 px-4 py-3 text-[14px] font-medium text-white transition-colors hover:bg-black"
            >
              Pay {organization.name}
            </button>
          </div>
        </div>
      </div>

      {/* Powered by Spaire — below the card, centered */}
      <div className="mt-4 flex justify-center">
        <Link
          href="https://spairehq.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-row items-center gap-x-1.5 text-[12px] text-gray-400 transition-colors hover:text-gray-500"
        >
          <span>powered by</span>
          <LogoType className="text-gray-400" width={44} />
        </Link>
      </div>
    </div>
  )
}
