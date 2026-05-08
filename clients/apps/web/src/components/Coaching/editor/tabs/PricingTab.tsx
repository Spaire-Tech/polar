'use client'

// Pricing tab — read-only summary of the underlying product price.
// Edits route the merchant to the existing product editor where pricing
// + payment plans + discounts already work end-to-end. Building a second
// pricing editor in the coaching tab would just create two sources of
// truth for the same data.

import type { CourseRead } from '@/hooks/queries/courses'
import { useProduct } from '@/hooks/queries/products'
import { schemas } from '@spaire/client'
import { useParams } from 'next/navigation'
import { Ic } from '../icons'
import { Btn, SectionHead } from '../ui'

const SYMBOL: Record<string, string> = {
  usd: '$',
  eur: '€',
  gbp: '£',
  aud: 'A$',
  cad: 'C$',
}

function formatPrice(price: schemas['ProductPrice']): string {
  // Discriminated union over amount_type. We only render the most common
  // variants explicitly; everything else (metered / seat) gets a generic
  // label since this surface is read-only — full pricing edit lives on
  // the product editor.
  if (price.amount_type === 'free') return 'Free'
  if (price.amount_type === 'fixed') {
    const sym = SYMBOL[price.price_currency.toLowerCase()] ?? '$'
    return `${sym}${(price.price_amount / 100).toFixed(2)}`
  }
  if (price.amount_type === 'custom') return 'Pay what you want'
  return 'Custom pricing'
}

function recurringLabel(p: schemas['Product']): string {
  if (!p.recurring_interval) return 'One-time'
  const count = p.recurring_interval_count ?? 1
  return count === 1
    ? `Subscription · monthly`
    : `Subscription · every ${count} ${p.recurring_interval}s`
}

export function PricingTab({ course }: { course: CourseRead }) {
  const params = useParams<{ organization: string }>()
  const orgSlug = params.organization
  const { data: product, isLoading } = useProduct(course.product_id)

  return (
    <>
      <SectionHead
        title="Pricing"
        subtitle="How members buy. Spaire is your merchant of record — we handle tax, refunds, and payouts."
        actions={
          <Btn
            icon={<Ic.External size={14} />}
            onClick={() =>
              window.open(
                `/dashboard/${orgSlug}/products/${course.product_id}/edit#pricing`,
                '_blank',
              )
            }
          >
            Edit pricing
          </Btn>
        }
      />

      <div style={{ maxWidth: 720 }}>
        {isLoading || !product ? (
          <div
            style={{
              height: 220,
              background: 'var(--bg-muted)',
              borderRadius: 16,
            }}
          />
        ) : (
          <div className="ce-stack-16">
            <div className="ce-card ce-card-pad">
              <div className="ce-label">Current price</div>
              {(product.prices ?? []).length === 0 ? (
                <p style={{ color: 'var(--ink-3)', margin: '8px 0 0' }}>
                  No price set. Click <strong>Edit pricing</strong> to add one.
                </p>
              ) : (
                <div className="ce-stack-12" style={{ marginTop: 8 }}>
                  {(product.prices ?? []).map((price) => (
                    <div
                      key={price.id}
                      className="ce-row-between"
                      style={{
                        padding: '14px 16px',
                        background: 'var(--bg-muted)',
                        borderRadius: 'var(--r-sm)',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 22,
                            fontWeight: 500,
                            letterSpacing: '-0.02em',
                            color: 'var(--ink)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatPrice(price)}
                        </div>
                        <div className="ce-mini" style={{ marginTop: 4 }}>
                          {recurringLabel(product)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className="ce-card ce-card-pad"
              style={{ background: 'var(--bg-muted)' }}
            >
              <div
                className="ce-row"
                style={{ gap: 12, alignItems: 'flex-start' }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--r-sm)',
                    background: 'var(--ink)',
                    color: 'white',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Ic.Lock size={14} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13.5 }}>
                    Spaire handles tax and refunds for you
                  </div>
                  <div
                    className="ce-mini"
                    style={{ marginTop: 4, lineHeight: 1.5 }}
                  >
                    As your merchant of record, we collect and remit sales
                    tax / VAT in 60+ jurisdictions and process refunds per
                    your refund policy.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
