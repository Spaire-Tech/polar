'use client'

import { ProductCard } from '@/components/Products/ProductCard'
import { CONFIG } from '@/utils/config'
import HiveOutlined from '@mui/icons-material/HiveOutlined'
import { schemas } from '@spaire/client'
import { useCallback, useMemo, useState } from 'react'
import { api } from '@/utils/client'

export const Storefront = ({
  organization,
  products,
}: {
  organization: schemas['Organization'] | schemas['CustomerOrganization']
  products: schemas['ProductStorefront'][]
}) => {
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

  // Create checkout and redirect to full checkout page (light theme)
  const handleProductClick = useCallback(async (productId: string) => {
    if (loadingProductId) return
    setLoadingProductId(productId)
    try {
      const { data: checkout } = await api.POST('/v1/checkouts/client/', {
        body: { product_id: productId },
      })
      if (checkout?.client_secret) {
        window.location.href = `${CONFIG.FRONTEND_BASE_URL}/checkout/${checkout.client_secret}?theme=light`
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
    <div className="flex w-full flex-col">
      {/* Product grid — 2 columns */}
      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
        {displayProducts.map((product) => (
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
