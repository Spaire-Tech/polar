'use client'

import { ProductCard } from '@/components/Products/ProductCard'
import HiveOutlined from '@mui/icons-material/HiveOutlined'
import { schemas } from '@spaire/client'
import Link from 'next/link'
import { useMemo } from 'react'

export const Storefront = ({
  organization,
  products,
}: {
  organization: schemas['Organization'] | schemas['CustomerOrganization']
  products: schemas['ProductStorefront'][]
}) => {
  const showDetails =
    'storefront_settings' in organization
      ? (organization.storefront_settings?.show_product_details ?? true)
      : true

  const thumbnailSize =
    'storefront_settings' in organization
      ? ((organization.storefront_settings?.thumbnail_size as 'small' | 'medium' | 'large') ?? 'medium')
      : 'medium'

  const featuredIds =
    'storefront_settings' in organization
      ? (organization.storefront_settings?.featured_product_ids ?? [])
      : []

  const displayProducts = useMemo(() => {
    if (featuredIds.length > 0) {
      return products.filter((p) => featuredIds.includes(p.id))
    }
    return products
  }, [products, featuredIds])

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <HiveOutlined
          className="text-5xl text-gray-300"
          fontSize="large"
        />
        <div className="mt-6 flex flex-col items-center gap-y-2">
          <h3 className="text-lg font-medium text-gray-900">No products yet</h3>
          <p className="text-gray-500">
            {organization.name} is not offering any products yet
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 md:hidden">Products</h2>
      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
        {displayProducts.map((product) => (
          <Link
            key={product.id}
            href={`/${organization.slug}/products/${product.id}`}
          >
            <ProductCard
              product={product}
              showDetails={showDetails}
              thumbnailSize={thumbnailSize}
            />
          </Link>
        ))}
      </div>
    </div>
  )
}
