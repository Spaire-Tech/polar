'use client'

import { ProductCard } from '@/components/Products/ProductCard'
import { organizationPageLink } from '@/utils/nav'
import HiveOutlined from '@mui/icons-material/HiveOutlined'
import { schemas } from '@spaire/client'
import Link from 'next/link'
import { useMemo, useState } from 'react'

type SortOption = 'last_added' | 'price_low' | 'price_high'

export const Storefront = ({
  organization,
  products,
}: {
  organization: schemas['Organization'] | schemas['CustomerOrganization']
  products: schemas['ProductStorefront'][]
}) => {
  const [sort, setSort] = useState<SortOption>('last_added')

  const showDetails =
    'storefront_settings' in organization
      ? (organization.storefront_settings?.show_product_details ?? true)
      : true

  const thumbnailSize =
    'storefront_settings' in organization
      ? ((organization.storefront_settings?.thumbnail_size as 'small' | 'medium' | 'large') ?? 'medium')
      : 'medium'

  const sortedProducts = useMemo(() => {
    const sorted = [...products]
    switch (sort) {
      case 'last_added':
        return sorted
      case 'price_low':
        return sorted.sort((a, b) => {
          const aPrice = a.prices[0] && 'price_amount' in a.prices[0] ? a.prices[0].price_amount : 0
          const bPrice = b.prices[0] && 'price_amount' in b.prices[0] ? b.prices[0].price_amount : 0
          return aPrice - bPrice
        })
      case 'price_high':
        return sorted.sort((a, b) => {
          const aPrice = a.prices[0] && 'price_amount' in a.prices[0] ? a.prices[0].price_amount : 0
          const bPrice = b.prices[0] && 'price_amount' in b.prices[0] ? b.prices[0].price_amount : 0
          return bPrice - aPrice
        })
      default:
        return sorted
    }
  }, [products, sort])

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
    <div className="flex w-full flex-col gap-y-6">
      {/* Sort dropdown */}
      <div className="flex justify-end">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700"
        >
          <option value="last_added">Last added</option>
          <option value="price_low">Price: Low to High</option>
          <option value="price_high">Price: High to Low</option>
        </select>
      </div>

      {/* Product grid */}
      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
        {sortedProducts.map((product) => (
          <Link
            key={product.id}
            href={organizationPageLink(organization, `products/${product.id}`)}
          >
            <ProductCard product={product} showDetails={showDetails} thumbnailSize={thumbnailSize} />
          </Link>
        ))}
      </div>
    </div>
  )
}
