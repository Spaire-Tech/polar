'use client'

import { CONFIG } from '@/utils/config'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import ComputerOutlined from '@mui/icons-material/ComputerOutlined'
import SmartphoneOutlined from '@mui/icons-material/SmartphoneOutlined'
import { schemas } from '@spaire/client'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import CopyToClipboardInput from '@spaire/ui/components/atoms/CopyToClipboardInput'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface CheckoutLinkPreviewPageProps {
  organization: schemas['Organization']
  checkoutLink: schemas['CheckoutLink']
}

export const CheckoutLinkPreviewPage = ({
  organization,
  checkoutLink,
}: CheckoutLinkPreviewPageProps) => {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [shareTab, setShareTab] = useState<'link' | 'embed'>('link')
  const { resolvedTheme } = useTheme()

  const firstProductId = checkoutLink.products[0]?.id

  const { data: previewCheckout, isLoading: isLoadingPreview } = useQuery({
    queryKey: ['checkout-preview', firstProductId],
    queryFn: async () => {
      const res = await fetch('/api/checkout-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: firstProductId }),
      })
      if (!res.ok) throw new Error('Failed to create checkout preview')
      return res.json() as Promise<{ client_secret: string }>
    },
    enabled: !!firstProductId,
    staleTime: Infinity,
    retry: false,
  })

  const iframeSrc = useMemo(() => {
    const secret = previewCheckout?.client_secret
    if (!secret) return null
    const theme = resolvedTheme === 'dark' ? 'dark' : 'light'
    return `${CONFIG.FRONTEND_BASE_URL}/checkout/${secret}?theme=${theme}`
  }, [previewCheckout, resolvedTheme])

  const embedCode = useMemo(
    () =>
      `<a href="${checkoutLink.url}" data-spaire-checkout>Buy Now</a>\n<script src="${CONFIG.CHECKOUT_EMBED_SCRIPT_SRC}" defer data-auto-init></script>`,
    [checkoutLink],
  )

  const segmentBtn = (active: boolean) =>
    twMerge(
      'flex-1 rounded-lg py-1.5 text-xs font-medium transition-all',
      active
        ? 'dark:bg-polar-700 bg-white text-gray-900 shadow-sm dark:text-white'
        : 'dark:text-polar-500 text-gray-500',
    )

  return (
    <div className="dark:bg-polar-950 flex h-screen overflow-hidden bg-gray-100">
      {/* ── Left settings panel ── */}
      <div className="dark:border-polar-800 dark:bg-polar-900 flex w-[300px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-gray-200 bg-white p-6">
        {/* Back */}
        <Link
          href={`/dashboard/${organization.slug}/products/checkout-links/${checkoutLink.id}`}
          className="dark:text-polar-400 flex items-center gap-2 text-sm text-gray-500 transition-opacity hover:opacity-60"
        >
          <ArrowBackOutlined fontSize="small" />
          <span>Back</span>
        </Link>

        {/* Identity */}
        <div className="flex items-center gap-3">
          <Avatar
            name={organization.name}
            avatar_url={organization.avatar_url}
            className="h-9 w-9 rounded-lg"
          />
          <div className="flex flex-col">
            <span className="text-sm font-medium dark:text-white">
              {organization.name}
            </span>
            {checkoutLink.label && (
              <span className="dark:text-polar-400 text-xs text-gray-500">
                {checkoutLink.label}
              </span>
            )}
          </div>
        </div>

        <div className="dark:bg-polar-800 h-px bg-gray-100" />

        {/* Device toggle */}
        <div className="flex flex-col gap-2">
          <span className="dark:text-polar-400 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Device
          </span>
          <div className="dark:bg-polar-800 flex rounded-xl bg-gray-100 p-1">
            <button
              onClick={() => setDevice('desktop')}
              className={twMerge(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all',
                device === 'desktop'
                  ? 'dark:bg-polar-700 bg-white text-gray-900 shadow-sm dark:text-white'
                  : 'dark:text-polar-500 text-gray-500',
              )}
            >
              <ComputerOutlined style={{ fontSize: 14 }} />
              Desktop
            </button>
            <button
              onClick={() => setDevice('mobile')}
              className={twMerge(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all',
                device === 'mobile'
                  ? 'dark:bg-polar-700 bg-white text-gray-900 shadow-sm dark:text-white'
                  : 'dark:text-polar-500 text-gray-500',
              )}
            >
              <SmartphoneOutlined style={{ fontSize: 14 }} />
              Mobile
            </button>
          </div>
        </div>

        <div className="dark:bg-polar-800 h-px bg-gray-100" />

        {/* Share */}
        <div className="flex flex-col gap-3">
          <span className="dark:text-polar-400 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Share
          </span>
          <div className="dark:bg-polar-800 flex rounded-xl bg-gray-100 p-1">
            <button
              onClick={() => setShareTab('link')}
              className={segmentBtn(shareTab === 'link')}
            >
              Link
            </button>
            <button
              onClick={() => setShareTab('embed')}
              className={segmentBtn(shareTab === 'embed')}
            >
              Embed
            </button>
          </div>
          {shareTab === 'link' ? (
            <CopyToClipboardInput value={checkoutLink.url} buttonLabel="Copy" />
          ) : (
            <div className="flex flex-col gap-2">
              <CopyToClipboardInput value={embedCode} buttonLabel="Copy" />
              <p className="dark:text-polar-500 text-xs text-gray-400">
                Paste into your website. Clicking opens the checkout as an
                overlay.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Right preview area ── */}
      <div className="dark:bg-polar-950 flex flex-1 flex-col overflow-hidden bg-gray-100 p-8">
        {isLoadingPreview ? (
          <div className="dark:bg-polar-700 h-40 w-full animate-pulse rounded-2xl bg-gray-200" />
        ) : iframeSrc ? (
          <div
            className={twMerge(
              'dark:border-polar-700 flex flex-1 flex-col overflow-hidden rounded-2xl border border-gray-300 shadow-2xl',
              device === 'mobile' ? 'mx-auto w-[390px]' : 'w-full',
            )}
          >
            {/* Browser chrome */}
            <div className="dark:border-polar-700 dark:bg-polar-800 flex shrink-0 items-center gap-3 border-b border-gray-200 bg-gray-200 px-4 py-3">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <div className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
                <div className="h-3 w-3 rounded-full bg-[#28c840]" />
              </div>
              <div className="dark:border-polar-600 dark:bg-polar-700 dark:text-polar-400 flex flex-1 items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1 text-xs text-gray-500">
                {checkoutLink.url}
              </div>
            </div>

            {/* Iframe fills remaining space — no scroll needed */}
            <div className="min-h-0 flex-1 overflow-hidden">
              <iframe
                key={iframeSrc}
                src={iframeSrc}
                className="h-full w-full border-0"
                title="Checkout preview"
              />
            </div>
          </div>
        ) : (
          <p className="dark:text-polar-500 text-sm text-gray-400">
            Failed to load preview
          </p>
        )}
      </div>
    </div>
  )
}
