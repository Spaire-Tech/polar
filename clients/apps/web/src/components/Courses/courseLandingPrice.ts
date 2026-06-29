import type { schemas } from '@spaire/client'

// Single source for the course landing price label, shared by the public
// landing (PublicPortalView) and the dashboard editor (CourseDesignEditor).
// Previously each surface had its own formatter, so the editor could quote a
// different string than the page buyers saw.
export function formatProductPrice(
  product: schemas['Product'] | undefined,
): string {
  if (!product) return ''
  const fixed = product.prices.find((p) => p.amount_type === 'fixed')
  if (!fixed || !('price_amount' in fixed)) {
    const free = product.prices.find((p) => p.amount_type === 'free')
    if (free) return 'Free'
    const custom = product.prices.find((p) => p.amount_type === 'custom')
    if (custom) return 'Pay what you want'
    return ''
  }
  const cents = fixed.price_amount as number
  const dollars = cents / 100
  if (dollars === Math.floor(dollars)) return `$${dollars.toFixed(0)}`
  return `$${dollars.toFixed(2)}`
}

// Whether the product's active price recurs (subscription) vs one-time.
export function isRecurringProduct(
  product: schemas['Product'] | undefined,
): boolean {
  if (!product) return false
  return product.prices.some(
    (p) => (p as { type?: string }).type === 'recurring',
  )
}
