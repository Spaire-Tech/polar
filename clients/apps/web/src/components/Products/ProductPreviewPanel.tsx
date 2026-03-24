'use client'

import { api } from '@/utils/client'
import { enums } from '@spaire/client'
import CountryPicker from '@spaire/ui/components/atoms/CountryPicker'
import Input from '@spaire/ui/components/atoms/Input'
import { formatCurrency } from '@spaire/currency'
import { useCallback, useEffect, useState } from 'react'

interface TaxPreviewResult {
  subtotal: number
  tax_amount: number
  total: number
  currency: string
  quantity: number
  tax_rate: { display_name: string; percentage: number | null } | null
  taxability_reason: string | null
}

interface ProductPreviewPanelProps {
  /** Price amount in smallest unit (e.g. cents) */
  priceAmount: number | null
  currency: string
  recurringInterval: string | null
  recurringIntervalCount: number | null
}

const fmt = formatCurrency('standard')
const formatAmount = (amount: number, currency: string): string =>
  fmt(amount, currency.toLowerCase())

const intervalLabel = (
  interval: string | null,
  count: number | null,
): string => {
  if (!interval) return ''
  if (count && count > 1) return `every ${count} ${interval}s`
  return `per ${interval}`
}

export const ProductPreviewPanel = ({
  priceAmount,
  currency,
  recurringInterval,
  recurringIntervalCount,
}: ProductPreviewPanelProps) => {
  const [quantity, setQuantity] = useState(1)
  const [country, setCountry] = useState<string>('')
  const [preview, setPreview] = useState<TaxPreviewResult | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchPreview = useCallback(async () => {
    if (!priceAmount || priceAmount <= 0 || !country) {
      setPreview(null)
      return
    }

    setLoading(true)
    try {
      const { data } = await (api as any).POST('/v1/products/tax-preview', {
        body: {
          amount: priceAmount,
          currency: currency.toLowerCase(),
          country: country.toUpperCase(),
          quantity,
        },
      })
      if (data) {
        setPreview(data as TaxPreviewResult)
      }
    } catch {
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }, [priceAmount, currency, country, quantity])

  useEffect(() => {
    fetchPreview()
  }, [fetchPreview])

  const hasPrice = priceAmount && priceAmount > 0

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Preview
        </h2>
        <p className="dark:text-polar-400 mt-1 text-sm text-gray-500">
          Estimate totals based on pricing model, unit quantity, and tax.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Unit quantity
          </label>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => {
              const v = parseInt(e.target.value)
              if (!isNaN(v) && v >= 1) setQuantity(v)
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Location
          </label>
          <CountryPicker
            allowedCountries={enums.addressInputCountryValues}
            value={country || undefined}
            onChange={setCountry}
          />
        </div>
      </div>

      {hasPrice && country && (
        <div className="dark:border-polar-700 flex flex-col gap-4 border-t border-gray-200 pt-4">
          {loading ? (
            <div className="dark:bg-polar-700 h-24 animate-pulse rounded-xl bg-gray-100" />
          ) : (
            <>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {quantity} × {formatAmount(priceAmount, currency)} ={' '}
                <span className="font-semibold">
                  {formatAmount(priceAmount * quantity, currency)}
                </span>
              </p>

              <div className="dark:border-polar-700 border-t border-gray-200" />

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Subtotal
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {preview
                      ? formatAmount(preview.subtotal, currency)
                      : formatAmount(priceAmount * quantity, currency)}
                  </span>
                </div>

                {preview && preview.tax_amount > 0 && preview.tax_rate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {preview.tax_rate.display_name}
                      {preview.tax_rate.percentage !== null
                        ? ` ${preview.tax_rate.percentage}%`
                        : ''}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatAmount(preview.tax_amount, currency)}
                    </span>
                  </div>
                )}

                {preview && preview.tax_amount === 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="dark:text-polar-400 text-gray-500">
                      Tax
                    </span>
                    <span className="dark:text-polar-400 text-gray-500">
                      —
                    </span>
                  </div>
                )}

                <div className="dark:border-polar-700 border-t border-gray-200 pt-2">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        Total
                        {recurringInterval
                          ? ` ${intervalLabel(recurringInterval, recurringIntervalCount)}`
                          : ''}
                      </span>
                      {recurringInterval && (
                        <p className="dark:text-polar-500 mt-0.5 text-xs text-gray-400">
                          Billed at the start of the period
                        </p>
                      )}
                    </div>
                    <span className="text-base font-semibold text-gray-900 dark:text-white">
                      {preview
                        ? formatAmount(preview.total, currency)
                        : formatAmount(priceAmount * quantity, currency)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {!hasPrice && (
        <p className="dark:text-polar-400 text-sm text-gray-400">
          Set a price to see the estimate.
        </p>
      )}

      {hasPrice && !country && (
        <p className="dark:text-polar-400 text-sm text-gray-400">
          Select a location to see the tax estimate.
        </p>
      )}
    </div>
  )
}
