'use client'

import LegacyRecurringProductPrices from '@/components/Products/LegacyRecurringProductPrices'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import { CourseRead } from '@/hooks/queries/courses'
import { useOrganizationPaymentStatus } from '@/hooks/queries/org'
import { useProduct } from '@/hooks/queries/products'
import { hasLegacyRecurringPrices } from '@/utils/product'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { PaywallIcon } from './PaywallIcon'
import { CourseSettingsEdits } from './SettingsTab'

export function PricingTab({
  organization,
  course,
  onSave,
  isSaving,
}: {
  organization: schemas['Organization']
  course: CourseRead
  onSave: (edits: CourseSettingsEdits) => void
  isSaving: boolean
}) {
  const { data: paymentStatus } = useOrganizationPaymentStatus(organization.id)
  const { data: product } = useProduct(course.product_id)

  const [enabled, setEnabled] = useState(course.paywall_enabled)
  const [position, setPosition] = useState<number | null>(
    course.paywall_position ?? (course.modules.length > 1 ? 1 : null),
  )

  useEffect(() => {
    setEnabled(course.paywall_enabled)
    setPosition(course.paywall_position)
  }, [course.id, course.paywall_enabled, course.paywall_position])

  const dirty =
    enabled !== course.paywall_enabled || position !== course.paywall_position

  const lockedCount =
    enabled && position != null
      ? Math.max(0, course.modules.length - position)
      : 0

  const showPayoutBanner = paymentStatus && !paymentStatus.payment_ready

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-8">
      {showPayoutBanner && (
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-y-1">
            <h3 className="text-sm font-medium text-gray-900">
              Complete your profile to start receiving payouts
            </h3>
            <p className="text-sm text-gray-500">
              Set up your payout account so you can get paid when customers
              purchase your products.
            </p>
          </div>
          <Link
            href={`/dashboard/${organization.slug}/finance/account`}
            className="shrink-0"
          >
            <Button size="sm">
              <span>Set Up Payouts</span>
              <ArrowForwardOutlined className="ml-1.5" fontSize="small" />
            </Button>
          </Link>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Pricing</h1>
        <p className="mt-1 text-sm text-gray-500">
          Set your offer and the paywall that controls free preview access.
        </p>
      </div>

      {/* Current offer */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-base font-bold text-gray-900">Current offer</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              The price your students see at checkout for this course.
            </p>
          </div>
          {product && (
            <Link
              href={`/dashboard/${organization.slug}/products/${product.id}/edit`}
            >
              <button className="flex h-8 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50">
                <EditOutlined sx={{ fontSize: 13 }} />
                Edit offer
              </button>
            </Link>
          )}
        </div>
        <div className="px-6 py-5">
          {product ? (
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-semibold text-gray-900">
                {hasLegacyRecurringPrices(product) ? (
                  <LegacyRecurringProductPrices product={product} />
                ) : (
                  <ProductPriceLabel product={product} />
                )}
              </span>
            </div>
          ) : (
            <div className="h-7 w-32 animate-pulse rounded bg-gray-100" />
          )}
        </div>
      </section>

      {/* Paywall */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-start gap-3 px-6 py-5">
          <span className="bg-primary/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
            <PaywallIcon size={20} />
          </span>
          <div className="flex-1">
            <h2 className="text-base font-bold text-gray-900">Paywall</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Place a paywall between modules. Modules above are free preview;
              everything after is locked until purchase.
            </p>
          </div>
          <Toggle checked={enabled} onChange={setEnabled} />
        </div>

        {enabled && (
          <div className="border-t border-gray-100 px-6 py-5">
            <label className="block text-sm font-bold text-gray-900">
              Paywall position
            </label>
            <p className="mt-0.5 text-xs text-gray-500">
              Number of modules visible before the paywall. Modules after this
              count are locked.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={course.modules.length}
                value={position ?? 0}
                onChange={(e) => setPosition(parseInt(e.target.value || '0'))}
                className="focus:border-primary w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none"
              />
              <span className="text-sm text-gray-600">
                of {course.modules.length} modules visible
              </span>
            </div>

            {course.modules.length > 0 && position != null && (
              <div className="mt-4 flex flex-col gap-1">
                {course.modules.map((m, idx) => {
                  const locked = idx >= position
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                      style={{
                        backgroundColor: locked
                          ? 'rgb(254 242 242)'
                          : 'rgb(240 253 244)',
                      }}
                    >
                      <span className="text-xs text-gray-400">{idx + 1}.</span>
                      <span className="flex-1 truncate text-gray-900">
                        {m.title}
                      </span>
                      <span
                        className={
                          locked
                            ? 'text-xs font-medium text-red-700'
                            : 'text-xs font-medium text-green-700'
                        }
                      >
                        {locked ? 'Locked' : 'Free preview'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {lockedCount === 0 && position != null && (
              <p className="mt-3 text-xs text-amber-600">
                With this position, no modules are locked — every module is a
                free preview.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-3">
          <button
            disabled={!dirty || isSaving}
            onClick={() => {
              setEnabled(course.paywall_enabled)
              setPosition(course.paywall_position)
            }}
            className="rounded-full border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Reset
          </button>
          <button
            disabled={!dirty || isSaving}
            onClick={() =>
              onSave({
                paywall_enabled: enabled,
                paywall_position: enabled ? position : null,
              })
            }
            className="rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </section>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
        checked ? 'bg-primary' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
