'use client'

import { toast } from '@/components/Toast/use-toast'
import { useUpdateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { CONFIG } from '@/utils/config'
import AddPhotoAlternateOutlined from '@mui/icons-material/AddPhotoAlternateOutlined'
import { isValidationError, schemas } from '@spaire/client'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import Button from '@spaire/ui/components/atoms/Button'
import CopyToClipboardInput from '@spaire/ui/components/atoms/CopyToClipboardInput'
import Input from '@spaire/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@spaire/ui/components/atoms/Select'
import ShadowBox from '@spaire/ui/components/atoms/ShadowBox'
import Switch from '@spaire/ui/components/atoms/Switch'
import { Label } from '@spaire/ui/components/ui/label'
import { Separator } from '@spaire/ui/components/ui/separator'
import { Textarea } from '@spaire/ui/components/ui/textarea'
import Link from 'next/link'
import { PropsWithChildren, useCallback } from 'react'
import { FileRejection } from 'react-dropzone'
import { useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { FileObject, useFileUpload } from '../../FileUpload'

const StorefrontSidebarContentWrapper = ({
  title,
  enabled,
  children,
  organization,
}: PropsWithChildren<{
  title: string
  enabled: boolean
  organization: schemas['Organization']
}>) => {
  return (
    <ShadowBox className="shadow-3xl flex h-full min-h-0 w-full max-w-96 shrink-0 grow-0 flex-col overflow-y-auto bg-white p-8 dark:border-transparent">
      <div className="flex h-full flex-col gap-y-6">
        <div className="flex flex-row items-center justify-between">
          <h2 className="text-lg font-medium">Spaire Space</h2>

          {enabled && (
            <Button size="sm" asChild>
              <Link href={`/${organization.slug}`} target="_blank">
                Open Storefront
              </Link>
            </Button>
          )}
        </div>
        <div className="flex grow flex-col justify-between gap-y-4">
          {children}
        </div>
      </div>
    </ShadowBox>
  )
}

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
      <Label className="text-sm font-medium">{label}</Label>
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
  const { handleSubmit, setError, formState, reset, setValue, watch } =
    useFormContext<schemas['OrganizationUpdate']>()

  const updateOrganization = useUpdateOrganization()

  // Get storefront settings from the form, with defaults
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

  const avatarURL = watch('avatar_url')

  // Avatar upload
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
      rejections.forEach((rejection) => {
        setError('avatar_url', { message: rejection.errors[0].message })
      })
    },
    [setError],
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

  const onSubmit = useCallback(
    async (organizationUpdate: schemas['OrganizationUpdate']) => {
      const { data: org, error } = await updateOrganization.mutateAsync({
        id: organization.id,
        body: organizationUpdate,
      })
      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, setError)
        } else {
          toast({
            title: 'Organization Update Failed',
            description: `Error updating organization: ${error.detail}`,
          })
        }
        return
      }

      toast({
        title: 'Organization Updated',
        description: `Organization ${organization.name} was successfully updated`,
      })
      reset(org)
    },
    [organization, setError, updateOrganization, reset],
  )

  const storefrontEnabled = storefrontSettings.enabled ?? false
  const storefrontURL = `${CONFIG.FRONTEND_BASE_URL}/${organization.slug}`

  return (
    <StorefrontSidebarContentWrapper
      title="Spaire Space"
      enabled={storefrontEnabled}
      organization={organization}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-y-4"
      >
        {/* Enable Store */}
        <ToggleRow
          label="Enable Store"
          checked={storefrontEnabled}
          onCheckedChange={(checked) => updateSetting('enabled', checked)}
        />

        <Separator />

        {/* Show Header Banner */}
        <ToggleRow
          label="Show Header Banner"
          checked={storefrontSettings.show_header ?? true}
          onCheckedChange={(checked) => updateSetting('show_header', checked)}
        >
          <div
            {...getBannerRootProps()}
            className={twMerge(
              'flex h-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 transition-colors hover:border-gray-300 dark:border-polar-700 dark:hover:border-polar-600',
              isBannerDragActive && 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
              storefrontSettings.header_image_url && 'border-solid border-transparent',
            )}
          >
            <input {...getBannerInputProps()} />
            {storefrontSettings.header_image_url ? (
              <div className="relative h-full w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={storefrontSettings.header_image_url}
                  alt="Header banner"
                  className="h-full w-full rounded-xl object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 transition-colors hover:bg-black/30">
                  <AddPhotoAlternateOutlined className="text-transparent transition-colors hover:text-white" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 text-gray-400">
                <AddPhotoAlternateOutlined fontSize="small" />
                <span className="text-xs">Upload banner image</span>
              </div>
            )}
          </div>
        </ToggleRow>

        <Separator />

        {/* Show Logo */}
        <ToggleRow
          label="Show Logo"
          checked={storefrontSettings.show_logo ?? true}
          onCheckedChange={(checked) => updateSetting('show_logo', checked)}
        >
          <div className="flex flex-row items-center gap-4">
            <div
              {...getAvatarRootProps()}
              className={twMerge(
                'group relative',
                isAvatarDragActive && 'opacity-50',
              )}
            >
              <input {...getAvatarInputProps()} />
              <Avatar
                avatar_url={avatarURL ?? ''}
                name={organization.name}
                className={twMerge(
                  'h-12 w-12 group-hover:opacity-50',
                  isAvatarDragActive && 'opacity-50',
                )}
              />
              <div
                className={twMerge(
                  'absolute top-0 left-0 h-12 w-12 cursor-pointer items-center justify-center group-hover:flex',
                  isAvatarDragActive ? 'flex' : 'hidden',
                )}
              >
                <AddPhotoAlternateOutlined fontSize="small" />
              </div>
            </div>
            <Input
              value={avatarURL ?? ''}
              onChange={(e) =>
                setValue('avatar_url', e.target.value, { shouldDirty: true })
              }
              placeholder="Logo URL"
              className="text-sm"
            />
          </div>
        </ToggleRow>

        <Separator />

        {/* Show Name */}
        <ToggleRow
          label="Show Name"
          checked={storefrontSettings.show_name ?? true}
          onCheckedChange={(checked) => updateSetting('show_name', checked)}
        >
          <Input
            value={watch('name') ?? ''}
            onChange={(e) =>
              setValue('name', e.target.value, { shouldDirty: true })
            }
            placeholder="Store name"
            className="text-sm"
          />
        </ToggleRow>

        <Separator />

        {/* Show Description */}
        <ToggleRow
          label="Show Description"
          checked={storefrontSettings.show_description ?? true}
          onCheckedChange={(checked) =>
            updateSetting('show_description', checked)
          }
        >
          <Textarea
            value={storefrontSettings.description ?? ''}
            onChange={(e) => updateSetting('description', e.target.value)}
            placeholder="Tell visitors about your store..."
            maxLength={160}
            rows={3}
            className="text-sm"
          />
          <span className="text-xs text-gray-400">
            {(storefrontSettings.description ?? '').length}/160
          </span>
        </ToggleRow>

        <Separator />

        {/* Thumbnail Size */}
        <div className="flex flex-col gap-y-2">
          <Label className="text-sm font-medium">Thumbnail Size</Label>
          <Select
            value={storefrontSettings.thumbnail_size ?? 'medium'}
            onValueChange={(value) => updateSetting('thumbnail_size', value)}
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Show Product Details */}
        <ToggleRow
          label="Show Product Details"
          checked={storefrontSettings.show_product_details ?? true}
          onCheckedChange={(checked) =>
            updateSetting('show_product_details', checked)
          }
        />

        <Separator />

        {/* Accent Color */}
        <div className="flex flex-col gap-y-2">
          <Label className="text-sm font-medium">Accent Color</Label>
          <div className="flex flex-row items-center gap-x-3">
            <input
              type="color"
              value={storefrontSettings.accent_color ?? '#0062FF'}
              onChange={(e) => updateSetting('accent_color', e.target.value)}
              className="h-9 w-9 cursor-pointer rounded-lg border border-gray-200 p-0.5 dark:border-polar-700"
            />
            <Input
              value={storefrontSettings.accent_color ?? ''}
              onChange={(e) => updateSetting('accent_color', e.target.value)}
              placeholder="#0062FF"
              className="text-sm"
            />
          </div>
        </div>

        <Separator />

        {/* Save Button */}
        <div className="flex flex-row items-center gap-x-4">
          <Button
            className="self-start"
            type="submit"
            loading={updateOrganization.isPending}
            disabled={!formState.isDirty || updateOrganization.isPending}
          >
            Save
          </Button>
        </div>

        {/* Share Section */}
        {storefrontEnabled && (
          <>
            <Separator />
            <div className="flex flex-col gap-y-3">
              <Label className="text-sm font-medium">Share</Label>
              <CopyToClipboardInput
                value={storefrontURL}
                buttonLabel="Copy"
                className="bg-white"
                onCopy={() => {
                  toast({
                    title: 'Copied To Clipboard',
                    description: `Storefront URL was copied to clipboard`,
                  })
                }}
              />
            </div>
          </>
        )}
      </form>
    </StorefrontSidebarContentWrapper>
  )
}
