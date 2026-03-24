'use client'

import { CheckoutLinkDetailPanel } from '@/components/CheckoutLinks/CheckoutLinkDetailPanel'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import Spinner from '@/components/Shared/Spinner'
import { toast } from '@/components/Toast/use-toast'
import {
  useCheckoutLinks,
  useCreateCheckoutLink,
  useUpdateCheckoutLink,
} from '@/hooks/queries'
import { useInViewport } from '@/hooks/utils'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import DriveFileRenameOutlineOutlined from '@mui/icons-material/DriveFileRenameOutlineOutlined'
import FileCopyOutlined from '@mui/icons-material/FileCopyOutlined'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined'
import PowerSettingsNewOutlined from '@mui/icons-material/PowerSettingsNewOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@spaire/ui/components/atoms/DropdownMenu'
import Input from '@spaire/ui/components/atoms/Input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@spaire/ui/components/ui/dialog'
import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import ProductSelect from '../Products/ProductSelect'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

interface CheckoutLinkListPageProps {
  organization: schemas['Organization']
}

function isLinkActive(link: schemas['CheckoutLink']): boolean {
  const meta = link.metadata as Record<string, unknown> | null
  return meta?.is_active !== false
}

function getLinkDisplayName(link: schemas['CheckoutLink']): string {
  return link.label ?? link.products[0]?.name ?? 'Untitled'
}

export const CheckoutLinkListPage = ({
  organization,
}: CheckoutLinkListPageProps) => {
  const router = useRouter()

  const [productIds, setProductIds] = useQueryState(
    'productId',
    parseAsArrayOf(parseAsString),
  )

  const [sorting, setSorting] = useQueryState(
    'sorting',
    parseAsStringLiteral([
      '-created_at',
      'created_at',
      'label',
      '-label',
    ] as const).withDefault('-created_at'),
  )

  const { data, fetchNextPage, hasNextPage } = useCheckoutLinks(
    organization.id,
    { sorting: [sorting], product_id: productIds },
  )

  const checkoutLinks = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  )

  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null)
  const [renameLink, setRenameLink] = useState<schemas['CheckoutLink'] | null>(null)
  const [renameName, setRenameName] = useState('')

  const { ref: loadingRef, inViewport } = useInViewport<HTMLDivElement>()
  useEffect(() => {
    if (inViewport && hasNextPage) fetchNextPage()
  }, [inViewport, hasNextPage, fetchNextPage])

  const { mutateAsync: updateCheckoutLink } = useUpdateCheckoutLink()
  const { mutateAsync: createCheckoutLink } = useCreateCheckoutLink()

  const navigateToCreate = () =>
    router.push(`/dashboard/${organization.slug}/products/checkout-links/new`)

  const handleCopyUrl = (link: schemas['CheckoutLink']) => {
    navigator.clipboard.writeText(link.url)
    toast({ title: 'Link Copied', description: 'Checkout link copied to clipboard' })
  }

  const handleToggleActive = async (link: schemas['CheckoutLink']) => {
    const meta = (link.metadata ?? {}) as Record<string, unknown>
    const newActive = !isLinkActive(link)
    await updateCheckoutLink({
      id: link.id,
      body: { metadata: { ...meta, is_active: newActive } as Record<string, string | number | boolean> },
    })
    toast({
      title: newActive ? 'Link Activated' : 'Link Deactivated',
      description: `"${getLinkDisplayName(link)}" is now ${newActive ? 'active' : 'inactive'}.`,
    })
  }

  const handleDuplicate = async (link: schemas['CheckoutLink']) => {
    const meta = (link.metadata ?? {}) as Record<string, string | number | boolean>
    await createCheckoutLink({
      payment_processor: 'stripe',
      products: link.products.map((p) => p.id),
      label: `${getLinkDisplayName(link)} (copy)`,
      allow_discount_codes: link.allow_discount_codes,
      require_billing_address: link.require_billing_address,
      discount_id: link.discount_id ?? null,
      success_url: link.success_url ?? null,
      metadata: meta,
    })
    toast({ title: 'Link Duplicated', description: 'A copy has been created.' })
  }

  const openRename = (link: schemas['CheckoutLink']) => {
    setRenameLink(link)
    setRenameName(getLinkDisplayName(link))
  }

  const handleRename = async () => {
    if (!renameLink) return
    await updateCheckoutLink({ id: renameLink.id, body: { label: renameName || null } })
    toast({ title: 'Name Updated' })
    setRenameLink(null)
  }

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-6">
        {checkoutLinks.length > 0 ? (
          <>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-row items-center gap-3">
                <div className="w-full md:max-w-64">
                  <ProductSelect
                    organization={organization}
                    value={productIds ?? []}
                    onChange={(ids) => setProductIds(ids)}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() =>
                    setSorting(
                      sorting === '-created_at' ? 'created_at' : '-created_at',
                    )
                  }
                >
                  {sorting === 'created_at' ? (
                    <ArrowUpward fontSize="small" />
                  ) : (
                    <ArrowDownward fontSize="small" />
                  )}
                </Button>
              </div>
              <Button onClick={navigateToCreate}>
                <AddOutlined className="h-4 w-4" />
                <span>Create link</span>
              </Button>
            </div>

            <div className="dark:border-spaire-700 dark:divide-spaire-700 flex flex-col divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200">
              {checkoutLinks.map((link) => {
                const active = isLinkActive(link)
                const name = getLinkDisplayName(link)
                const productLabel =
                  link.products.length === 1
                    ? link.products[0].name
                    : `${link.products.length} products`

                return (
                  <div
                    key={link.id}
                    className="dark:hover:bg-spaire-800 flex flex-row items-center gap-3 px-6 py-4 transition-colors hover:bg-gray-50"
                  >
                    {/* Active dot */}
                    <div
                      className={`h-2 w-2 shrink-0 rounded-full ${active ? 'bg-green-500' : 'bg-gray-300 dark:bg-spaire-600'}`}
                      title={active ? 'Active' : 'Inactive'}
                    />

                    {/* Main content */}
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 flex-col text-left"
                      onClick={() => setSelectedLinkId(link.id)}
                    >
                      <span
                        className={`truncate text-sm font-medium ${active ? 'dark:text-white text-gray-900' : 'text-gray-400 dark:text-spaire-500 line-through'}`}
                      >
                        {name}
                      </span>
                      <span className="dark:text-spaire-500 truncate text-xs text-gray-500">
                        {productLabel}
                      </span>
                    </button>

                    {/* Three-dots menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="dark:text-spaire-400 h-8 w-8 shrink-0 text-gray-500"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertOutlined fontSize="small" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem
                          onClick={() => handleCopyUrl(link)}
                        >
                          <ContentCopyOutlined fontSize="small" className="mr-2" />
                          Copy URL
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(
                              `/dashboard/${organization.slug}/checkout-preview/${link.id}`,
                            )
                          }
                        >
                          <VisibilityOutlined fontSize="small" className="mr-2" />
                          Preview checkout link
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openRename(link)}>
                          <DriveFileRenameOutlineOutlined
                            fontSize="small"
                            className="mr-2"
                          />
                          Change name
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setSelectedLinkId(link.id)}
                        >
                          <OpenInNewOutlined fontSize="small" className="mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDuplicate(link)}
                        >
                          <FileCopyOutlined fontSize="small" className="mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleToggleActive(link)}
                          className={active ? 'text-red-500 focus:text-red-500' : 'text-green-600 focus:text-green-600'}
                        >
                          <PowerSettingsNewOutlined
                            fontSize="small"
                            className="mr-2"
                          />
                          {active ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )
              })}
              {hasNextPage && (
                <div
                  ref={loadingRef}
                  className="flex w-full items-center justify-center py-6"
                >
                  <Spinner />
                </div>
              )}
            </div>
          </>
        ) : (
          <StripeStyleEmptyState onCreateClick={navigateToCreate} />
        )}
      </div>

      {/* Rename dialog */}
      <Dialog open={!!renameLink} onOpenChange={(open) => !open && setRenameLink(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change name</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            <Input
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              placeholder="Link name"
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRenameLink(null)}>
                Cancel
              </Button>
              <Button onClick={handleRename}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <InlineModal
        isShown={!!selectedLinkId}
        hide={() => setSelectedLinkId(null)}
        className="md:w-[600px]"
        modalContent={
          selectedLinkId ? (
            <CheckoutLinkDetailPanel
              checkoutLinkId={selectedLinkId}
              organization={organization}
              onClose={() => setSelectedLinkId(null)}
            />
          ) : (
            <div />
          )
        }
      />
    </DashboardBody>
  )
}

// Stripe-style empty state
function StripeStyleEmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center gap-10 py-12 text-center">
      {/* Visual mockup */}
      <div className="relative h-[300px] w-full max-w-[680px] select-none">
        {/* Left: checkout page (teal bg + payment form side-by-side) */}
        <div className="absolute left-0 top-8 flex h-[256px] w-[420px] overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/5">
          {/* Product panel (teal) */}
          <div className="flex w-[160px] shrink-0 flex-col gap-3 bg-teal-600 px-5 py-5">
            <div className="flex items-center gap-1.5">
              <div className="h-3.5 w-3.5 rounded-full bg-white/80" />
              <div className="h-2 w-14 rounded-full bg-white/60" />
            </div>
            <div className="mt-1 flex flex-col gap-1">
              <div className="h-2 w-28 rounded-full bg-white/50" />
              <div className="h-5 w-16 rounded-full bg-white/90" />
            </div>
            <div className="mt-1 flex h-[100px] w-full items-center justify-center rounded-xl bg-white/20">
              <svg className="h-10 w-10 text-white/60" fill="none" viewBox="0 0 40 40">
                <rect x="4" y="4" width="32" height="32" rx="6" fill="currentColor" fillOpacity="0.3" />
                <rect x="10" y="18" width="6" height="12" rx="1.5" fill="currentColor" fillOpacity="0.8" />
                <rect x="17" y="12" width="6" height="18" rx="1.5" fill="currentColor" fillOpacity="0.8" />
                <rect x="24" y="8" width="6" height="22" rx="1.5" fill="currentColor" fillOpacity="0.8" />
              </svg>
            </div>
          </div>

          {/* Payment form (white) */}
          <div className="flex flex-1 flex-col gap-2 bg-white px-4 py-4">
            <div className="mb-1 h-8 rounded-lg bg-gray-900" />
            <div className="flex items-center gap-2 py-0.5">
              <div className="h-px flex-1 bg-gray-100" />
              <div className="h-1.5 w-16 rounded-full bg-gray-200" />
              <div className="h-px flex-1 bg-gray-100" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <div className="h-1.5 w-10 rounded-full bg-gray-300" />
                <div className="h-6 rounded-md border border-gray-200 bg-gray-50" />
              </div>
            ))}
            <div className="mt-1 h-8 rounded-lg bg-gray-900" />
          </div>
        </div>

        {/* Right: "Checkout link is active" status card */}
        <div className="absolute right-0 top-0 w-[244px] rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl ring-1 ring-black/5">
          <p className="text-sm font-semibold text-gray-900">
            Checkout link is{' '}
            <span className="text-green-500">active</span>
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Share your link to accept payments.
          </p>
          <div className="mt-3 truncate rounded-lg bg-gray-50 px-3 py-2 text-left text-xs font-medium text-blue-600">
            spaire.com/checkout/ab1c23d
          </div>
          <button className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700">
            Share
          </button>
        </div>
      </div>

      {/* Title + description */}
      <div className="flex flex-col gap-3 max-w-lg">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
          Create a checkout page in a few clicks
        </h2>
        <p className="text-gray-500 dark:text-spaire-400">
          Sell products, offer subscriptions, or accept donations with a
          link—no code required.
        </p>
      </div>

      {/* CTA */}
      <Button size="lg" onClick={onCreateClick} className="gap-2">
        <AddOutlined fontSize="small" />
        Create checkout link
      </Button>
    </div>
  )
}
