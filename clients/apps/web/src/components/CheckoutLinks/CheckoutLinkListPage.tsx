'use client'

import { CheckoutLinkDetailPanel } from '@/components/CheckoutLinks/CheckoutLinkDetailPanel'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { CheckoutLinkManagementModal } from '@/components/CheckoutLinks/CheckoutLinkManagementModal'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import Spinner from '@/components/Shared/Spinner'
import { toast } from '@/components/Toast/use-toast'
import { useCheckoutLinks } from '@/hooks/queries'
import { useInViewport } from '@/hooks/utils'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import { ShadowBoxOnMd } from '@spaire/ui/components/atoms/ShadowBox'
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useEffect, useMemo, useState } from 'react'
import ProductSelect from '../Products/ProductSelect'

interface CheckoutLinkListPageProps {
  organization: schemas['Organization']
}

export const CheckoutLinkListPage = ({
  organization,
}: CheckoutLinkListPageProps) => {
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

  const [createCheckoutLinkQuerystring, setCreateCheckoutLinkQuerystring] =
    useQueryState('create_checkout_link', parseAsBoolean.withDefault(false))

  const { data, fetchNextPage, hasNextPage } = useCheckoutLinks(organization.id, {
    sorting: [sorting],
    product_id: productIds,
  })

  const checkoutLinks = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  )

  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null)

  const {
    isShown: isCreateModalShown,
    show: showCreateModal,
    hide: hideCreateModal,
  } = useModal()

  const { ref: loadingRef, inViewport } = useInViewport<HTMLDivElement>()

  useEffect(() => {
    if (inViewport && hasNextPage) fetchNextPage()
  }, [inViewport, hasNextPage, fetchNextPage])

  useEffect(() => {
    if (createCheckoutLinkQuerystring) {
      showCreateModal()
      setCreateCheckoutLinkQuerystring(null)
    }
  }, [createCheckoutLinkQuerystring, setCreateCheckoutLinkQuerystring, showCreateModal])

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-6">
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
          <Button onClick={showCreateModal}>
            <AddOutlined className="h-4 w-4" />
            <span>Create link</span>
          </Button>
        </div>

        {checkoutLinks.length > 0 ? (
          <div className="dark:border-spaire-700 dark:divide-spaire-700 flex flex-col divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200">
            {checkoutLinks.map((link) => {
              const productLabel =
                link.products.length === 1
                  ? link.products[0].name
                  : `${link.products.length} Products`

              return (
                <div
                  key={link.id}
                  className="dark:hover:bg-spaire-800 flex flex-row items-center gap-4 px-6 py-4 transition-colors hover:bg-gray-50"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 flex-row items-center gap-4 text-left"
                    onClick={() => setSelectedLinkId(link.id)}
                  >
                    <span className="dark:bg-spaire-700 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:text-gray-300">
                      <LinkOutlined fontSize="small" />
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {link.label ?? 'Untitled'}
                      </span>
                      <span className="dark:text-spaire-500 truncate text-xs text-gray-500">
                        {productLabel}
                      </span>
                    </div>
                  </button>
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => {
                      if (typeof navigator !== 'undefined') {
                        navigator.clipboard.writeText(link.url)
                        toast({
                          title: 'Link Copied',
                          description: 'Checkout link copied to clipboard',
                        })
                      }
                    }}
                  >
                    <LinkOutlined fontSize="small" />
                  </Button>
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
        ) : (
          <ShadowBoxOnMd className="relative overflow-hidden p-0 md:p-0">
            <img
              src="https://spaire-production-files-public.s3.us-east-1.amazonaws.com/Untitled+design+-+2026-03-19T000326.960.png"
              alt=""
              aria-hidden="true"
              className="h-[420px] w-full object-cover object-top md:h-[560px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between md:p-8">
              <div className="flex flex-col gap-2 md:gap-3">
                <h3 className="text-2xl font-bold text-white md:text-4xl">
                  Share links that go straight to checkout
                </h3>
                <p className="text-sm text-gray-400">
                  Create a link for one or more products and share it anywhere
                  — email, social, or your site.
                </p>
              </div>
              <Button
                size="lg"
                className="w-full shrink-0 bg-white text-black hover:bg-gray-100 hover:opacity-100 border-white/20 md:w-auto md:ml-8"
                onClick={showCreateModal}
              >
                Create link
              </Button>
            </div>
          </ShadowBoxOnMd>
        )}
      </div>

      <InlineModal
        isShown={isCreateModalShown}
        hide={hideCreateModal}
        modalContent={
          <CheckoutLinkManagementModal
            organization={organization}
            productIds={productIds ?? []}
            onClose={(link) => {
              setProductIds([])
              hideCreateModal()
              setSelectedLinkId(link.id)
            }}
          />
        }
      />

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
