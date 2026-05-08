'use client'

import { useProducts } from '@/hooks/queries'
import { schemas } from '@spaire/client'
import { useFormContext } from 'react-hook-form'
import { ProfileCard } from '../../Profile/ProfileCard'

export const StorefrontLivePreview = ({
  organization: org,
}: {
  organization: schemas['Organization']
}) => {
  const { watch } = useFormContext<schemas['OrganizationUpdate']>()
  const organizationUpdate = watch()
  const storefrontSettings = watch('storefront_settings')

  const organization = {
    ...org,
    ...organizationUpdate,
    storefront_settings: storefrontSettings ?? org.storefront_settings,
  } as schemas['Organization']

  const allProducts =
    useProducts(organization.id, { is_archived: false }).data?.items ?? []

  // Honor featured_mode: 'all' shows every product, 'curated' shows only
  // the IDs the user has explicitly selected.
  const featuredMode = organization.storefront_settings?.featured_mode ?? 'all'
  const featuredIds =
    organization.storefront_settings?.featured_product_ids ?? []
  const products =
    featuredMode === 'curated'
      ? allProducts.filter((p) => featuredIds.includes(p.id))
      : allProducts

  return <ProfileCard organization={organization} products={products} preview />
}
