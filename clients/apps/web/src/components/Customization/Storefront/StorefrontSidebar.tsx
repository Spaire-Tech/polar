'use client'

import { schemas } from '@spaire/client'
import { CONFIG } from '@/utils/config'
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
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'

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

// --- Collapsible section with dark header (matching Ruul) ---
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
    <div className="border-b border-gray-100">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full flex-row items-center justify-between rounded-lg bg-gray-900 px-5 py-3.5"
      >
        <span className="text-[14px] font-semibold text-white">{title}</span>
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/20">
          <ExpandMoreOutlined
            style={{ fontSize: 18 }}
            className={twMerge('text-white transition-transform', open && 'rotate-180')}
          />
        </div>
      </button>
      {open && (
        <div className="flex flex-col gap-y-5 px-1 py-6">{children}</div>
      )}
    </div>
  )
}

// --- Tag input with dropdown ---
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

  const addTag = (tag: string) => {
    onChange([...value, tag])
    setSearch('')
  }

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag))
  }

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
                onClick={() => removeTag(tag)}
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
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
        />
        <ExpandMoreOutlined
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
          style={{ fontSize: 18 }}
        />
      </div>
      {showDropdown && filtered.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {filtered.slice(0, 12).map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addTag(option)}
              className="w-full px-3 py-2 text-left text-[13px] text-gray-700 hover:bg-gray-50"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Main editor form (right column) ---
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
        console.error('File rejected:', rejections[0].errors[0].message)
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
    <div className="flex flex-col gap-y-0 p-6">
      {/* Enable Your Space */}
      <div className="mb-6 flex flex-col gap-y-3 rounded-xl border border-gray-100 bg-gray-50 p-5">
        <div className="flex flex-row items-center justify-between">
          <div>
            <span className="text-[14px] font-semibold text-gray-900">Enable Your Space</span>
            <p className="mt-0.5 text-[12px] text-gray-500">Make your storefront visible to the public.</p>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={(v) => updateSetting('enabled', v)}
          />
        </div>
        {isEnabled && (
          <div className="flex flex-row items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-lg border border-gray-200 bg-white px-3 py-2">
              <span className="truncate text-[12px] text-gray-600">{spaceUrl}</span>
            </div>
            <button
              type="button"
              onClick={copyLink}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
              title="Visit your Space"
            >
              <OpenInNewOutlined style={{ fontSize: 16 }} />
            </a>
          </div>
        )}
      </div>

      {/* Profile Information — dark header section */}
      <Section title="Profile Information">
        {/* Display Name + Profile Title — side by side */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-y-1.5">
            <label className="text-[13px] font-medium text-gray-700">Display Name</label>
            <input
              type="text"
              value={organization.name}
              disabled
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[14px] text-gray-500"
            />
          </div>
          <div className="flex flex-col gap-y-1.5">
            <label className="text-[13px] font-medium text-gray-700">Profile Title</label>
            <Select
              value={settings?.profile_title ?? ''}
              onValueChange={(v) => updateSetting('profile_title', v || null)}
            >
              <SelectTrigger className="h-[42px]">
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

        {/* Profile Photo + Cover color or image — side by side */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-y-1.5">
            <label className="text-[13px] font-medium text-gray-700">Profile Photo</label>
            <div className="flex h-[100px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white transition-colors hover:border-gray-400">
              <span className="text-[13px] text-gray-500">
                Drop your photo here,{' '}
                <span className="text-blue-500">or click to browse</span>
              </span>
              <span className="mt-0.5 text-[11px] text-gray-400">
                Square image, at least 400x400px. Max 10MB.
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-y-1.5">
            <label className="text-[13px] font-medium text-gray-700">Cover color or image</label>
            <div
              {...getBannerRootProps()}
              className={twMerge(
                'flex h-[100px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white transition-colors hover:border-gray-400',
                isBannerDragActive && 'border-blue-500 bg-blue-50',
              )}
            >
              <input {...getBannerInputProps()} />
              {settings?.header_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.header_image_url}
                  alt="Cover preview"
                  className="h-full w-full rounded-md object-cover"
                />
              ) : (
                <span className="text-[13px] text-gray-400">
                  Upload cover image
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Profile Description */}
        <div className="flex flex-col gap-y-1.5">
          <label className="text-[13px] font-medium text-gray-700">Profile Description</label>
          <div className="relative">
            <textarea
              value={settings?.description ?? ''}
              onChange={(e) => updateSetting('description', e.target.value)}
              placeholder="eg. I'm a product manager with a passion for building products that help people."
              maxLength={160}
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
            />
            <span className="absolute bottom-2 right-3 text-[11px] text-gray-400">
              {(settings?.description ?? '').length}/160
            </span>
          </div>
        </div>

        {/* Skills */}
        <div className="flex flex-col gap-y-1.5">
          <label className="text-[13px] font-medium text-gray-700">Skills</label>
          <TagInput
            value={settings?.skills ?? []}
            onChange={(tags) => updateSetting('skills', tags)}
            options={SKILL_OPTIONS}
            placeholder="eg. Figma, Java, etc."
          />
        </div>

        {/* Languages */}
        <div className="flex flex-col gap-y-1.5">
          <label className="text-[13px] font-medium text-gray-700">Languages</label>
          <TagInput
            value={settings?.languages ?? []}
            onChange={(tags) => updateSetting('languages', tags)}
            options={LANGUAGE_OPTIONS}
            placeholder="eg. English, French, etc."
          />
        </div>
      </Section>

      {/* Highlights & Social Links */}
      <Section title="Highlights & Social Links" defaultOpen={false}>
        <div className="flex flex-col gap-y-3">
          <p className="text-[13px] text-gray-500">
            Social links are managed from your organization settings. Your product images automatically appear as highlights on your card.
          </p>
          <div className="flex flex-col gap-y-2">
            <label className="text-[13px] font-medium text-gray-700">Available for work</label>
            <div className="flex flex-row items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
              <span className="text-[13px] text-gray-700">Show &quot;Available for work&quot; badge</span>
              <Switch
                checked={settings?.available_for_work ?? false}
                onCheckedChange={(v) => updateSetting('available_for_work', v)}
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Display Settings */}
      <Section title="Display Settings" defaultOpen={false}>
        <div className="flex flex-col gap-y-3">
          {[
            { key: 'show_header' as const, label: 'Show cover image', def: true },
            { key: 'show_logo' as const, label: 'Show profile photo', def: true },
            { key: 'show_name' as const, label: 'Show name', def: true },
            { key: 'show_description' as const, label: 'Show description', def: true },
            { key: 'show_product_details' as const, label: 'Show product details', def: true },
          ].map(({ key, label, def }) => (
            <div
              key={key}
              className="flex flex-row items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              <span className="text-[13px] text-gray-700">{label}</span>
              <Switch
                checked={(settings?.[key] as boolean | undefined) ?? def}
                onCheckedChange={(v) => updateSetting(key, v)}
              />
            </div>
          ))}

          {/* Thumbnail size */}
          <div className="flex flex-row items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
            <span className="text-[13px] text-gray-700">Thumbnail size</span>
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
