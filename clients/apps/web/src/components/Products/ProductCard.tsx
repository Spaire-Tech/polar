'use client'

import { hasLegacyRecurringPrices } from '@/utils/product'
import { schemas } from '@spaire/client'
import LogoIcon from '../Brand/LogoIcon'
import LegacyRecurringProductPrices from './LegacyRecurringProductPrices'
import ProductPriceLabel from './ProductPriceLabel'

interface ProductCardProps {
  product: schemas['ProductStorefront']
  showDetails?: boolean
  thumbnailSize?: 'small' | 'medium' | 'large'
}

const thumbnailAspectClass = {
  small: 'aspect-[4/3]',
  medium: 'aspect-video',
  large: 'aspect-square',
}

export const ProductCard = ({
  product,
  showDetails = true,
  thumbnailSize = 'medium',
}: ProductCardProps) => {
  const aspectClass = thumbnailAspectClass[thumbnailSize]

  return (
    <div className="flex h-full w-full flex-col gap-y-3">
      {/* Thumbnail */}
      {product.medias.length > 0 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={`dark:bg-polar-900 w-full rounded-xl bg-gray-100 object-cover ${aspectClass}`}
          alt={product.medias[0].name}
          width={600}
          height={600}
          src={product.medias[0].public_url}
        />
      ) : (
        <div
          className={`dark:bg-polar-900 flex w-full flex-col items-center justify-center rounded-xl bg-gray-100 ${aspectClass}`}
        >
          <LogoIcon className="dark:text-polar-600 h-10 w-10 text-gray-300" />
        </div>
      )}

      {/* Name + Price row */}
      <div className="flex flex-row items-start justify-between gap-x-3">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          {product.name}
        </h3>
        <span className="dark:text-polar-400 shrink-0 text-sm text-gray-500">
          {hasLegacyRecurringPrices(product) ? (
            <LegacyRecurringProductPrices product={product} />
          ) : (
            <ProductPriceLabel product={product} />
          )}
        </span>
      </div>

      {/* Description */}
      {showDetails && product.description && (
        <p className="dark:text-polar-400 line-clamp-2 text-sm text-gray-500">
          {product.description}
        </p>
      )}

      {/* View Product button */}
      {showDetails && (
        <button className="dark:border-polar-600 dark:text-polar-300 mt-auto w-fit rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:hover:bg-polar-800">
          View Product
        </button>
      )}
    </div>
  )
}
