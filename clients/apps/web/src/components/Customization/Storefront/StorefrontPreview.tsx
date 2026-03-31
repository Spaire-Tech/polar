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

  const organization = { ...org, ...organizationUpdate } as schemas['Organization']

  const products =
    useProducts(organization.id, { is_archived: false }).data?.items ?? []

  return (
    <ProfileCard organization={organization} products={products} />
  )
}

// Keep backward-compat export
export const StorefrontPreview = StorefrontLivePreview
