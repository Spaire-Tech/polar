'use client'

import { toast } from '@/components/Toast/use-toast'
import { useUpdateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import Close from '@mui/icons-material/Close'
import { isValidationError, schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import { Form } from '@spaire/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { StorefrontPreview } from './Storefront/StorefrontPreview'
import { StorefrontSidebar } from './Storefront/StorefrontSidebar'

export const CustomizationPage = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const router = useRouter()
  const updateOrganization = useUpdateOrganization()

  const form = useForm<schemas['OrganizationUpdate']>({
    defaultValues: {
      ...organization,
      storefront_settings: organization.storefront_settings ?? {
        enabled: false,
        show_header: true,
        header_image_url: null,
        show_logo: true,
        show_name: true,
        show_description: true,
        description: null,
        thumbnail_size: 'medium',
        show_product_details: true,
        accent_color: null,
      },
    },
  })

  const onPublish = useCallback(
    async (organizationUpdate: schemas['OrganizationUpdate']) => {
      const { data: org, error } = await updateOrganization.mutateAsync({
        id: organization.id,
        body: organizationUpdate,
      })
      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, form.setError)
        } else {
          toast({
            title: 'Publish Failed',
            description: `Error publishing changes: ${error.detail}`,
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
    [organization, form, updateOrganization],
  )

  return (
    <div className="dark:bg-polar-950 flex h-full flex-col bg-gray-100">
      {/* Top bar */}
      <div className="flex flex-row items-center justify-between px-6 py-4">
        <div className="flex flex-row items-center gap-x-4">
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 text-gray-500 hover:text-black dark:text-polar-400 dark:hover:text-white"
            onClick={() => {
              router.push(`/dashboard/${organization.slug}`)
            }}
            tabIndex={-1}
          >
            <Close fontSize="small" />
          </Button>
          <h1 className="text-lg font-semibold dark:text-white">Design</h1>
        </div>
        <Button
          className="rounded-full bg-blue-500 px-6 text-white hover:bg-blue-600"
          onClick={form.handleSubmit(onPublish)}
          loading={updateOrganization.isPending}
          disabled={!form.formState.isDirty || updateOrganization.isPending}
        >
          Publish Changes
        </Button>
      </div>

      {/* Content */}
      <Form {...form}>
        <div className="flex min-h-0 grow flex-row">
          <StorefrontSidebar organization={organization} />
          <div className="flex-1 p-4 pl-0">
            <StorefrontPreview organization={organization} />
          </div>
        </div>
      </Form>
    </div>
  )
}
