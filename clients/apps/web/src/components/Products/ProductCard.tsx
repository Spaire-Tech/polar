'use client'

import { hasLegacyRecurringPrices } from '@/utils/product'
import { schemas } from '@spaire/client'
import LogoIcon from '../Brand/LogoIcon'
import LegacyRecurringProductPrices from './LegacyRecurringProductPrices'
import ProductPriceLabel from './ProductPriceLabel'

interface ProductCardProps {
  product: schemas['ProductStorefront']
}

export const ProductCard = ({ product }: ProductCardProps) => {
  return (
    <div className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-spaire-800 dark:bg-spaire-900">
      {/* Product image */}
      {product.medias.length > 0 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="aspect-square w-full object-cover"
          alt={product.medias[0].name}
          width={600}
          height={600}
          src={product.medias[0].public_url}
        />
      ) : (
        <div className="flex aspect-square w-full flex-col items-center justify-center bg-gray-50 dark:bg-spaire-800">
          <LogoIcon className="h-16 w-16 text-gray-200 dark:text-spaire-700" />
        </div>
      )}

      {/* Product info */}
      <div className="flex flex-col items-center gap-y-1 px-4 py-5 text-center">
        <h3 className="line-clamp-2 text-base font-medium leading-snug text-gray-900 dark:text-white">
          {product.name}
        </h3>
        <span className="text-sm text-gray-500 dark:text-spaire-500">
          {hasLegacyRecurringPrices(product) ? (
            <LegacyRecurringProductPrices product={product} />
          ) : (
            <ProductPriceLabel product={product} />
          )}
        </span>
      </div>
    </div>
  )
}
