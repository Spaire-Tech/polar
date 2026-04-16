'use client'

import { useProducts } from '@/hooks/queries'
import { ProfileCard } from '../../Profile/ProfileCard'
import { Storefront } from '../../Profile/Storefront'
import { schemas } from '@spaire/client'
import { useFormContext } from 'react-hook-form'

export const StorefrontLivePreview = ({
  organization: org,
}: {
  organization: schemas['Organization']
}) => {
  const { watch } = useFormContext<schemas['OrganizationUpdate']>()
  const organizationUpdate = watch()

  const organization = { ...org, ...organizationUpdate } as schemas['Organization']

  const allProducts =
    useProducts(organization.id, { is_archived: false }).data?.items ?? []

  // Filter by featured product IDs if set
  const featuredIds = organization.storefront_settings?.featured_product_ids ?? []
  const products = (featuredIds.length > 0
    ? allProducts.filter((p) => featuredIds.includes(p.id))
    : allProducts) as schemas['ProductStorefront'][]

  return (
    <div className="flex flex-col gap-6 p-4 md:flex-row md:gap-8 md:p-6">
      {/* Left — Profile card */}
      <div className="w-full shrink-0 md:w-[260px]">
        <ProfileCard organization={organization} products={products} />
      </div>

      {/* Right — Products storefront */}
      <div className="min-w-0 flex-1">
        <Storefront organization={organization} products={products} />
      </div>
    </div>
  )
}

// Keep backward-compat export
export const StorefrontPreview = StorefrontLivePreview
