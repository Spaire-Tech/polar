'use client'

import { ProductCard } from '@/components/Products/ProductCard'
import { organizationPageLink } from '@/utils/nav'
import HiveOutlined from '@mui/icons-material/HiveOutlined'
import { schemas } from '@spaire/client'
import { ShadowBoxOnMd } from '@spaire/ui/components/atoms/ShadowBox'
import Link from 'next/link'

export const Storefront = ({
  organization,
  products,
  storefrontSettings,
}: {
  organization: schemas['CustomerOrganization']
  products: schemas['ProductStorefront'][]
  storefrontSettings?: schemas['OrganizationStorefrontSettings'] | null
}) => {
  const showDetails = storefrontSettings?.show_product_details ?? true
  const thumbnailSize = storefrontSettings?.thumbnail_size ?? 'medium'

  if (products.length === 0) {
    return (
      <ShadowBoxOnMd className="items-center justify-center gap-y-6 md:flex md:flex-col md:py-48">
        <HiveOutlined
          className="dark:text-polar-600 text-5xl text-gray-300"
          fontSize="large"
        />
        <div className="flex flex-col items-center gap-y-6">
          <div className="flex flex-col items-center gap-y-2">
            <h3 className="text-lg font-medium">No products found</h3>
            <p className="dark:text-polar-500 text-gray-500">
              {organization.name} is not offering any products yet
            </p>
          </div>
        </div>
      </ShadowBoxOnMd>
    )
  }

  return (
    <div className="grid w-full grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <Link
          key={product.id}
          href={organizationPageLink(
            organization,
            `products/${product.id}`,
          )}
        >
          <ProductCard
            product={product}
            showDetails={showDetails}
            thumbnailSize={thumbnailSize}
          />
        </Link>
      ))}
    </div>
  )
}
