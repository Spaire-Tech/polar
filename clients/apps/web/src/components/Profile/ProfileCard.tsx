'use client'

import { useStorefrontSubscribe } from '@/hooks/queries/emailMarketing'
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
import { useState } from 'react'
import LogoType from '../Brand/LogoType'

// TikTok SVG icon (not available in MUI)
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} width="24" height="24">
    <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" />
  </svg>
)

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
    case 'tiktok':
      return <TikTokIcon className={cls} />
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

  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [showLanguagesTooltip, setShowLanguagesTooltip] = useState(false)
  const [showSkillsTooltip, setShowSkillsTooltip] = useState(false)
  const subscribe = useStorefrontSubscribe()

  const handleSubscribe = async () => {
    if (!email.trim() || subscribing) return
    setSubscribing(true)
    try {
      await subscribe.mutateAsync({ slug: organization.slug, email: email.trim() })
      setSubscribed(true)
      setEmail('')
    } catch {
      // silently fail
    } finally {
      setSubscribing(false)
    }
  }

  const MAX_VISIBLE_SKILLS = 4
  const MAX_HIGHLIGHTS = 7

  // Get product images for highlights row
  const highlights = products
    .filter((p) => p.medias.length > 0)
    .slice(0, MAX_HIGHLIGHTS)

  return (
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
        {/* Avatar — overlapping banner, full-bleed logo */}
        {showLogo && (
          <div className={showHeader ? '-mt-10' : 'mt-6'}>
            {organization.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={organization.avatar_url}
                alt={organization.name}
                className="h-20 w-20 rounded-xl border-4 border-white object-cover shadow-sm"
              />
            ) : (
              <Avatar
                className="h-20 w-20 rounded-xl border-4 border-white text-lg shadow-sm"
                name={organization.name}
                avatar_url={null}
              />
            )}
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
              <button
                type="button"
                className="group relative flex flex-row items-center gap-x-1.5 rounded-full border border-gray-200 px-3 py-1 text-[12px] text-gray-500"
                onClick={() => setShowLanguagesTooltip(!showLanguagesTooltip)}
                onMouseEnter={() => setShowLanguagesTooltip(true)}
                onMouseLeave={() => setShowLanguagesTooltip(false)}
              >
                <TranslateOutlined style={{ fontSize: 14 }} />
                {languages.length <= 2
                  ? languages.join(', ')
                  : `${languages[0]}, ${languages.length - 1} more`}
                {languages.length > 2 && showLanguagesTooltip && (
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-[11px] text-white shadow-lg">
                    {languages.join(', ')}
                  </span>
                )}
              </button>
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
              <button
                type="button"
                className="group relative rounded-full border border-gray-200 px-3 py-1 text-[12px] text-gray-400"
                onClick={() => setShowSkillsTooltip(!showSkillsTooltip)}
                onMouseEnter={() => setShowSkillsTooltip(true)}
                onMouseLeave={() => setShowSkillsTooltip(false)}
              >
                +{skills.length - MAX_VISIBLE_SKILLS}
                {showSkillsTooltip && (
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-[11px] text-white shadow-lg">
                    {skills.slice(MAX_VISIBLE_SKILLS).join(', ')}
                  </span>
                )}
              </button>
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

        {/* Email Subscribe */}
        {subscribed ? (
          <div className="mt-5 flex items-center justify-center rounded-xl bg-green-50 px-4 py-3 text-[13px] font-medium text-green-700">
            You&apos;re subscribed!
          </div>
        ) : (
          <div className="mt-5 flex flex-row gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubscribe()}
              placeholder="Enter your email address..."
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={subscribing || !email.trim()}
              className="shrink-0 rounded-xl bg-blue-500 px-5 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              {subscribing ? 'Subscribing...' : 'Subscribe'}
            </button>
          </div>
        )}

        {/* Powered by Spaire */}
        <div className="mt-6 flex flex-row items-center justify-center gap-x-1.5 border-t border-gray-100 pt-4">
          <span className="text-[11px] text-gray-400">Powered by</span>
          <LogoType className="h-4" />
        </div>
      </div>
    </div>
  )
}
