'use client'

import { OnboardingProgressBar } from '@/components/Onboarding/OnboardingProgressBar'
import {
  AppleMusicIcon,
  PatreonIcon,
  PinterestIcon,
  SnapchatIcon,
  SoundCloudIcon,
  SpotifyIcon,
  ThreadsIcon,
  TikTokIcon,
  TwitchIcon,
  WhatsAppIcon,
} from '@/components/Onboarding/SocialPlatformIcons'
import { useUpdateOrganization } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import Facebook from '@mui/icons-material/Facebook'
import GitHub from '@mui/icons-material/GitHub'
import Instagram from '@mui/icons-material/Instagram'
import LinkedIn from '@mui/icons-material/LinkedIn'
import Public from '@mui/icons-material/Public'
import X from '@mui/icons-material/X'
import YouTube from '@mui/icons-material/YouTube'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useContext, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface Platform {
  id: string
  label: string
  placeholder: string
  Icon: React.ComponentType<{ className?: string }>
}

const ALL_PLATFORMS: Platform[] = [
  { id: 'instagram', label: 'Instagram', placeholder: 'instagram.com/username', Icon: Instagram },
  { id: 'x', label: 'X', placeholder: 'x.com/username', Icon: X },
  { id: 'tiktok', label: 'TikTok', placeholder: 'tiktok.com/@username', Icon: TikTokIcon },
  { id: 'youtube', label: 'YouTube', placeholder: 'youtube.com/c/channel', Icon: YouTube },
  { id: 'facebook', label: 'Facebook', placeholder: 'facebook.com/username', Icon: Facebook },
  { id: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/username', Icon: LinkedIn },
  { id: 'github', label: 'GitHub', placeholder: 'github.com/username', Icon: GitHub },
  { id: 'whatsapp', label: 'WhatsApp', placeholder: 'wa.me/number', Icon: WhatsAppIcon },
  { id: 'spotify', label: 'Spotify', placeholder: 'open.spotify.com/artist/...', Icon: SpotifyIcon },
  { id: 'threads', label: 'Threads', placeholder: 'threads.net/@username', Icon: ThreadsIcon },
  { id: 'soundcloud', label: 'SoundCloud', placeholder: 'soundcloud.com/username', Icon: SoundCloudIcon },
  { id: 'snapchat', label: 'Snapchat', placeholder: 'snapchat.com/add/username', Icon: SnapchatIcon },
  { id: 'pinterest', label: 'Pinterest', placeholder: 'pinterest.com/username', Icon: PinterestIcon },
  { id: 'patreon', label: 'Patreon', placeholder: 'patreon.com/username', Icon: PatreonIcon },
  { id: 'twitch', label: 'Twitch', placeholder: 'twitch.tv/username', Icon: TwitchIcon },
  { id: 'apple_music', label: 'Apple Music', placeholder: 'music.apple.com/...', Icon: AppleMusicIcon },
  { id: 'website', label: 'Website', placeholder: 'https://yourwebsite.com', Icon: Public },
]

const MAX_PLATFORMS = 5

export default function SocialsPage() {
  const { organization } = useContext(OrganizationContext)
  const router = useRouter()
  const updateOrganization = useUpdateOrganization()

  const [selected, setSelected] = useState<string[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [showUrls, setShowUrls] = useState(false)
  const [saving, setSaving] = useState(false)

  const togglePlatform = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((s) => s !== id))
    } else if (selected.length < MAX_PLATFORMS) {
      setSelected([...selected, id])
    }
  }

  const handleContinue = async () => {
    if (!showUrls) {
      setShowUrls(true)
      return
    }

    setSaving(true)
    try {
      const socials = selected
        .filter((id) => urls[id]?.trim())
        .map((id) => ({ platform: id, url: urls[id].trim() }))

      await updateOrganization.mutateAsync({
        id: organization.id,
        body: { socials: socials as any },
      })
      router.push(`/dashboard/${organization.slug}/onboarding/skills`)
    } catch {
      // validation errors on URL format — allow user to correct
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    router.push(`/dashboard/${organization.slug}/onboarding/skills`)
  }

  const selectedPlatformObjects = ALL_PLATFORMS.filter((p) =>
    selected.includes(p.id),
  )

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-white px-4 py-12">
      <div className="mb-12 w-full max-w-lg">
        <OnboardingProgressBar currentStep={2} totalSteps={4} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex w-full max-w-lg flex-col gap-8"
      >
        {!showUrls ? (
          <>
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Which platforms are you on?
              </h1>
              <p className="text-sm text-gray-500">
                Pick up to {MAX_PLATFORMS} to get started. You can update at any time.
              </p>
            </div>

            {/* Platform grid */}
            <div className="grid grid-cols-3 gap-3">
              {ALL_PLATFORMS.map((platform) => {
                const isSelected = selected.includes(platform.id)
                const isDisabled = !isSelected && selected.length >= MAX_PLATFORMS

                return (
                  <button
                    key={platform.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => togglePlatform(platform.id)}
                    className={twMerge(
                      'flex flex-col items-center gap-2 rounded-2xl border-2 bg-white p-4 transition-all',
                      isSelected
                        ? 'border-gray-900 shadow-sm'
                        : isDisabled
                          ? 'cursor-not-allowed border-gray-100 opacity-40'
                          : 'cursor-pointer border-gray-200 hover:border-gray-300',
                    )}
                  >
                    <platform.Icon className="h-8 w-8 text-gray-800" />
                    <span className="text-xs font-medium text-gray-700">
                      {platform.label}
                    </span>
                  </button>
                )
              })}
            </div>

            {selected.length > 0 && (
              <p className="text-center text-xs text-gray-400">
                {selected.length} of {MAX_PLATFORMS} selected
              </p>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Add your links
              </h1>
              <p className="text-sm text-gray-500">
                Complete the fields below to add your content to your new Space Card.
              </p>
            </div>

            {/* URL inputs for selected platforms */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Your selections
              </p>
              {selectedPlatformObjects.map((platform) => (
                <div key={platform.id} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                    <platform.Icon className="h-7 w-7 text-gray-800" />
                  </div>
                  <input
                    type="url"
                    value={urls[platform.id] || ''}
                    onChange={(e) =>
                      setUrls({ ...urls, [platform.id]: e.target.value })
                    }
                    placeholder={platform.placeholder}
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400"
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleContinue}
            disabled={saving}
            className="w-full rounded-full bg-blue-600 py-4 text-sm font-semibold text-white transition-all hover:bg-blue-700 disabled:bg-gray-300"
          >
            {saving ? 'Saving…' : 'Continue'}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="w-full rounded-full py-3 text-sm text-gray-400 transition-colors hover:text-gray-600"
          >
            Skip for now
          </button>
        </div>
      </motion.div>
    </div>
  )
}
