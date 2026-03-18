import { Hr, Preview, Section, Text } from '@react-email/components'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
import WrapperOrganization from '../components/WrapperOrganization'
import { organization } from '../preview'
import type { schemas } from '../types'

function fmt(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(cents / 100)
}

export function ClientInvoice({
  email,
  organization_name,
  customer_name,
  invoice_id,
  due_date,
  currency,
  line_items,
  subtotal_amount,
  discount_amount,
  discount_label,
  tax_amount,
  total_amount,
  checkout_link,
  memo,
}: schemas['ClientInvoiceEmailProps']) {
  return (
    <WrapperOrganization organization={{ ...organization, name: organization_name } as any}>
      <Preview>
        Invoice {invoice_id} from {organization_name} — {fmt(total_amount, currency)} due{due_date ? ` ${due_date}` : ''}
      </Preview>

      <Section>
        <Text className="text-2xl font-semibold text-gray-900">
          You have a new invoice
        </Text>
        <Text className="text-gray-600">
          Hi {customer_name}, {organization_name} has sent you an invoice.
        </Text>
      </Section>

      {/* Invoice details */}
      <Section className="rounded-lg border border-gray-200 bg-gray-50 p-6">
        <Text className="m-0 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Invoice #{invoice_id}
        </Text>
        {due_date && (
          <Text className="mt-1 text-sm text-gray-500">Due {due_date}</Text>
        )}

        <Hr className="my-4 border-gray-200" />

        {/* Line items */}
        {line_items.map((item, i) => (
          <Section key={i} className="flex justify-between">
            <Text className="m-0 flex-1 text-sm text-gray-700">
              {item.description}
              {item.quantity > 1 ? ` × ${item.quantity}` : ''}
            </Text>
            <Text className="m-0 text-sm text-gray-700">
              {fmt(item.amount, currency)}
            </Text>
          </Section>
        ))}

        <Hr className="my-4 border-gray-200" />

        {/* Totals */}
        <Section className="flex justify-between">
          <Text className="m-0 text-sm text-gray-500">Subtotal</Text>
          <Text className="m-0 text-sm text-gray-500">
            {fmt(subtotal_amount, currency)}
          </Text>
        </Section>
        {discount_amount > 0 && (
          <Section className="flex justify-between">
            <Text className="m-0 text-sm text-gray-500">
              {discount_label ?? 'Discount'}
            </Text>
            <Text className="m-0 text-sm text-gray-500">
              -{fmt(discount_amount, currency)}
            </Text>
          </Section>
        )}
        {tax_amount > 0 && (
          <Section className="flex justify-between">
            <Text className="m-0 text-sm text-gray-500">Tax</Text>
            <Text className="m-0 text-sm text-gray-500">
              {fmt(tax_amount, currency)}
            </Text>
          </Section>
        )}
        <Section className="flex justify-between border-t border-gray-200 pt-3">
          <Text className="m-0 font-semibold text-gray-900">Total due</Text>
          <Text className="m-0 font-semibold text-gray-900">
            {fmt(total_amount, currency)}
          </Text>
        </Section>
      </Section>

      {/* CTA */}
      {checkout_link && (
        <Section className="mt-6 text-center">
          <Button href={checkout_link}>Pay invoice</Button>
        </Section>
      )}

      {/* Memo */}
      {memo && (
        <Section className="mt-6 rounded-lg bg-gray-50 p-4">
          <Text className="m-0 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Note
          </Text>
          <Text className="mt-1 text-sm text-gray-600">{memo}</Text>
        </Section>
      )}

      <Hr className="mt-8" />
      <FooterCustomer
        organization={{ ...organization, name: organization_name } as any}
        email={email}
      />
    </WrapperOrganization>
  )
}

ClientInvoice.PreviewProps = {
  email: 'customer@example.com',
  organization_name: 'Acme Inc.',
  customer_name: 'John Doe',
  invoice_id: 'ABC12345',
  due_date: '2026-04-17',
  currency: 'USD',
  line_items: [
    { description: 'Consulting', quantity: 1, amount: 150000 },
    { description: 'Setup fee', quantity: 1, amount: 50000 },
  ],
  subtotal_amount: 200000,
  discount_amount: 0,
  discount_label: null,
  tax_amount: 14000,
  total_amount: 214000,
  checkout_link: 'https://app.spairehq.com/checkout/abc123',
  memo: 'Thank you for your business.',
}

export default ClientInvoice
