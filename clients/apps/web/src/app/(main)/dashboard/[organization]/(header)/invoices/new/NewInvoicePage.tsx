'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import Spinner from '@/components/Shared/Spinner'
import { useCustomers } from '@/hooks/queries'
import {
  ManualInvoiceItemCreate,
  useCreateManualInvoice,
} from '@/hooks/queries/manualInvoices'
import { useInViewport } from '@/hooks/utils'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import Search from '@mui/icons-material/Search'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@polar-sh/ui/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

interface LineItem {
  description: string
  quantity: number
  unit_amount: number // in cents
}

interface NewInvoicePageProps {
  organization: schemas['Organization']
}

const NewInvoicePage: React.FC<NewInvoicePageProps> = ({ organization }) => {
  const router = useRouter()
  const createInvoice = useCreateManualInvoice()

  // Form state
  const [currency, setCurrency] = useState('usd')
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [billingName, setBillingName] = useState('')
  const [notes, setNotes] = useState('')
  const [includePaymentLink, setIncludePaymentLink] = useState(true)
  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit_amount: 0 },
  ])

  // Customer search
  const [customerOpen, setCustomerOpen] = useState(false)
  const [customerQuery, setCustomerQuery] = useState('')
  const customerInputRef = useRef<HTMLInputElement>(null)

  const { data: customersData, fetchNextPage, hasNextPage } = useCustomers(
    organization.id,
    { query: customerQuery || undefined, sorting: ['-created_at'] },
  )

  const allCustomers = useMemo(
    () => customersData?.pages.flatMap((page) => page.items) ?? [],
    [customersData],
  )

  const { ref: loadingRef, inViewport } = useInViewport<HTMLDivElement>()

  useEffect(() => {
    if (inViewport && hasNextPage) {
      fetchNextPage()
    }
  }, [inViewport, hasNextPage, fetchNextPage])

  const selectCustomer = useCallback(
    (customer: schemas['Customer']) => {
      setCustomerId(customer.id)
      setCustomerName(customer.name || customer.email)
      setBillingName(customer.name || '')
      setCustomerOpen(false)
      setCustomerQuery('')
    },
    [],
  )

  const clearCustomer = useCallback(() => {
    setCustomerId(null)
    setCustomerName('')
    setBillingName('')
  }, [])

  // Line items
  const addLineItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_amount: 0 }])
  }

  const removeLineItem = (index: number) => {
    if (items.length === 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const updateLineItem = (
    index: number,
    field: keyof LineItem,
    value: string | number,
  ) => {
    const newItems = [...items]
    if (field === 'unit_amount' && typeof value === 'string') {
      // Convert dollar input to cents
      const dollars = parseFloat(value) || 0
      newItems[index] = { ...newItems[index], [field]: Math.round(dollars * 100) }
    } else {
      newItems[index] = { ...newItems[index], [field]: value }
    }
    setItems(newItems)
  }

  const subtotal = items.reduce(
    (acc, item) => acc + item.quantity * item.unit_amount,
    0,
  )

  const handleSubmit = async () => {
    const validItems: ManualInvoiceItemCreate[] = items
      .filter((item) => item.description && item.unit_amount > 0)
      .map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_amount: item.unit_amount,
      }))

    if (validItems.length === 0) return

    try {
      const invoice = await createInvoice.mutateAsync({
        organization_id: organization.id,
        currency,
        customer_id: customerId,
        billing_name: billingName || null,
        notes: notes || null,
        items: validItems,
      })
      router.push(`/dashboard/${organization.slug}/invoices/${invoice.id}`)
    } catch {
      // Error is handled by the mutation
    }
  }

  return (
    <DashboardBody
      title={
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/${organization.slug}/invoices`}>
            <Button size="icon" variant="ghost">
              <ArrowBackOutlined fontSize="inherit" />
            </Button>
          </Link>
          <span>New Invoice</span>
        </div>
      }
    >
      <div className="flex flex-col gap-8">
        {/* Customer Details */}
        <ShadowBox>
          <div className="flex flex-col gap-6 p-6">
            <h3 className="text-lg font-medium dark:text-white">
              Customer Details
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Customer Selector */}
              <div className="flex flex-col gap-2">
                <label className="dark:text-polar-300 text-sm font-medium text-gray-700">
                  Customer
                </label>
                {customerId ? (
                  <div className="dark:border-polar-700 dark:bg-polar-800 flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2">
                    <span className="text-sm">{customerName}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      onClick={clearCustomer}
                    >
                      <DeleteOutlined fontSize="inherit" />
                    </Button>
                  </div>
                ) : (
                  <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                    <PopoverTrigger asChild>
                      <div>
                        <Input
                          ref={customerInputRef}
                          placeholder="Search customers..."
                          value={customerQuery}
                          onChange={(e) => setCustomerQuery(e.target.value)}
                          onFocus={() => setCustomerOpen(true)}
                          preSlot={<Search fontSize="small" />}
                        />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent
                      className="overflow-hidden p-0"
                      align="start"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                      <div className="max-h-64 overflow-y-auto font-sans">
                        {allCustomers.length > 0 ? (
                          <List size="small" className="rounded-md border-0">
                            {allCustomers.map((customer) => (
                              <ListItem
                                key={customer.id}
                                size="small"
                                className="flex cursor-pointer flex-row items-center gap-3 p-3"
                                onSelect={(e) => {
                                  e.preventDefault()
                                  selectCustomer(customer)
                                }}
                              >
                                <Avatar
                                  className="size-7"
                                  avatar_url={customer.avatar_url}
                                  name={customer.name || customer.email}
                                />
                                <div className="flex flex-col">
                                  <span className="text-sm">
                                    {customer.name ?? customer.email}
                                  </span>
                                  {customer.name && (
                                    <span className="dark:text-polar-500 text-xs text-gray-400">
                                      {customer.email}
                                    </span>
                                  )}
                                </div>
                              </ListItem>
                            ))}
                          </List>
                        ) : null}
                        {hasNextPage && (
                          <div className="flex w-full items-center justify-center py-4">
                            <Spinner />
                            <div ref={loadingRef} />
                          </div>
                        )}
                        {allCustomers.length === 0 && !hasNextPage && (
                          <div className="dark:text-polar-500 flex w-full items-center justify-center py-8 text-sm text-gray-500">
                            {customerQuery
                              ? 'No customers found'
                              : 'No customers yet'}
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              {/* Currency */}
              <div className="flex flex-col gap-2">
                <label className="dark:text-polar-300 text-sm font-medium text-gray-700">
                  Currency
                </label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usd">US Dollar (USD)</SelectItem>
                    <SelectItem value="eur">Euro (EUR)</SelectItem>
                    <SelectItem value="gbp">
                      British Pound Sterling (GBP)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="dark:text-polar-300 text-sm font-medium text-gray-700">
                  Billing Name
                  <span className="dark:text-polar-500 ml-1 text-gray-400">
                    Optional
                  </span>
                </label>
                <Input
                  placeholder="Customer billing name"
                  value={billingName}
                  onChange={(e) => setBillingName(e.target.value)}
                />
              </div>
            </div>
          </div>
        </ShadowBox>

        {/* Product and Pricing */}
        <ShadowBox>
          <div className="flex flex-col gap-6 p-6">
            <h3 className="text-lg font-medium dark:text-white">
              Product and Pricing
            </h3>

            {/* Line items table */}
            <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-polar-700">
              <table className="w-full">
                <thead>
                  <tr className="dark:bg-polar-800 border-b border-gray-200 bg-gray-50 dark:border-polar-700">
                    <th className="dark:text-polar-400 px-4 py-3 text-left text-xs font-medium text-gray-500">
                      Description
                    </th>
                    <th className="dark:text-polar-400 w-24 px-4 py-3 text-right text-xs font-medium text-gray-500">
                      Price
                    </th>
                    <th className="dark:text-polar-400 w-20 px-4 py-3 text-right text-xs font-medium text-gray-500">
                      Qty
                    </th>
                    <th className="dark:text-polar-400 w-28 px-4 py-3 text-right text-xs font-medium text-gray-500">
                      Amount
                    </th>
                    <th className="w-12 px-2 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-200 last:border-0 dark:border-polar-700"
                    >
                      <td className="px-4 py-2">
                        <Input
                          className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                          placeholder="Item description"
                          value={item.description}
                          onChange={(e) =>
                            updateLineItem(index, 'description', e.target.value)
                          }
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          className="border-0 bg-transparent text-right shadow-none focus-visible:ring-0"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={
                            item.unit_amount > 0
                              ? (item.unit_amount / 100).toFixed(2)
                              : ''
                          }
                          onChange={(e) =>
                            updateLineItem(
                              index,
                              'unit_amount',
                              e.target.value,
                            )
                          }
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          className="border-0 bg-transparent text-right shadow-none focus-visible:ring-0"
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateLineItem(
                              index,
                              'quantity',
                              parseInt(e.target.value) || 1,
                            )
                          }
                        />
                      </td>
                      <td className="dark:text-polar-300 px-4 py-2 text-right text-sm text-gray-700">
                        {formatCurrency('compact')(
                          item.quantity * item.unit_amount,
                          currency,
                        )}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {items.length > 1 && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="dark:text-polar-500 size-7 text-gray-400"
                            onClick={() => removeLineItem(index)}
                          >
                            <DeleteOutlined fontSize="inherit" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={addLineItem}
                wrapperClassNames="gap-x-2"
              >
                <AddOutlined fontSize="inherit" />
                <span>Add line item</span>
              </Button>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="dark:text-polar-400 text-gray-500">
                    Subtotal
                  </span>
                  <span className="dark:text-polar-300 font-medium text-gray-700">
                    {formatCurrency('compact')(subtotal, currency)}
                  </span>
                </div>
                <div className="dark:border-polar-700 border-t border-gray-200 pt-2">
                  <div className="flex justify-between text-base font-semibold">
                    <span className="dark:text-white">Total</span>
                    <span className="dark:text-white">
                      {formatCurrency('compact')(subtotal, currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ShadowBox>

        {/* Invoice Details */}
        <ShadowBox>
          <div className="flex flex-col gap-6 p-6">
            <h3 className="text-lg font-medium dark:text-white">
              Invoice Details
            </h3>

            <div className="flex flex-col gap-4">
              {/* Include payment link */}
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={includePaymentLink}
                  onChange={(e) => setIncludePaymentLink(e.target.checked)}
                  className="dark:border-polar-600 h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium dark:text-white">
                    Include payment link
                  </span>
                  <span className="dark:text-polar-400 text-xs text-gray-500">
                    A checkout link will be generated when the invoice is issued,
                    supporting cards, and other payment methods.
                  </span>
                </div>
              </label>

              {/* Notes */}
              <div className="flex flex-col gap-2">
                <label className="dark:text-polar-300 text-sm font-medium text-gray-700">
                  Notes
                  <span className="dark:text-polar-500 ml-1 text-gray-400">
                    Optional
                  </span>
                </label>
                <textarea
                  className="dark:border-polar-700 dark:bg-polar-800 dark:text-polar-200 dark:placeholder:text-polar-500 min-h-[80px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Add notes to the invoice (visible to the customer)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
        </ShadowBox>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 pb-8">
          <Link href={`/dashboard/${organization.slug}/invoices`}>
            <Button variant="secondary">Cancel</Button>
          </Link>
          <Button
            onClick={handleSubmit}
            loading={createInvoice.isPending}
            disabled={
              items.filter((i) => i.description && i.unit_amount > 0)
                .length === 0
            }
          >
            Create Draft Invoice
          </Button>
        </div>
      </div>
    </DashboardBody>
  )
}

export default NewInvoicePage
