'use client'

import { hasLegacyRecurringPrices } from '@/utils/product'
import { schemas } from '@spaire/client'
import { useCallback, useState } from 'react'
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
  const medias = product.medias
  const hasMultiple = medias.length > 1
  const [current, setCurrent] = useState(0)

  const goTo = useCallback(
    (idx: number) => {
      setCurrent(((idx % medias.length) + medias.length) % medias.length)
    },
    [medias.length],
  )

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Image with price overlay */}
      <div className="group relative">
        {medias.length > 0 ? (
          <div className="relative overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={twMerge(aspect, 'w-full object-cover')}
              alt={medias[current]?.name ?? product.name}
              width={600}
              height={450}
              src={medias[current]?.public_url}
            />
            {hasMultiple && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); goTo(current - 1) }}
                  className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-white/80 p-1 opacity-0 shadow transition-opacity group-hover:opacity-100"
                  aria-label="Previous image"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); goTo(current + 1) }}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-white/80 p-1 opacity-0 shadow transition-opacity group-hover:opacity-100"
                  aria-label="Next image"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                </button>
                <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                  {medias.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); goTo(i) }}
                      className={twMerge(
                        'h-1.5 rounded-full transition-all',
                        i === current ? 'w-3 bg-white' : 'w-1.5 bg-white/50',
                      )}
                      aria-label={`Go to image ${i + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
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
