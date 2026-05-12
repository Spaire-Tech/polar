'use client'

import revalidate from '@/app/actions'
import { EditableProfileCard } from '@/components/Customization/InlineEdit/EditableProfileCard'
import { ForceLightMode } from '@/components/Profile/ForceLightMode'
import { toast } from '@/components/Toast/use-toast'
import { useProducts, useUpdateOrganization } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { schemas } from '@spaire/client'
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

  const { data: productsData } = useProducts(organization.id, {
    is_archived: false,
    limit: 100,
  })
  const products = (productsData?.items ?? []) as unknown as schemas['ProductStorefront'][]

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
        toast({
          title: 'Publish Failed',
          description: `Error: ${typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail)}`,
        })
        setPublishing(false)
        return
      }

      await revalidate(`organizations:${org.id}`)
      await revalidate(`organizations:${org.slug}`)
      await revalidate(`storefront:${org.slug}`)

      router.push(`/dashboard/${organization.slug}`)
    } catch (err) {
      toast({
        title: 'Publish Failed',
        description: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      })
      setPublishing(false)
    }
  }, [form, organization, updateOrganization, publishing, router])

  return (
    <Form {...form}>
      <ForceLightMode />
      <div className="spaire-editor flex h-full w-full flex-col bg-white">
        {/* Top bar — minimal: just the publish action. No settings tab. */}
        <div className="flex flex-row items-center justify-between border-b border-gray-200 bg-white px-8 py-4">
          <div className="text-[14px] font-medium text-gray-900">
            Create your Space Card
          </div>
          <Button
            className="rounded-full px-6"
            type="button"
            onClick={handlePublish}
            loading={publishing}
          >
            Publish my Space Card
          </Button>
        </div>

        {/* Centered card-only canvas */}
        <div className="flex min-h-0 flex-1 justify-center overflow-y-auto px-4 py-10">
          <div className="flex w-full max-w-[460px] flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-[28px] font-bold text-gray-950">
                Let&apos;s create your Space Card
              </h1>
              <p className="text-[15px] text-gray-500">
                Click anything on the card to edit it directly.
              </p>
            </div>
            <div className="canvas-card w-full">
              <EditableProfileCard
                organization={organization}
                products={products}
              />
            </div>
          </div>
        </div>
      </div>
    </Form>
  )
}
