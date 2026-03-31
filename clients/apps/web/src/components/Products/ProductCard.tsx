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
  small: 'aspect-video',
  medium: 'aspect-[4/3]',
  large: 'aspect-square',
}

export const ProductCard = ({
  product,
  showDetails = true,
  thumbnailSize = 'medium',
}: ProductCardProps) => {
  const aspect = thumbnailAspect[thumbnailSize]

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md">
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
              'flex w-full flex-col items-center justify-center bg-gray-50',
            )}
          >
            <LogoIcon className="h-12 w-12 text-gray-200" />
          </div>
        )}
        {/* Price badge — white pill, bottom-right */}
        <div className="absolute bottom-3 right-3 rounded-full bg-white px-3 py-1 text-[13px] font-medium text-gray-900 shadow">
          {hasLegacyRecurringPrices(product) ? (
            <LegacyRecurringProductPrices product={product} />
          ) : (
            <ProductPriceLabel product={product} />
          )}
        </div>
      </div>

      {/* Product name only — no reviews */}
      {showDetails && (
        <div className="px-4 py-3">
          <h3 className="line-clamp-1 text-[14px] font-medium text-gray-900">
            {product.name}
          </h3>
        </div>
      )}
    </div>
  )
}
