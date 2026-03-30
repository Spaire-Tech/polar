'use client'

import { toast } from '@/components/Toast/use-toast'
import { useUpdateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { CONFIG } from '@/utils/config'
import { ErrorMessage } from '@hookform/error-message'
import AddPhotoAlternateOutlined from '@mui/icons-material/AddPhotoAlternateOutlined'
import { isValidationError, schemas } from '@spaire/client'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import Button from '@spaire/ui/components/atoms/Button'
import CopyToClipboardInput from '@spaire/ui/components/atoms/CopyToClipboardInput'
import Input from '@spaire/ui/components/atoms/Input'
import ShadowBox from '@spaire/ui/components/atoms/ShadowBox'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@spaire/ui/components/ui/form'
import { Label } from '@spaire/ui/components/ui/label'
import { Separator } from '@spaire/ui/components/ui/separator'
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
      <div className="flex h-full flex-col gap-y-8">
        <div className="flex flex-row items-center justify-between">
          <h2 className="text-lg">{title}</h2>

          {enabled && (
            <Button size="sm">
              <Link href={`/${organization.slug}`} target="_blank">
                Open Space
              </Link>
            </Button>
          )}
        </div>
        <div className="flex grow flex-col justify-between gap-y-8">
          {children}
        </div>
      </div>
    </ShadowBox>
  )
}

const StorefrontForm = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const {
    control,
    formState: { errors },
    setValue,
    setError,
    watch,
  } = useFormContext<schemas['OrganizationUpdate']>()

  const avatarURL = watch('avatar_url')

  const onFilesUpdated = useCallback(
    (files: FileObject<schemas['OrganizationAvatarFileRead']>[]) => {
      if (files.length === 0) {
        return
      }
      const lastFile = files[files.length - 1]
      setValue('avatar_url', lastFile.public_url, { shouldDirty: true })
    },
    [setValue],
  )
  const onFilesRejected = useCallback(
    (rejections: FileRejection[]) => {
      rejections.forEach((rejection) => {
        setError('avatar_url', { message: rejection.errors[0].message })
      })
    },
    [setError],
  )
  const { getRootProps, getInputProps, isDragActive } = useFileUpload({
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
    onFilesUpdated,
    onFilesRejected,
    initialFiles: [],
  })

  return (
    <>
      <FormField
        control={control}
        name="avatar_url"
        render={({ field }) => (
          <div className="flex flex-row items-center gap-4">
            <div
              {...getRootProps()}
              className={twMerge(
                'group relative',
                isDragActive && 'opacity-50',
              )}
            >
              <input {...getInputProps()} />
              <Avatar
                avatar_url={avatarURL ?? ''}
                name={organization.name}
                className={twMerge(
                  'h-16 w-16 group-hover:opacity-50',
                  isDragActive && 'opacity-50',
                )}
              />
              <div
                className={twMerge(
                  'absolute top-0 left-0 h-16 w-16 cursor-pointer items-center justify-center group-hover:flex',
                  isDragActive ? 'flex' : 'hidden',
                )}
              >
                <AddPhotoAlternateOutlined />
              </div>
            </div>
            <FormItem className="grow">
              <FormControl>
                <Input
                  {...field}
                  value={field.value || ''}
                  placeholder="Logo URL"
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          </div>
        )}
      />
      <FormField
        control={control}
        name="name"
        defaultValue=""
        render={({ field }) => (
          <FormItem className="flex flex-col gap-y-1">
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Store Name</FormLabel>
            </div>
            <FormControl>
              <Input {...field} value={field.value || ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="flex flex-col gap-y-1">
        <Label className="text-sm font-medium">Description</Label>
        <textarea
          className="dark:border-spaire-700 dark:bg-spaire-800 min-h-[80px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="Tell visitors about your store..."
          maxLength={160}
          value={
            (watch('profile_settings') as Record<string, unknown>)
              ?.description as string ?? ''
          }
          onChange={(e) => {
            const current = watch('profile_settings') as Record<string, unknown> ?? {}
            setValue(
              'profile_settings' as any,
              { ...current, description: e.target.value },
              { shouldDirty: true },
            )
          }}
        />
        <p className="text-xs text-gray-400">
          {((watch('profile_settings') as Record<string, unknown>)?.description as string)?.length ?? 0}/160
        </p>
      </div>

      <div className="flex flex-col gap-y-2">
        <Label className="text-sm font-medium">Accent Color</Label>
        <div className="flex flex-row items-center gap-3">
          <input
            type="color"
            className="h-10 w-10 cursor-pointer rounded-lg border border-gray-200 p-0.5 dark:border-spaire-700"
            value={
              ((watch('profile_settings') as Record<string, unknown>)
                ?.accent_color as string) ?? '#6366f1'
            }
            onChange={(e) => {
              const current =
                (watch('profile_settings') as Record<string, unknown>) ?? {}
              setValue(
                'profile_settings' as any,
                { ...current, accent_color: e.target.value },
                { shouldDirty: true },
              )
            }}
          />
          <span className="text-sm text-gray-500">
            Used for the banner gradient
          </span>
        </div>
      </div>

      <ErrorMessage
        errors={errors}
        name="prices"
        render={({ message }) => (
          <p className="text-destructive text-sm">{message}</p>
        )}
      />
    </>
  )
}

export const StorefrontSidebar = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const { handleSubmit, setError, formState, reset } =
    useFormContext<schemas['OrganizationUpdate']>()

  const updateOrganization = useUpdateOrganization()

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

  const storefrontEnabled =
    organization.profile_settings?.enabled ?? false
  const storefrontURL = `${CONFIG.FRONTEND_BASE_URL}/${organization.slug}`

  return (
    <StorefrontSidebarContentWrapper
      title="Spaire Space"
      enabled={storefrontEnabled}
      organization={organization}
    >
      <div className="flex flex-col gap-y-8">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-y-8"
        >
          <StorefrontForm organization={organization} />
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
        </form>
        <Separator />

        <div className="flex flex-col gap-y-4">
          <Label>Share your Spaire Space</Label>
          <CopyToClipboardInput
            value={storefrontURL}
            buttonLabel="Copy"
            className="bg-white"
            onCopy={() => {
              toast({
                title: 'Copied To Clipboard',
                description: `Spaire Space URL was copied to clipboard`,
              })
            }}
          />
        </div>
      </div>
    </StorefrontSidebarContentWrapper>
  )
}
