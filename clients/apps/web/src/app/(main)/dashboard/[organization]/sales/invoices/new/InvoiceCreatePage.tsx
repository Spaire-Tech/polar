'use client'

import {
  InvoiceFormContent,
  useInvoiceForm,
} from '@/components/Invoices/InvoiceForm'
import { InvoicePreviewPanel } from '@/components/Invoices/InvoicePreviewPanel'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import { schemas } from '@spaire/client'
import {
  Form,
} from '@spaire/ui/components/ui/form'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Switch from '@spaire/ui/components/atoms/Switch'

export const InvoiceCreatePage = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const router = useRouter()
  const [showLogo, setShowLogo] = useState(true)
  const [showMorAttribution, setShowMorAttribution] = useState(true)

  const handleClose = (invoiceId?: string) => {
    if (invoiceId) {
      router.push(
        `/dashboard/${organization.slug}/invoices/${invoiceId}`,
      )
    }
  }

  const {
    form,
    isSubmitting,
    selectedDiscount,
    setSelectedDiscount,
    selectedCheckoutLink,
    setSelectedCheckoutLink,
    onSubmit,
    handleSubmit,
  } = useInvoiceForm(organization, handleClose)

  return (
    <Form {...form}>
      <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-spaire-900">
        {/* Left panel — form */}
        <div className="flex w-[460px] shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white dark:border-spaire-700 dark:bg-spaire-800">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-spaire-700">
            <Link
              href={`/dashboard/${organization.slug}/invoices`}
              className="flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-black dark:text-spaire-400 dark:hover:text-white"
            >
              <ArrowBackOutlined fontSize="small" />
              <span>Back to Invoices</span>
            </Link>
          </div>
          <div className="flex flex-col gap-6 overflow-y-auto px-8 py-8">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Create Invoice
            </h1>

            {/* Display toggles */}
            <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 p-4 dark:border-spaire-700">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Display Options
              </p>
              <label className="flex cursor-pointer items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Show organization logo
                </span>
                <Switch
                  checked={showLogo}
                  onCheckedChange={setShowLogo}
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Show &ldquo;via Spaire&rdquo; attribution
                </span>
                <Switch
                  checked={showMorAttribution}
                  onCheckedChange={setShowMorAttribution}
                />
              </label>
            </div>

            <InvoiceFormContent
              organization={organization}
              isSubmitting={isSubmitting}
              selectedDiscount={selectedDiscount}
              setSelectedDiscount={setSelectedDiscount}
              selectedCheckoutLink={selectedCheckoutLink}
              setSelectedCheckoutLink={setSelectedCheckoutLink}
              onSubmit={handleSubmit(onSubmit)}
            />
          </div>
        </div>

        {/* Right panel — live preview */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <InvoicePreviewPanel
            organization={organization}
            showLogo={showLogo}
            showMorAttribution={showMorAttribution}
            selectedDiscount={selectedDiscount}
            selectedCheckoutLink={selectedCheckoutLink}
          />
        </div>
      </div>
    </Form>
  )
}
