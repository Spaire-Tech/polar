'use client'

import { useAuth } from '@/hooks'
import { useProducts } from '@/hooks/queries'
import { schemas } from '@spaire/client'
import ShadowBox from '@spaire/ui/components/atoms/ShadowBox'
import { useFormContext } from 'react-hook-form'
import { Storefront } from '../../Profile/Storefront'
import { StorefrontHeader } from '../../Profile/StorefrontHeader'

export const StorefrontPreview = ({
  organization: org,
}: {
  organization: schemas['Organization']
}) => {
  const { watch } = useFormContext<schemas['OrganizationUpdate']>()
  const organizationUpdate = watch()

  const organization = { ...org, ...organizationUpdate }

  const products =
    useProducts(organization.id, { is_archived: false }).data?.items ?? []

  return (
    <ShadowBox className="dark:bg-spaire-950 flex h-full w-full flex-col items-center overflow-y-auto bg-gray-50">
      <div className="flex w-full max-w-7xl flex-col gap-y-12 px-8 py-10">
        <StorefrontHeader
          organization={organization as schemas['Organization']}
        />
        <div className="flex h-full grow flex-col gap-y-8 pb-16 md:gap-y-16">
          <Storefront
            organization={organization as schemas['Organization']}
            products={products}
          />
        </div>
      </div>
    </ShadowBox>
  )
}
