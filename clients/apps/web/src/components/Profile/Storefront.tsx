'use client'

import { ProductCard } from '@/components/Products/ProductCard'
import { organizationPageLink } from '@/utils/nav'
import HiveOutlined from '@mui/icons-material/HiveOutlined'
import { schemas } from '@spaire/client'
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
  const thumbnailSize = storefrontSettings?.thumbnail_size ?? 'medium'

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <HiveOutlined
          className="dark:text-polar-600 text-5xl text-gray-300"
          fontSize="large"
        />
        <h3 className="mt-4 text-lg font-medium dark:text-white">
          No products found
        </h3>
        <p className="dark:text-polar-500 mt-1 text-gray-500">
          {organization.name} is not offering any products yet
        </p>
      </div>
    )
  }

  return (
    <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
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
            thumbnailSize={thumbnailSize}
          />
        </Link>
      ))}
    </div>
  )
}
