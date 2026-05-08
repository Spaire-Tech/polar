'use client'

import { InlineModal } from '@/components/Modal/InlineModal'
import { CreateProductPage } from '@/components/Products/CreateProductPage'
import { StorefrontLinkItem } from '@/components/Profile/StorefrontLinks'
import { toast } from '@/components/Toast/use-toast'
import { useProducts } from '@/hooks/queries'
import { spacePageLink } from '@/utils/nav'
import AddOutlined from '@mui/icons-material/AddOutlined'
import AddPhotoAlternateOutlined from '@mui/icons-material/AddPhotoAlternateOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import GridViewOutlined from '@mui/icons-material/GridViewOutlined'
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined'
import Public from '@mui/icons-material/Public'
import ViewAgendaOutlined from '@mui/icons-material/ViewAgendaOutlined'
import ViewCarouselOutlined from '@mui/icons-material/ViewCarouselOutlined'
import ViewListOutlined from '@mui/icons-material/ViewListOutlined'
import { schemas } from '@spaire/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@spaire/ui/components/atoms/Select'
import Switch from '@spaire/ui/components/atoms/Switch'
import { useCallback, useRef, useState } from 'react'
import { FileRejection } from 'react-dropzone'
import { useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { FileObject, useFileUpload } from '../../FileUpload'
import {
  SOCIAL_PLATFORMS,
  getSocialPlatform,
} from '../../Profile/socialPlatforms'

// Predefined options
const SKILL_OPTIONS = [
  '2D Design',
  '3D Design',
  '3D Modeling',
  '2D Animation',
  '3D Animation',
  'Game Art',
  'Illustration',
  'Digital Art',
  'Graphic Design',
  'UI/UX Design',
  'Motion Graphics',
  'Video Editing',
  'Photography',
  'Ebook',
  'Templates',
  'Fonts',
  'Icons',
  'Mockups',
  'Textures',
  'Audio',
  'Music',
  'Sound Effects',
  'Presets',
  'LUTs',
  'Brushes',
  'Plugins',
  'WordPress Themes',
  'Notion Templates',
  'Figma',
  'Adobe Photoshop',
  'Adobe Illustrator',
  'After Effects',
  'Blender',
  'Cinema 4D',
  'Unity',
  'Unreal Engine',
]

const LANGUAGE_OPTIONS = [
  'English',
  'French',
  'Spanish',
  'German',
  'Portuguese',
  'Italian',
  'Dutch',
  'Russian',
  'Arabic',
  'Chinese',
  'Japanese',
  'Korean',
  'Hindi',
  'Turkish',
  'Polish',
  'Swedish',
  'Norwegian',
  'Danish',
  'Finnish',
  'Greek',
  'Czech',
  'Romanian',
  'Hungarian',
  'Thai',
  'Vietnamese',
  'Indonesian',
  'Malay',
  'Filipino',
  'Hebrew',
  'Ukrainian',
]

const PROFILE_TITLE_OPTIONS = [
  'Designer',
  '3D Artist',
  'Illustrator',
  'Photographer',
  'Animator',
  'Video Editor',
  'Developer',
  'Writer',
  'Creator',
  'Music Producer',
  'Game Developer',
  'UI/UX Designer',
  'Graphic Designer',
  'Motion Designer',
]

// --- Focal point helpers ---
export const focalPointToObjectPosition = (focal: string): string => {
  // "X% Y%" is stored directly as CSS object-position
  if (focal.includes('%')) return focal
  // Legacy named values
  const map: Record<string, string> = {
    'top-left': 'left top',
    top: 'center top',
    'top-right': 'right top',
    left: 'left center',
    center: 'center center',
    right: 'right center',
    'bottom-left': 'left bottom',
    bottom: 'center bottom',
    'bottom-right': 'right bottom',
  }
  return map[focal] ?? 'center center'
}

const parseFocalPosition = (raw: string): { x: number; y: number } => {
  if (raw.includes('%') && raw.includes(' ')) {
    const [px, py] = raw.split(' ')
    return { x: parseFloat(px), y: parseFloat(py) }
  }
  const named: Record<string, { x: number; y: number }> = {
    'top-left': { x: 0, y: 0 },
    top: { x: 50, y: 0 },
    'top-right': { x: 100, y: 0 },
    left: { x: 0, y: 50 },
    center: { x: 50, y: 50 },
    right: { x: 100, y: 50 },
    'bottom-left': { x: 0, y: 100 },
    bottom: { x: 50, y: 100 },
    'bottom-right': { x: 100, y: 100 },
  }
  return named[raw] ?? { x: 50, y: 50 }
}

// --- Tag input with full scrollable dropdown ---
const TagInput = ({
  value,
  onChange,
  options,
  placeholder,
  allowCustom = false,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  options: string[]
  placeholder: string
  allowCustom?: boolean
}) => {
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const filtered = options.filter(
    (o) => !value.includes(o) && o.toLowerCase().includes(search.toLowerCase()),
  )

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
      setSearch('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (allowCustom && e.key === 'Enter' && search.trim()) {
      e.preventDefault()
      addTag(search)
    }
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
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
        />
      </div>
      {showDropdown && filtered.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {filtered.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange([...value, option])
                setSearch('')
              }}
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
type SocialLink = schemas['OrganizationSocialLink']

const SocialLinkRow = ({
  social,
  onUpdate,
  onRemove,
}: {
  social: SocialLink
  onUpdate: (social: SocialLink) => void
  onRemove: () => void
}) => {
  const currentPlatform = getSocialPlatform(social.platform)
  const Icon = currentPlatform?.Icon ?? Public

  return (
    <div className="flex flex-row items-center gap-2">
      <Select
        value={social.platform}
        onValueChange={(v) =>
          onUpdate({ ...social, platform: v as SocialLink['platform'] })
        }
      >
        <SelectTrigger className="h-10 w-[140px] shrink-0">
          <div className="flex items-center gap-x-2">
            <Icon className="h-4 w-4" />
            <span className="truncate text-xs">
              {currentPlatform?.label ?? 'Other'}
            </span>
          </div>
        </SelectTrigger>
        <SelectContent>
          {SOCIAL_PLATFORMS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              <div className="flex items-center gap-x-2">
                <p.Icon className="h-4 w-4" />
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
  onEnterLinksMode,
}: {
  organization: schemas['Organization']
  onEnterLinksMode?: () => void
}) => {
  const { watch, setValue } = useFormContext<schemas['OrganizationUpdate']>()
  const settings = watch('storefront_settings')
  const [copied, setCopied] = useState(false)

  const spaceUrl = spacePageLink(organization).replace(/\/$/, '')

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

  const [copiedShare, setCopiedShare] = useState(false)
  const copyShareMessage = useCallback(() => {
    navigator.clipboard.writeText(
      `I just launched my Spaire Space\n\nAll my work is up here now!\n${spaceUrl}`,
    )
    setCopiedShare(true)
    setTimeout(() => setCopiedShare(false), 2000)
  }, [spaceUrl])
  const shareOnTwitter = useCallback(() => {
    const msg = 'I just launched my Spaire Space\n\nAll my work is up here now!'
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}&url=${encodeURIComponent(spaceUrl)}`,
      '_blank',
    )
  }, [spaceUrl])
  const shareOnLinkedIn = useCallback(() => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(spaceUrl)}`,
      '_blank',
    )
  }, [spaceUrl])

  // Socials — read from organization, write to form
  const socials: SocialLink[] = (watch('socials') ??
    organization.socials ??
    []) as SocialLink[]
  const addSocial = () => {
    setValue(
      'socials',
      [...socials, { platform: 'instagram', url: '' } as SocialLink],
      { shouldDirty: true },
    )
  }
  const updateSocial = (idx: number, social: SocialLink) => {
    const updated = [...socials]
    updated[idx] = social
    setValue('socials', updated, { shouldDirty: true })
  }
  const removeSocial = (idx: number) => {
    setValue(
      'socials',
      socials.filter((_, i) => i !== idx),
      { shouldDirty: true },
    )
  }

  // Storefront links
  const storefrontLinks: StorefrontLinkItem[] =
    (settings?.storefront_links as StorefrontLinkItem[] | undefined) ?? []
  const linksPosition: string = settings?.links_position ?? 'after_products'
  const linksLayout: NonNullable<
    schemas['OrganizationStorefrontSettings']['links_layout']
  > = settings?.links_layout ?? 'classic'
  const hasUrlLinks = storefrontLinks.some((l) => l.type !== 'embedded')

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

  const onAvatarFilesRejected = useCallback((rejections: FileRejection[]) => {
    if (rejections.length > 0) {
      toast({
        title: 'Upload failed',
        description: rejections[0].errors[0].message,
      })
    }
  }, [])

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

  const onBannerFilesRejected = useCallback((rejections: FileRejection[]) => {
    if (rejections.length > 0) {
      toast({
        title: 'Upload failed',
        description: rejections[0].errors[0].message,
      })
    }
  }, [])

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

  // Products — for featured selection
  const allProducts =
    useProducts(organization.id, { is_archived: false }).data?.items ?? []
  const featuredMode: 'all' | 'curated' = settings?.featured_mode ?? 'all'
  const featuredIds: string[] = settings?.featured_product_ids ?? []
  const isCurated = featuredMode === 'curated'

  const setFeaturedMode = (mode: 'all' | 'curated') => {
    if (mode === featuredMode) return
    if (mode === 'all') {
      updateSetting('featured_mode', 'all')
    } else {
      updateSetting('featured_mode', 'curated')
      // Seed the curated list with whatever is already there. If empty,
      // pre-select everything so flipping the toggle isn't immediately
      // destructive.
      if (featuredIds.length === 0 && allProducts.length > 0) {
        updateSetting(
          'featured_product_ids',
          allProducts.map((p) => p.id),
        )
      }
    }
  }

  const toggleProduct = (productId: string) => {
    if (!isCurated) return
    if (featuredIds.includes(productId)) {
      updateSetting(
        'featured_product_ids',
        featuredIds.filter((id) => id !== productId),
      )
    } else {
      updateSetting('featured_product_ids', [...featuredIds, productId])
    }
  }

  const isEnabled = settings?.enabled ?? false
  const headerFocalRaw = settings?.header_focal_point ?? '50% 50%'
  const coverPos = parseFocalPosition(headerFocalRaw)

  // Drag-to-reposition cover image. Math is size-relative: dragging the
  // image one container-width to the right shifts focal point 100%.
  // Pointer events handle mouse, touch, and pen with one path.
  const [isCoverDragging, setIsCoverDragging] = useState(false)
  const [createProductOpen, setCreateProductOpen] = useState(false)
  const coverDragRef = useRef<{
    startX: number
    startY: number
    posX: number
    posY: number
    width: number
    height: number
    pointerId: number
  } | null>(null)

  const startCoverDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsCoverDragging(true)
    coverDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: coverPos.x,
      posY: coverPos.y,
      width: rect.width,
      height: rect.height,
      pointerId: e.pointerId,
    }
  }

  const moveCoverDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = coverDragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dxPct = ((e.clientX - drag.startX) / drag.width) * 100
    const dyPct = ((e.clientY - drag.startY) / drag.height) * 100
    const newX = Math.max(0, Math.min(100, drag.posX - dxPct))
    const newY = Math.max(0, Math.min(100, drag.posY - dyPct))
    updateSetting(
      'header_focal_point',
      `${newX.toFixed(1)}% ${newY.toFixed(1)}%`,
    )
  }

  const endCoverDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = coverDragRef.current
    if (drag && e.currentTarget.hasPointerCapture(drag.pointerId)) {
      e.currentTarget.releasePointerCapture(drag.pointerId)
    }
    setIsCoverDragging(false)
    coverDragRef.current = null
  }

  return (
    <div className="flex flex-col gap-y-8 px-8 py-8">
      {/* Enable Your Space */}
      <div className="flex flex-col gap-y-3">
        <div className="flex flex-col divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-gray-50">
            <div>
              <span className="text-sm font-medium text-gray-900">
                Enable Your Space
              </span>
              <p className="text-xs text-gray-500">
                Make your storefront visible to the public.
              </p>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={(v) => updateSetting('enabled', v)}
            />
          </div>
        </div>
        {isEnabled && (
          <>
            <div className="flex flex-row items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                <span className="truncate text-xs text-gray-600">
                  {spaceUrl}
                </span>
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
            <div className="flex flex-col gap-2 pt-2">
              <span className="text-xs font-medium text-gray-500">
                Share your Space
              </span>
              <div className="flex flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={shareOnTwitter}
                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Post on X
                </button>
                <button
                  type="button"
                  onClick={shareOnLinkedIn}
                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  LinkedIn
                </button>
                <button
                  type="button"
                  onClick={copyShareMessage}
                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  {copiedShare ? 'Copied!' : 'Copy message'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Profile Information */}
      <div className="flex flex-col gap-y-2">
        <h3 className="text-sm font-semibold text-gray-900">
          Profile Information
        </h3>
        <div className="flex flex-col gap-y-5">
          {/* Display Name + Profile Title */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Display Name
              </label>
              <input
                type="text"
                value={watch('name') ?? organization.name}
                onChange={(e) =>
                  setValue('name', e.target.value, { shouldDirty: true })
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
                placeholder="Your display name"
              />
            </div>
            <div className="flex flex-col gap-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Profile Title
              </label>
              <Select
                value={settings?.profile_title ?? ''}
                onValueChange={(v) => updateSetting('profile_title', v || null)}
              >
                <SelectTrigger className="h-[42px] rounded-xl">
                  <SelectValue />
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
              <label className="text-sm font-medium text-gray-700">
                Profile Photo
              </label>
              <div
                {...getAvatarRootProps()}
                className={twMerge(
                  'flex h-[120px] cursor-pointer flex-col items-center justify-center gap-y-2 overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-white transition-colors hover:border-gray-400',
                  isAvatarDragActive && 'border-blue-500 bg-blue-50',
                )}
              >
                <input {...getAvatarInputProps()} />
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={organization.name}
                    className="h-full w-full object-cover"
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
              <span className="text-xs text-gray-400">
                Square image, 400x400px. Max 1MB.
              </span>
            </div>
            <div className="flex flex-col gap-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Cover Image
              </label>
              {settings?.header_image_url ? (
                <>
                  {/* Drag-to-reposition when image is set */}
                  <div
                    className={twMerge(
                      'group relative h-[120px] touch-none overflow-hidden rounded-xl select-none',
                      isCoverDragging ? 'cursor-grabbing' : 'cursor-grab',
                    )}
                    onPointerDown={(e) => {
                      e.preventDefault()
                      startCoverDrag(e)
                    }}
                    onPointerMove={(e) => {
                      if (isCoverDragging) moveCoverDrag(e)
                    }}
                    onPointerUp={endCoverDrag}
                    onPointerCancel={endCoverDrag}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={settings.header_image_url}
                      alt="Cover preview"
                      className="pointer-events-none h-full w-full object-cover"
                      style={{
                        objectPosition: `${coverPos.x.toFixed(1)}% ${coverPos.y.toFixed(1)}%`,
                      }}
                      draggable={false}
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                        Drag to reposition
                      </span>
                    </div>
                  </div>
                  {/* Replace button */}
                  <div {...getBannerRootProps()} className="cursor-pointer">
                    <input {...getBannerInputProps()} />
                    <span className="text-xs text-blue-500 hover:underline">
                      Replace image
                    </span>
                  </div>
                </>
              ) : (
                <div
                  {...getBannerRootProps()}
                  className={twMerge(
                    'flex h-[120px] cursor-pointer flex-col items-center justify-center gap-y-2 overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-white transition-colors hover:border-gray-400',
                    isBannerDragActive && 'border-blue-500 bg-blue-50',
                  )}
                >
                  <input {...getBannerInputProps()} />
                  <AddPhotoAlternateOutlined className="text-gray-400" />
                  <span className="text-center text-xs text-gray-500">
                    Upload cover image
                  </span>
                </div>
              )}
              <span className="text-xs text-gray-400">
                1600 x 300 recommended. Max 10MB.
              </span>
            </div>
          </div>

          {/* Profile Description */}
          <div className="flex flex-col gap-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Profile Description
            </label>
            <div className="relative">
              <textarea
                value={settings?.description ?? ''}
                onChange={(e) => updateSetting('description', e.target.value)}
                placeholder="eg. I'm a product manager with a passion for building products that help people."
                maxLength={160}
                rows={3}
                className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
              />
              <span className="absolute right-3 bottom-2 text-[11px] text-gray-400">
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
              allowCustom={true}
            />
          </div>

          {/* Languages */}
          <div className="flex flex-col gap-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Languages
            </label>
            <TagInput
              value={settings?.languages ?? []}
              onChange={(tags) => updateSetting('languages', tags)}
              options={LANGUAGE_OPTIONS}
              placeholder="eg. English, French, etc."
            />
          </div>
        </div>
      </div>

      {/* Social Links — always visible, not collapsible */}
      <div className="flex flex-col gap-y-2">
        <h3 className="text-sm font-semibold text-gray-900">Social Links</h3>
        <div className="flex flex-col gap-y-3">
          {socials.map((social: SocialLink, idx: number) => (
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
      </div>

      {/* Links */}
      <div className="flex flex-col gap-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Links</h3>
          {storefrontLinks.length > 0 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {storefrontLinks.length}
            </span>
          )}
        </div>

        {/* Manage links button — opens left panel */}
        <button
          type="button"
          onClick={onEnterLinksMode}
          className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50"
        >
          <span className="font-medium">
            {storefrontLinks.length === 0
              ? 'Add links & embeds'
              : `Manage ${storefrontLinks.length} link${storefrontLinks.length !== 1 ? 's' : ''}`}
          </span>
          <ChevronRightOutlined
            style={{ fontSize: 18 }}
            className="text-gray-400"
          />
        </button>

        {storefrontLinks.length > 0 && (
          <>
            {/* Layout picker — only applies to URL-typed links. Embeds
                always render full-width regardless. */}
            {hasUrlLinks && (
              <div className="flex flex-col gap-y-2">
                <span className="text-xs font-medium text-gray-500">
                  URL link layout
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { value: 'classic', label: 'List', Icon: ViewListOutlined },
                      { value: 'card', label: 'Cards', Icon: ViewAgendaOutlined },
                      {
                        value: 'image_grid',
                        label: 'Grid',
                        Icon: GridViewOutlined,
                      },
                      {
                        value: 'carousel',
                        label: 'Carousel',
                        Icon: ViewCarouselOutlined,
                      },
                    ] as const
                  ).map(({ value, label, Icon }) => {
                    const active = linksLayout === value
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateSetting('links_layout', value)}
                        className={twMerge(
                          'flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium transition-colors',
                          active
                            ? 'border-blue-500 bg-blue-50 text-blue-600'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                        )}
                      >
                        <Icon style={{ fontSize: 18 }} />
                        {label}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-400">
                  Embeds always render full-width, regardless of layout.
                </p>
              </div>
            )}

            {/* Position toggle */}
            <div className="flex flex-col divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
              <div className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <span className="text-sm text-gray-700">
                    Show before products
                  </span>
                  <p className="text-xs text-gray-400">
                    Off = show after products
                  </p>
                </div>
                <Switch
                  checked={linksPosition === 'before_products'}
                  onCheckedChange={(v) =>
                    updateSetting(
                      'links_position',
                      v ? 'before_products' : 'after_products',
                    )
                  }
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Products to Display */}
      <div className="flex flex-col gap-y-2">
        <h3 className="text-sm font-semibold text-gray-900">
          Products to Display
        </h3>

        {/* Mode toggle */}
        <div className="flex flex-col divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-gray-50">
            <div>
              <span className="text-sm font-medium text-gray-900">
                Curate which products appear
              </span>
              <p className="text-xs text-gray-500">
                {isCurated
                  ? 'Only the products you check below appear on your Space.'
                  : 'All your active products appear automatically — including new ones you create.'}
              </p>
            </div>
            <Switch
              checked={isCurated}
              onCheckedChange={(v) => setFeaturedMode(v ? 'curated' : 'all')}
            />
          </div>
        </div>

        {isCurated && allProducts.length > 0 && (
          <div className="flex flex-col divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
            {allProducts.map((product) => {
              const checked = featuredIds.includes(product.id)
              return (
                <label
                  key={product.id}
                  className="flex cursor-pointer items-center gap-x-3 px-4 py-3 transition-colors hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleProduct(product.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 accent-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex min-w-0 flex-1 items-center gap-x-3">
                    {product.medias?.[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.medias[0].public_url}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900">
                        {product.name}
                      </span>
                      {product.prices?.[0] &&
                        'price_amount' in product.prices[0] && (
                          <span className="text-xs text-gray-500">
                            $
                            {(
                              (product.prices[0] as { price_amount: number })
                                .price_amount / 100
                            ).toFixed(2)}
                          </span>
                        )}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => setCreateProductOpen(true)}
          className="flex flex-row items-center gap-x-2 rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700"
        >
          <AddOutlined style={{ fontSize: 18 }} />
          {allProducts.length > 0
            ? 'Create another product'
            : 'Create your first product'}
        </button>
      </div>
      <InlineModal
        isShown={createProductOpen}
        hide={() => setCreateProductOpen(false)}
        className="md:w-[720px]"
        modalContent={
          createProductOpen ? (
            <CreateProductPage
              organization={organization}
              panelMode
              onClose={() => setCreateProductOpen(false)}
            />
          ) : (
            <div />
          )
        }
      />

      {/* Display Settings — always visible, not collapsible */}
      {/* Available for work — its own section because it has an optional
          contact URL sub-input. */}
      <div className="flex flex-col gap-y-2">
        <h3 className="text-sm font-semibold text-gray-900">
          Available for work
        </h3>
        <div className="flex flex-col divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-gray-50">
            <div>
              <span className="text-sm font-medium text-gray-900">
                Show the badge
              </span>
              <p className="text-xs text-gray-500">
                A green &ldquo;Available for work&rdquo; pill on your Space
                card.
              </p>
            </div>
            <Switch
              checked={settings?.available_for_work ?? false}
              onCheckedChange={(v) => updateSetting('available_for_work', v)}
            />
          </div>
          {(settings?.available_for_work ?? false) && (
            <div className="flex flex-col gap-y-1.5 px-4 py-3.5">
              <label className="text-xs font-medium text-gray-700">
                Contact link (optional)
              </label>
              <input
                type="text"
                value={settings?.contact_url ?? ''}
                onChange={(e) =>
                  updateSetting('contact_url', e.target.value || null)
                }
                placeholder="mailto:hello@example.com  or  https://cal.com/me"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
              />
              <p className="text-[11px] text-gray-400">
                When set, the badge becomes a clickable link. Leave empty to
                show the badge without a link.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-y-2">
        <h3 className="text-sm font-semibold text-gray-900">
          Display Settings
        </h3>
        <div className="flex flex-col divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
          {[
            {
              key: 'show_header' as const,
              label: 'Show cover image',
              def: true,
            },
            {
              key: 'show_logo' as const,
              label: 'Show profile photo',
              def: true,
            },
            { key: 'show_name' as const, label: 'Show name', def: true },
            {
              key: 'show_description' as const,
              label: 'Show description',
              def: true,
            },
            {
              key: 'show_product_details' as const,
              label: 'Show product details',
              def: true,
            },
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
            <span className="text-sm text-gray-700">
              Show product images in card
            </span>
            <Switch
              checked={settings?.show_card_products ?? true}
              onCheckedChange={(v) => updateSetting('show_card_products', v)}
            />
          </div>
          <div className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-gray-50">
            <span className="text-sm text-gray-700">Thumbnail size</span>
            <Select
              value={settings?.thumbnail_size ?? 'medium'}
              onValueChange={(v) =>
                updateSetting(
                  'thumbnail_size',
                  v as 'small' | 'medium' | 'large',
                )
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
      </div>

    </div>
  )
}
