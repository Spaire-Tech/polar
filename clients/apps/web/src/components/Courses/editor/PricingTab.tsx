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
import { useEffect, useMemo, useState } from 'react'
import { CourseSettingsEdits } from './SettingsTab'
import { EditPricingModal } from './EditPricingModal'

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
  const [editingPrice, setEditingPrice] = useState(false)

  // Flatten lessons from all modules
  const allLessons = course.modules.flatMap((m) => m.lessons)

  // Free preview count = positional cutoff PLUS any lesson after the
  // cutoff explicitly marked is_free_preview via the lesson options menu.
  // The input mirrors this combined count so it stays in sync with the
  // OutlineTab's Free Preview section.
  const derivedFreePreviewCount = useMemo(() => {
    const positional = Math.min(
      course.paywall_position ?? 0,
      allLessons.length,
    )
    const flaggedAfter = allLessons
      .slice(positional)
      .filter((l) => l.is_free_preview).length
    return positional + flaggedAfter
  }, [allLessons, course.paywall_position])
  const flaggedAfterPaywall =
    derivedFreePreviewCount - (course.paywall_position ?? 0)

  const [position, setPosition] = useState<number | null>(
    derivedFreePreviewCount,
  )

  useEffect(() => {
    setEnabled(course.paywall_enabled)
    setPosition(derivedFreePreviewCount)
  }, [course.id, course.paywall_enabled, derivedFreePreviewCount])

  const dirty =
    enabled !== course.paywall_enabled || position !== derivedFreePreviewCount

  const lockedCount =
    enabled && position != null
      ? Math.max(0, allLessons.length - position)
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

      <div className="mb-6">
        <h1 className="text-lg font-medium text-gray-900">Pricing</h1>
        <p className="mt-1 text-gray-500">
          The price students see at checkout, plus where the paywall sits in
          your lesson list.
        </p>
      </div>

      {/* Current offer */}
      <section className="mb-4 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Current offer</h2>
            <p className="mt-1 text-gray-500">
              The price your students see at checkout for this course.
            </p>
          </div>
          {product && (
            <button
              type="button"
              onClick={() => setEditingPrice(true)}
              className="flex h-8 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <EditOutlined sx={{ fontSize: 13 }} />
              Edit price
            </button>
          )}
        </div>
        <div className="px-5 py-4">
          {product ? (
            <div className="flex items-baseline gap-3">
              <span className="text-lg font-medium text-gray-900">
                {hasLegacyRecurringPrices(product) ? (
                  <LegacyRecurringProductPrices product={product} />
                ) : (
                  <ProductPriceLabel product={product} />
                )}
              </span>
            </div>
          ) : (
            <div className="h-6 w-28 animate-pulse rounded bg-gray-100" />
          )}
        </div>
      </section>

      {/* Paywall */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-start gap-4 px-5 py-4">
          <div className="flex-1">
            <h2 className="text-lg font-medium text-gray-900">Paywall</h2>
            <p className="mt-1 text-gray-500">
              Place a paywall between lessons. Lessons above are free preview;
              everything after is locked until purchase.
            </p>
          </div>
          <Toggle checked={enabled} onChange={setEnabled} />
        </div>

        {enabled && (
          <div className="border-t border-gray-100 px-5 py-4">
            <label className="block text-sm font-medium text-gray-900">
              Paywall position
            </label>
            <p className="mt-0.5 text-xs text-gray-500">
              Number of lessons visible before the paywall. Lessons after this
              count are locked.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={allLessons.length}
                value={position ?? ''}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === '') {
                    setPosition(null)
                    return
                  }
                  const parsed = parseInt(raw, 10)
                  if (!Number.isFinite(parsed)) return
                  setPosition(Math.max(0, Math.min(allLessons.length, parsed)))
                }}
                onBlur={() => {
                  if (position == null) setPosition(0)
                }}
                className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#0066cc] focus:ring-2 focus:ring-blue-100 focus:outline-none"
              />
              <span className="text-sm text-gray-600">
                of {allLessons.length} lessons visible
              </span>
            </div>
            {flaggedAfterPaywall > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                Includes {flaggedAfterPaywall} lesson
                {flaggedAfterPaywall === 1 ? '' : 's'} marked as free preview
                from the lesson menu.
              </p>
            )}

            {lockedCount === 0 && position != null && (
              <p className="mt-3 text-xs text-amber-600">
                With this position, no lessons are locked — every lesson is a
                free preview.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
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

      {editingPrice && product && (
        <EditPricingModal
          organization={organization}
          product={product}
          onClose={() => setEditingPrice(false)}
        />
      )}
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
        checked ? 'bg-[#0066cc]' : 'bg-gray-200'
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
