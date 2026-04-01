'use client'

import { ProductCard } from '@/components/Products/ProductCard'
import { CONFIG } from '@/utils/config'
import HiveOutlined from '@mui/icons-material/HiveOutlined'
import KeyboardArrowDownOutlined from '@mui/icons-material/KeyboardArrowDownOutlined'
import { schemas } from '@spaire/client'
import { useCallback, useMemo, useState } from 'react'
import { api } from '@/utils/client'

type SortOption = 'last_added' | 'price_low' | 'price_high'

const sortLabels: Record<SortOption, string> = {
  last_added: 'Last added',
  price_low: 'Price: Low to High',
  price_high: 'Price: High to Low',
}

export const Storefront = ({
  organization,
  products,
}: {
  organization: schemas['Organization'] | schemas['CustomerOrganization']
  products: schemas['ProductStorefront'][]
}) => {
  const [sort, setSort] = useState<SortOption>('last_added')
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null)

  const showDetails =
    'storefront_settings' in organization
      ? (organization.storefront_settings?.show_product_details ?? true)
      : true

  const thumbnailSize =
    'storefront_settings' in organization
      ? ((organization.storefront_settings?.thumbnail_size as 'small' | 'medium' | 'large') ?? 'medium')
      : 'medium'

  // Filter by featured product IDs if set
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

  const sortedProducts = useMemo(() => {
    const sorted = [...displayProducts]
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
  }, [displayProducts, sort])

  // Create checkout and redirect to full checkout page
  const handleProductClick = useCallback(async (productId: string) => {
    if (loadingProductId) return
    setLoadingProductId(productId)
    try {
      const { data: checkout } = await api.POST('/v1/checkouts/client/', {
        body: { product_id: productId },
      })
      if (checkout?.client_secret) {
        window.location.href = `${CONFIG.FRONTEND_BASE_URL}/checkout/${checkout.client_secret}`
      }
    } catch {
      // Fallback: navigate to product page
      window.location.href = `${CONFIG.FRONTEND_BASE_URL}/${organization.slug}/products/${productId}`
    } finally {
      setLoadingProductId(null)
    }
  }, [loadingProductId, organization.slug])

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
      {/* Sort dropdown — rounded pill */}
      <div className="flex justify-end">
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="appearance-none rounded-full border border-gray-200 bg-white py-2 pl-4 pr-9 text-[13px] font-medium text-gray-700 focus:border-gray-300 focus:outline-none"
          >
            <option value="last_added">{sortLabels.last_added}</option>
            <option value="price_low">{sortLabels.price_low}</option>
            <option value="price_high">{sortLabels.price_high}</option>
          </select>
          <KeyboardArrowDownOutlined
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
            style={{ fontSize: 18 }}
          />
        </div>
      </div>

      {/* Product grid — 2 columns */}
      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
        {sortedProducts.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => handleProductClick(product.id)}
            disabled={loadingProductId === product.id}
            className="text-left"
          >
            <ProductCard
              product={product}
              showDetails={showDetails}
              thumbnailSize={thumbnailSize}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
