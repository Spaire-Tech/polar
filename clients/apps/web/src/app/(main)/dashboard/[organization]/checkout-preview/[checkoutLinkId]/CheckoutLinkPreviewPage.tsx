'use client'

import { CONFIG } from '@/utils/config'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import ComputerOutlined from '@mui/icons-material/ComputerOutlined'
import SmartphoneOutlined from '@mui/icons-material/SmartphoneOutlined'
import { schemas } from '@spaire/client'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import CopyToClipboardInput from '@spaire/ui/components/atoms/CopyToClipboardInput'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type ThemeMode = 'light' | 'dark' | 'system'

interface CheckoutLinkPreviewPageProps {
  organization: schemas['Organization']
  checkoutLink: schemas['CheckoutLink']
}

export const CheckoutLinkPreviewPage = ({
  organization,
  checkoutLink,
}: CheckoutLinkPreviewPageProps) => {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [themeMode, setThemeMode] = useState<ThemeMode>('system')
  const [systemPrefersDark, setSystemPrefersDark] = useState(false)
  const [shareTab, setShareTab] = useState<'link' | 'embed'>('link')

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemPrefersDark(mq.matches)
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const effectiveDark =
    themeMode === 'dark' || (themeMode === 'system' && systemPrefersDark)

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
    return `${CONFIG.FRONTEND_BASE_URL}/checkout/${secret}?theme=${effectiveDark ? 'dark' : 'light'}`
  }, [previewCheckout, effectiveDark])

  const embedCode = useMemo(
    () =>
      `<a href="${checkoutLink.url}" data-spaire-checkout>Buy Now</a>\n<script src="${CONFIG.CHECKOUT_EMBED_SCRIPT_SRC}" defer data-auto-init></script>`,
    [checkoutLink],
  )

  // Explicit conditional classes — independent of the document's dark class
  const pageBg = effectiveDark ? 'bg-[#0d0d0d]' : 'bg-gray-100'
  const panelBg = effectiveDark ? 'bg-[#111111]' : 'bg-white'
  const panelBorder = effectiveDark ? 'border-white/[0.08]' : 'border-gray-200'
  const textPrimary = effectiveDark ? 'text-white' : 'text-gray-900'
  const textMuted = effectiveDark ? 'text-gray-400' : 'text-gray-500'
  const segmentBg = effectiveDark ? 'bg-[#1c1c1c]' : 'bg-gray-100'
  const segmentActive = effectiveDark
    ? 'bg-[#2a2a2a] text-white shadow-sm'
    : 'bg-white text-gray-900 shadow-sm'
  const segmentInactive = effectiveDark ? 'text-gray-500' : 'text-gray-500'
  const chromeBg = effectiveDark ? 'bg-[#1a1a1a]' : 'bg-gray-200'
  const chromeBorder = effectiveDark ? 'border-white/[0.06]' : 'border-gray-300'
  const urlBarBg = effectiveDark ? 'bg-[#2d2d2d]' : 'bg-white'
  const urlBarText = effectiveDark ? 'text-gray-400' : 'text-gray-500'
  const urlBarBorder = effectiveDark ? 'border-white/[0.08]' : 'border-gray-300'
  const windowBorder = effectiveDark ? 'border-white/[0.08]' : 'border-gray-300'

  const segmentBtn = (mode: string, active: boolean) =>
    twMerge(
      'flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition-all',
      active ? segmentActive : segmentInactive,
    )

  return (
    <div
      className={twMerge('flex h-screen overflow-hidden', pageBg)}
      // Prevent any parent dark: cascade from interfering
    >
      {/* ── Left settings panel ── */}
      <div
        className={twMerge(
          'flex w-[300px] shrink-0 flex-col gap-6 overflow-y-auto border-r p-6',
          panelBg,
          panelBorder,
        )}
      >
        {/* Back */}
        <Link
          href={`/dashboard/${organization.slug}/products/checkout-links/${checkoutLink.id}`}
          className={twMerge(
            'flex items-center gap-2 text-sm transition-opacity hover:opacity-60',
            textMuted,
          )}
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
            <span className={twMerge('text-sm font-medium', textPrimary)}>
              {organization.name}
            </span>
            {checkoutLink.label && (
              <span className={twMerge('text-xs', textMuted)}>
                {checkoutLink.label}
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className={twMerge('h-px', effectiveDark ? 'bg-white/[0.06]' : 'bg-gray-100')} />

        {/* Theme */}
        <div className="flex flex-col gap-2">
          <span className={twMerge('text-xs font-semibold uppercase tracking-wider', textMuted)}>
            Theme
          </span>
          <div className={twMerge('flex rounded-xl p-1', segmentBg)}>
            {(['light', 'system', 'dark'] as ThemeMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setThemeMode(mode)}
                className={segmentBtn(mode, themeMode === mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Device */}
        <div className="flex flex-col gap-2">
          <span className={twMerge('text-xs font-semibold uppercase tracking-wider', textMuted)}>
            Device
          </span>
          <div className={twMerge('flex rounded-xl p-1', segmentBg)}>
            <button
              onClick={() => setDevice('desktop')}
              className={twMerge(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all',
                device === 'desktop' ? segmentActive : segmentInactive,
              )}
            >
              <ComputerOutlined style={{ fontSize: 14 }} />
              Desktop
            </button>
            <button
              onClick={() => setDevice('mobile')}
              className={twMerge(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all',
                device === 'mobile' ? segmentActive : segmentInactive,
              )}
            >
              <SmartphoneOutlined style={{ fontSize: 14 }} />
              Mobile
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className={twMerge('h-px', effectiveDark ? 'bg-white/[0.06]' : 'bg-gray-100')} />

        {/* Share */}
        <div className="flex flex-col gap-3">
          <span className={twMerge('text-xs font-semibold uppercase tracking-wider', textMuted)}>
            Share
          </span>

          {/* Tab pills */}
          <div className={twMerge('flex rounded-xl p-1', segmentBg)}>
            <button
              onClick={() => setShareTab('link')}
              className={segmentBtn('link', shareTab === 'link')}
            >
              Link
            </button>
            <button
              onClick={() => setShareTab('embed')}
              className={segmentBtn('embed', shareTab === 'embed')}
            >
              Embed
            </button>
          </div>

          {shareTab === 'link' ? (
            <CopyToClipboardInput value={checkoutLink.url} buttonLabel="Copy" />
          ) : (
            <div className="flex flex-col gap-2">
              <CopyToClipboardInput value={embedCode} buttonLabel="Copy" />
              <p className={twMerge('text-xs', textMuted)}>
                Paste into your website. Clicking opens the checkout as an overlay.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Right preview area ── */}
      <div
        className={twMerge(
          'flex flex-1 flex-col items-center justify-center overflow-hidden p-10',
          pageBg,
        )}
      >
        {isLoadingPreview ? (
          <div
            className={twMerge(
              'h-40 w-full max-w-3xl animate-pulse rounded-2xl',
              effectiveDark ? 'bg-white/10' : 'bg-gray-200',
            )}
          />
        ) : iframeSrc ? (
          <div
            className={twMerge(
              'flex flex-col overflow-hidden rounded-2xl border shadow-2xl transition-all duration-300',
              windowBorder,
              device === 'mobile' ? 'w-[390px]' : 'w-full max-w-5xl',
            )}
          >
            {/* Browser chrome */}
            <div
              className={twMerge(
                'flex shrink-0 items-center gap-3 border-b px-4 py-3',
                chromeBg,
                chromeBorder,
              )}
            >
              {/* Traffic lights */}
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <div className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
                <div className="h-3 w-3 rounded-full bg-[#28c840]" />
              </div>

              {/* URL bar */}
              <div
                className={twMerge(
                  'flex flex-1 items-center justify-center rounded-md border px-3 py-1 text-xs',
                  urlBarBg,
                  urlBarText,
                  urlBarBorder,
                )}
              >
                {checkoutLink.url}
              </div>
            </div>

            {/* Iframe */}
            <div
              className={twMerge(
                'overflow-hidden',
                device === 'mobile' ? 'h-[700px]' : 'h-[600px]',
              )}
            >
              <iframe
                key={iframeSrc}
                src={iframeSrc}
                className="h-full w-full border-0"
                title="Checkout preview"
              />
            </div>
          </div>
        ) : (
          <p className={twMerge('text-sm', textMuted)}>Failed to load preview</p>
        )}
      </div>
    </div>
  )
}
