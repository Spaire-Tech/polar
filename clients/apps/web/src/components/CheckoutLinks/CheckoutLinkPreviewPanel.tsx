'use client'

import { CONFIG } from '@/utils/config'
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlined from '@mui/icons-material/LightModeOutlined'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

interface CheckoutLinkPreviewPanelProps {
  productId?: string
}

export const CheckoutLinkPreviewPanel = ({
  productId,
}: CheckoutLinkPreviewPanelProps) => {
  const [dark, setDark] = useState(false)

  const { data: checkout, isLoading, error } = useQuery({
    queryKey: ['checkout-preview', productId],
    queryFn: async () => {
      const res = await fetch('/api/checkout-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create checkout preview')
      return json as { client_secret: string }
    },
    enabled: !!productId,
    staleTime: Infinity,
    retry: false,
  })

  const iframeSrc = useMemo(() => {
    if (!checkout?.client_secret) return null
    return `${CONFIG.FRONTEND_BASE_URL}/checkout/${checkout.client_secret}?theme=${dark ? 'dark' : 'light'}`
  }, [checkout, dark])

  return (
    <div className="dark:bg-spaire-950 flex h-full flex-col overflow-hidden bg-gray-50">
      <div className="dark:border-spaire-800 dark:bg-spaire-950 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <span className="text-sm font-medium dark:text-white">Preview</span>
        <button
          type="button"
          onClick={() => setDark((d) => !d)}
          className="dark:text-spaire-400 dark:hover:text-spaire-200 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:text-black"
        >
          {dark ? (
            <DarkModeOutlined fontSize="small" />
          ) : (
            <LightModeOutlined fontSize="small" />
          )}
        </button>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-hidden p-4 pt-8">
        {!productId ? (
          <p className="dark:text-spaire-500 text-sm text-gray-400">
            Select a product to preview the checkout
          </p>
        ) : isLoading ? (
          <div className="dark:bg-spaire-700 h-32 w-full max-w-md animate-pulse rounded-xl bg-gray-200" />
        ) : error ? (
          <p className="dark:text-spaire-500 text-center text-sm text-gray-400">
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
