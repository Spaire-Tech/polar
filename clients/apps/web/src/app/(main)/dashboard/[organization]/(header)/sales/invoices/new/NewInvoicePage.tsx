'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Section } from '@/components/Layout/Section'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { CreateCustomerModal } from '@/components/Customer/CreateCustomerModal'
import CreateDiscountModalContent from '@/components/Discounts/CreateDiscountModalContent'
import { CreateProductPage } from '@/components/Products/CreateProductPage'
import { toast } from '@/components/Toast/use-toast'
import {
  useCustomers,
  useDiscounts,
  useProducts,
} from '@/hooks/queries'
import {
  ClientInvoiceCreate,
  useCreateClientInvoice,
} from '@/hooks/queries/client_invoices'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import Search from '@mui/icons-material/Search'
import { schemas } from '@spaire/client'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import Button from '@spaire/ui/components/atoms/Button'
import Input from '@spaire/ui/components/atoms/Input'
import ShadowBox from '@spaire/ui/components/atoms/ShadowBox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@spaire/ui/components/ui/form'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@spaire/ui/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@spaire/ui/components/ui/command'
import { formatCurrency } from '@spaire/currency'
import { addDays, format } from 'date-fns'
import { useRouter } from 'next/navigation'
import React, { useMemo, useRef, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'

// All 35 supported currencies
const SUPPORTED_CURRENCIES = [
  { value: 'usd', label: 'USD — US Dollar' },
  { value: 'eur', label: 'EUR — Euro' },
  { value: 'gbp', label: 'GBP — British Pound' },
  { value: 'aed', label: 'AED — UAE Dirham' },
  { value: 'ars', label: 'ARS — Argentine Peso' },
  { value: 'aud', label: 'AUD — Australian Dollar' },
  { value: 'brl', label: 'BRL — Brazilian Real' },
  { value: 'cad', label: 'CAD — Canadian Dollar' },
  { value: 'chf', label: 'CHF — Swiss Franc' },
  { value: 'clp', label: 'CLP — Chilean Peso' },
  { value: 'cny', label: 'CNY — Chinese Yuan' },
  { value: 'cop', label: 'COP — Colombian Peso' },
  { value: 'czk', label: 'CZK — Czech Koruna' },
  { value: 'dkk', label: 'DKK — Danish Krone' },
  { value: 'hkd', label: 'HKD — Hong Kong Dollar' },
  { value: 'huf', label: 'HUF — Hungarian Forint' },
  { value: 'idr', label: 'IDR — Indonesian Rupiah' },
  { value: 'ils', label: 'ILS — Israeli Shekel' },
  { value: 'inr', label: 'INR — Indian Rupee' },
  { value: 'jpy', label: 'JPY — Japanese Yen' },
  { value: 'krw', label: 'KRW — South Korean Won' },
  { value: 'mxn', label: 'MXN — Mexican Peso' },
  { value: 'myr', label: 'MYR — Malaysian Ringgit' },
  { value: 'nok', label: 'NOK — Norwegian Krone' },
  { value: 'nzd', label: 'NZD — New Zealand Dollar' },
  { value: 'pen', label: 'PEN — Peruvian Sol' },
  { value: 'php', label: 'PHP — Philippine Peso' },
  { value: 'pln', label: 'PLN — Polish Zloty' },
  { value: 'ron', label: 'RON — Romanian Leu' },
  { value: 'sar', label: 'SAR — Saudi Riyal' },
  { value: 'sek', label: 'SEK — Swedish Krona' },
  { value: 'sgd', label: 'SGD — Singapore Dollar' },
  { value: 'thb', label: 'THB — Thai Baht' },
  { value: 'try', label: 'TRY — Turkish Lira' },
  { value: 'twd', label: 'TWD — Taiwan Dollar' },
  { value: 'zar', label: 'ZAR — South African Rand' },
]

const NET_OPTIONS = [
  { label: 'Net 7', days: 7 },
  { label: 'Net 15', days: 15 },
  { label: 'Net 30', days: 30 },
  { label: 'Net 60', days: 60 },
]

function getPriceForCurrency(
  product: schemas['Product'],
  currency: string,
): number {
  const prices = product.prices ?? []
  // Find a matching fixed price for the selected currency
  const match = prices.find(
    (p) =>
      'price_currency' in p &&
      (p as any).price_currency === currency.toLowerCase() &&
      'price_amount' in p &&
      typeof (p as any).price_amount === 'number',
  )
  if (match) return (match as any).price_amount as number
  // Fallback: any price with price_amount
  const fallback = prices.find(
    (p) => 'price_amount' in p && typeof (p as any).price_amount === 'number',
  )
  if (fallback) return (fallback as any).price_amount as number
  return 0
}

function computeDiscountCents(
  discount: schemas['Discount'],
  subtotalCents: number,
): number {
  if (discount.type === 'fixed') {
    return (discount as any).amount ?? 0
  }
  // percentage: basis_points e.g. 1000 = 10%
  return Math.round((subtotalCents * ((discount as any).basis_points ?? 0)) / 10000)
}

interface LineItemFormValue {
  product_id: string | null
  description: string
  quantity: number
  unit_amount: string // display value in major currency units (e.g. dollars)
}

interface InvoiceFormValues {
  customer_id: string
  currency: string
  line_items: LineItemFormValue[]
  due_date: string
  memo: string
  po_number: string
  on_behalf_of_label: string
  include_payment_link: boolean
}

interface NewInvoicePageProps {
  organization: schemas['Organization']
}

const NewInvoicePage: React.FC<NewInvoicePageProps> = ({ organization }) => {
  const router = useRouter()
  const createInvoice = useCreateClientInvoice(organization.id)

  const {
    isShown: isCustomerModalShown,
    show: showCustomerModal,
    hide: hideCustomerModal,
  } = useModal()
  const {
    isShown: isProductModalShown,
    show: showProductModal,
    hide: hideProductModal,
  } = useModal()
  const {
    isShown: isDiscountModalShown,
    show: showDiscountModal,
    hide: hideDiscountModal,
  } = useModal()

  // Selected discount (stores the full discount object for amount computation)
  const [selectedDiscount, setSelectedDiscount] =
    useState<schemas['Discount'] | null>(null)

  // Customer search state
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false)
  const [selectedCustomerLabel, setSelectedCustomerLabel] = useState('')
  const customerInputRef = useRef<HTMLInputElement>(null)

  const { data: customersData } = useCustomers(organization.id, {
    query: customerQuery || undefined,
    sorting: ['-created_at'],
  })
  const allCustomers = useMemo(
    () => customersData?.pages.flatMap((p) => p.items) ?? [],
    [customersData],
  )

  // Products
  const { data: productsData } = useProducts(organization.id)
  const allProducts = useMemo(
    () => productsData?.items ?? [],
    [productsData],
  )

  // Discounts
  const { data: discountsData } = useDiscounts(organization.id)
  const allDiscounts = useMemo(
    () => discountsData?.items ?? [],
    [discountsData],
  )

  const form = useForm<InvoiceFormValues>({
    defaultValues: {
      customer_id: '',
      currency: organization.default_presentment_currency ?? 'usd',
      line_items: [
        { product_id: null, description: '', quantity: 1, unit_amount: '' },
      ],
      due_date: '',
      memo: '',
      po_number: '',
      on_behalf_of_label: '',
      include_payment_link: true,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'line_items',
  })

  const currency = form.watch('currency')
  const lineItems = form.watch('line_items')

  const subtotalCents = lineItems.reduce((sum, item) => {
    const unitCents = Math.round((parseFloat(item.unit_amount) || 0) * 100)
    return sum + unitCents * (Number(item.quantity) || 1)
  }, 0)

  const discountCents = selectedDiscount
    ? computeDiscountCents(selectedDiscount, subtotalCents)
    : 0

  const totalCents = Math.max(0, subtotalCents - discountCents)

  const handleSubmit = async (values: InvoiceFormValues) => {
    if (!values.customer_id) {
      form.setError('customer_id', { message: 'Please select a customer' })
      return
    }
    if (values.line_items.some((item) => !item.description)) {
      toast({ title: 'Each item needs a description' })
      return
    }

    const body: ClientInvoiceCreate = {
      customer_id: values.customer_id,
      currency: values.currency,
      line_items: values.line_items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unit_amount: Math.round((parseFloat(item.unit_amount) || 0) * 100),
      })),
      due_date: values.due_date || null,
      memo: values.memo || null,
      po_number: values.po_number || null,
      on_behalf_of_label: values.on_behalf_of_label || null,
      discount_amount: discountCents,
      discount_label: selectedDiscount?.name ?? null,
      include_payment_link: values.include_payment_link,
    }

    try {
      const invoice = await createInvoice.mutateAsync(body)
      toast({ title: 'Invoice created' })
      router.push(
        `/dashboard/${organization.slug}/sales/invoices/${invoice.id}`,
      )
    } catch (err: any) {
      toast({
        title: 'Failed to create invoice',
        description: err?.detail ?? String(err),
      })
    }
  }

  return (
    <DashboardBody
      wrapperClassName="max-w-(--breakpoint-xl)!"
      title={
        <div className="flex flex-col gap-1">
          <span className="text-xl font-medium dark:text-white">
            Create and send invoices in minutes
          </span>
          <p className="text-sm font-normal text-gray-500 dark:text-gray-400">
            Send an invoice with a link to pay online. Accept cards, bank
            transfers, and more.
          </p>
        </div>
      }
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col gap-8 lg:flex-row lg:items-start"
        >
          {/* ── Left: form sections ── */}
          <div className="dark:border-spaire-700 dark:divide-spaire-700 flex flex-1 flex-col divide-y divide-gray-200 rounded-4xl border border-gray-200">

            {/* Customer */}
            <Section
              compact
              title="Customer"
              description="Select the customer to invoice."
            >
              <div className="flex flex-col gap-3">
                <FormField
                  control={form.control}
                  name="customer_id"
                  rules={{ required: 'Please select a customer' }}
                  render={({ field }) => (
                    <FormItem>
                      <Popover
                        open={customerPopoverOpen}
                        onOpenChange={setCustomerPopoverOpen}
                      >
                        <PopoverTrigger asChild>
                          <div>
                            <Input
                              ref={customerInputRef}
                              placeholder="Search customers..."
                              value={
                                field.value
                                  ? selectedCustomerLabel
                                  : customerQuery
                              }
                              onChange={(e) => {
                                if (field.value) {
                                  field.onChange('')
                                  setSelectedCustomerLabel('')
                                }
                                setCustomerQuery(e.target.value)
                                setCustomerPopoverOpen(true)
                              }}
                              onFocus={() => setCustomerPopoverOpen(true)}
                              preSlot={<Search fontSize="small" />}
                            />
                          </div>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-80 overflow-hidden p-0"
                          align="start"
                          onOpenAutoFocus={(e) => e.preventDefault()}
                          onInteractOutside={() =>
                            setCustomerPopoverOpen(false)
                          }
                        >
                          <div className="max-h-60 overflow-y-auto">
                            {allCustomers.length > 0 ? (
                              allCustomers.map((customer) => (
                                <button
                                  key={customer.id}
                                  type="button"
                                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                    field.onChange(customer.id)
                                    setSelectedCustomerLabel(
                                      customer.name ?? customer.email,
                                    )
                                    setCustomerPopoverOpen(false)
                                  }}
                                >
                                  <Avatar
                                    className="size-7 shrink-0"
                                    avatar_url={customer.avatar_url}
                                    name={customer.name || customer.email}
                                  />
                                  <div className="flex min-w-0 flex-col">
                                    <span className="truncate font-medium">
                                      {customer.name ?? customer.email}
                                    </span>
                                    {customer.name && (
                                      <span className="truncate text-xs text-gray-500">
                                        {customer.email}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="py-6 text-center text-sm text-gray-500">
                                No customers found
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start gap-1 text-blue-500"
                  onClick={showCustomerModal}
                >
                  <AddOutlined fontSize="small" />
                  New customer
                </Button>
              </div>
            </Section>

            {/* Currency */}
            <Section
              compact
              title="Currency"
              description="All line items will be billed in this currency."
            >
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <select
                        {...field}
                        className="dark:bg-spaire-900 dark:border-spaire-700 w-full max-w-xs rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none"
                      >
                        {SUPPORTED_CURRENCIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                  </FormItem>
                )}
              />
            </Section>

            {/* Line Items */}
            <Section
              compact
              title="Items"
              description="Add products or custom line items."
              cta={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-blue-500"
                  onClick={showProductModal}
                >
                  <AddOutlined fontSize="small" />
                  New product
                </Button>
              }
            >
              <div className="flex flex-col gap-4">
                {/* Header row */}
                <div className="hidden grid-cols-[2fr_80px_110px_32px] gap-3 text-xs text-gray-400 dark:text-gray-500 sm:grid">
                  <span>Product / Description</span>
                  <span className="text-center">Qty</span>
                  <span className="text-right">
                    Unit price ({currency.toUpperCase()})
                  </span>
                  <span />
                </div>

                {fields.map((field, index) => (
                  <LineItemRow
                    key={field.id}
                    index={index}
                    form={form}
                    products={allProducts}
                    currency={currency}
                    onRemove={() => remove(index)}
                    canRemove={fields.length > 1}
                  />
                ))}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start gap-1 text-blue-500"
                  onClick={() =>
                    append({
                      product_id: null,
                      description: '',
                      quantity: 1,
                      unit_amount: '',
                    })
                  }
                >
                  <AddOutlined fontSize="small" />
                  Add item
                </Button>
              </div>
            </Section>

            {/* Discount */}
            <Section
              compact
              title="Discount"
              description="Apply an existing discount or create a new one."
              cta={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-blue-500"
                  onClick={showDiscountModal}
                >
                  <AddOutlined fontSize="small" />
                  New discount
                </Button>
              }
            >
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="dark:border-spaire-700 w-full max-w-xs justify-start border border-gray-200"
                  >
                    {selectedDiscount ? (
                      <span>{selectedDiscount.name}</span>
                    ) : (
                      <span className="text-gray-400">Select discount…</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search discounts…" />
                    <CommandList>
                      <CommandEmpty>No discounts found.</CommandEmpty>
                      <CommandGroup>
                        {selectedDiscount && (
                          <CommandItem
                            onSelect={() => setSelectedDiscount(null)}
                            className="text-red-500"
                          >
                            Remove discount
                          </CommandItem>
                        )}
                        {allDiscounts.map((d) => (
                          <CommandItem
                            key={d.id}
                            onSelect={() => setSelectedDiscount(d)}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{d.name}</span>
                              <span className="text-xs text-gray-500">
                                {d.type === 'percentage'
                                  ? `${(((d as any).basis_points ?? 0) / 100).toFixed(0)}% off`
                                  : formatCurrency('compact')(
                                      (d as any).amount ?? 0,
                                      (d as any).currency ?? currency,
                                    ) + ' off'}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {selectedDiscount && (
                <p className="text-sm text-green-600 dark:text-green-400">
                  {selectedDiscount.name} applied —{' '}
                  {discountCents > 0 &&
                    `−${formatCurrency('compact')(discountCents, currency)}`}
                </p>
              )}
            </Section>

            {/* Invoice Details */}
            <Section
              compact
              title="Invoice Details"
              description="Due date, notes, and other invoice settings."
            >
              <div className="flex flex-col gap-6">
                {/* Due date */}
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment due</FormLabel>
                      <div className="flex flex-wrap gap-2">
                        {NET_OPTIONS.map((opt) => (
                          <Button
                            key={opt.label}
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              field.onChange(
                                format(addDays(new Date(), opt.days), 'yyyy-MM-dd'),
                              )
                            }
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                      <FormControl>
                        <Input {...field} type="date" className="max-w-xs" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Memo */}
                <FormField
                  control={form.control}
                  name="memo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes / Memo</FormLabel>
                      <FormControl>
                        <textarea
                          {...field}
                          rows={3}
                          placeholder="Add a note visible on the invoice…"
                          className="dark:bg-spaire-900 dark:border-spaire-700 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* PO Number */}
                <FormField
                  control={form.control}
                  name="po_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PO Number</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Purchase order number"
                          className="max-w-xs"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* On behalf of */}
                <FormField
                  control={form.control}
                  name="on_behalf_of_label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>On behalf of (optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={organization.name}
                          className="max-w-xs"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Include payment link */}
                <FormField
                  control={form.control}
                  name="include_payment_link"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-3">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </FormControl>
                      <FormLabel className="m-0 cursor-pointer text-sm font-normal">
                        Include payment link in invoice email
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </Section>
          </div>

          {/* ── Right: summary + submit ── */}
          <div className="w-full lg:w-72">
            <div className="sticky top-8 flex flex-col gap-4">
              <ShadowBox className="flex flex-col gap-3 text-sm">
                <h3 className="font-medium dark:text-white">Summary</h3>
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>Subtotal</span>
                  <span>{formatCurrency('compact')(subtotalCents, currency)}</span>
                </div>
                {discountCents > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>{selectedDiscount?.name ?? 'Discount'}</span>
                    <span>
                      −{formatCurrency('compact')(discountCents, currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-gray-400 dark:text-gray-500">
                  <span>Tax</span>
                  <span>Calculated on send</span>
                </div>
                <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
                  <div className="flex justify-between font-semibold dark:text-white">
                    <span>Total (excl. tax)</span>
                    <span>{formatCurrency('compact')(totalCents, currency)}</span>
                  </div>
                </div>
              </ShadowBox>

              <Button
                type="submit"
                className="w-full"
                loading={createInvoice.isPending}
              >
                Create Draft Invoice
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() =>
                  router.push(
                    `/dashboard/${organization.slug}/sales/invoices`,
                  )
                }
              >
                Cancel
              </Button>
            </div>
          </div>
        </form>
      </Form>

      {/* ── Side panel modals ── */}
      <InlineModal
        isShown={isCustomerModalShown}
        hide={hideCustomerModal}
        className="md:w-[540px]"
        modalContent={
          <CreateCustomerModal
            organization={organization}
            onClose={hideCustomerModal}
          />
        }
      />

      <InlineModal
        isShown={isProductModalShown}
        hide={hideProductModal}
        className="md:w-[720px]"
        modalContent={
          <CreateProductPage
            organization={organization}
            panelMode={true}
            onClose={hideProductModal}
          />
        }
      />

      <InlineModal
        isShown={isDiscountModalShown}
        hide={hideDiscountModal}
        className="md:w-[540px]"
        modalContent={
          <CreateDiscountModalContent
            organization={organization}
            onDiscountCreated={(discount) => {
              setSelectedDiscount(discount)
              hideDiscountModal()
            }}
            hideModal={hideDiscountModal}
          />
        }
      />
    </DashboardBody>
  )
}

// ── LineItemRow ──────────────────────────────────────────────────────────────

interface LineItemRowProps {
  index: number
  form: ReturnType<typeof useForm<InvoiceFormValues>>
  products: schemas['Product'][]
  currency: string
  onRemove: () => void
  canRemove: boolean
}

const LineItemRow: React.FC<LineItemRowProps> = ({
  index,
  form,
  products,
  currency,
  onRemove,
  canRemove,
}) => {
  const [productOpen, setProductOpen] = useState(false)
  const [productQuery, setProductQuery] = useState('')

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productQuery.toLowerCase()),
  )

  const handleSelectProduct = (product: schemas['Product']) => {
    const price = getPriceForCurrency(product, currency)
    form.setValue(`line_items.${index}.product_id`, product.id)
    form.setValue(`line_items.${index}.description`, product.name)
    form.setValue(
      `line_items.${index}.unit_amount`,
      price > 0 ? (price / 100).toString() : '',
    )
    setProductOpen(false)
  }

  return (
    <div className="grid grid-cols-[2fr_80px_110px_32px] items-start gap-3">
      {/* Product / description */}
      <div className="flex flex-col gap-1">
        <Popover open={productOpen} onOpenChange={setProductOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="dark:border-spaire-700 w-full justify-start border border-gray-200 font-normal"
            >
              <span className="truncate">
                {form.watch(`line_items.${index}.description`) ||
                  'Select product…'}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search products…"
                value={productQuery}
                onValueChange={setProductQuery}
              />
              <CommandList>
                <CommandEmpty>
                  No products found.
                </CommandEmpty>
                <CommandGroup>
                  {filteredProducts.map((product) => (
                    <CommandItem
                      key={product.id}
                      onSelect={() => handleSelectProduct(product)}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{product.name}</span>
                        <span className="text-xs text-gray-500">
                          {(() => {
                            const price = getPriceForCurrency(product, currency)
                            return price > 0
                              ? formatCurrency('compact')(price, currency)
                              : 'Custom price'
                          })()}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Editable description (shown after product selected or as free text) */}
        <FormField
          control={form.control}
          name={`line_items.${index}.description`}
          rules={{ required: 'Description required' }}
          render={({ field }) => (
            <FormItem className="m-0">
              <FormControl>
                <Input
                  {...field}
                  placeholder="Or type description…"
                  className="text-sm"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Quantity */}
      <FormField
        control={form.control}
        name={`line_items.${index}.quantity`}
        render={({ field }) => (
          <FormItem className="m-0">
            <FormControl>
              <Input
                {...field}
                type="number"
                min={1}
                className="text-center"
              />
            </FormControl>
          </FormItem>
        )}
      />

      {/* Unit amount */}
      <FormField
        control={form.control}
        name={`line_items.${index}.unit_amount`}
        rules={{ required: 'Required', min: 0 }}
        render={({ field }) => (
          <FormItem className="m-0">
            <FormControl>
              <Input
                {...field}
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                className="text-right"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Remove */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="mt-1 text-gray-400 hover:text-red-500"
        disabled={!canRemove}
        onClick={onRemove}
      >
        <DeleteOutline fontSize="small" />
      </Button>
    </div>
  )
}

export default NewInvoicePage
