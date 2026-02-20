'use client'

import { hasLegacyRecurringPrices } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import LogoIcon from '../Brand/LogoIcon'
import LegacyRecurringProductPrices from './LegacyRecurringProductPrices'
import ProductPriceLabel from './ProductPriceLabel'

interface ProductCardProps {
  product: schemas['ProductStorefront']
}

export const ProductCard = ({ product }: ProductCardProps) => {
  return (
    <div className="flex h-full w-full flex-col gap-4 transition-opacity hover:opacity-50">
      {product.medias.length > 0 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="aspect-video w-full rounded-2xl bg-white/[0.04] object-cover"
          alt={product.medias[0].name}
          width={600}
          height={600}
          src={product.medias[0].public_url}
        />
      ) : (
        <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl bg-white/[0.06]">
          <div className="flex flex-col items-center justify-center text-4xl text-white">
            <LogoIcon className="h-12 w-12 text-polar-600" />
          </div>
        </div>
      )}
      <div className="flex grow flex-col gap-y-1 text-lg">
        <h3 className="line-clamp-1 flex items-center justify-between gap-1 leading-snug text-white">
          {product.name}
        </h3>
        <div className="flex flex-row items-center justify-between">
          <span className="flex flex-row items-center gap-x-2 text-base text-polar-500">
            <h3 className="leading-snug">
              {hasLegacyRecurringPrices(product) ? (
                <LegacyRecurringProductPrices product={product} />
              ) : (
                <ProductPriceLabel product={product} />
              )}
            </h3>
            {product.benefits.length > 0 && (
              <>
                ·
                <span>
                  {product.benefits.length === 1
                    ? `${product.benefits.length} Benefit`
                    : `${product.benefits.length} Benefits`}
                </span>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
