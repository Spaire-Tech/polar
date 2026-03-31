'use client'

import { toast } from '@/components/Toast/use-toast'
import AddPhotoAlternateOutlined from '@mui/icons-material/AddPhotoAlternateOutlined'
import { schemas } from '@spaire/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@spaire/ui/components/atoms/Select'
import Switch from '@spaire/ui/components/atoms/Switch'
import { Textarea } from '@spaire/ui/components/ui/textarea'
import { useCallback } from 'react'
import { FileRejection } from 'react-dropzone'
import { useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { FileObject, useFileUpload } from '../../FileUpload'

const ToggleRow = ({
  label,
  checked,
  onCheckedChange,
  children,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  children?: React.ReactNode
}) => (
  <div className="flex flex-col gap-y-3">
    <div className="flex flex-row items-center justify-between">
      <span className="text-sm font-medium text-gray-900 dark:text-white">
        {label}
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
    {checked && children}
  </div>
)

export const StorefrontSidebar = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const { setValue, watch } =
    useFormContext<schemas['OrganizationUpdate']>()

  const storefrontSettings = watch('storefront_settings') ?? {
    enabled: false,
    show_header: true,
    header_image_url: null,
    show_logo: true,
    show_name: true,
    show_description: true,
    description: null,
    thumbnail_size: 'medium' as const,
    show_product_details: true,
    accent_color: null,
  }

  const updateSetting = useCallback(
    (key: string, value: unknown) => {
      setValue(
        'storefront_settings',
        { ...storefrontSettings, [key]: value },
        { shouldDirty: true },
      )
    },
    [storefrontSettings, setValue],
  )

  // Banner upload
  const onBannerFilesUpdated = useCallback(
    (files: FileObject[]) => {
      if (files.length === 0) return
      const lastFile = files[files.length - 1]
      if ('public_url' in lastFile) {
        updateSetting('header_image_url', lastFile.public_url)
      }
    },
    [updateSetting],
  )
  const onBannerFilesRejected = useCallback(
    (rejections: FileRejection[]) => {
      rejections.forEach((rejection) => {
        toast({
          title: 'Upload Failed',
          description: rejection.errors[0].message,
        })
      })
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

  const storefrontEnabled = storefrontSettings.enabled ?? false

  return (
    <div className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white px-6 py-6 dark:border-polar-700 dark:bg-polar-900">
      <div className="flex flex-col gap-y-6">
        {/* Enable your store */}
        <ToggleRow
          label="Enable your store"
          checked={storefrontEnabled}
          onCheckedChange={(checked) => updateSetting('enabled', checked)}
        />
        <p className="dark:text-polar-500 -mt-3 text-xs text-gray-400">
          Display your store or hide it and redirect to your website instead.
        </p>

        {/* Show store header */}
        <ToggleRow
          label="Show store header"
          checked={storefrontSettings.show_header ?? true}
          onCheckedChange={(checked) => updateSetting('show_header', checked)}
        >
          {/* Banner image preview / upload */}
          <div
            {...getBannerRootProps()}
            className={twMerge(
              'flex h-[72px] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg',
              isBannerDragActive && 'opacity-70',
              !storefrontSettings.header_image_url &&
                'border border-dashed border-gray-300 bg-gray-50 dark:border-polar-600 dark:bg-polar-800',
            )}
          >
            <input {...getBannerInputProps()} />
            {storefrontSettings.header_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={storefrontSettings.header_image_url}
                alt="Header banner"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-0.5 text-gray-400 dark:text-polar-500">
                <AddPhotoAlternateOutlined style={{ fontSize: 18 }} />
              </div>
            )}
          </div>
          <p className="dark:text-polar-500 text-xs text-gray-400">
            1600 × 300 (16:3) recommended
            <br />
            10MB max file size.
          </p>
        </ToggleRow>

        {/* Show store logo */}
        <ToggleRow
          label="Show store logo"
          checked={storefrontSettings.show_logo ?? true}
          onCheckedChange={(checked) => updateSetting('show_logo', checked)}
        />

        {/* Show store name */}
        <ToggleRow
          label="Show store name"
          checked={storefrontSettings.show_name ?? true}
          onCheckedChange={(checked) => updateSetting('show_name', checked)}
        />

        {/* Show store description */}
        <ToggleRow
          label="Show store description"
          checked={storefrontSettings.show_description ?? true}
          onCheckedChange={(checked) =>
            updateSetting('show_description', checked)
          }
        >
          <Textarea
            value={storefrontSettings.description ?? ''}
            onChange={(e) => updateSetting('description', e.target.value)}
            placeholder="Your one-stop destination for..."
            rows={3}
            className="dark:border-polar-600 dark:bg-polar-800 resize-none border-gray-200 text-sm"
          />
          <p className="dark:text-polar-500 text-xs text-gray-400">
            Give your a short, clear description. Basic HTML allowed.
          </p>
        </ToggleRow>

        {/* Thumbnail size — inline */}
        <div className="flex flex-row items-center justify-between">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Thumbnail size
          </span>
          <Select
            value={storefrontSettings.thumbnail_size ?? 'medium'}
            onValueChange={(value) => updateSetting('thumbnail_size', value)}
          >
            <SelectTrigger className="dark:border-polar-600 dark:bg-polar-800 h-8 w-28 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Show product details */}
        <ToggleRow
          label="Show product details"
          checked={storefrontSettings.show_product_details ?? true}
          onCheckedChange={(checked) =>
            updateSetting('show_product_details', checked)
          }
        />
      </div>
    </div>
  )
}
