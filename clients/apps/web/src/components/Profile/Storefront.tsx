'use client'

import { ProductCard } from '@/components/Products/ProductCard'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import { useRecurringInterval } from '@/hooks/products'
import { organizationPageLink } from '@/utils/nav'
import { isLegacyRecurringPrice } from '@/utils/product'
import { schemas } from '@spaire/client'
import Link from 'next/link'
import { useMemo } from 'react'
import { ProductsGrid } from './ProductsGrid'

export const Storefront = ({
  organization,
  products,
}: {
  organization: schemas['CustomerOrganization']
  products: schemas['ProductStorefront'][]
}) => {
  const [recurringInterval, setRecurringInterval, hasBothIntervals] =
    useRecurringInterval(products)

  const subscriptionProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          p.is_recurring &&
          (p.recurring_interval === recurringInterval ||
            p.prices.some(
              (price) =>
                isLegacyRecurringPrice(price) &&
                price.recurring_interval === recurringInterval,
            )),
      ),
    [products, recurringInterval],
  )

  const oneTimeProducts = useMemo(
    () => products.filter((p) => !p.is_recurring),
    [products],
  )

  if (subscriptionProducts.length < 1 && oneTimeProducts.length < 1) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg text-gray-400 dark:text-spaire-600">
          No products available yet
        </p>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-y-16">
      {subscriptionProducts.length > 0 && (
        <ProductsGrid
          title="Subscriptions"
          organization={organization}
          hasBothIntervals={hasBothIntervals}
          recurringInterval={recurringInterval}
          setRecurringInterval={setRecurringInterval}
        >
          {subscriptionProducts.map((tier) => (
            <Link
              className="shrink-0 self-stretch"
              key={tier.id}
              href={`/${organization.slug}/products/${tier.id}`}
            >
              <SubscriptionTierCard
                className="h-full"
                subscriptionTier={tier}
                recurringInterval={recurringInterval}
              />
            </Link>
          ))}
        </ProductsGrid>
      )}

      {oneTimeProducts.length > 0 && (
        <ProductsGrid title="Products" organization={organization}>
          {oneTimeProducts.map((product) => (
            <Link
              key={product.id}
              href={organizationPageLink(
                organization,
                `products/${product.id}`,
              )}
            >
              <ProductCard key={product.id} product={product} />
            </Link>
          ))}
        </ProductsGrid>
      )}
    </div>
  )
}
