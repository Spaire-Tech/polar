'use client'

import { CONFIG } from '@/utils/config'
import ComputerOutlined from '@mui/icons-material/ComputerOutlined'
import SmartphoneOutlined from '@mui/icons-material/SmartphoneOutlined'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface CheckoutLinkPreviewPanelProps {
  productId?: string
}

// Scale factor: the iframe renders at 1/SCALE of its container size,
// so the checkout page gets a larger viewport and fits without internal scroll.
const SCALE = 0.72

export const CheckoutLinkPreviewPanel = ({
  productId,
}: CheckoutLinkPreviewPanelProps) => {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
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

  const pct = `${(100 / SCALE).toFixed(2)}%`

  return (
    <div className="flex h-full flex-col bg-gray-100 dark:bg-polar-950">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5 dark:border-polar-800 dark:bg-polar-900">
        <span className="text-sm font-medium dark:text-white">Preview</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDevice('desktop')}
            className={twMerge(
              'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
              device === 'desktop'
                ? 'bg-gray-100 text-gray-900 dark:bg-polar-700 dark:text-white'
                : 'text-gray-400 hover:text-gray-700 dark:text-polar-500 dark:hover:text-polar-300',
            )}
          >
            <ComputerOutlined style={{ fontSize: 16 }} />
          </button>
          <button
            type="button"
            onClick={() => setDevice('mobile')}
            className={twMerge(
              'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
              device === 'mobile'
                ? 'bg-gray-100 text-gray-900 dark:bg-polar-700 dark:text-white'
                : 'text-gray-400 hover:text-gray-700 dark:text-polar-500 dark:hover:text-polar-300',
            )}
          >
            <SmartphoneOutlined style={{ fontSize: 16 }} />
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex flex-1 items-center justify-center overflow-hidden p-6">
        {!productId ? (
          <p className="text-sm text-gray-400 dark:text-polar-500">
            Select a product to preview the checkout
          </p>
        ) : isLoading ? (
          <div className="h-32 w-full max-w-md animate-pulse rounded-xl bg-gray-200 dark:bg-polar-700" />
        ) : error ? (
          <p className="text-center text-sm text-gray-400 dark:text-polar-500">
            {(error as Error).message}
          </p>
        ) : iframeSrc ? (
          <div
            className={twMerge(
              'flex flex-col overflow-hidden rounded-xl border border-gray-200 shadow-xl dark:border-polar-700',
              'h-full',
              device === 'mobile' ? 'w-[300px]' : 'w-full',
            )}
          >
            {/* Browser chrome */}
            <div className="flex shrink-0 items-center gap-2.5 border-b border-gray-200 bg-gray-100 px-3 py-2 dark:border-polar-700 dark:bg-polar-800">
              <div className="flex items-center gap-1">
                <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </div>
              <div className="flex-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-center text-[10px] text-gray-400 dark:border-polar-600 dark:bg-polar-700 dark:text-polar-400">
                checkout
              </div>
            </div>

            {/* Scaled iframe */}
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <iframe
                key={iframeSrc}
                src={iframeSrc}
                className="absolute left-0 top-0 border-0"
                style={{
                  width: pct,
                  height: pct,
                  transform: `scale(${SCALE})`,
                  transformOrigin: 'top left',
                }}
                title="Checkout preview"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
