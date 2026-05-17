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
import { useSpaireSubscription } from '@/hooks/queries/spaireTier'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { api } from '@/utils/client'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import { Form } from '@spaire/ui/components/ui/form'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'

type SocialLink = schemas['OrganizationSocialLink']

export default function ReviewPage() {
  const { organization } = useContext(OrganizationContext)
  const router = useRouter()
  const searchParams = useSearchParams()
  const updateOrganization = useUpdateOrganization()
  const [publishing, setPublishing] = useState(false)

  // When Polar redirects back here with ?upgraded=1, verify the
  // checkout actually completed. Until §1d, this page trusted the
  // query param blindly — a creator who started checkout, closed the
  // tab, and browser-back'd here could publish without ever paying.
  // The platform-subscription endpoint exposes `is_default_trial`,
  // which stays True as long as the active sub is the auto-created
  // trial from organization.created. Flip the flag and we know
  // Stripe minted a new subscription on the chosen tier.
  const cameFromCheckout = searchParams.get('upgraded') === '1'
  const subscriptionQuery = useSpaireSubscription(organization.id)
  const checkoutCompleted = cameFromCheckout
    ? subscriptionQuery.data
      ? !subscriptionQuery.data.is_default_trial
      : null
    : true
  const subscriptionWarnedRef = useRef(false)
  useEffect(() => {
    if (
      cameFromCheckout &&
      subscriptionQuery.data &&
      subscriptionQuery.data.is_default_trial &&
      !subscriptionWarnedRef.current
    ) {
      subscriptionWarnedRef.current = true
      toast({
        title: 'Finish picking your plan',
        description:
          "Looks like the Spaire checkout didn't finish — pick a plan to keep going.",
      })
      router.push(`/dashboard/${organization.slug}/onboarding/plan`)
    }
  }, [cameFromCheckout, subscriptionQuery.data, router, organization.slug])

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
    // If we landed here from a checkout return URL, hold the publish
    // until the subscription verification has finished. Block entirely
    // when verification proves the checkout never completed — the
    // ?upgraded=1 query param is not enough proof.
    if (cameFromCheckout) {
      if (checkoutCompleted === null) {
        toast({
          title: 'One moment',
          description: 'Verifying your subscription…',
        })
        return
      }
      if (checkoutCompleted === false) {
        toast({
          title: 'Plan not picked yet',
          description:
            'Pick a Spaire plan before publishing your Space Card.',
        })
        router.push(`/dashboard/${organization.slug}/onboarding/plan`)
        return
      }
    }
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

      // Stamp ai_onboarding_completed_at so the dashboard plan-gate
      // releases. Idempotent server-side — the endpoint no-ops if the
      // flag is already set (e.g. user already finished the assistant
      // path). Failures here are non-fatal: the publish succeeded, and
      // the assistant flow can still set the flag later.
      await api
        .POST('/v1/organizations/{id}/ai-onboarding-complete', {
          params: { path: { id: organization.id } },
        })
        .catch(() => undefined)

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
  }, [
    form,
    organization,
    updateOrganization,
    publishing,
    router,
    cameFromCheckout,
    checkoutCompleted,
  ])

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
