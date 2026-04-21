'use client'

import revalidate from '@/app/actions'
import { StorefrontEditorForm } from '@/components/Customization/Storefront/StorefrontSidebar'
import { StorefrontLivePreview } from '@/components/Customization/Storefront/StorefrontPreview'
import { ForceLightMode } from '@/components/Profile/ForceLightMode'
import { toast } from '@/components/Toast/use-toast'
import { useUpdateOrganization } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { isValidationError, schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import { Form } from '@spaire/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useCallback, useContext, useState } from 'react'
import { useForm } from 'react-hook-form'

export default function ReviewPage() {
  const { organization } = useContext(OrganizationContext)
  const router = useRouter()
  const updateOrganization = useUpdateOrganization()
  const [publishing, setPublishing] = useState(false)

  const form = useForm<schemas['OrganizationUpdate']>({
    defaultValues: {
      name: organization.name,
      avatar_url: organization.avatar_url,
      socials: organization.socials,
      storefront_settings: {
        ...organization.storefront_settings,
        enabled: true,
      },
    },
  })

  const handlePublish = useCallback(async () => {
    if (publishing) return
    setPublishing(true)

    try {
      const values = form.getValues()

      const cleanSocials = (values.socials ?? []).filter(
        (s: { url?: string }) => s?.url?.trim(),
      )

      const body: schemas['OrganizationUpdate'] = {
        name: values.name ?? organization.name,
        avatar_url: values.avatar_url,
        socials: cleanSocials,
        storefront_settings: {
          ...values.storefront_settings,
          enabled: true,
        },
      }

      const { data: org, error } = await updateOrganization.mutateAsync({
        id: organization.id,
        body,
      })

      if (error) {
        if (isValidationError(error.detail)) {
          // setValidationErrors handled inline
        }
        toast({
          title: 'Publish Failed',
          description: `Error: ${typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail)}`,
        })
        return
      }

      await revalidate(`organizations:${org.id}`)
      await revalidate(`organizations:${org.slug}`)
      await revalidate(`storefront:${org.slug}`)

      router.push(`/dashboard/${organization.slug}/onboarding/product`)
    } catch (err) {
      toast({
        title: 'Publish Failed',
        description: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      setPublishing(false)
    }
  }, [form, organization, updateOrganization, publishing, router])

  return (
    <Form {...form}>
      <ForceLightMode />
      <div className="flex h-full w-full flex-col bg-gray-50">
        {/* Top bar — identical to dashboard Space Card editor */}
        <div className="flex flex-row items-center justify-between border-b border-gray-200 bg-white px-8 py-4">
          <button
            type="button"
            onClick={() =>
              router.push(
                `/dashboard/${organization.slug}/onboarding/skills`,
              )
            }
            className="text-[14px] text-gray-500 transition-colors hover:text-gray-700"
          >
            ← Back
          </button>
          <Button
            className="rounded-full px-6"
            type="button"
            onClick={handlePublish}
            loading={publishing}
          >
            Publish my Space Card
          </Button>
        </div>

        {/* Two-column layout: preview left, form right */}
        <div className="flex min-h-0 grow flex-row overflow-hidden">
          {/* Left — live card preview */}
          <div className="hidden flex-1 flex-col items-center justify-center overflow-y-auto p-10 md:flex">
            <div className="flex w-full max-w-[500px] flex-col items-center">
              <h1 className="text-center text-[28px] font-bold text-gray-950">
                Let&apos;s Create your Space Card
              </h1>
              <p className="mt-1 text-center text-[15px] text-gray-500">
                Introduce yourself and design your personal Space ID card.
              </p>
              <div className="mt-8 w-full max-w-[460px]">
                <StorefrontLivePreview organization={organization} />
              </div>
            </div>
          </div>

          {/* Right — the exact same form as the dashboard */}
          <div className="w-full shrink-0 overflow-y-auto border-l border-gray-200 bg-white shadow-sm md:w-[700px]">
            <StorefrontEditorForm organization={organization} />
          </div>
        </div>
      </div>
    </Form>
  )
}
