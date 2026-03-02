import type { CheckoutProduct } from '@spaire/sdk/models/components/checkoutproduct'
import type { CheckoutPublic } from '@spaire/sdk/models/components/checkoutpublic'
import type { LegacyRecurringProductPrice } from '@spaire/sdk/models/components/legacyrecurringproductprice'
import type { ProductPrice } from '@spaire/sdk/models/components/productprice'

interface ProductCheckoutMixin {
  product_id: string
  product: CheckoutProduct
  productPriceId: string
  productPrice: ProductPrice | LegacyRecurringProductPrice | null
  prices: { [k: string]: Array<ProductPrice | LegacyRecurringProductPrice> }
}

export type ProductCheckoutPublic = CheckoutPublic & ProductCheckoutMixin

export const hasProductCheckout = (
  checkout: CheckoutPublic,
): checkout is ProductCheckoutPublic => {
  return checkout.product !== null && checkout.prices !== null
}
