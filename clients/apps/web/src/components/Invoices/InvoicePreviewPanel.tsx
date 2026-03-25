'use client'

import InvoiceDocument, {
  type InvoiceDocumentData,
} from '@/app/(main)/dashboard/[organization]/(header)/sales/invoices/InvoiceDocument'
import { useCustomer } from '@/hooks/queries'
import { schemas } from '@spaire/client'
import { useMemo } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import type { InvoiceFormValues } from './InvoiceForm'
import { computeDiscountCents } from './InvoiceForm'

interface InvoicePreviewPanelProps {
  organization: schemas['Organization']
  showLogo: boolean
  showMorAttribution: boolean
  selectedDiscount: schemas['Discount'] | null
}

export const InvoicePreviewPanel = ({
  organization,
  showLogo,
  showMorAttribution,
  selectedDiscount,
}: InvoicePreviewPanelProps) => {
  const { control } = useFormContext<InvoiceFormValues>()

  const customerId = useWatch({ control, name: 'customer_id' })
  const currency = useWatch({ control, name: 'currency' })
  const lineItems = useWatch({ control, name: 'line_items' })
  const dueDate = useWatch({ control, name: 'due_date' })
  const memo = useWatch({ control, name: 'memo' })
  const poNumber = useWatch({ control, name: 'po_number' })
  const onBehalfOfLabel = useWatch({ control, name: 'on_behalf_of_label' })

  const { data: selectedCustomer } = useCustomer(customerId || null)

  const previewData = useMemo((): InvoiceDocumentData => {
    const items = (lineItems ?? []).map((item) => ({
      description: item.description || '',
      quantity: Number(item.quantity) || 1,
      unitAmount: Math.round((parseFloat(item.unit_amount) || 0) * 100),
    }))

    const subtotalAmount = items.reduce(
      (sum, item) => sum + item.unitAmount * item.quantity,
      0,
    )

    const discountAmount = selectedDiscount
      ? computeDiscountCents(selectedDiscount, subtotalAmount)
      : 0

    const totalAmount = Math.max(0, subtotalAmount - discountAmount)

    return {
      invoiceNumber: 'DRAFT',
      status: 'draft',
      issueDate: new Date(),
      dueDate: dueDate || null,
      currency: currency || 'usd',
      customerName: selectedCustomer
        ? (selectedCustomer as any).name ?? (selectedCustomer as any).email
        : undefined,
      customerEmail: selectedCustomer
        ? (selectedCustomer as any).email
        : undefined,
      onBehalfOfLabel: onBehalfOfLabel || undefined,
      organizationName: organization.name,
      organizationLogoUrl: organization.avatar_url ?? undefined,
      showLogo,
      showMorAttribution,
      lineItems: items,
      subtotalAmount,
      discountAmount,
      discountLabel: selectedDiscount?.name ?? undefined,
      taxAmount: 0,
      totalAmount,
      memo: memo || undefined,
      poNumber: poNumber || undefined,
    }
  }, [
    lineItems,
    currency,
    dueDate,
    memo,
    poNumber,
    onBehalfOfLabel,
    selectedCustomer,
    selectedDiscount,
    organization,
    showLogo,
    showMorAttribution,
  ])

  return (
    <div className="flex h-full flex-col bg-gray-100 dark:bg-spaire-900">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5 dark:border-spaire-700 dark:bg-spaire-800">
        <span className="text-sm font-medium dark:text-white">Preview</span>
      </div>

      {/* Preview area */}
      <div className="flex flex-1 items-start justify-center overflow-y-auto p-8">
        <div className="w-full max-w-[560px]">
          <InvoiceDocument data={previewData} isPreview />
        </div>
      </div>
    </div>
  )
}
