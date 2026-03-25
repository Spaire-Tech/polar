'use client'

import { useCustomer } from '@/hooks/queries'
import {
  type ClientInvoicePreviewRequest,
  fetchInvoicePreviewPdf,
} from '@/hooks/queries/client_invoices'
import { schemas } from '@spaire/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import type { InvoiceFormValues } from './InvoiceForm'
import { computeDiscountCents } from './InvoiceForm'

interface InvoicePreviewPanelProps {
  organization: schemas['Organization']
  showLogo: boolean
  showMorAttribution: boolean
  selectedDiscount: schemas['Discount'] | null
  selectedCheckoutLink: schemas['CheckoutLink'] | null
}

export const InvoicePreviewPanel = ({
  organization,
  showLogo,
  showMorAttribution,
  selectedDiscount,
  selectedCheckoutLink,
}: InvoicePreviewPanelProps) => {
  const { control } = useFormContext<InvoiceFormValues>()

  const customerId = useWatch({ control, name: 'customer_id' })
  const currency = useWatch({ control, name: 'currency' })
  const lineItems = useWatch({ control, name: 'line_items' })
  const dueDate = useWatch({ control, name: 'due_date' })
  const memo = useWatch({ control, name: 'memo' })
  const poNumber = useWatch({ control, name: 'po_number' })
  const onBehalfOfLabel = useWatch({ control, name: 'on_behalf_of_label' })
  const billingLine1 = useWatch({ control, name: 'billing_line1' })
  const billingLine2 = useWatch({ control, name: 'billing_line2' })
  const billingCity = useWatch({ control, name: 'billing_city' })
  const billingState = useWatch({ control, name: 'billing_state' })
  const billingPostalCode = useWatch({ control, name: 'billing_postal_code' })
  const billingCountry = useWatch({ control, name: 'billing_country' })

  const { data: selectedCustomer } = useCustomer(customerId || null)

  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevUrlRef = useRef<string | null>(null)

  const generatePreview = useCallback(async () => {
    const items = (lineItems ?? [])
      .filter((item) => item.description || item.unit_amount)
      .map((item) => ({
        description: item.description || '—',
        quantity: Number(item.quantity) || 1,
        unit_amount: Math.round((parseFloat(item.unit_amount) || 0) * 100),
      }))

    if (items.length === 0) {
      items.push({ description: '—', quantity: 1, unit_amount: 0 })
    }

    const subtotalCents = items.reduce(
      (sum, item) => sum + item.unit_amount * item.quantity,
      0,
    )
    const discountCents = selectedDiscount
      ? computeDiscountCents(selectedDiscount, subtotalCents)
      : 0

    const customerName =
      selectedCustomer
        ? (selectedCustomer as any).name ?? (selectedCustomer as any).email
        : undefined

    const body: ClientInvoicePreviewRequest = {
      organization_id: organization.id,
      customer_id: customerId || undefined,
      currency: currency || 'usd',
      line_items: items,
      due_date: dueDate || undefined,
      memo: memo || undefined,
      po_number: poNumber || undefined,
      on_behalf_of_label: onBehalfOfLabel || undefined,
      discount_amount: discountCents,
      discount_label: selectedDiscount?.name ?? undefined,
      include_payment_link: !!selectedCheckoutLink,
      checkout_link_url: selectedCheckoutLink?.url ?? undefined,
      show_logo: showLogo,
      show_mor_attribution: showMorAttribution,
      billing_name: customerName,
      billing_line1: billingLine1 || undefined,
      billing_line2: billingLine2 || undefined,
      billing_city: billingCity || undefined,
      billing_state: billingState || undefined,
      billing_postal_code: billingPostalCode || undefined,
      billing_country: billingCountry || undefined,
    }

    setIsLoading(true)
    try {
      const url = await fetchInvoicePreviewPdf(body)
      // Revoke old blob URL to avoid memory leaks
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current)
      }
      prevUrlRef.current = url
      setPdfUrl(url)
    } catch {
      // Silently ignore preview errors — the form is the source of truth
    } finally {
      setIsLoading(false)
    }
  }, [
    lineItems,
    currency,
    dueDate,
    memo,
    poNumber,
    onBehalfOfLabel,
    billingLine1,
    billingLine2,
    billingCity,
    billingState,
    billingPostalCode,
    billingCountry,
    customerId,
    selectedCustomer,
    selectedDiscount,
    selectedCheckoutLink,
    organization,
    showLogo,
    showMorAttribution,
  ])

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      generatePreview()
    }, 600)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [generatePreview])

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current)
      }
    }
  }, [])

  return (
    <div className="flex h-full flex-col bg-gray-100 dark:bg-spaire-900">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5 dark:border-spaire-700 dark:bg-spaire-800">
        <span className="text-sm font-medium dark:text-white">Preview</span>
        {isLoading && (
          <span className="text-xs text-gray-400 dark:text-spaire-500">
            Generating…
          </span>
        )}
      </div>

      {/* PDF preview */}
      <div className="flex flex-1 items-start justify-center overflow-hidden p-4">
        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            className="h-full w-full rounded-sm border border-gray-200 bg-white shadow-lg dark:border-spaire-700"
            title="Invoice Preview"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-sm text-gray-400 dark:text-spaire-500">
              {isLoading ? 'Generating preview…' : 'Preview will appear here'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
