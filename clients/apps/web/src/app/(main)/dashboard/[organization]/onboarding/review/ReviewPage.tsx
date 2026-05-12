'use client'

import revalidate from '@/app/actions'
import { EditableProfileCard } from '@/components/Customization/InlineEdit/EditableProfileCard'
import { ForceLightMode } from '@/components/Profile/ForceLightMode'
import {
  isValidSocialUrl,
  normalizeSocialUrl,
} from '@/components/Customization/Storefront/StorefrontSidebar/utils'
import { toast } from '@/components/Toast/use-toast'
import { useProducts, useUpdateOrganization } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import { Form } from '@spaire/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useCallback, useContext, useState } from 'react'
import { useForm } from 'react-hook-form'

type SocialLink = schemas['OrganizationSocialLink']

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

      const cleanSocials: SocialLink[] = ((values.socials ?? []) as SocialLink[])
        .map((s) => ({
          ...s,
          url: normalizeSocialUrl(s?.url ?? ''),
        }))
        .filter((s) => s.url && s.platform && isValidSocialUrl(s.url))

      const body: schemas['OrganizationUpdate'] = {
        name: values.name ?? organization.name,
        socials: cleanSocials,
        storefront_settings: {
          ...values.storefront_settings,
          enabled: true,
        },
      }

      const avatar = values.avatar_url
      if (typeof avatar === 'string' && avatar.length > 0) {
        body.avatar_url = avatar
      } else if (avatar === null) {
        body.avatar_url = null
      }

      const { data: org, error } = await updateOrganization.mutateAsync({
        id: organization.id,
        body,
      })

      if (error) {
        const detail = error.detail
        const description =
          typeof detail === 'string'
            ? detail
            : Array.isArray(detail)
              ? detail
                  .map((d) => {
                    const loc = Array.isArray(d.loc)
                      ? d.loc.slice(1).join('.')
                      : ''
                    return loc ? `${loc}: ${d.msg}` : d.msg
                  })
                  .join('; ')
              : 'Unknown error. Please try again.'
        toast({
          title: 'Publish Failed',
          description,
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
      <div className="spaire-editor flex h-full min-h-0 w-full flex-col bg-white">
        {/* Top bar — minimal: just the publish action. No settings tab. */}
        <div className="flex shrink-0 flex-row items-center justify-between border-b border-gray-200 bg-white px-8 py-4">
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

        {/* Centered card-only canvas — scrolls vertically when the
            card grows taller than the viewport. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[460px] flex-col items-stretch gap-6 px-4 py-10">
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
