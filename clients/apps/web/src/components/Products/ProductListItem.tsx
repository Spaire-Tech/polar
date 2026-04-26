import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import LegacyRecurringProductPrices from '@/components/Products/LegacyRecurringProductPrices'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import { ProductThumbnail } from '@/components/Products/ProductThumbnail'
import { toast } from '@/components/Toast/use-toast'
import { useUpdateProduct } from '@/hooks/queries/products'
import {
  hasLegacyRecurringPrices,
  isMeteredPrice,
  isSeatBasedPrice,
} from '@/utils/product'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import { ListItem } from '@spaire/ui/components/atoms/List'
import { Status } from '@spaire/ui/components/atoms/Status'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@spaire/ui/components/ui/dropdown-menu'
import Pill from '@spaire/ui/components/atoms/Pill'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@spaire/ui/components/ui/tooltip'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

interface ProductListItemProps {
  product: schemas['Product'] | schemas['CheckoutProduct']
  organization: schemas['Organization']
}

export const ProductListItem = ({
  product,
  organization,
}: ProductListItemProps) => {
  const router = useRouter()
  const {
    show: showModal,
    hide: hideModal,
    isShown: isConfirmModalShown,
  } = useModal()

  const handleContextMenuCallback = (
    callback: (e: React.MouseEvent) => void,
  ) => {
    return (e: React.MouseEvent) => {
      e.stopPropagation()
      callback(e)
    }
  }

  const updateProduct = useUpdateProduct(organization)

  const onArchiveProduct = useCallback(async () => {
    try {
      await updateProduct.mutate({
        id: product.id,
        body: {
          is_archived: true,
        },
      })

      toast({
        title: 'Product archived',
        description: 'The product has been archived',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An error occurred while archiving the product',
      })
    }
  }, [updateProduct, product])

  const isUsageBasedProduct = product.prices.some((price) =>
    isMeteredPrice(price),
  )

  const isSeatBasedProduct = product.prices.some((price) =>
    isSeatBasedPrice(price),
  )

  // Determine primary pricing type for the badge
  const primaryPrice = product.prices.find(
    (p) => !isMeteredPrice(p) && !isSeatBasedPrice(p),
  )
  const isFreeProduct =
    !isUsageBasedProduct &&
    !isSeatBasedProduct &&
    primaryPrice?.amount_type === 'free'
  const isCustomProduct =
    !isUsageBasedProduct &&
    !isSeatBasedProduct &&
    primaryPrice?.amount_type === 'custom'
  const isFixedRecurring =
    !isUsageBasedProduct &&
    !isSeatBasedProduct &&
    !isFreeProduct &&
    !isCustomProduct &&
    product.recurring_interval !== null &&
    product.recurring_interval !== undefined
  const isOneTime =
    !isUsageBasedProduct &&
    !isSeatBasedProduct &&
    !isFreeProduct &&
    !isCustomProduct &&
    (product.recurring_interval === null || product.recurring_interval === undefined)

  const isCourseProduct = (product as any).product_type === 'course'
  const itemHref = isCourseProduct
    ? `/dashboard/${organization.slug}/courses/via-product/${product.id}`
    : `/dashboard/${organization.slug}/products/${product.id}`

  // Category color — courses share a distinct tag color, recurring/one-time/PWYW/free use their own.
  // Variations are intentional and may repeat — they highlight the type at a glance.
  const categoryTag = isCourseProduct
    ? { label: 'Course', className: 'bg-sky-100 text-sky-700' }
    : isUsageBasedProduct
      ? { label: 'Metered', className: 'bg-green-100 text-green-700' }
      : isSeatBasedProduct
        ? { label: 'Per seat', className: 'bg-blue-100 text-blue-700' }
        : isFreeProduct
          ? { label: 'Free', className: 'bg-emerald-100 text-emerald-700' }
          : isCustomProduct
            ? { label: 'Pay what you want', className: 'bg-purple-100 text-purple-700' }
            : isFixedRecurring
              ? { label: 'Subscription', className: 'bg-violet-100 text-violet-700' }
              : isOneTime
                ? { label: 'One-time', className: 'bg-orange-100 text-orange-700' }
                : null

  return (
    <>
      <Link href={itemHref}>
        <ListItem className="flex flex-row items-center justify-between gap-x-6">
          <div className="flex min-w-0 grow flex-row items-center gap-x-4 text-sm">
            <ProductThumbnail product={product} />
            <div className="flex min-w-0 flex-row items-center gap-x-2">
              <span className="truncate">{product.name}</span>
              {product.visibility === 'private' && (
                <Pill color="gray" className="shrink-0 px-2 py-0.5 text-xs">
                  Private
                </Pill>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-row items-center gap-x-4 md:gap-x-6">
            {product.is_archived ? (
              <Tooltip>
                <TooltipTrigger>
                  <Status
                    className="bg-red-100 text-red-500"
                    status="Archived"
                  />
                </TooltipTrigger>
                <TooltipContent align="center" side="left">
                  Archived products only prevents new subscribers & purchases
                </TooltipContent>
              </Tooltip>
            ) : (
              <>
                {categoryTag && (
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${categoryTag.className}`}
                  >
                    {categoryTag.label}
                  </span>
                )}
                <span className="text-sm leading-snug">
                  {hasLegacyRecurringPrices(product) ? (
                    <LegacyRecurringProductPrices product={product} />
                  ) : (
                    <ProductPriceLabel product={product} />
                  )}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.preventDefault()
                    router.push(
                      `/dashboard/${organization.slug}/products/checkout-links?productId=${product.id}`,
                    )
                  }}
                >
                  Share
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger className="focus:outline-none" asChild>
                    <Button
                      className={
                        'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100'
                      }
                      size="icon"
                      variant="secondary"
                    >
                      <MoreVertOutlined fontSize="inherit" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className=" bg-gray-50 shadow-lg"
                  >
                    <DropdownMenuItem
                      onClick={handleContextMenuCallback(() => {
                        if (typeof navigator !== 'undefined') {
                          navigator.clipboard.writeText(product.id)
                        }
                      })}
                    >
                      Copy Product ID
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleContextMenuCallback(() => {
                        router.push(
                          `/dashboard/${organization.slug}/onboarding/integrate?productId=${product.id}`,
                        )
                      })}
                    >
                      Integrate Checkout
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {product.is_archived ? null : (
                      <DropdownMenuItem
                        onClick={handleContextMenuCallback(() => {
                          router.push(
                            `/dashboard/${organization.slug}/products/${product.id}/edit`,
                          )
                        })}
                      >
                        Edit Product
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem
                      onClick={handleContextMenuCallback(() => {
                        router.push(
                          `/dashboard/${organization.slug}/products/new?fromProductId=${product.id}`,
                        )
                      })}
                    >
                      Duplicate Product
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      destructive
                      onClick={handleContextMenuCallback(showModal)}
                    >
                      Archive Product
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </ListItem>
      </Link>
      <ConfirmModal
        isShown={isConfirmModalShown}
        hide={hideModal}
        title={`Archive "${product.name}"`}
        description="Are you sure you want to archive this product? This action cannot be undone."
        onConfirm={onArchiveProduct}
        destructive
        destructiveText="Yes, archive"
      />
    </>
  )
}
