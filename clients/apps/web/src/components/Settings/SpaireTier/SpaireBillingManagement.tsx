'use client'

import { AddPaymentMethodModal } from '@/components/CustomerPortal/AddPaymentMethodModal'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { Section, SectionDescription } from '@/components/Settings/Section'
import {
  SpaireBillingAddress,
  SpaireOrder,
  SpairePaymentMethod,
  useCreateCustomerPortalSession,
  useDeleteSpairePaymentMethod,
  useGetSpaireOrderInvoice,
  useSetDefaultSpairePaymentMethod,
  useSpaireBillingDetails,
  useSpaireOrders,
  useSpairePaymentMethods,
  useUpdateSpaireBillingDetails,
} from '@/hooks/queries/spaireTier'
import { createClientSideAPI } from '@/utils/client'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CreditCardOutlined from '@mui/icons-material/CreditCardOutlined'
import DownloadOutlined from '@mui/icons-material/DownloadOutlined'
import { enums, schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import CountryPicker from '@spaire/ui/components/atoms/CountryPicker'
import Input from '@spaire/ui/components/atoms/Input'
import Pill from '@spaire/ui/components/atoms/Pill'
import { getThemePreset } from '@spaire/ui/hooks/theming'
import { useMemo, useState } from 'react'

const formatCurrency = (amountCents: number, currency: string): string => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amountCents / 100)
  } catch {
    return `$${(amountCents / 100).toFixed(2)}`
  }
}

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

const statusPillColor = (
  status: string,
): 'green' | 'yellow' | 'purple' | 'gray' => {
  if (status === 'paid') return 'green'
  if (status === 'pending') return 'yellow'
  if (status === 'refunded' || status === 'partially_refunded') return 'purple'
  return 'gray'
}

const cardLabel = (pm: SpairePaymentMethod): string => {
  if (pm.type !== 'card') return pm.type.replace(/_/g, ' ')
  const brand = pm.method_metadata.brand ?? 'card'
  const last4 = pm.method_metadata.last4 ?? '••••'
  return `${brand.charAt(0).toUpperCase()}${brand.slice(1)} ending in ${last4}`
}

const cardExpiry = (pm: SpairePaymentMethod): string | null => {
  const { exp_month, exp_year } = pm.method_metadata
  if (!exp_month || !exp_year) return null
  return `Expires ${String(exp_month).padStart(2, '0')}/${String(exp_year).slice(-2)}`
}

const PaymentMethodRow = ({
  organizationId,
  paymentMethod,
  isDefault,
  canManage,
}: {
  organizationId: string
  paymentMethod: SpairePaymentMethod
  isDefault: boolean
  canManage: boolean
}) => {
  const setDefault = useSetDefaultSpairePaymentMethod(organizationId)
  const remove = useDeleteSpairePaymentMethod(organizationId)

  const onRemove = async () => {
    if (!window.confirm('Remove this card? You can add it back any time.'))
      return
    try {
      await remove.mutateAsync(paymentMethod.id)
    } catch (e) {
      window.alert(
        e instanceof Error ? e.message : 'Could not remove the card.',
      )
    }
  }

  return (
    <div className="flex flex-col gap-y-4 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-row items-center gap-x-3">
        <CreditCardOutlined
          className="text-gray-400"
          style={{ fontSize: 20 }}
        />
        <div>
          <div className="flex flex-row items-center gap-x-2">
            <span className="text-sm font-medium text-gray-900">
              {cardLabel(paymentMethod)}
            </span>
            {isDefault && <Pill color="green">Default</Pill>}
          </div>
          {cardExpiry(paymentMethod) && (
            <span className="text-xs text-gray-500">
              {cardExpiry(paymentMethod)}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-row items-center gap-x-2">
        {canManage && !isDefault && (
          <Button
            variant="ghost"
            size="sm"
            loading={setDefault.isPending}
            onClick={() => setDefault.mutate(paymentMethod.id)}
          >
            Make default
          </Button>
        )}
        {canManage && (
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600"
            loading={remove.isPending}
            onClick={onRemove}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  )
}

const BillingAddressForm = ({
  organizationId,
  initial,
  onDone,
}: {
  organizationId: string
  initial: {
    billing_name: string | null
    billing_address: SpaireBillingAddress | null
    tax_id: [string, string] | null
  }
  onDone: () => void
}) => {
  const update = useUpdateSpaireBillingDetails(organizationId)
  const [billingName, setBillingName] = useState(initial.billing_name ?? '')
  const [line1, setLine1] = useState(initial.billing_address?.line1 ?? '')
  const [line2, setLine2] = useState(initial.billing_address?.line2 ?? '')
  const [city, setCity] = useState(initial.billing_address?.city ?? '')
  const [postalCode, setPostalCode] = useState(
    initial.billing_address?.postal_code ?? '',
  )
  const [state, setState] = useState(initial.billing_address?.state ?? '')
  const [country, setCountry] = useState(
    initial.billing_address?.country ?? 'US',
  )
  const [taxId, setTaxId] = useState(initial.tax_id?.[0] ?? '')
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!country) {
      setError('Country is required.')
      return
    }
    try {
      await update.mutateAsync({
        billing_name: billingName || null,
        billing_address: {
          line1: line1 || null,
          line2: line2 || null,
          city: city || null,
          postal_code: postalCode || null,
          state: state || null,
          country,
        },
        tax_id: taxId || null,
      })
      onDone()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save your billing address.',
      )
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-y-4 p-6">
      <h2 className="text-lg font-medium text-gray-900">Billing address</h2>
      <Input
        placeholder="Name on invoice"
        value={billingName}
        onChange={(e) => setBillingName(e.target.value)}
      />
      <Input
        placeholder="Address line 1"
        value={line1}
        onChange={(e) => setLine1(e.target.value)}
      />
      <Input
        placeholder="Address line 2 (optional)"
        value={line2}
        onChange={(e) => setLine2(e.target.value)}
      />
      <div className="flex flex-col gap-4 sm:flex-row">
        <Input
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <Input
          placeholder="Postal code"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="w-full">
          <CountryPicker
            allowedCountries={enums.addressInputCountryValues}
            value={country}
            onChange={setCountry}
          />
        </div>
        <Input
          placeholder="State / Province (optional)"
          value={state}
          onChange={(e) => setState(e.target.value)}
        />
      </div>
      <Input
        placeholder="Tax ID (optional)"
        value={taxId}
        onChange={(e) => setTaxId(e.target.value)}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex flex-row items-center gap-x-2">
        <Button type="submit" loading={update.isPending}>
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

const OrderRow = ({
  organizationId,
  order,
}: {
  organizationId: string
  order: SpaireOrder
}) => {
  const getInvoice = useGetSpaireOrderInvoice(organizationId)
  const refunded =
    order.refunded_amount >= order.total_amount && order.total_amount > 0

  const onDownload = async () => {
    try {
      const { url } = await getInvoice.mutateAsync(order.id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      window.alert(
        e instanceof Error
          ? e.message
          : 'Invoice is not ready yet, try again shortly.',
      )
    }
  }

  return (
    <div className="flex flex-row items-center justify-between gap-x-4 px-4 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-gray-900">
          {order.description}
        </span>
        <span className="text-xs text-gray-500">
          {formatDate(order.created_at)} ·{' '}
          {order.invoice_number ?? order.id.slice(0, 8)}
        </span>
      </div>
      <div className="flex flex-row items-center gap-x-3">
        <Pill color={statusPillColor(order.status)}>
          {order.status.replace(/_/g, ' ')}
        </Pill>
        <span
          className={
            refunded
              ? 'text-sm text-gray-400 line-through'
              : 'text-sm font-medium text-gray-900'
          }
        >
          {formatCurrency(order.total_amount, order.currency)}
        </span>
        {order.is_invoice_generated && (
          <Button
            variant="ghost"
            size="icon"
            loading={getInvoice.isPending}
            onClick={onDownload}
            title="Download invoice"
          >
            <DownloadOutlined style={{ fontSize: 18 }} />
          </Button>
        )}
      </div>
    </div>
  )
}

const EmptyState = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
    {children}
  </div>
)

export default function SpaireBillingManagement({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const orgId = organization.id

  const { data: paymentMethods, isLoading: pmLoading } =
    useSpairePaymentMethods(orgId)
  const { data: orders } = useSpaireOrders(orgId)
  const { data: billingDetails } = useSpaireBillingDetails(orgId)

  const createSession = useCreateCustomerPortalSession(orgId)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const addCardModal = useModal()
  const editAddressModal = useModal()

  const themePreset = useMemo(
    () => getThemePreset(organization.slug, 'light'),
    [organization.slug],
  )
  const sessionApi = useMemo(
    () => createClientSideAPI(sessionToken ?? undefined),
    [sessionToken],
  )

  const cards = paymentMethods?.items ?? []
  const defaultId = billingDetails?.default_payment_method_id ?? null
  const canManageCards = cards.length > 1
  const address = billingDetails?.billing_address ?? null
  const hasAddress = Boolean(
    billingDetails?.billing_name ||
    address?.line1 ||
    address?.city ||
    address?.country,
  )
  const orderItems = orders?.items ?? []

  const onAddCard = async () => {
    try {
      const session = await createSession.mutateAsync({})
      setSessionToken(session.token)
      addCardModal.show()
    } catch (e) {
      window.alert(
        e instanceof Error ? e.message : 'Could not start adding a card.',
      )
    }
  }

  return (
    <div className="flex flex-col gap-y-12">
      {/* Payment methods */}
      <Section id="payment-methods">
        <div className="flex flex-row items-start justify-between gap-x-4">
          <SectionDescription
            title="Payment methods"
            description="Cards used to pay for your Spaire subscription."
          />
          <Button
            variant="secondary"
            wrapperClassNames="flex flex-row items-center gap-x-1"
            loading={createSession.isPending}
            onClick={onAddCard}
          >
            <AddOutlined style={{ fontSize: 16 }} />
            Add card
          </Button>
        </div>
        {pmLoading ? (
          <div className="h-20 animate-pulse rounded-2xl bg-gray-100" />
        ) : cards.length === 0 ? (
          <EmptyState>No payment methods on file.</EmptyState>
        ) : (
          <div className="flex flex-col gap-y-3">
            {cards.map((pm) => (
              <PaymentMethodRow
                key={pm.id}
                organizationId={orgId}
                paymentMethod={pm}
                isDefault={pm.id === defaultId}
                canManage={canManageCards}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Billing address */}
      <Section id="billing-address">
        <div className="flex flex-row items-start justify-between gap-x-4">
          <SectionDescription
            title="Billing address"
            description="Used on invoices for your Spaire subscription."
          />
          <Button variant="secondary" onClick={editAddressModal.show}>
            {hasAddress ? 'Edit' : 'Add address'}
          </Button>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          {hasAddress ? (
            <div className="flex flex-col gap-y-0.5 text-sm text-gray-700">
              {billingDetails?.billing_name && (
                <span className="font-medium text-gray-900">
                  {billingDetails.billing_name}
                </span>
              )}
              {address?.line1 && <span>{address.line1}</span>}
              {address?.line2 && <span>{address.line2}</span>}
              <span>
                {[address?.postal_code, address?.city]
                  .filter(Boolean)
                  .join(' ')}
              </span>
              <span>
                {[address?.state, address?.country].filter(Boolean).join(', ')}
              </span>
              {billingDetails?.tax_id && (
                <span className="mt-1 text-gray-500">
                  Tax ID: {billingDetails.tax_id[0]}
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No billing address on file.</p>
          )}
        </div>
      </Section>

      {/* Order history */}
      <Section id="orders">
        <SectionDescription
          title="Order history"
          description="Past invoices for your Spaire subscription."
        />
        {orderItems.length === 0 ? (
          <EmptyState>No orders yet.</EmptyState>
        ) : (
          <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {orderItems.map((order) => (
              <OrderRow key={order.id} organizationId={orgId} order={order} />
            ))}
          </div>
        )}
      </Section>

      <Modal
        title="Add card"
        isShown={addCardModal.isShown}
        hide={addCardModal.hide}
        modalContent={
          <AddPaymentMethodModal
            api={sessionApi}
            onPaymentMethodAdded={() => {
              setSessionToken(null)
              addCardModal.hide()
            }}
            hide={addCardModal.hide}
            themePreset={themePreset}
          />
        }
      />

      <Modal
        title="Billing address"
        isShown={editAddressModal.isShown}
        hide={editAddressModal.hide}
        modalContent={
          <BillingAddressForm
            organizationId={orgId}
            initial={{
              billing_name: billingDetails?.billing_name ?? null,
              billing_address: address,
              tax_id: billingDetails?.tax_id ?? null,
            }}
            onDone={editAddressModal.hide}
          />
        }
      />
    </div>
  )
}
