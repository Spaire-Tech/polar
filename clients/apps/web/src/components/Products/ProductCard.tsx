'use client'

import { hasLegacyRecurringPrices } from '@/utils/product'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import LogoIcon from '../Brand/LogoIcon'
import LegacyRecurringProductPrices from './LegacyRecurringProductPrices'
import ProductPriceLabel from './ProductPriceLabel'

interface ProductCardProps {
  product: schemas['ProductStorefront']
  showDetails?: boolean
  thumbnailSize?: 'small' | 'medium' | 'large'
  accentColor?: string | null
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
  accentColor,
}: ProductCardProps) => {
  const aspectClass = thumbnailAspectClass[thumbnailSize]

  return (
    <div className="dark:border-polar-700 flex h-full w-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow hover:shadow-lg dark:bg-polar-800">
      {product.medias.length > 0 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={`dark:bg-polar-950 w-full bg-gray-100 object-cover ${aspectClass}`}
          alt={product.medias[0].name}
          width={600}
          height={600}
          src={product.medias[0].public_url}
        />
      ) : (
        <div
          className={`dark:bg-polar-900 flex w-full flex-col items-center justify-center bg-gray-50 ${aspectClass}`}
        >
          <LogoIcon className="dark:text-polar-600 h-12 w-12 text-gray-300" />
        </div>
      )}
      <div className="flex grow flex-col gap-y-3 p-5">
        <div className="flex flex-row items-start justify-between gap-x-2">
          <h3 className="line-clamp-1 text-base font-medium text-gray-900 dark:text-white">
            {product.name}
          </h3>
          <span className="shrink-0 text-sm font-medium text-gray-600 dark:text-polar-400">
            {hasLegacyRecurringPrices(product) ? (
              <LegacyRecurringProductPrices product={product} />
            ) : (
              <ProductPriceLabel product={product} />
            )}
          </span>
        </div>
        {showDetails && product.description && (
          <p className="dark:text-polar-400 line-clamp-2 text-sm text-gray-500">
            {product.description}
          </p>
        )}
        {showDetails && (
          <div className="mt-auto pt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              style={
                accentColor
                  ? {
                      borderColor: accentColor,
                      color: accentColor,
                    }
                  : undefined
              }
            >
              View Product
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
