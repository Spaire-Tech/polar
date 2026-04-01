'use client'

import {
  CustomizationProvider,
} from '@/components/Customization/CustomizationProvider'
import { toast } from '@/components/Toast/use-toast'
import { useUpdateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import { Form } from '@spaire/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { StorefrontEditorForm } from './Storefront/StorefrontSidebar'
import { StorefrontLivePreview } from './Storefront/StorefrontPreview'

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
      <div className="flex flex-row items-center justify-between border-b border-gray-200 bg-white px-8 py-4">
        <button
          type="button"
          onClick={() => router.push(`/dashboard/${organization.slug}`)}
          className="text-[14px] text-gray-500 transition-colors hover:text-gray-700"
        >
          &larr; Back to dashboard
        </button>
        <Button
          className="rounded-full px-6"
          onClick={form.handleSubmit(onPublish)}
          loading={updateOrganization.isPending}
          disabled={!form.formState.isDirty || updateOrganization.isPending}
        >
          Publish Changes
        </Button>
      </div>

      {/* Two-column: preview left, form right */}
      <Form {...form}>
        <div className="flex min-h-0 grow flex-row overflow-hidden">
          {/* Left — heading + live card preview */}
          <div className="flex flex-1 flex-col overflow-y-auto p-10">
            <h1 className="text-[28px] font-bold text-gray-950">
              Let&apos;s Create your Space Card
            </h1>
            <p className="mt-1 text-[15px] text-gray-500">
              Introduce yourself and design your personal Space ID card.
            </p>

            <div className="mt-8 max-w-[460px]">
              <StorefrontLivePreview organization={organization} />
            </div>
          </div>

          {/* Right — form sections (wider, matching checkout link style) */}
          <div className="w-[700px] shrink-0 overflow-y-auto border-l border-gray-200 bg-white shadow-sm">
            <StorefrontEditorForm organization={organization} />
          </div>
        </div>
      </Form>
    </div>
  )
}
