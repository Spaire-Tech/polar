'use client'

import { hasLegacyRecurringPrices } from '@/utils/product'
import { schemas } from '@spaire/client'
import LogoIcon from '../Brand/LogoIcon'
import LegacyRecurringProductPrices from './LegacyRecurringProductPrices'
import ProductPriceLabel from './ProductPriceLabel'

interface ProductCardProps {
  product: schemas['ProductStorefront']
  thumbnailSize?: 'small' | 'medium' | 'large'
}

const thumbnailAspectClass = {
  small: 'aspect-[4/3]',
  medium: 'aspect-[4/3]',
  large: 'aspect-square',
}

export const ProductCard = ({
  product,
  thumbnailSize = 'medium',
}: ProductCardProps) => {
  const aspectClass = thumbnailAspectClass[thumbnailSize]

  return (
    <div className="dark:border-polar-700 dark:bg-polar-900 flex h-full w-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow hover:shadow-lg">
      {/* Image with price overlay */}
      <div className="relative">
        {product.medias.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={`dark:bg-polar-800 w-full bg-gray-100 object-cover ${aspectClass}`}
            alt={product.medias[0].name}
            width={600}
            height={600}
            src={product.medias[0].public_url}
          />
        ) : (
          <div
            className={`dark:bg-polar-800 flex w-full flex-col items-center justify-center bg-gray-50 ${aspectClass}`}
          >
            <LogoIcon className="dark:text-polar-600 h-12 w-12 text-gray-300" />
          </div>
        )}

        {/* Price badge overlay */}
        <div className="absolute right-3 bottom-3 rounded-lg bg-white px-2.5 py-1 text-sm font-medium text-gray-900 shadow-sm dark:bg-polar-800 dark:text-white">
          {hasLegacyRecurringPrices(product) ? (
            <LegacyRecurringProductPrices product={product} />
          ) : (
            <ProductPriceLabel product={product} />
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-col gap-y-1 p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          {product.name}
        </h3>
        <span className="dark:text-polar-500 text-xs text-gray-400">
          0 review
        </span>
      </div>
    </div>
  )
}
