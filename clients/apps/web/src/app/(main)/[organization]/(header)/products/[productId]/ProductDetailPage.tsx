'use client'

import { DETAIL_OPTION_MAP, DETAIL_KEYS } from '@/components/Products/ProductForm/ProductAdditionalDetailsSection'
import { hasLegacyRecurringPrices } from '@/utils/product'
import LegacyRecurringProductPrices from '@/components/Products/LegacyRecurringProductPrices'
import { CONFIG } from '@/utils/config'
import { api } from '@/utils/client'
import { schemas } from '@spaire/client'
import { formatCurrency } from '@spaire/currency'
import Link from 'next/link'
import { useCallback, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import LogoIcon from '@/components/Brand/LogoIcon'
import { ProductCard } from '@/components/Products/ProductCard'

// Renders "USD $59.00" / "EUR €59.00" etc.
function PriceDisplay({ product }: { product: schemas['ProductStorefront'] }) {
  const staticPrice = product.prices.find(({ amount_type }) =>
    ['fixed', 'custom', 'free', 'seat_based'].includes(amount_type),
  )

  if (!staticPrice) return null

  if (staticPrice.amount_type === 'fixed') {
    const code = staticPrice.price_currency.toUpperCase()
    const formatted = formatCurrency('accounting')(
      staticPrice.price_amount,
      staticPrice.price_currency,
    )
    return (
      <span>
        {code} {formatted}
      </span>
    )
  }

  if (staticPrice.amount_type === 'seat_based') {
    const tiers = staticPrice.seat_tiers.tiers
    if (tiers.length > 0) {
      const code = staticPrice.price_currency.toUpperCase()
      const formatted = formatCurrency('accounting')(
        tiers[0].price_per_seat,
        staticPrice.price_currency,
      )
      return (
        <span>
          {tiers.length > 1 && <span className="mr-1 text-[18px] text-gray-400">From</span>}
          {code} {formatted}
          <span className="ml-1 text-[18px] text-gray-400">/ seat</span>
        </span>
      )
    }
    return null
  }

  if (staticPrice.amount_type === 'custom') {
    return <span className="text-[22px]">Pay what you want</span>
  }

  return <span className="text-[22px]">Free</span>
}

const CATEGORY_LABELS: Record<string, string> = {
  ebook: 'eBook',
  template: 'Template',
  assets: 'Assets',
  course: 'Course',
  guide: 'Guide',
  music: 'Music',
  video: 'Video',
  photo: 'Photo',
  software: 'Software',
  coaching: 'Coaching',
  membership: 'Membership',
  other: 'Other',
}

// SVG icons for detail rows
function DetailIcon({ detailKey }: { detailKey: string }) {
  const cls = 'h-[18px] w-[18px] shrink-0 text-gray-500'
  switch (detailKey) {
    case 'pages':
    case 'chapters':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      )
    case 'format':
    case 'file_size':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
        </svg>
      )
    case 'language':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      )
    case 'level':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      )
    case 'duration':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      )
    case 'dimensions':
    case 'size':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
      )
    case 'words':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" />
        </svg>
      )
    case 'resolution':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      )
    case 'license':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M9 13h6M9 17h4M14 2v6h6" />
        </svg>
      )
    case 'compatible_with':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
        </svg>
      )
    case 'release_year':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      )
    case 'edition':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      )
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )
  }
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
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const category = product.category
  const categoryLabel = category ? (CATEGORY_LABELS[category] ?? category) : null

  // Extract "additional details" from metadata
  const details: { key: string; label: string; value: string }[] = product.metadata
    ? Object.entries(product.metadata)
        .filter(([k]) => DETAIL_KEYS.has(k))
        .map(([k, v]) => ({
          key: k,
          label: DETAIL_OPTION_MAP[k] ?? k,
          value: String(v),
        }))
    : []

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

  return (
    <div className="flex w-full flex-col gap-10">
      {/* Back link */}
      <Link
        href={`/${organization.slug}`}
        className="text-sm text-gray-400 transition-colors hover:text-gray-600"
      >
        &larr; Back to {organization.name}
      </Link>

      {/* Main product section — matches screenshot layout */}
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
        {/* Left — Media gallery */}
        <div className="w-full lg:flex-1">
          <MediaGallery medias={product.medias} productName={product.name} />
        </div>

        {/* Right — Product info */}
        <div className="flex w-full flex-col gap-5 lg:w-[420px] lg:shrink-0">
          {/* Breadcrumb: Space • Category */}
          <div className="flex items-center gap-2.5">
            <span className="rounded-full border border-gray-200 bg-white px-3.5 py-1 text-[13px] font-medium text-gray-700 shadow-sm">
              space
            </span>
            {categoryLabel && (
              <>
                <span className="text-[13px] text-gray-400">•</span>
                <span className="text-[13px] text-gray-500">{categoryLabel}</span>
              </>
            )}
          </div>

          {/* Title */}
          <h1 className="text-[36px] font-semibold leading-tight tracking-tight text-gray-900">
            {product.name}
          </h1>

          {/* Price — "USD $59.00" format */}
          <div className="text-[22px] font-normal text-gray-900">
            {hasLegacyRecurringPrices(product) ? (
              <LegacyRecurringProductPrices product={product} />
            ) : (
              <PriceDisplay product={product} />
            )}
          </div>

          {/* 1. Additional details — rows with icon, label, value */}
          {details.length > 0 && (
            <div className="flex flex-col">
              {details.map((detail, i) => (
                <div
                  key={detail.key}
                  className={twMerge(
                    'flex items-center gap-4 py-4',
                    i > 0 && 'border-t border-gray-100',
                  )}
                >
                  <DetailIcon detailKey={detail.key} />
                  <span className="w-28 shrink-0 text-[14px] font-semibold text-gray-800">
                    {detail.label}
                  </span>
                  <span className="text-[14px] text-gray-500">{detail.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* 2. Buy Now button */}
          <button
            type="button"
            onClick={handleBuy}
            disabled={checkoutLoading}
            className="mt-1 flex h-14 w-full items-center justify-center rounded-full bg-gray-900 text-[16px] font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
          >
            {checkoutLoading ? 'Loading...' : 'Buy Now'}
          </button>

          {/* 3. Overview: description + benefits */}
          {(product.description || product.benefits.length > 0) && (
            <div className="flex flex-col gap-4 border-t border-gray-100 pt-5">
              <h2 className="text-[15px] font-semibold text-gray-900">Overview</h2>

              {product.description && (
                <div className="flex flex-col gap-3">
                  {product.description.split(/\n\s*\n/).map((para, i) => (
                    <p key={i} className="whitespace-pre-wrap text-[15px] leading-relaxed text-gray-500">
                      {para.trim()}
                    </p>
                  ))}
                </div>
              )}

              {product.benefits.length > 0 && (
                <div className="flex flex-col gap-2 pt-1">
                  <h3 className="text-sm font-semibold text-gray-900">What&apos;s included</h3>
                  <ul className="flex flex-col gap-2">
                    {product.benefits.map((benefit) => (
                      <li key={benefit.id} className="flex items-start gap-2 text-sm text-gray-600">
                        <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        <span>{benefit.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

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
      <div className="relative overflow-hidden rounded-3xl bg-gray-50" style={{ aspectRatio: '4/3' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={active?.public_url}
          alt={active?.name ?? productName}
          className="absolute inset-0 h-full w-full object-cover"
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
              className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow transition-colors hover:bg-white"
              aria-label="Previous"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button
              type="button"
              onClick={() =>
                setActiveIdx((activeIdx + 1) % medias.length)
              }
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow transition-colors hover:bg-white"
              aria-label="Next"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {medias.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {medias.map((m, i) => (
            <button
              key={m.id ?? i}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={twMerge(
                'h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-gray-50 transition-all',
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

