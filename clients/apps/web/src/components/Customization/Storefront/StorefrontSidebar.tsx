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
import AddPhotoAlternateOutlined from '@mui/icons-material/AddPhotoAlternateOutlined'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'

// Predefined skill options for digital product creators
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

// --- Reusable section component ---
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
        className="flex w-full flex-row items-center justify-between px-5 py-4"
      >
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <ExpandMoreOutlined
          style={{ fontSize: 20 }}
          className={twMerge('text-gray-400 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && <div className="flex flex-col gap-y-4 px-5 pb-5">{children}</div>}
    </div>
  )
}

// --- Tag input component ---
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
      {/* Selected tags */}
      {value.length > 0 && (
        <div className="mb-2 flex flex-row flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-x-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
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
      {/* Search input */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
      />
      {/* Dropdown */}
      {showDropdown && filtered.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {filtered.slice(0, 10).map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addTag(option)}
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

// --- Toggle row component ---
const ToggleRow = ({
  label,
  description,
  checked,
  onCheckedChange,
  children,
}: {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  children?: React.ReactNode
}) => (
  <div className="flex flex-col gap-y-3">
    <div className="flex flex-row items-center justify-between">
      <div className="flex flex-col gap-y-0.5">
        <span className="text-sm font-medium text-gray-900">{label}</span>
        {description && (
          <span className="text-xs text-gray-500">{description}</span>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
    {checked && children}
  </div>
)

// --- Main sidebar ---
export const StorefrontSidebar = ({
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
    <aside className="flex h-full w-[320px] shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white">
      {/* Enable Your Space — always visible at top */}
      <div className="border-b border-gray-100 px-5 py-5">
        <ToggleRow
          label="Enable Your Space"
          description="Make your storefront visible to the public."
          checked={isEnabled}
          onCheckedChange={(v) => updateSetting('enabled', v)}
        />
        {isEnabled && (
          <div className="mt-3 flex flex-row items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <span className="truncate text-xs text-gray-600">{spaceUrl}</span>
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

      {/* Profile Information */}
      <Section title="Profile Information">
        {/* Profile Title */}
        <div className="flex flex-col gap-y-1.5">
          <label className="text-xs font-medium text-gray-700">Profile Title</label>
          <Select
            value={settings?.profile_title ?? ''}
            onValueChange={(v) => updateSetting('profile_title', v || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="e.g. Designer" />
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

        {/* Profile Photo (avatar) */}
        <div className="flex flex-col gap-y-1.5">
          <label className="text-xs font-medium text-gray-700">Cover Image</label>
          <div
            {...getBannerRootProps()}
            className={twMerge(
              'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-4 transition-colors hover:border-gray-400',
              isBannerDragActive && 'border-blue-500 bg-blue-50',
            )}
          >
            <input {...getBannerInputProps()} />
            {settings?.header_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.header_image_url}
                alt="Banner preview"
                className="max-h-20 w-full rounded object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-y-1">
                <AddPhotoAlternateOutlined className="text-gray-400" fontSize="small" />
                <span className="text-xs text-gray-500">
                  Drop your image here, or click to browse
                </span>
              </div>
            )}
          </div>
          <span className="text-xs text-gray-400">
            1600 x 300 recommended. Max 10MB.
          </span>
        </div>

        {/* Profile Description */}
        <div className="flex flex-col gap-y-1.5">
          <label className="text-xs font-medium text-gray-700">Profile Description</label>
          <textarea
            value={settings?.description ?? ''}
            onChange={(e) => updateSetting('description', e.target.value)}
            placeholder="e.g. I'm a product manager with a passion for building products that help people."
            maxLength={160}
            rows={3}
            className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
          />
          <div className="flex justify-end">
            <span className="text-xs text-gray-400">
              {(settings?.description ?? '').length}/160
            </span>
          </div>
        </div>

        {/* Skills */}
        <div className="flex flex-col gap-y-1.5">
          <label className="text-xs font-medium text-gray-700">Skills</label>
          <TagInput
            value={settings?.skills ?? []}
            onChange={(tags) => updateSetting('skills', tags)}
            options={SKILL_OPTIONS}
            placeholder="e.g. Figma, Blender, etc."
          />
        </div>

        {/* Languages */}
        <div className="flex flex-col gap-y-1.5">
          <label className="text-xs font-medium text-gray-700">Languages</label>
          <TagInput
            value={settings?.languages ?? []}
            onChange={(tags) => updateSetting('languages', tags)}
            options={LANGUAGE_OPTIONS}
            placeholder="e.g. English, French, etc."
          />
        </div>
      </Section>

      {/* Display Settings */}
      <Section title="Display Settings" defaultOpen={false}>
        <ToggleRow
          label="Show cover image"
          checked={settings?.show_header ?? true}
          onCheckedChange={(v) => updateSetting('show_header', v)}
        />
        <ToggleRow
          label="Show profile photo"
          checked={settings?.show_logo ?? true}
          onCheckedChange={(v) => updateSetting('show_logo', v)}
        />
        <ToggleRow
          label="Show name"
          checked={settings?.show_name ?? true}
          onCheckedChange={(v) => updateSetting('show_name', v)}
        />
        <ToggleRow
          label="Show description"
          checked={settings?.show_description ?? true}
          onCheckedChange={(v) => updateSetting('show_description', v)}
        />
        <ToggleRow
          label="Available for work"
          description="Show a green badge on your profile."
          checked={settings?.available_for_work ?? false}
          onCheckedChange={(v) => updateSetting('available_for_work', v)}
        />

        {/* Thumbnail size */}
        <div className="flex flex-row items-center justify-between">
          <span className="text-sm font-medium text-gray-900">
            Thumbnail size
          </span>
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

        <ToggleRow
          label="Show product details"
          checked={settings?.show_product_details ?? true}
          onCheckedChange={(v) => updateSetting('show_product_details', v)}
        />
      </Section>
    </aside>
  )
}
