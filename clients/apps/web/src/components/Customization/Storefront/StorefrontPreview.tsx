'use client'

import { useProducts } from '@/hooks/queries'
import { schemas } from '@spaire/client'
import { useFormContext } from 'react-hook-form'
import { ProfileCard } from '../../Profile/ProfileCard'
import { ProductCard } from '../../Products/ProductCard'
import { BrowserChrome } from '../BrowserChrome'

export const StorefrontPreview = ({
  organization: org,
}: {
  organization: schemas['Organization']
}) => {
  const { watch } = useFormContext<schemas['OrganizationUpdate']>()
  const organizationUpdate = watch()

  const organization = { ...org, ...organizationUpdate } as schemas['Organization']

  const products =
    useProducts(organization.id, { is_archived: false }).data?.items ?? []

  const showDetails =
    organization.storefront_settings?.show_product_details ?? true
  const thumbnailSize =
    (organization.storefront_settings?.thumbnail_size as 'small' | 'medium' | 'large') ?? 'medium'

  return (
    <BrowserChrome url={`space.spairehq.com/${organization.slug}`}>
      <div className="p-6">
        {/* Two-column layout preview */}
        <div className="flex flex-row gap-6">
          {/* Left — Profile card */}
          <div className="w-[260px] shrink-0">
            <ProfileCard organization={organization} />
          </div>

          {/* Right — Products */}
          <div className="flex min-w-0 flex-1 flex-col gap-y-4">
            {/* Nav preview */}
            <div className="flex flex-row gap-x-4 border-b border-gray-100 pb-2">
              <span className="relative pb-1 text-xs font-medium text-gray-950">
                Products
                <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-gray-950" />
              </span>
              <span className="text-xs text-gray-400">
                About
              </span>
            </div>

            {/* Product grid preview */}
            {products.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {products.slice(0, 4).map((product) => (
                  <div key={product.id} className="pointer-events-none">
                    <ProductCard
                      product={product}
                      showDetails={showDetails}
                      thumbnailSize={thumbnailSize}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <span className="text-xs text-gray-400">
                  No products yet
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </BrowserChrome>
  )
}
