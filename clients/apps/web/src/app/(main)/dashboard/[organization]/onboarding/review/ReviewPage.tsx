'use client'

import revalidate from '@/app/actions'
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
import { ProfileCard } from '@/components/Profile/ProfileCard'
import { useUpdateOrganization } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { schemas } from '@spaire/client'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import AddPhotoAlternateOutlined from '@mui/icons-material/AddPhotoAlternateOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import Facebook from '@mui/icons-material/Facebook'
import GitHub from '@mui/icons-material/GitHub'
import Instagram from '@mui/icons-material/Instagram'
import LinkedIn from '@mui/icons-material/LinkedIn'
import Public from '@mui/icons-material/Public'
import X from '@mui/icons-material/X'
import YouTube from '@mui/icons-material/YouTube'
import AddOutlined from '@mui/icons-material/AddOutlined'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useContext, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Upload } from '@/components/FileUpload/Upload'
import { useAuth } from '@/hooks'

const SKILL_OPTIONS = [
  '2D Design', '3D Design', '3D Modeling', 'Illustration', 'Digital Art',
  'Graphic Design', 'UI/UX Design', 'Motion Graphics', 'Video Editing',
  'Photography', 'Ebook', 'Templates', 'Fonts', 'Icons', 'Mockups',
  'Audio', 'Music', 'Plugins', 'Figma', 'Blender',
]

const LANGUAGE_OPTIONS = [
  'English', 'French', 'Spanish', 'German', 'Portuguese', 'Italian',
  'Dutch', 'Russian', 'Arabic', 'Chinese', 'Japanese', 'Korean',
]

interface SocialLink {
  platform: string
  url: string
}

const PLATFORM_INFO: Record<string, { label: string; placeholder: string; Icon: React.ComponentType<{ className?: string }> }> = {
  instagram: { label: 'Instagram', placeholder: 'instagram.com/username', Icon: Instagram },
  x: { label: 'X', placeholder: 'x.com/username', Icon: X },
  tiktok: { label: 'TikTok', placeholder: 'tiktok.com/@username', Icon: TikTokIcon },
  youtube: { label: 'YouTube', placeholder: 'youtube.com/c/channel', Icon: YouTube },
  facebook: { label: 'Facebook', placeholder: 'facebook.com/username', Icon: Facebook },
  linkedin: { label: 'LinkedIn', placeholder: 'linkedin.com/in/username', Icon: LinkedIn },
  github: { label: 'GitHub', placeholder: 'github.com/username', Icon: GitHub },
  whatsapp: { label: 'WhatsApp', placeholder: 'wa.me/number', Icon: WhatsAppIcon },
  spotify: { label: 'Spotify', placeholder: 'open.spotify.com/artist/...', Icon: SpotifyIcon },
  threads: { label: 'Threads', placeholder: 'threads.net/@username', Icon: ThreadsIcon },
  soundcloud: { label: 'SoundCloud', placeholder: 'soundcloud.com/username', Icon: SoundCloudIcon },
  snapchat: { label: 'Snapchat', placeholder: 'snapchat.com/add/username', Icon: SnapchatIcon },
  pinterest: { label: 'Pinterest', placeholder: 'pinterest.com/username', Icon: PinterestIcon },
  patreon: { label: 'Patreon', placeholder: 'patreon.com/username', Icon: PatreonIcon },
  twitch: { label: 'Twitch', placeholder: 'twitch.tv/username', Icon: TwitchIcon },
  apple_music: { label: 'Apple Music', placeholder: 'music.apple.com/...', Icon: AppleMusicIcon },
  website: { label: 'Website', placeholder: 'https://yourwebsite.com', Icon: Public },
  other: { label: 'Website', placeholder: 'https://yourwebsite.com', Icon: Public },
}

function TagInput({
  values,
  onChange,
  options,
  placeholder,
}: {
  values: string[]
  onChange: (next: string[]) => void
  options: string[]
  placeholder: string
}) {
  const [input, setInput] = useState('')

  const add = (value: string) => {
    const v = value.trim()
    if (!v || values.includes(v)) return
    onChange([...values, v])
    setInput('')
  }

  return (
    <div className="flex flex-col gap-2">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span
              key={v}
              className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="opacity-60 hover:opacity-100"
              >
                <CloseOutlined style={{ fontSize: 10 }} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add(input))}
          placeholder={placeholder}
          list={`datalist-${placeholder}`}
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
        />
        <datalist id={`datalist-${placeholder}`}>
          {options
            .filter((o) => !values.includes(o))
            .map((o) => (
              <option key={o} value={o} />
            ))}
        </datalist>
        <button
          type="button"
          onClick={() => add(input)}
          disabled={!input.trim()}
          className="flex items-center gap-1 rounded-xl border border-gray-200 px-2.5 py-2 text-xs transition-colors hover:bg-gray-50 disabled:opacity-40"
        >
          <AddOutlined style={{ fontSize: 14 }} />
        </button>
      </div>
    </div>
  )
}

export default function ReviewPage() {
  const { organization } = useContext(OrganizationContext)
  const { currentUser } = useAuth()
  const router = useRouter()
  const updateOrganization = useUpdateOrganization()

  // Local form state (reflects current org data, editable)
  const [name, setName] = useState(organization.name)
  const [description, setDescription] = useState(
    organization.storefront_settings?.description ?? '',
  )
  const [profileTitle, setProfileTitle] = useState(
    organization.storefront_settings?.profile_title ?? '',
  )
  const [skills, setSkills] = useState<string[]>(
    organization.storefront_settings?.skills ?? [],
  )
  const [languages, setLanguages] = useState<string[]>(
    organization.storefront_settings?.languages ?? [],
  )
  const [availableForWork, setAvailableForWork] = useState(
    organization.storefront_settings?.available_for_work ?? false,
  )
  const [socials, setSocials] = useState<SocialLink[]>(
    (organization.socials ?? []).map((s) => ({
      platform: s.platform,
      url: s.url,
    })),
  )
  const [avatarPreview, setAvatarPreview] = useState<string>(
    organization.avatar_url ?? '',
  )
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [coverPreview, setCoverPreview] = useState<string>(
    organization.storefront_settings?.header_image_url ?? '',
  )
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const [publishing, setPublishing] = useState(false)

  // Build a synthetic org for the live preview
  const previewOrg: schemas['Organization'] = {
    ...organization,
    name,
    avatar_url: avatarPreview || organization.avatar_url,
    socials: socials
      .filter((s) => s.url.trim())
      .map((s) => ({
        platform: s.platform as schemas['OrganizationSocialPlatforms'],
        url: s.url,
      })),
    storefront_settings: {
      ...(organization.storefront_settings ?? {}),
      enabled: true,
      show_header: true,
      show_logo: true,
      show_name: true,
      show_description: true,
      description: description || null,
      profile_title: profileTitle || null,
      skills,
      languages,
      available_for_work: availableForWork,
      header_image_url: coverPreview || organization.storefront_settings?.header_image_url || null,
      thumbnail_size: organization.storefront_settings?.thumbnail_size ?? 'medium',
      show_product_details: organization.storefront_settings?.show_product_details ?? true,
      featured_product_ids: organization.storefront_settings?.featured_product_ids ?? [],
    },
  }

  const uploadFile = (
    service: schemas['FileServiceTypes'],
    file: File,
  ): Promise<string> =>
    new Promise<string>((resolve, reject) => {
      const upload = new Upload({
        service,
        organization,
        file,
        onFileProcessing: () => {},
        onFileCreate: () => {},
        onFileUploadProgress: () => {},
        onFileUploaded: (response) => {
          resolve((response as { public_url: string }).public_url)
        },
        onFileError: (_id, err) => reject(err),
      })
      upload.run()
    })

  const handlePublish = async () => {
    setPublishing(true)
    try {
      let newAvatarUrl: string | undefined
      let newCoverUrl: string | undefined

      if (avatarFile) {
        try {
          newAvatarUrl = await uploadFile('organization_avatar', avatarFile)
        } catch { /* skip */ }
      }

      if (coverFile) {
        try {
          newCoverUrl = await uploadFile('storefront_header', coverFile)
        } catch { /* skip */ }
      }

      await updateOrganization.mutateAsync({
        id: organization.id,
        body: {
          name,
          ...(newAvatarUrl ? { avatar_url: newAvatarUrl } : {}),
          socials: socials.filter((s) => s.url.trim()) as any,
          storefront_settings: {
            enabled: true,
            show_header: true,
            show_logo: true,
            show_name: true,
            show_description: true,
            description: description || null,
            profile_title: profileTitle || null,
            skills,
            languages,
            available_for_work: availableForWork,
            ...(newCoverUrl ? { header_image_url: newCoverUrl } : coverPreview ? { header_image_url: coverPreview } : {}),
          },
        },
        userId: currentUser?.id,
      })

      await revalidate(`organizations:${organization.id}`)
      await revalidate(`organizations:${organization.slug}`)
      await revalidate(`storefront:${organization.slug}`)

      router.push(`/dashboard/${organization.slug}/onboarding/product`)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-white px-4 py-12">
      <div className="mb-12 w-full max-w-5xl">
        <OnboardingProgressBar currentStep={4} totalSteps={4} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex w-full max-w-5xl flex-col gap-8"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Looking good!
          </h1>
          <p className="text-sm text-gray-500">
            Review your Space Card and publish when you&apos;re ready.
          </p>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {/* Left — Live preview */}
          <div className="lg:sticky lg:top-8 lg:w-80 lg:shrink-0">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Live Preview
            </p>
            <div className="overflow-hidden rounded-2xl shadow-lg">
              <ProfileCard organization={previewOrg} />
            </div>
          </div>

          {/* Right — Editable form */}
          <div className="flex flex-1 flex-col gap-5">

            {/* Cover image */}
            <div className="rounded-2xl border border-gray-100 p-5 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-gray-900">Cover Image</p>
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="relative flex h-28 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 transition-colors hover:border-gray-300"
              >
                {coverPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverPreview} alt="Cover" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-gray-400">
                    <AddPhotoAlternateOutlined fontSize="medium" />
                    <span className="text-xs">Upload cover image</span>
                  </div>
                )}
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setCoverFile(file)
                    setCoverPreview(URL.createObjectURL(file))
                  }
                }}
              />
            </div>

            {/* Profile info */}
            <div className="rounded-2xl border border-gray-100 p-5 shadow-sm">
              <p className="mb-4 text-sm font-semibold text-gray-900">Profile</p>
              <div className="flex flex-col gap-4">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-full"
                  >
                    <Avatar
                      avatar_url={avatarPreview || ''}
                      name={name}
                      className="h-14 w-14"
                    />
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/20 opacity-0 transition-opacity hover:opacity-100">
                      <AddPhotoAlternateOutlined className="text-white" fontSize="small" />
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm transition-colors hover:bg-gray-50"
                  >
                    Change photo
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setAvatarFile(file)
                        setAvatarPreview(URL.createObjectURL(file))
                      }
                    }}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-500">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-500">Title</label>
                  <input
                    type="text"
                    value={profileTitle}
                    onChange={(e) => setProfileTitle(e.target.value)}
                    placeholder="Designer, Creator, Developer…"
                    maxLength={50}
                    className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-500">Bio</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="A short bio about yourself…"
                    rows={3}
                    maxLength={160}
                    className="resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400"
                  />
                  <p className="text-right text-xs text-gray-400">
                    {description.length}/160
                  </p>
                </div>

                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={availableForWork}
                    onChange={(e) => setAvailableForWork(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Available for work</span>
                </label>
              </div>
            </div>

            {/* Skills & Languages */}
            <div className="rounded-2xl border border-gray-100 p-5 shadow-sm">
              <p className="mb-4 text-sm font-semibold text-gray-900">Skills & Languages</p>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-500">Skills</label>
                  <TagInput
                    values={skills}
                    onChange={setSkills}
                    options={SKILL_OPTIONS}
                    placeholder="Add a skill…"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-500">Languages</label>
                  <TagInput
                    values={languages}
                    onChange={setLanguages}
                    options={LANGUAGE_OPTIONS}
                    placeholder="Add a language…"
                  />
                </div>
              </div>
            </div>

            {/* Social links */}
            <div className="rounded-2xl border border-gray-100 p-5 shadow-sm">
              <p className="mb-4 text-sm font-semibold text-gray-900">Social Links</p>
              <div className="flex flex-col gap-3">
                {socials.map((social, i) => {
                  const info = PLATFORM_INFO[social.platform] ?? PLATFORM_INFO.other
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <info.Icon className="h-6 w-6 shrink-0 text-gray-600" />
                      <input
                        type="url"
                        value={social.url}
                        onChange={(e) => {
                          const next = [...socials]
                          next[i] = { ...next[i], url: e.target.value }
                          setSocials(next)
                        }}
                        placeholder={info.placeholder}
                        className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                      />
                      <button
                        type="button"
                        onClick={() => setSocials(socials.filter((_, j) => j !== i))}
                        className="text-gray-300 transition-colors hover:text-gray-500"
                      >
                        <CloseOutlined style={{ fontSize: 18 }} />
                      </button>
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={() =>
                    setSocials([...socials, { platform: 'other', url: '' }])
                  }
                  className={twMerge(
                    'flex items-center gap-2 rounded-xl border border-dashed border-gray-200 px-3 py-2.5 text-sm text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600',
                    socials.length > 0 ? 'mt-1' : '',
                  )}
                >
                  <AddOutlined style={{ fontSize: 16 }} />
                  Add social link
                </button>
              </div>
            </div>

            {/* Publish button */}
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing}
              className="w-full rounded-full bg-blue-600 py-4 text-sm font-semibold text-white transition-all hover:bg-blue-700 disabled:bg-gray-300"
            >
              {publishing ? 'Publishing…' : 'Publish my Space Card'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
