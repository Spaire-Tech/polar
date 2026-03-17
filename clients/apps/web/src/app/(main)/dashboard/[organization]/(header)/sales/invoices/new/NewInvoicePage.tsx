'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { toast } from '@/components/Toast/use-toast'
import { useCustomers } from '@/hooks/queries'
import {
  ClientInvoiceCreate,
  ClientInvoiceLineItemCreate,
  useCreateClientInvoice,
} from '@/hooks/queries/client_invoices'
import Add from '@mui/icons-material/Add'
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
import { formatCurrency } from '@spaire/currency'
import { addDays, format } from 'date-fns'
import { useRouter } from 'next/navigation'
import React, { useMemo, useRef, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'

const CURRENCIES = ['usd', 'eur', 'gbp', 'cad', 'aud', 'jpy', 'chf', 'sek']
const NET_OPTIONS = [
  { label: 'Net 7', days: 7 },
  { label: 'Net 15', days: 15 },
  { label: 'Net 30', days: 30 },
  { label: 'Net 60', days: 60 },
]

interface NewInvoiceFormValues {
  customer_id: string
  currency: string
  line_items: ClientInvoiceLineItemCreate[]
  due_date: string
  memo: string
  po_number: string
  on_behalf_of_label: string
  discount_amount: string
  discount_label: string
  include_payment_link: boolean
}

interface NewInvoicePageProps {
  organization: schemas['Organization']
}

const NewInvoicePage: React.FC<NewInvoicePageProps> = ({ organization }) => {
  const router = useRouter()
  const createInvoice = useCreateClientInvoice(organization.id)

  const form = useForm<NewInvoiceFormValues>({
    defaultValues: {
      customer_id: '',
      currency: 'usd',
      line_items: [{ description: '', quantity: 1, unit_amount: 0 }],
      due_date: '',
      memo: '',
      po_number: '',
      on_behalf_of_label: '',
      discount_amount: '',
      discount_label: '',
      include_payment_link: true,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'line_items',
  })

  // Customer selector state
  const [customerOpen, setCustomerOpen] = useState(false)
  const [customerQuery, setCustomerQuery] = useState('')
  const [selectedCustomerName, setSelectedCustomerName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: customersData } = useCustomers(organization.id, {
    query: customerQuery || undefined,
    sorting: ['-created_at'],
  })
  const allCustomers = useMemo(
    () => customersData?.pages.flatMap((page) => page.items) ?? [],
    [customersData],
  )

  const currency = form.watch('currency')
  const lineItems = form.watch('line_items')
  const discountAmountRaw = form.watch('discount_amount')
  const discountAmount = parseFloat(discountAmountRaw) || 0

  const subtotal = lineItems.reduce(
    (sum, item) => sum + (parseFloat(String(item.unit_amount)) || 0) * (item.quantity || 1),
    0,
  )
  const discountCents = Math.round(discountAmount * 100)
  const taxableAmount = Math.max(0, subtotal - discountCents)
  const total = taxableAmount // tax shown after creation

  const handleSubmit = async (values: NewInvoiceFormValues) => {
    if (!values.customer_id) {
      form.setError('customer_id', { message: 'Please select a customer' })
      return
    }

    const body: ClientInvoiceCreate = {
      customer_id: values.customer_id,
      currency: values.currency,
      line_items: values.line_items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unit_amount: Math.round(parseFloat(String(item.unit_amount)) * 100),
      })),
      due_date: values.due_date || null,
      memo: values.memo || null,
      po_number: values.po_number || null,
      on_behalf_of_label: values.on_behalf_of_label || null,
      discount_amount: Math.round(discountAmount * 100),
      discount_label: values.discount_label || null,
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
      title={
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-medium dark:text-white">
            Create and send invoices in minutes
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
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
          {/* Left: form fields */}
          <div className="flex flex-1 flex-col gap-6">
            {/* Customer */}
            <ShadowBox className="flex flex-col gap-4">
              <h3 className="text-sm font-medium dark:text-white">Customer</h3>
              <FormField
                control={form.control}
                name="customer_id"
                rules={{ required: 'Please select a customer' }}
                render={({ field }) => (
                  <FormItem>
                    <Popover open={customerOpen}>
                      <PopoverTrigger asChild>
                        <div
                          onBlur={() => {
                            setTimeout(() => setCustomerOpen(false), 150)
                          }}
                        >
                          <Input
                            ref={inputRef}
                            placeholder="Search customers..."
                            value={
                              field.value
                                ? selectedCustomerName
                                : customerQuery
                            }
                            onChange={(e) => {
                              if (field.value) {
                                field.onChange('')
                                setSelectedCustomerName('')
                              }
                              setCustomerQuery(e.target.value)
                            }}
                            onFocus={() => setCustomerOpen(true)}
                            preSlot={<Search fontSize="small" />}
                          />
                        </div>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-72 overflow-hidden p-0"
                        align="start"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                        onInteractOutside={(e) => e.preventDefault()}
                        onPointerDownOutside={(e) => e.preventDefault()}
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
                                  setSelectedCustomerName(
                                    customer.name ?? customer.email,
                                  )
                                  setCustomerOpen(false)
                                }}
                              >
                                <Avatar
                                  className="size-7"
                                  avatar_url={customer.avatar_url}
                                  name={customer.name || customer.email}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {customer.name ?? customer.email}
                                  </span>
                                  {customer.name && (
                                    <span className="text-xs text-gray-500">
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

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="dark:bg-spaire-900 dark:border-spaire-700 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm uppercase focus:outline-none"
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c}>
                            {c.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                  </FormItem>
                )}
              />
            </ShadowBox>

            {/* Line items */}
            <ShadowBox className="flex flex-col gap-4">
              <h3 className="text-sm font-medium dark:text-white">
                Items
              </h3>
              <div className="flex flex-col gap-2">
                <div className="hidden grid-cols-[1fr_80px_100px_32px] gap-2 text-xs text-gray-500 dark:text-gray-400 sm:grid">
                  <span>Description</span>
                  <span className="text-center">Qty</span>
                  <span className="text-right">Unit price</span>
                  <span />
                </div>
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-[1fr_80px_100px_32px] items-center gap-2"
                  >
                    <FormField
                      control={form.control}
                      name={`line_items.${index}.description`}
                      rules={{ required: 'Required' }}
                      render={({ field }) => (
                        <FormItem className="m-0">
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Item description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                    <FormField
                      control={form.control}
                      name={`line_items.${index}.unit_amount`}
                      rules={{ required: 'Required', min: 0.01 }}
                      render={({ field }) => (
                        <FormItem className="m-0">
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min={0.01}
                              step={0.01}
                              placeholder="0.00"
                              className="text-right"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-red-500"
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                    >
                      <DeleteOutline fontSize="small" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start gap-1 text-blue-500"
                onClick={() =>
                  append({ description: '', quantity: 1, unit_amount: 0 })
                }
              >
                <Add fontSize="small" />
                Add item
              </Button>
            </ShadowBox>

            {/* Discount */}
            <ShadowBox className="flex flex-col gap-4">
              <h3 className="text-sm font-medium dark:text-white">Discount</h3>
              <div className="flex gap-3">
                <FormField
                  control={form.control}
                  name="discount_amount"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Amount ({currency.toUpperCase()})</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0.00"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="discount_label"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Label (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Promo code" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </ShadowBox>

            {/* Invoice details */}
            <ShadowBox className="flex flex-col gap-4">
              <h3 className="text-sm font-medium dark:text-white">
                Invoice Details
              </h3>

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
                          onClick={() => {
                            const d = addDays(new Date(), opt.days)
                            field.onChange(format(d, 'yyyy-MM-dd'))
                          }}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                  </FormItem>
                )}
              />

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
                        placeholder="Add a note visible on the invoice..."
                        className="dark:bg-spaire-900 dark:border-spaire-700 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="po_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PO Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Purchase order number" />
                    </FormControl>
                  </FormItem>
                )}
              />

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
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

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
            </ShadowBox>
          </div>

          {/* Right: summary + submit */}
          <div className="w-full lg:w-80">
            <div className="sticky top-8 flex flex-col gap-4">
              <ShadowBox className="flex flex-col gap-3 text-sm">
                <h3 className="font-medium dark:text-white">Summary</h3>
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>Subtotal</span>
                  <span>
                    {formatCurrency('compact')(subtotal, currency)}
                  </span>
                </div>
                {discountCents > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>Discount</span>
                    <span>
                      -{formatCurrency('compact')(discountCents, currency)}
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
                    <span>
                      {formatCurrency('compact')(total, currency)}
                    </span>
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
    </DashboardBody>
  )
}

export default NewInvoicePage
