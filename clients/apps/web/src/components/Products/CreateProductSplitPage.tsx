'use client'

import { useProduct } from '@/hooks/queries'
import { schemas } from '@spaire/client'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import Link from 'next/link'
import { useState } from 'react'
import { CreateProductPage } from './CreateProductPage'
import { ProductPreviewPanel } from './ProductPreviewPanel'

interface CreateProductSplitPageProps {
  organization: schemas['Organization']
  fromProductId?: string
}

/**
 * Full-screen split layout for creating products — form on the left,
 * live tax/price preview on the right (mirrors the checkout link creation page).
 */
const CreateProductSplitPageInner = ({
  organization,
  sourceProduct,
}: {
  organization: schemas['Organization']
  sourceProduct?: schemas['Product']
}) => {
  const [previewPrice, setPreviewPrice] = useState<{
    amount: number | null
    currency: string
    recurringInterval: string | null
    recurringIntervalCount: number | null
  }>({
    amount: null,
    currency: organization.default_presentment_currency,
    recurringInterval: null,
    recurringIntervalCount: null,
  })

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-spaire-900">
      {/* Left panel — product form */}
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden border-r border-gray-200 bg-white dark:border-spaire-700 dark:bg-spaire-800">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-spaire-700">
          <Link
            href={`/dashboard/${organization.slug}/products`}
            className="flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-black dark:text-spaire-400 dark:hover:text-white"
          >
            <ArrowBackOutlined fontSize="small" />
            <span>Back to Products</span>
          </Link>
        </div>
        <div className="overflow-y-auto">
          <CreateProductPage
            organization={organization}
            sourceProduct={sourceProduct}
            splitMode
            onPriceChange={setPreviewPrice}
          />
        </div>
      </div>

      {/* Right panel — preview */}
      <div className="flex w-[420px] shrink-0 flex-col overflow-y-auto p-8">
        <div className="mx-auto w-full max-w-sm">
          <ProductPreviewPanel
            priceAmount={previewPrice.amount}
            currency={previewPrice.currency}
            recurringInterval={previewPrice.recurringInterval}
            recurringIntervalCount={previewPrice.recurringIntervalCount}
          />
        </div>
      </div>
    </div>
  )
}

export const CreateProductSplitPage = ({
  organization,
  fromProductId,
}: CreateProductSplitPageProps) => {
  const { data: sourceProduct, isLoading } = useProduct(fromProductId)

  if (fromProductId && isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="dark:text-spaire-500 text-gray-500">
          Loading product...
        </p>
      </div>
    )
  }

  if (fromProductId && !sourceProduct) {
    return null
  }

  return (
    <CreateProductSplitPageInner
      organization={organization}
      sourceProduct={sourceProduct}
    />
  )
}
