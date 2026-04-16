import { isLegacyRecurringPrice } from '@/utils/product'
import { schemas } from '@spaire/client'
import { formatCurrency } from '@spaire/currency'
import AmountLabel from '../Shared/AmountLabel'

interface ProductPriceLabelProps {
  product:
    | schemas['Product']
    | schemas['ProductStorefront']
    | schemas['CheckoutProduct']
}

function isSeatBasedPrice(
  price: schemas['ProductPrice'],
): price is schemas['ProductPriceSeatBased'] {
  return price.amount_type === 'seat_based'
}

const ProductPriceLabel: React.FC<ProductPriceLabelProps> = ({
  product,
}: ProductPriceLabelProps) => {
  const staticPrice = product.prices.find(({ amount_type }) =>
    ['fixed', 'custom', 'free', 'seat_based'].includes(amount_type),
  )

  if (!staticPrice) {
    return null
  }

  if (staticPrice.amount_type === 'fixed') {
    const code = staticPrice.price_currency.toUpperCase()
    const formatted = formatCurrency('accounting')(
      staticPrice.price_amount,
      staticPrice.price_currency,
    )
    const interval = isLegacyRecurringPrice(staticPrice)
      ? staticPrice.recurring_interval
      : product.recurring_interval || undefined
    const intervalLabel = interval
      ? { month: '/ mo', year: '/ yr', week: '/ wk', day: '/ dy' }[interval] ?? ''
      : ''
    return (
      <span className="flex items-baseline gap-1">
        <span>{code} {formatted}</span>
        {intervalLabel && (
          <span className="dark:text-spaire-500 text-[0.5em] text-gray-500">{intervalLabel}</span>
        )}
      </span>
    )
  } else if (isSeatBasedPrice(staticPrice)) {
    const tiers = staticPrice.seat_tiers.tiers
    if (tiers.length > 0) {
      const code = staticPrice.price_currency.toUpperCase()
      const formatted = formatCurrency('accounting')(
        tiers[0].price_per_seat,
        staticPrice.price_currency,
      )
      return (
        <span className="flex items-baseline gap-1.5">
          {tiers.length > 1 && (
            <span className="dark:text-spaire-500 text-xs text-gray-500">From</span>
          )}
          <span>{code} {formatted}</span>
          <span className="dark:text-spaire-500 text-xs text-gray-500">/ seat</span>
        </span>
      )
    }
    return null
  } else if (staticPrice.amount_type === 'custom') {
    return <div className="text-[min(1em,24px)]">Pay what you want</div>
  } else {
    return <div className="text-[min(1em,24px)]">Free</div>
  }
}

export default ProductPriceLabel
