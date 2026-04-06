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
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ForceLightMode } from '@/components/Profile/ForceLightMode'
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
  const [publishing, setPublishing] = useState(false)

  const form = useForm<schemas['OrganizationUpdate']>({
    defaultValues: {
      name: organization.name,
      avatar_url: organization.avatar_url,
      socials: organization.socials,
      storefront_settings: organization.storefront_settings,
    },
  })

  const handlePublish = useCallback(async () => {
    if (publishing) return
    setPublishing(true)

    try {
      const values = form.getValues()

      // Filter out social links with empty URLs before sending
      const cleanSocials = (values.socials ?? [])
        .filter((s: { url?: string }) => s?.url?.trim())

      const body: schemas['OrganizationUpdate'] = {
        name: values.name ?? organization.name,
        avatar_url: values.avatar_url,
        socials: cleanSocials.length > 0 ? cleanSocials : [],
        storefront_settings: values.storefront_settings,
      }

      const { data: org, error } = await updateOrganization.mutateAsync({
        id: organization.id,
        body,
      })

      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, form.setError)
        } else {
          toast({
            title: 'Publish Failed',
            description: `Error: ${typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail)}`,
          })
        }
        return
      }

      toast({
        title: 'Changes Published',
        description: 'Your storefront has been updated.',
      })

      form.reset({
        name: org.name,
        avatar_url: org.avatar_url,
        socials: org.socials,
        storefront_settings: org.storefront_settings,
      })
    } catch (err) {
      toast({
        title: 'Publish Failed',
        description: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      setPublishing(false)
    }
  }, [form, organization, updateOrganization, publishing])

  return (
    <Form {...form}>
      <ForceLightMode />
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
            type="button"
            onClick={handlePublish}
            loading={publishing}
          >
            Publish Changes
          </Button>
        </div>

        {/* Two-column: preview left, form right */}
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

          {/* Right — form sections */}
          <div className="w-[700px] shrink-0 overflow-y-auto border-l border-gray-200 bg-white shadow-sm">
            <StorefrontEditorForm organization={organization} />
          </div>
        </div>
      </div>
    </Form>
  )
}
