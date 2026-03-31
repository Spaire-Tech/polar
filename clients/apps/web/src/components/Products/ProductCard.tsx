'use client'

import { hasLegacyRecurringPrices } from '@/utils/product'
import { schemas } from '@spaire/client'
import { twMerge } from 'tailwind-merge'
import LogoIcon from '../Brand/LogoIcon'
import LegacyRecurringProductPrices from './LegacyRecurringProductPrices'
import ProductPriceLabel from './ProductPriceLabel'

type ThumbnailSize = 'small' | 'medium' | 'large'

interface ProductCardProps {
  product: schemas['ProductStorefront']
  showDetails?: boolean
  thumbnailSize?: ThumbnailSize
}

const thumbnailAspect: Record<ThumbnailSize, string> = {
  small: 'aspect-square',
  medium: 'aspect-[4/3]',
  large: 'aspect-video',
}

export const ProductCard = ({
  product,
  showDetails = true,
  thumbnailSize = 'medium',
}: ProductCardProps) => {
  const aspect = thumbnailAspect[thumbnailSize]

  return (
    <div className="dark:border-polar-700 dark:bg-polar-900 flex h-full w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md">
      {/* Image with price overlay */}
      <div className="relative">
        {product.medias.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={twMerge(aspect, 'w-full object-cover')}
            alt={product.medias[0].name}
            width={600}
            height={450}
            src={product.medias[0].public_url}
          />
        ) : (
          <div
            className={twMerge(
              aspect,
              'dark:bg-polar-800 flex w-full flex-col items-center justify-center bg-gray-100',
            )}
          >
            <LogoIcon className="dark:text-polar-600 h-12 w-12 text-gray-300" />
          </div>
        )}
        {/* Price badge */}
        <div className="absolute bottom-3 right-3 rounded-full bg-white px-3 py-1 text-sm font-medium text-gray-900 shadow-sm">
          {hasLegacyRecurringPrices(product) ? (
            <LegacyRecurringProductPrices product={product} />
          ) : (
            <ProductPriceLabel product={product} />
          )}
        </div>
      </div>

      {/* Details */}
      {showDetails && (
        <div className="flex flex-col gap-y-1 px-4 py-3">
          <h3 className="line-clamp-1 text-sm font-medium text-gray-950 dark:text-white">
            {product.name}
          </h3>
          <span className="dark:text-polar-500 text-xs text-gray-400">
            0 review
          </span>
        </div>
      )}
    </div>
  )
}
