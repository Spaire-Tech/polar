import EmailOutlined from '@mui/icons-material/EmailOutlined'
import Facebook from '@mui/icons-material/Facebook'
import GitHub from '@mui/icons-material/GitHub'
import Instagram from '@mui/icons-material/Instagram'
import LanguageOutlined from '@mui/icons-material/LanguageOutlined'
import LinkedIn from '@mui/icons-material/LinkedIn'
import X from '@mui/icons-material/X'
import YouTube from '@mui/icons-material/YouTube'
import { BioSocial } from './types'

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} width="18" height="18">
    <path d="M20.317 4.369A19.791 19.791 0 0 0 16.558 3c-.214.388-.463.908-.636 1.322a18.225 18.225 0 0 0-5.845 0A12.502 12.502 0 0 0 9.436 3a19.84 19.84 0 0 0-3.76 1.369C2.253 9.064 1.293 13.638 1.76 18.15a19.9 19.9 0 0 0 5.998 3.04 14.58 14.58 0 0 0 1.28-2.08 12.91 12.91 0 0 1-2.017-.968c.17-.124.335-.253.495-.384a14.264 14.264 0 0 0 12.975 0c.16.131.325.26.495.384a12.93 12.93 0 0 1-2.02.969c.378.74.81 1.443 1.281 2.08a19.89 19.89 0 0 0 6.002-3.041c.553-5.287-.882-9.82-3.932-13.78ZM8.02 15.331c-1.184 0-2.156-1.09-2.156-2.43 0-1.34.951-2.43 2.156-2.43 1.204 0 2.176 1.09 2.156 2.43 0 1.34-.952 2.43-2.156 2.43Zm7.96 0c-1.185 0-2.157-1.09-2.157-2.43 0-1.34.95-2.43 2.156-2.43 1.204 0 2.176 1.09 2.156 2.43 0 1.34-.951 2.43-2.156 2.43Z" />
  </svg>
)

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} width="18" height="18">
    <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" />
  </svg>
)

const iconFor = (platform: string) => {
  const cls = 'h-[18px] w-[18px]'
  switch (platform.toLowerCase()) {
    case 'x':
    case 'twitter':
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
    case 'discord':
      return <DiscordIcon className={cls} />
    case 'email':
    case 'mail':
      return <EmailOutlined className={cls} />
    default:
      return <LanguageOutlined className={cls} />
  }
}

export const BioSocialIcons = ({ socials }: { socials: BioSocial[] }) => {
  if (!socials || socials.length === 0) return null
  return (
    <div className="flex flex-row flex-wrap items-center justify-center gap-2">
      {socials.map((s, i) => (
        <a
          key={`${s.platform}-${i}`}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={s.platform}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 text-gray-600 transition-colors hover:border-gray-900 hover:text-gray-900"
        >
          {iconFor(s.platform)}
        </a>
      ))}
    </div>
  )
}
