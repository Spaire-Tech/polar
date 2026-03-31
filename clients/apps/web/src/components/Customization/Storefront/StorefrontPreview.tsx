'use client'

import { useProducts } from '@/hooks/queries'
import { schemas } from '@spaire/client'
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
  const storefrontSettings =
    organizationUpdate.storefront_settings ?? org.storefront_settings

  const products =
    useProducts(organization.id, { is_archived: false }).data?.items ?? []

  return (
    <div className="dark:border-polar-700 dark:bg-polar-950 flex h-full w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* Browser toolbar */}
      <div className="dark:border-polar-700 dark:bg-polar-900 flex shrink-0 flex-row items-center gap-x-3 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
        <div className="flex flex-row gap-x-1.5">
          <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <div className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <div className="h-3 w-3 rounded-full bg-[#28C840]" />
        </div>
        <div className="dark:bg-polar-800 dark:text-polar-500 flex-1 rounded-md bg-white px-3 py-1 text-center text-xs text-gray-400">
          {org.slug}.spaire.com
        </div>
      </div>

      {/* Preview content — two-column like the real storefront */}
      <div className="flex flex-1 overflow-y-auto">
        <div className="flex w-full gap-6 p-6">
          {/* Left: Profile card */}
          <div className="w-[280px] shrink-0">
            <StorefrontHeader
              organization={organization as schemas['Organization']}
              storefrontSettings={storefrontSettings}
            />
          </div>

          {/* Right: Products tab label + grid */}
          <div className="flex min-w-0 flex-1 flex-col gap-y-4">
            {/* Tab bar */}
            <div className="flex flex-row items-center justify-between">
              <div className="flex flex-row items-center gap-x-4">
                <span className="border-b-2 border-gray-900 pb-1.5 text-xs font-medium text-gray-900 dark:border-white dark:text-white">
                  Products
                </span>
                <span className="dark:text-polar-500 pb-1.5 text-xs text-gray-400">
                  About
                </span>
              </div>
              <span className="dark:border-polar-700 dark:text-polar-400 rounded-md border border-gray-200 px-2 py-1 text-[10px] text-gray-500">
                Last added
              </span>
            </div>

            {/* Product grid */}
            <Storefront
              organization={organization as schemas['Organization']}
              products={products}
              storefrontSettings={storefrontSettings}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
