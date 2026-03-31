'use client'

import {
  CustomizationProvider,
} from '@/components/Customization/CustomizationProvider'
import { toast } from '@/components/Toast/use-toast'
import { useUpdateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { isValidationError, schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import { Form } from '@spaire/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { StorefrontCustomization } from './Storefront/StorefrontCustomization'
import { StorefrontSidebar } from './Storefront/StorefrontSidebar'

export const CustomizationPage = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  return (
    <CustomizationProvider>
      <Customization organization={organization} />
    </CustomizationProvider>
  )
}

const Customization = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const router = useRouter()
  const updateOrganization = useUpdateOrganization()

  const form = useForm<schemas['OrganizationUpdate']>({
    defaultValues: {
      ...organization,
    },
  })

  const onPublish = useCallback(
    async (data: schemas['OrganizationUpdate']) => {
      const { data: org, error } = await updateOrganization.mutateAsync({
        id: organization.id,
        body: data,
      })
      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, form.setError)
        } else {
          toast({
            title: 'Publish Failed',
            description: `Error updating storefront: ${error.detail}`,
          })
        }
        return
      }

      toast({
        title: 'Changes Published',
        description: 'Your storefront has been updated.',
      })
      form.reset(org)
    },
    [organization, updateOrganization, form],
  )

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Top bar */}
      <div className="flex flex-row items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex flex-row items-center gap-x-3">
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 text-gray-600"
            onClick={() => router.push(`/dashboard/${organization.slug}`)}
            tabIndex={-1}
          >
            <CloseOutlined fontSize="small" />
          </Button>
          <h1 className="text-lg font-medium text-gray-900">Design Your Space</h1>
        </div>
        <Button
          className="rounded-full px-6"
          onClick={form.handleSubmit(onPublish)}
          loading={updateOrganization.isPending}
          disabled={!form.formState.isDirty || updateOrganization.isPending}
        >
          Publish Changes
        </Button>
      </div>

      {/* Content: sidebar + preview */}
      <Form {...form}>
        <div className="flex min-h-0 grow flex-row">
          <StorefrontSidebar organization={organization} />
          <div className="flex min-w-0 flex-1 p-6">
            <StorefrontCustomization organization={organization} />
          </div>
        </div>
      </Form>
    </div>
  )
}
