'use client'

import { schemas } from '@spaire/client'
import { CONFIG } from '@/utils/config'
import { toast } from '@/components/Toast/use-toast'
import Switch from '@spaire/ui/components/atoms/Switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@spaire/ui/components/atoms/Select'
import { useCallback, useState } from 'react'
import { FileRejection } from 'react-dropzone'
import { useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { FileObject, useFileUpload } from '../../FileUpload'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import Instagram from '@mui/icons-material/Instagram'
import Facebook from '@mui/icons-material/Facebook'
import LinkedIn from '@mui/icons-material/LinkedIn'
import YouTube from '@mui/icons-material/YouTube'
import GitHub from '@mui/icons-material/GitHub'
import X from '@mui/icons-material/X'
import Public from '@mui/icons-material/Public'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import AddPhotoAlternateOutlined from '@mui/icons-material/AddPhotoAlternateOutlined'

// Predefined options
const SKILL_OPTIONS = [
  '2D Design', '3D Design', '3D Modeling', '2D Animation', '3D Animation',
  'Game Art', 'Illustration', 'Digital Art', 'Graphic Design', 'UI/UX Design',
  'Motion Graphics', 'Video Editing', 'Photography', 'Ebook', 'Templates',
  'Fonts', 'Icons', 'Mockups', 'Textures', 'Audio', 'Music', 'Sound Effects',
  'Presets', 'LUTs', 'Brushes', 'Plugins', 'WordPress Themes', 'Notion Templates',
  'Figma', 'Adobe Photoshop', 'Adobe Illustrator', 'After Effects',
  'Blender', 'Cinema 4D', 'Unity', 'Unreal Engine',
]

const LANGUAGE_OPTIONS = [
  'English', 'French', 'Spanish', 'German', 'Portuguese', 'Italian',
  'Dutch', 'Russian', 'Arabic', 'Chinese', 'Japanese', 'Korean',
  'Hindi', 'Turkish', 'Polish', 'Swedish', 'Norwegian', 'Danish',
  'Finnish', 'Greek', 'Czech', 'Romanian', 'Hungarian', 'Thai',
  'Vietnamese', 'Indonesian', 'Malay', 'Filipino', 'Hebrew', 'Ukrainian',
]

const PROFILE_TITLE_OPTIONS = [
  'Designer', '3D Artist', 'Illustrator', 'Photographer', 'Animator',
  'Video Editor', 'Developer', 'Writer', 'Creator', 'Music Producer',
  'Game Developer', 'UI/UX Designer', 'Graphic Designer', 'Motion Designer',
]

const SOCIAL_PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'x', label: 'X', icon: X },
  { value: 'linkedin', label: 'LinkedIn', icon: LinkedIn },
  { value: 'youtube', label: 'YouTube', icon: YouTube },
  { value: 'github', label: 'GitHub', icon: GitHub },
  { value: 'facebook', label: 'Facebook', icon: Facebook },
  { value: 'tiktok', label: 'TikTok', icon: Public },
  { value: 'other', label: 'Website', icon: Public },
]

// --- Collapsible section ---
const Section = ({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="flex flex-col gap-y-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full flex-row items-center justify-between"
      >
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <ExpandMoreOutlined
          style={{ fontSize: 18 }}
          className={twMerge('text-gray-400 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && children}
    </div>
  )
}

// --- Tag input ---
const TagInput = ({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  options: string[]
  placeholder: string
}) => {
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const filtered = options.filter(
    (o) => !value.includes(o) && o.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="relative">
      {value.length > 0 && (
        <div className="mb-2 flex flex-row flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-x-1 rounded-full bg-gray-100 px-2.5 py-1 text-[12px] text-gray-700"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="ml-0.5 text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
        />
        <ExpandMoreOutlined
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
          style={{ fontSize: 18 }}
        />
      </div>
      {showDropdown && filtered.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-44 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {filtered.slice(0, 12).map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange([...value, option]); setSearch('') }}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Social Link Row ---
const SocialLinkRow = ({
  social,
  onUpdate,
  onRemove,
}: {
  social: schemas['OrganizationSocialLink']
  onUpdate: (social: schemas['OrganizationSocialLink']) => void
  onRemove: () => void
}) => {
  const currentPlatform = SOCIAL_PLATFORMS.find((p) => p.value === social.platform)
  const Icon = currentPlatform?.icon ?? Public

  return (
    <div className="flex flex-row items-center gap-2">
      <Select
        value={social.platform}
        onValueChange={(v) => onUpdate({ ...social, platform: v as schemas['OrganizationSocialLink']['platform'] })}
      >
        <SelectTrigger className="h-10 w-[120px] shrink-0">
          <div className="flex items-center gap-x-2">
            <Icon style={{ fontSize: 16 }} />
            <span className="text-xs">{currentPlatform?.label ?? 'Other'}</span>
          </div>
        </SelectTrigger>
        <SelectContent>
          {SOCIAL_PLATFORMS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              <div className="flex items-center gap-x-2">
                <p.icon style={{ fontSize: 16 }} />
                <span>{p.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input
        type="url"
        value={social.url}
        onChange={(e) => onUpdate({ ...social, url: e.target.value })}
        placeholder="https://example.com"
        className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
      />
      <button
        type="button"
        onClick={onRemove}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
      >
        <DeleteOutlined style={{ fontSize: 18 }} />
      </button>
    </div>
  )
}

// --- Main editor form ---
export const StorefrontEditorForm = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const { watch, setValue } = useFormContext<schemas['OrganizationUpdate']>()
  const settings = watch('storefront_settings')
  const [copied, setCopied] = useState(false)

  const spaceUrl = `${CONFIG.SPACE_BASE_URL}/${organization.slug}`

  const updateSetting = useCallback(
    <K extends keyof NonNullable<schemas['OrganizationStorefrontSettings']>>(
      key: K,
      value: NonNullable<schemas['OrganizationStorefrontSettings']>[K],
    ) => {
      setValue(
        'storefront_settings',
        { ...settings, [key]: value },
        { shouldDirty: true },
      )
    },
    [settings, setValue],
  )

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(spaceUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [spaceUrl])

  // Socials — read from organization, write to form
  type SocialLink = schemas['OrganizationSocialLink']
  const socials: SocialLink[] = (watch('socials') ?? organization.socials ?? []) as SocialLink[]
  const addSocial = () => {
    setValue('socials', [...socials, { platform: 'instagram', url: '' } as SocialLink], { shouldDirty: true })
  }
  const updateSocial = (idx: number, social: SocialLink) => {
    const updated = [...socials]
    updated[idx] = social
    setValue('socials', updated, { shouldDirty: true })
  }
  const removeSocial = (idx: number) => {
    setValue('socials', socials.filter((_, i) => i !== idx), { shouldDirty: true })
  }

  // Avatar upload
  const avatarUrl = watch('avatar_url') ?? organization.avatar_url
  const onAvatarFilesUpdated = useCallback(
    (files: FileObject<schemas['OrganizationAvatarFileRead']>[]) => {
      if (files.length === 0) return
      const lastFile = files[files.length - 1]
      setValue('avatar_url', lastFile.public_url, { shouldDirty: true })
    },
    [setValue],
  )

  const onAvatarFilesRejected = useCallback(
    (rejections: FileRejection[]) => {
      if (rejections.length > 0) {
        toast({
          title: 'Upload failed',
          description: rejections[0].errors[0].message,
        })
      }
    },
    [],
  )

  const {
    getRootProps: getAvatarRootProps,
    getInputProps: getAvatarInputProps,
    isDragActive: isAvatarDragActive,
  } = useFileUpload({
    organization,
    service: 'organization_avatar',
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/gif': [],
      'image/webp': [],
      'image/svg+xml': [],
    },
    maxSize: 1 * 1024 * 1024,
    onFilesUpdated: onAvatarFilesUpdated,
    onFilesRejected: onAvatarFilesRejected,
    initialFiles: [],
  })

  // Banner upload
  const onBannerFilesUpdated = useCallback(
    (files: FileObject<schemas['StorefrontHeaderFileRead']>[]) => {
      if (files.length === 0) return
      const lastFile = files[files.length - 1]
      updateSetting('header_image_url', lastFile.public_url)
    },
    [updateSetting],
  )

  const onBannerFilesRejected = useCallback(
    (rejections: FileRejection[]) => {
      if (rejections.length > 0) {
        toast({
          title: 'Upload failed',
          description: rejections[0].errors[0].message,
        })
      }
    },
    [],
  )

  const {
    getRootProps: getBannerRootProps,
    getInputProps: getBannerInputProps,
    isDragActive: isBannerDragActive,
  } = useFileUpload({
    organization,
    service: 'storefront_header',
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/gif': [],
      'image/webp': [],
      'image/svg+xml': [],
    },
    maxSize: 10 * 1024 * 1024,
    onFilesUpdated: onBannerFilesUpdated,
    onFilesRejected: onBannerFilesRejected,
    initialFiles: [],
  })

  const isEnabled = settings?.enabled ?? false

  return (
    <div className="flex flex-col gap-y-8 px-8 py-8">
      {/* Enable Your Space */}
      <div className="flex flex-col gap-y-3">
        <div className="flex flex-col divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-gray-50">
            <div>
              <span className="text-sm font-medium text-gray-900">Enable Your Space</span>
              <p className="text-xs text-gray-500">Make your storefront visible to the public.</p>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={(v) => updateSetting('enabled', v)}
            />
          </div>
        </div>
        {isEnabled && (
          <div className="flex flex-row items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
              <span className="truncate text-xs text-gray-600">{spaceUrl}</span>
            </div>
            <button
              type="button"
              onClick={copyLink}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
              title="Copy link"
            >
              {copied ? (
                <CheckOutlined style={{ fontSize: 16 }} />
              ) : (
                <ContentCopyOutlined style={{ fontSize: 16 }} />
              )}
            </button>
            <a
              href={spaceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
              title="Visit your Space"
            >
              <OpenInNewOutlined style={{ fontSize: 16 }} />
            </a>
          </div>
        )}
      </div>

      {/* Profile Information */}
      <Section title="Profile Information">
        <div className="flex flex-col gap-y-5">
          {/* Display Name + Profile Title */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-y-1.5">
              <label className="text-sm font-medium text-gray-700">Display Name</label>
              <input
                type="text"
                value={organization.name}
                disabled
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500"
              />
            </div>
            <div className="flex flex-col gap-y-1.5">
              <label className="text-sm font-medium text-gray-700">Profile Title</label>
              <Select
                value={settings?.profile_title ?? ''}
                onValueChange={(v) => updateSetting('profile_title', v || null)}
              >
                <SelectTrigger className="h-[42px] rounded-xl">
                  <SelectValue placeholder="eg. Designer" />
                </SelectTrigger>
                <SelectContent>
                  {PROFILE_TITLE_OPTIONS.map((title) => (
                    <SelectItem key={title} value={title}>
                      {title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Profile Photo + Cover Image */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-y-1.5">
              <label className="text-sm font-medium text-gray-700">Profile Photo</label>
              <div
                {...getAvatarRootProps()}
                className={twMerge(
                  'flex h-[120px] cursor-pointer flex-col items-center justify-center gap-y-2 rounded-xl border-2 border-dashed border-gray-300 bg-white transition-colors hover:border-gray-400',
                  isAvatarDragActive && 'border-blue-500 bg-blue-50',
                )}
              >
                <input {...getAvatarInputProps()} />
                {avatarUrl ? (
                  <Avatar
                    avatar_url={avatarUrl}
                    name={organization.name}
                    className="h-16 w-16 rounded-xl"
                  />
                ) : (
                  <>
                    <AddPhotoAlternateOutlined className="text-gray-400" />
                    <span className="text-center text-xs text-gray-500">
                      Drop your photo here,{' '}
                      <span className="text-blue-500">or click to browse</span>
                    </span>
                  </>
                )}
              </div>
              <span className="text-xs text-gray-400">Square image, 400x400px. Max 1MB.</span>
            </div>
            <div className="flex flex-col gap-y-1.5">
              <label className="text-sm font-medium text-gray-700">Cover Image</label>
              <div
                {...getBannerRootProps()}
                className={twMerge(
                  'flex h-[120px] cursor-pointer flex-col items-center justify-center gap-y-2 rounded-xl border-2 border-dashed border-gray-300 bg-white transition-colors hover:border-gray-400',
                  isBannerDragActive && 'border-blue-500 bg-blue-50',
                )}
              >
                <input {...getBannerInputProps()} />
                {settings?.header_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={settings.header_image_url}
                    alt="Cover preview"
                    className="h-full w-full rounded-lg object-cover"
                  />
                ) : (
                  <>
                    <AddPhotoAlternateOutlined className="text-gray-400" />
                    <span className="text-center text-xs text-gray-500">
                      Upload cover image
                    </span>
                  </>
                )}
              </div>
              <span className="text-xs text-gray-400">1600 x 300 recommended. Max 10MB.</span>
            </div>
          </div>

          {/* Profile Description */}
          <div className="flex flex-col gap-y-1.5">
            <label className="text-sm font-medium text-gray-700">Profile Description</label>
            <div className="relative">
              <textarea
                value={settings?.description ?? ''}
                onChange={(e) => updateSetting('description', e.target.value)}
                placeholder="eg. I'm a product manager with a passion for building products that help people."
                maxLength={160}
                rows={3}
                className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
              />
              <span className="absolute bottom-2 right-3 text-[11px] text-gray-400">
                {(settings?.description ?? '').length}/160
              </span>
            </div>
          </div>

          {/* Skills */}
          <div className="flex flex-col gap-y-1.5">
            <label className="text-sm font-medium text-gray-700">Skills</label>
            <TagInput
              value={settings?.skills ?? []}
              onChange={(tags) => updateSetting('skills', tags)}
              options={SKILL_OPTIONS}
              placeholder="eg. Figma, Blender, etc."
            />
          </div>

          {/* Languages */}
          <div className="flex flex-col gap-y-1.5">
            <label className="text-sm font-medium text-gray-700">Languages</label>
            <TagInput
              value={settings?.languages ?? []}
              onChange={(tags) => updateSetting('languages', tags)}
              options={LANGUAGE_OPTIONS}
              placeholder="eg. English, French, etc."
            />
          </div>
        </div>
      </Section>

      {/* Social Links */}
      <Section title="Social Links" defaultOpen={false}>
        <div className="flex flex-col gap-y-3">
          {socials.map((social: schemas['OrganizationSocialLink'], idx: number) => (
            <SocialLinkRow
              key={idx}
              social={social}
              onUpdate={(s) => updateSocial(idx, s)}
              onRemove={() => removeSocial(idx)}
            />
          ))}
          <button
            type="button"
            onClick={addSocial}
            className="flex flex-row items-center gap-x-2 rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700"
          >
            <AddOutlined style={{ fontSize: 18 }} />
            Add social link
          </button>
        </div>
      </Section>

      {/* Display Settings */}
      <Section title="Display Settings" defaultOpen={false}>
        <div className="flex flex-col divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
          {[
            { key: 'show_header' as const, label: 'Show cover image', def: true },
            { key: 'show_logo' as const, label: 'Show profile photo', def: true },
            { key: 'show_name' as const, label: 'Show name', def: true },
            { key: 'show_description' as const, label: 'Show description', def: true },
            { key: 'show_product_details' as const, label: 'Show product details', def: true },
            { key: 'available_for_work' as const, label: 'Available for work', def: false },
          ].map(({ key, label, def }) => (
            <div
              key={key}
              className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-gray-50"
            >
              <span className="text-sm text-gray-700">{label}</span>
              <Switch
                checked={(settings?.[key] as boolean | undefined) ?? def}
                onCheckedChange={(v) => updateSetting(key, v)}
              />
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-gray-50">
            <span className="text-sm text-gray-700">Thumbnail size</span>
            <Select
              value={settings?.thumbnail_size ?? 'medium'}
              onValueChange={(v) =>
                updateSetting('thumbnail_size', v as 'small' | 'medium' | 'large')
              }
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>
    </div>
  )
}

// Backward-compat export
export const StorefrontSidebar = StorefrontEditorForm
