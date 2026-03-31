'use client'

import { useProducts } from '@/hooks/queries'
import { schemas } from '@spaire/client'
import { useFormContext } from 'react-hook-form'
import LogoIcon from '../../Brand/LogoIcon'
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
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-polar-700 dark:bg-polar-950">
      {/* Browser toolbar */}
      <div className="flex shrink-0 flex-row items-center gap-x-3 border-b border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-polar-700 dark:bg-polar-900">
        <div className="flex flex-row gap-x-1.5">
          <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <div className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <div className="h-3 w-3 rounded-full bg-[#28C840]" />
        </div>
        <div className="dark:bg-polar-800 dark:text-polar-500 flex-1 rounded-md bg-white px-3 py-1 text-center text-xs text-gray-400">
          {org.slug}.spaire.com
        </div>
      </div>

      {/* Preview content */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-y-8 px-8 py-8">
          {/* Header: banner, logo, name, description */}
          <StorefrontHeader
            organization={organization as schemas['Organization']}
            storefrontSettings={storefrontSettings}
          />

          {/* Product grid */}
          <div className="w-full">
            <Storefront
              organization={organization as schemas['Organization']}
              products={products}
              storefrontSettings={storefrontSettings}
            />
          </div>

          {/* Powered by Spaire footer */}
          <div className="flex flex-row items-center gap-x-2 pb-8 pt-8">
            <LogoIcon size={16} className="opacity-40" />
            <span className="dark:text-polar-600 text-xs text-gray-400">
              Powered by Spaire
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
