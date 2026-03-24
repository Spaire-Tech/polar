'use client'

import { api } from '@/utils/client'
import { CONFIG } from '@/utils/config'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import ComputerOutlined from '@mui/icons-material/ComputerOutlined'
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlined from '@mui/icons-material/LightModeOutlined'
import SmartphoneOutlined from '@mui/icons-material/SmartphoneOutlined'
import { schemas } from '@spaire/client'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import CopyToClipboardInput from '@spaire/ui/components/atoms/CopyToClipboardInput'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@spaire/ui/components/atoms/Tabs'
import { useQuery } from '@tanstack/react-query'
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
  const [darkPreview, setDarkPreview] = useState(false)

  const firstProductId = checkoutLink.products[0]?.id

  const { data: previewCheckout, isLoading: isLoadingPreview } = useQuery({
    queryKey: ['checkout-preview', firstProductId],
    queryFn: async () => {
      const { data, error } = await api.POST('/v1/checkouts/client/', {
        body: {
          product_id: firstProductId!,
        },
      })
      if (error) throw error
      return data
    },
    enabled: !!firstProductId,
    staleTime: Infinity,
    retry: false,
  })

  const iframeSrc = useMemo(() => {
    if (!previewCheckout?.client_secret) return null
    return `${CONFIG.FRONTEND_BASE_URL}/checkout/${previewCheckout.client_secret}?theme=${darkPreview ? 'dark' : 'light'}`
  }, [previewCheckout, darkPreview])

  const embedCode = useMemo(
    () =>
      `<a href="${checkoutLink.url}" data-spaire-checkout>Buy Now</a>\n<script src="${CONFIG.CHECKOUT_EMBED_SCRIPT_SRC}" defer data-auto-init></script>`,
    [checkoutLink],
  )

  const triggerClass =
    'dark:data-[state=active]:bg-spaire-900 data-[state=active]:bg-white rounded-full! w-full'

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left panel ── */}
      <div className="dark:border-spaire-800 dark:bg-spaire-950 flex w-[360px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-gray-200 bg-white p-6">
        {/* Back */}
        <Link
          href={`/dashboard/${organization.slug}/products/checkout-links/${checkoutLink.id}`}
          className="dark:text-spaire-400 flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-black dark:hover:text-white"
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
              <span className="dark:text-spaire-400 text-xs text-gray-500">
                {checkoutLink.label}
              </span>
            )}
          </div>
        </div>

        {/* Share options */}
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium dark:text-white">Share</span>
          <Tabs defaultValue="link">
            <TabsList className="dark:bg-spaire-800 mb-3 w-full rounded-full bg-gray-100">
              <TabsTrigger className={triggerClass} value="link">
                Checkout Link
              </TabsTrigger>
              <TabsTrigger className={triggerClass} value="embed">
                Embed
              </TabsTrigger>
            </TabsList>
            <TabsContent value="link">
              <CopyToClipboardInput
                value={checkoutLink.url}
                buttonLabel="Copy"
              />
            </TabsContent>
            <TabsContent value="embed">
              <CopyToClipboardInput value={embedCode} buttonLabel="Copy" />
              <p className="dark:text-spaire-500 mt-2 text-xs text-gray-400">
                Paste this snippet into your website. Clicking the link opens
                the checkout in an overlay.
              </p>
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview appearance */}
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium dark:text-white">Preview</span>
          <button
            onClick={() => setDarkPreview((d) => !d)}
            className="dark:border-spaire-700 dark:hover:bg-spaire-800 flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-sm transition-colors hover:bg-gray-50"
          >
            <span className="dark:text-spaire-300 text-gray-700">
              {darkPreview ? 'Dark mode' : 'Light mode'}
            </span>
            {darkPreview ? (
              <DarkModeOutlined
                fontSize="small"
                className="dark:text-spaire-400 text-gray-400"
              />
            ) : (
              <LightModeOutlined
                fontSize="small"
                className="text-gray-400 dark:text-gray-400"
              />
            )}
          </button>
        </div>
      </div>

      {/* ── Right preview panel ── */}
      <div className="dark:bg-spaire-950 flex flex-1 flex-col overflow-hidden bg-gray-50">
        {/* Toolbar */}
        <div className="dark:border-spaire-800 dark:bg-spaire-950 flex items-center justify-end gap-1 border-b border-gray-200 bg-white px-4 py-2">
          <button
            onClick={() => setDevice('desktop')}
            className={twMerge(
              'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
              device === 'desktop'
                ? 'dark:bg-spaire-800 bg-gray-100 text-black dark:text-white'
                : 'dark:text-spaire-500 text-gray-400 hover:text-black dark:hover:text-white',
            )}
          >
            <ComputerOutlined fontSize="small" />
          </button>
          <button
            onClick={() => setDevice('mobile')}
            className={twMerge(
              'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
              device === 'mobile'
                ? 'dark:bg-spaire-800 bg-gray-100 text-black dark:text-white'
                : 'dark:text-spaire-500 text-gray-400 hover:text-black dark:hover:text-white',
            )}
          >
            <SmartphoneOutlined fontSize="small" />
          </button>
        </div>

        {/* iframe */}
        <div className="flex flex-1 items-center justify-center overflow-hidden p-8">
          {isLoadingPreview ? (
            <div className="dark:bg-spaire-700 h-32 w-full max-w-md animate-pulse rounded-xl bg-gray-200" />
          ) : iframeSrc ? (
            <div
              className={twMerge(
                'overflow-hidden rounded-2xl shadow-xl transition-all duration-300',
                device === 'mobile'
                  ? 'h-[760px] w-[390px]'
                  : 'h-full w-full max-h-[860px]',
              )}
            >
              <iframe
                key={iframeSrc}
                src={iframeSrc}
                className="h-full w-full border-0"
                title="Checkout preview"
              />
            </div>
          ) : (
            <p className="dark:text-spaire-500 text-sm text-gray-400">
              Failed to load preview
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
