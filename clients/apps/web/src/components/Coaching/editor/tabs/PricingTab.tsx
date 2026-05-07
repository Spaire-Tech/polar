'use client'

// Pricing tab — ported from pricing.jsx in the design handoff.
//
// v1 of this surface is read-only / framing for the design. Wiring to
// the real product price endpoints (one-time vs subscription, payment
// plan, early-bird) is a follow-up — this matches the visual design 1:1
// while we settle on which existing product hooks to call.

import type { CourseRead } from '@/hooks/queries/courses'
import { useState } from 'react'
import { Ic } from '../icons'
import { Btn, SectionHead, Toggle } from '../ui'

const SYMBOL: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
}

export function PricingTab({ course: _course }: { course: CourseRead }) {
  const [model, setModel] = useState<'onetime' | 'subscription'>('onetime')
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD'>('USD')
  const [price, setPrice] = useState(1200)
  const [paymentPlan, setPaymentPlan] = useState(false)
  const [installments, setInstallments] = useState(3)
  const [earlyBird, setEarlyBird] = useState(false)

  const symbol = SYMBOL[currency]

  return (
    <>
      <SectionHead
        title="Pricing"
        subtitle="How members buy. Spaire is your merchant of record — we handle tax, refunds, and payouts."
        actions={<Btn variant="primary">Save changes</Btn>}
      />

      <div style={{ maxWidth: 720 }}>
        <div className="ce-stack-16">
          <div className="ce-card ce-card-pad">
            <div className="ce-label">Pricing model</div>
            <div className="ce-grid-2" style={{ marginTop: 8 }}>
              <div
                className={
                  'ce-radio-card' + (model === 'onetime' ? ' selected' : '')
                }
                onClick={() => setModel('onetime')}
              >
                <div className="ce-radio-dot" />
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13.5 }}>One-time</div>
                  <div className="ce-mini" style={{ marginTop: 2 }}>
                    Members pay once, get access for the duration of the cohort.
                  </div>
                </div>
              </div>
              <div
                className={
                  'ce-radio-card' +
                  (model === 'subscription' ? ' selected' : '')
                }
                onClick={() => setModel('subscription')}
              >
                <div className="ce-radio-dot" />
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13.5 }}>
                    Subscription
                  </div>
                  <div className="ce-mini" style={{ marginTop: 2 }}>
                    Recurring monthly access. Best for ongoing programs.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="ce-card ce-card-pad">
            <div className="ce-grid-2">
              <div>
                <label className="ce-label">Currency</label>
                <select
                  className="ce-select"
                  value={currency}
                  onChange={(e) =>
                    setCurrency(
                      e.target.value as 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD',
                    )
                  }
                >
                  <option value="USD">USD — $</option>
                  <option value="EUR">EUR — €</option>
                  <option value="GBP">GBP — £</option>
                  <option value="AUD">AUD — A$</option>
                  <option value="CAD">CAD — C$</option>
                </select>
              </div>
              <div>
                <label className="ce-label">
                  {model === 'subscription' ? 'Monthly price' : 'Price'}
                </label>
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: 8,
                      color: 'var(--ink-3)',
                    }}
                  >
                    {symbol}
                  </span>
                  <input
                    type="number"
                    className="ce-input"
                    value={price}
                    onChange={(e) => setPrice(+e.target.value || 0)}
                    style={{
                      paddingLeft: 28,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {model === 'onetime' && (
            <div className="ce-card">
              <div
                className="ce-card-pad"
                style={{ paddingBottom: paymentPlan ? 0 : 22 }}
              >
                <div className="ce-row-between">
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>
                      Offer a payment plan
                    </div>
                    <div className="ce-mini" style={{ marginTop: 2 }}>
                      Lets buyers split the price into equal monthly payments.
                    </div>
                  </div>
                  <Toggle on={paymentPlan} onChange={setPaymentPlan} />
                </div>
              </div>
              {paymentPlan && (
                <>
                  <hr
                    className="ce-divider"
                    style={{ margin: '16px 22px' }}
                  />
                  <div className="ce-card-pad" style={{ paddingTop: 0 }}>
                    <label className="ce-label">Number of installments</label>
                    <div className="ce-row" style={{ gap: 6 }}>
                      {[2, 3, 4, 6].map((n) => (
                        <button
                          key={n}
                          className={
                            'ce-btn ce-btn-sm ' +
                            (installments === n ? 'ce-btn-primary' : '')
                          }
                          onClick={() => setInstallments(n)}
                        >
                          {n}× {symbol}
                          {Math.ceil(price / n)}
                        </button>
                      ))}
                    </div>
                    <div className="ce-help">
                      A 1.5% fee covers the spread risk — passed to the buyer
                      or absorbed by you.
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="ce-card">
            <div
              className="ce-card-pad"
              style={{ paddingBottom: earlyBird ? 0 : 22 }}
            >
              <div className="ce-row-between">
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>
                    Early-bird discount
                  </div>
                  <div className="ce-mini" style={{ marginTop: 2 }}>
                    Drop the price for the first N seats or until a date.
                  </div>
                </div>
                <Toggle on={earlyBird} onChange={setEarlyBird} />
              </div>
            </div>
            {earlyBird && (
              <>
                <hr className="ce-divider" style={{ margin: '16px 22px' }} />
                <div className="ce-card-pad" style={{ paddingTop: 0 }}>
                  <div className="ce-grid-3">
                    <div>
                      <label className="ce-label">Discount</label>
                      <input className="ce-input" defaultValue="20%" />
                    </div>
                    <div>
                      <label className="ce-label">First N seats</label>
                      <input
                        className="ce-input"
                        type="number"
                        defaultValue="5"
                      />
                    </div>
                    <div>
                      <label className="ce-label">…or until</label>
                      <input
                        className="ce-input"
                        type="date"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div
            className="ce-card ce-card-pad"
            style={{ background: 'var(--bg-muted)' }}
          >
            <div className="ce-row" style={{ gap: 12, alignItems: 'flex-start' }}>
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
                <div className="ce-mini" style={{ marginTop: 4, lineHeight: 1.5 }}>
                  As your merchant of record, we collect and remit sales tax /
                  VAT in 60+ jurisdictions and process refunds per your refund
                  policy.
                </div>
              </div>
              <Btn variant="ghost" size="sm">
                Refund policy
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
