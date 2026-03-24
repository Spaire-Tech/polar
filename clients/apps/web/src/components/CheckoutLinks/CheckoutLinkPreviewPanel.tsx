'use client'

import { CONFIG } from '@/utils/config'
import ComputerOutlined from '@mui/icons-material/ComputerOutlined'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type ThemeMode = 'light' | 'dark' | 'system'

interface CheckoutLinkPreviewPanelProps {
  productId?: string
}

export const CheckoutLinkPreviewPanel = ({
  productId,
}: CheckoutLinkPreviewPanelProps) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('system')
  const [systemPrefersDark, setSystemPrefersDark] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemPrefersDark(mq.matches)
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const effectiveDark =
    themeMode === 'dark' || (themeMode === 'system' && systemPrefersDark)

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
    return `${CONFIG.FRONTEND_BASE_URL}/checkout/${checkout.client_secret}?theme=${effectiveDark ? 'dark' : 'light'}`
  }, [checkout, effectiveDark])

  return (
    <div className="dark:bg-polar-950 flex h-full flex-col overflow-hidden bg-gray-50">
      <div className="dark:border-polar-800 dark:bg-polar-950 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <span className="text-sm font-medium dark:text-white">Preview</span>
        <div className="dark:bg-polar-800 flex rounded-lg bg-gray-100 p-0.5">
          {(['light', 'system', 'dark'] as ThemeMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setThemeMode(mode)}
              className={twMerge(
                'rounded-md px-2 py-1 text-xs font-medium capitalize transition-all',
                themeMode === mode
                  ? 'dark:bg-polar-700 bg-white text-gray-900 shadow-sm dark:text-white'
                  : 'text-gray-400 dark:text-gray-500',
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-hidden p-4 pt-8">
        {!productId ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <ComputerOutlined className="text-gray-300 dark:text-gray-600" />
            <p className="dark:text-polar-500 text-sm text-gray-400">
              Select a product to preview the checkout
            </p>
          </div>
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
