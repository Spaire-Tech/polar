'use client'

import { schemas } from '@spaire/client'
import Switch from '@spaire/ui/components/atoms/Switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@spaire/ui/components/atoms/Select'
import { useCallback } from 'react'
import { FileRejection } from 'react-dropzone'
import { useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { FileObject, useFileUpload } from '../../FileUpload'
import AddPhotoAlternateOutlined from '@mui/icons-material/AddPhotoAlternateOutlined'

interface ToggleRowProps {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  children?: React.ReactNode
}

const ToggleRow = ({
  label,
  description,
  checked,
  onCheckedChange,
  children,
}: ToggleRowProps) => (
  <div className="flex flex-col gap-y-3">
    <div className="flex flex-row items-center justify-between">
      <div className="flex flex-col gap-y-0.5">
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {label}
        </span>
        {description && (
          <span className="dark:text-polar-500 text-xs text-gray-500">
            {description}
          </span>
        )}
      </div>
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
  const { watch, setValue } = useFormContext<schemas['OrganizationUpdate']>()

  const settings = watch('storefront_settings')

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
      // Show first error
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

  return (
    <aside className="dark:border-polar-700 flex h-full w-[280px] shrink-0 flex-col gap-y-6 overflow-y-auto border-r border-gray-200 bg-white px-5 py-6 dark:bg-polar-900">
      {/* Enable store */}
      <ToggleRow
        label="Enable your store"
        description="Display your store or hide it and redirect to your website instead."
        checked={settings?.enabled ?? false}
        onCheckedChange={(v) => updateSetting('enabled', v)}
      />

      {/* Show header */}
      <ToggleRow
        label="Show store header"
        checked={settings?.show_header ?? true}
        onCheckedChange={(v) => updateSetting('show_header', v)}
      >
        {/* Banner upload area */}
        <div
          {...getBannerRootProps()}
          className={twMerge(
            'dark:border-polar-600 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-4 transition-colors hover:border-gray-400 dark:hover:border-polar-500',
            isBannerDragActive && 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
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
              <AddPhotoAlternateOutlined className="dark:text-polar-500 text-gray-400" fontSize="small" />
              <span className="dark:text-polar-500 text-xs text-gray-500">
                Upload banner
              </span>
            </div>
          )}
        </div>
        <span className="dark:text-polar-500 text-xs text-gray-400">
          1600 × 300 (16:3) recommended / 10MB max file size.
        </span>
      </ToggleRow>

      {/* Show logo */}
      <ToggleRow
        label="Show store logo"
        checked={settings?.show_logo ?? true}
        onCheckedChange={(v) => updateSetting('show_logo', v)}
      />

      {/* Show name */}
      <ToggleRow
        label="Show store name"
        checked={settings?.show_name ?? true}
        onCheckedChange={(v) => updateSetting('show_name', v)}
      />

      {/* Show description */}
      <ToggleRow
        label="Show store description"
        checked={settings?.show_description ?? true}
        onCheckedChange={(v) => updateSetting('show_description', v)}
      >
        <textarea
          value={settings?.description ?? ''}
          onChange={(e) => updateSetting('description', e.target.value)}
          placeholder="Give your store a short, clear description."
          maxLength={160}
          rows={3}
          className="dark:border-polar-600 dark:bg-polar-800 dark:text-polar-200 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none dark:placeholder:text-polar-500"
        />
        <span className="dark:text-polar-500 text-xs text-gray-400">
          Give your store a short, clear description.
        </span>
      </ToggleRow>

      {/* Thumbnail size */}
      <div className="flex flex-row items-center justify-between">
        <span className="text-sm font-medium text-gray-900 dark:text-white">
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

      {/* Show product details */}
      <ToggleRow
        label="Show product details"
        checked={settings?.show_product_details ?? true}
        onCheckedChange={(v) => updateSetting('show_product_details', v)}
      />
    </aside>
  )
}
