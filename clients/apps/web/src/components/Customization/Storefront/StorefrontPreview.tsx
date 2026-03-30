'use client'

import { SpaireLogotype } from '@/components/Layout/Public/SpaireLogotype'
import TopbarRight from '@/components/Layout/Public/TopbarRight'
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
  const { currentUser } = useAuth()
  const organizationUpdate = watch()

  const organization = { ...org, ...organizationUpdate }
  const storefrontSettings = organizationUpdate.storefront_settings ?? org.storefront_settings

  const products =
    useProducts(organization.id, { is_archived: false }).data?.items ?? []

  return (
    <div className="flex h-full w-full flex-col items-center">
      {/* Browser Chrome */}
      <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-polar-700">
        {/* Browser toolbar */}
        <div className="flex flex-row items-center gap-x-3 border-b border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-polar-700 dark:bg-polar-900">
          <div className="flex flex-row gap-x-1.5">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-yellow-400" />
            <div className="h-3 w-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 rounded-md bg-white px-3 py-1 text-center text-xs text-gray-400 dark:bg-polar-800 dark:text-polar-500">
            {org.slug}.spaire.com
          </div>
        </div>

        {/* Preview content */}
        <ShadowBox className="dark:bg-polar-950 flex h-full w-full flex-col items-center overflow-y-auto border-0 bg-white shadow-none">
          <div className="flex w-full max-w-7xl flex-col gap-y-12 p-6">
            <div className="relative flex flex-row items-center justify-end gap-x-6">
              <SpaireLogotype
                className="absolute left-1/2 -translate-x-1/2"
                size={50}
              />
              <TopbarRight authenticatedUser={currentUser} />
            </div>
            <div className="flex grow flex-col items-center">
              <StorefrontHeader
                organization={organization as schemas['Organization']}
                storefrontSettings={storefrontSettings}
              />
            </div>
            <div className="flex h-full grow flex-col gap-y-8 pb-16 md:gap-y-16">
              <Storefront
                organization={organization as schemas['Organization']}
                products={products}
                storefrontSettings={storefrontSettings}
              />
            </div>
          </div>
        </ShadowBox>
      </div>
    </div>
  )
}
