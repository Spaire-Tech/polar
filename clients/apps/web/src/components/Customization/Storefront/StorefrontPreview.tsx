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

  // Filter by featured product IDs if set
  const featuredIds = organization.storefront_settings?.featured_product_ids ?? []
  const products = featuredIds.length > 0
    ? allProducts.filter((p) => featuredIds.includes(p.id))
    : allProducts

  const showCardProducts = (storefrontSettings as any)?.show_card_products ?? true

  return (
    <ProfileCard organization={organization} products={showCardProducts ? products : []} />
  )
}

// Keep backward-compat export
export const StorefrontPreview = StorefrontLivePreview
