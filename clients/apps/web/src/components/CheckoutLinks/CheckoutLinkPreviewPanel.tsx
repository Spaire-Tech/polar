'use client'

import { CONFIG } from '@/utils/config'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { useMemo } from 'react'

interface CheckoutLinkPreviewPanelProps {
  productId?: string
}

export const CheckoutLinkPreviewPanel = ({
  productId,
}: CheckoutLinkPreviewPanelProps) => {
  const { resolvedTheme } = useTheme()

  const { data: checkout, isLoading, error } = useQuery({
    queryKey: ['checkout-preview', productId],
    queryFn: async () => {
      const res = await fetch('/api/checkout-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      })
      const json = await res.json()
      if (!res.ok)
        throw new Error(json.error ?? 'Failed to create checkout preview')
      return json as { client_secret: string }
    },
    enabled: !!productId,
    staleTime: Infinity,
    retry: false,
  })

  const iframeSrc = useMemo(() => {
    if (!checkout?.client_secret) return null
    const theme = resolvedTheme === 'dark' ? 'dark' : 'light'
    return `${CONFIG.FRONTEND_BASE_URL}/checkout/${checkout.client_secret}?theme=${theme}`
  }, [checkout, resolvedTheme])

  return (
    <div className="dark:bg-polar-950 flex h-full flex-col bg-gray-50">
      <div className="dark:border-polar-800 dark:bg-polar-900 flex shrink-0 items-center border-b border-gray-200 bg-white px-4 py-3">
        <span className="text-sm font-medium dark:text-white">Preview</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center overflow-hidden p-6">
        {!productId ? (
          <p className="dark:text-polar-500 text-sm text-gray-400">
            Select a product to preview the checkout
          </p>
        ) : isLoading ? (
          <div className="dark:bg-polar-700 h-32 w-full max-w-md animate-pulse rounded-xl bg-gray-200" />
        ) : error ? (
          <p className="dark:text-polar-500 text-center text-sm text-gray-400">
            {(error as Error).message}
          </p>
        ) : iframeSrc ? (
          <div className="h-full w-full overflow-hidden rounded-xl shadow-lg">
            <iframe
              key={iframeSrc}
              src={iframeSrc}
              className="h-full w-full border-0"
              title="Checkout preview"
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
