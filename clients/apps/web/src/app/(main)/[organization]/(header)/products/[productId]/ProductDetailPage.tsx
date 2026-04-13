'use client'

import { ProductCard } from '@/components/Products/ProductCard'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import { hasLegacyRecurringPrices } from '@/utils/product'
import LegacyRecurringProductPrices from '@/components/Products/LegacyRecurringProductPrices'
import { CONFIG } from '@/utils/config'
import { getServerURL } from '@/utils/api'
import { api } from '@/utils/client'
import { schemas } from '@spaire/client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import LogoIcon from '@/components/Brand/LogoIcon'

interface ReviewData {
  id: string
  rating: number
  title: string | null
  text: string | null
  customer_name: string
  created_at: string
}

interface ReviewStats {
  average_rating: number
  total_reviews: number
}

export const ProductDetailPage = ({
  organization,
  product,
  otherProducts,
}: {
  organization: schemas['Organization']
  product: schemas['ProductStorefront']
  otherProducts: schemas['ProductStorefront'][]
}) => {
  const reviewsEnabled =
    'storefront_settings' in organization &&
    (organization.storefront_settings as any)?.enable_reviews === true
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const handleBuy = useCallback(async () => {
    if (checkoutLoading) return
    setCheckoutLoading(true)
    try {
      const { data: checkout } = await api.POST('/v1/checkouts/client/', {
        body: { product_id: product.id },
      })
      if (checkout?.client_secret) {
        window.location.href = `${CONFIG.FRONTEND_BASE_URL}/checkout/${checkout.client_secret}?theme=light`
      }
    } catch {
      // fallback
    } finally {
      setCheckoutLoading(false)
    }
  }, [checkoutLoading, product.id])

  const handleOtherProductClick = useCallback(
    async (productId: string) => {
      try {
        const { data: checkout } = await api.POST('/v1/checkouts/client/', {
          body: { product_id: productId },
        })
        if (checkout?.client_secret) {
          window.location.href = `${CONFIG.FRONTEND_BASE_URL}/checkout/${checkout.client_secret}?theme=light`
        }
      } catch {
        // fallback
      }
    },
    [],
  )

  return (
    <div className="flex w-full flex-col gap-10">
      {/* Back link */}
      <Link
        href={`/${organization.slug}`}
        className="text-sm text-gray-500 transition-colors hover:text-gray-700"
      >
        &larr; Back to {organization.name}
      </Link>

      {/* Main product section */}
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        {/* Left — Media gallery (large) */}
        <div className="w-full lg:flex-1">
          <MediaGallery medias={product.medias} productName={product.name} />
        </div>

        {/* Right — Product info */}
        <div className="flex w-full flex-col gap-5 lg:w-[380px] lg:shrink-0">
          <div className="flex flex-col gap-1">
            <h1 className="text-4xl font-normal leading-tight text-gray-900">
              {product.name}
            </h1>
            {organization.name && (
              <div className="text-[15px] text-gray-500">
                by {organization.name}
              </div>
            )}
          </div>

          <div className="text-3xl font-normal text-gray-900">
            {hasLegacyRecurringPrices(product) ? (
              <LegacyRecurringProductPrices product={product} />
            ) : (
              <ProductPriceLabel product={product} />
            )}
          </div>

          {/* Buy button */}
          <button
            type="button"
            onClick={handleBuy}
            disabled={checkoutLoading}
            className="flex h-12 w-full items-center justify-center rounded-full bg-gray-900 text-[15px] font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            {checkoutLoading ? 'Loading...' : 'Buy'}
          </button>

          {product.description && (
            <div className="text-[15px] leading-relaxed whitespace-pre-wrap text-gray-600">
              {product.description}
            </div>
          )}

          {/* Benefits */}
          {product.benefits.length > 0 && (
            <div className="flex flex-col gap-3 pt-2">
              <h3 className="text-sm font-semibold text-gray-900">
                What&apos;s included
              </h3>
              <ul className="flex flex-col gap-2">
                {product.benefits.map((benefit) => (
                  <li
                    key={benefit.id}
                    className="flex items-start gap-2 text-sm text-gray-600"
                  >
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{benefit.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Reviews */}
      {reviewsEnabled && (
        <ReviewsSection productId={product.id} />
      )}

      {/* More from org */}
      {otherProducts.length > 0 && (
        <div className="flex flex-col gap-6 border-t border-gray-100 pt-10">
          <h2 className="text-lg font-semibold text-gray-900">
            More from {organization.name}
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {otherProducts.slice(0, 6).map((p) => (
              <Link key={p.id} href={`/${organization.slug}/products/${p.id}`}>
                <ProductCard product={p} thumbnailSize="medium" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Media Gallery ──

function MediaGallery({
  medias,
  productName,
}: {
  medias: schemas['ProductStorefront']['medias']
  productName: string
}) {
  const [activeIdx, setActiveIdx] = useState(0)

  if (medias.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-3xl bg-gray-50">
        <LogoIcon className="h-16 w-16 text-gray-200" />
      </div>
    )
  }

  const active = medias[activeIdx]

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-gray-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={active?.public_url}
          alt={active?.name ?? productName}
          className="h-full w-full object-contain"
        />
        {medias.length > 1 && (
          <>
            <button
              type="button"
              onClick={() =>
                setActiveIdx(
                  (activeIdx - 1 + medias.length) % medias.length,
                )
              }
              className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow transition-opacity hover:bg-white"
              aria-label="Previous"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button
              type="button"
              onClick={() =>
                setActiveIdx((activeIdx + 1) % medias.length)
              }
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow transition-opacity hover:bg-white"
              aria-label="Next"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {medias.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {medias.map((m, i) => (
            <button
              key={m.id ?? i}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={twMerge(
                'h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all',
                i === activeIdx
                  ? 'border-gray-900'
                  : 'border-transparent opacity-60 hover:opacity-100',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.public_url}
                alt={m.name ?? `Image ${i + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Reviews Section ──

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          width={size}
          height={size}
          viewBox="0 0 20 20"
          fill={star <= rating ? '#f59e0b' : '#e5e7eb'}
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

function ReviewsSection({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<ReviewData[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await fetch(
          `${getServerURL()}/v1/product-reviews/product/${productId}`,
          { credentials: 'include' },
        )
        if (res.ok) {
          const data = await res.json()
          setReviews(data.reviews ?? [])
          setStats(data.stats ?? null)
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchReviews()
  }, [productId])

  if (loading) {
    return (
      <div className="border-t border-gray-100 pt-10">
        <div className="h-8 w-32 animate-pulse rounded bg-gray-100" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 border-t border-gray-100 pt-10">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-gray-900">Reviews</h2>
        {stats && stats.total_reviews > 0 && (
          <div className="flex items-center gap-2">
            <StarRating rating={Math.round(stats.average_rating)} />
            <span className="text-sm text-gray-500">
              {stats.average_rating} ({stats.total_reviews} review{stats.total_reviews !== 1 ? 's' : ''})
            </span>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-gray-400">No reviews yet. Be the first to leave one!</p>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50 p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                    {review.customer_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {review.customer_name}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(review.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <StarRating rating={review.rating} size={14} />
              {review.title && (
                <h4 className="text-sm font-medium text-gray-900">
                  {review.title}
                </h4>
              )}
              {review.text && (
                <p className="text-sm leading-relaxed text-gray-600">
                  {review.text}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
