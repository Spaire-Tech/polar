'use client'

import StripeConnectProvider from '@/components/Finance/Embedded/StripeConnectProvider'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import {
  ArrowUpRight,
  Banknote,
  Landmark,
  Send,
} from 'lucide-react'
import { useState } from 'react'

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

type PaymentMethod = 'ach' | 'us_domestic_wire'
type MovementType = 'outbound_payment' | 'outbound_transfer'

const movementTypes = [
  {
    value: 'outbound_payment' as const,
    label: 'Pay Vendor',
    description: 'Send payment to a vendor or contractor',
    icon: <Banknote className="h-4 w-4" />,
  },
  {
    value: 'outbound_transfer' as const,
    label: 'Transfer to Bank',
    description: 'Move funds to your external bank account',
    icon: <Landmark className="h-4 w-4" />,
  },
]

export default function PayPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const [movementType, setMovementType] =
    useState<MovementType>('outbound_payment')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ach')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [recipient, setRecipient] = useState('')

  const selectedMovement = movementTypes.find(
    (m) => m.value === movementType,
  )!

  return (
    <DashboardBody>
      <div className="space-y-6 p-4 md:p-8">
        <div>
          <h2 className="dark:text-white text-xl font-bold text-gray-900">
            Pay
          </h2>
          <p className="dark:text-polar-400 mt-1 text-sm text-gray-500">
            Send payments to vendors, transfer funds to your bank, and view
            payment history.
          </p>
        </div>

        {/* Movement Type Selector */}
        <div className="grid grid-cols-2 gap-3">
          {movementTypes.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setMovementType(type.value)}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                movementType === type.value
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10'
                  : 'border-gray-200 bg-white hover:border-gray-300 dark:border-polar-700 dark:bg-polar-900 dark:hover:border-polar-600'
              }`}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  movementType === type.value
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-polar-800 dark:text-polar-400'
                }`}
              >
                {type.icon}
              </div>
              <div>
                <p
                  className={`text-sm font-semibold ${
                    movementType === type.value
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {type.label}
                </p>
                <p
                  className={`text-xs ${
                    movementType === type.value
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-polar-400'
                  }`}
                >
                  {type.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Payment Form */}
          <div className="lg:col-span-3">
            <ShadowBoxOnMd>
              <div className="space-y-5 p-6">
                <div className="flex items-center gap-2">
                  {selectedMovement.icon}
                  <h3 className="dark:text-white text-lg font-semibold text-gray-900">
                    {selectedMovement.label}
                  </h3>
                </div>

                <div className="space-y-4">
                  {movementType === 'outbound_payment' && (
                    <div>
                      <label className="dark:text-polar-300 mb-1.5 block text-sm font-medium text-gray-700">
                        Recipient
                      </label>
                      <Input
                        type="text"
                        placeholder="Vendor name or account"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                      />
                    </div>
                  )}

                  <div>
                    <label className="dark:text-polar-300 mb-1.5 block text-sm font-medium text-gray-700">
                      Amount (USD)
                    </label>
                    <div className="relative">
                      <span className="dark:text-polar-400 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                        $
                      </span>
                      <Input
                        type="number"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="pl-7"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="dark:text-polar-300 mb-1.5 block text-sm font-medium text-gray-700">
                      Payment Method
                    </label>
                    <Select
                      value={paymentMethod}
                      onValueChange={(v) =>
                        setPaymentMethod(v as PaymentMethod)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ach">
                          ACH Transfer
                        </SelectItem>
                        <SelectItem value="us_domestic_wire">
                          Domestic Wire
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="dark:text-polar-500 mt-1 text-xs text-gray-400">
                      {paymentMethod === 'ach'
                        ? 'ACH transfers typically settle in 1-3 business days'
                        : 'Wire transfers typically settle same day'}
                    </p>
                  </div>

                  <div>
                    <label className="dark:text-polar-300 mb-1.5 block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <Input
                      type="text"
                      placeholder="Payment for invoice #1234"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>

                {/* Summary */}
                <div className="dark:bg-polar-800 rounded-lg bg-gray-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="dark:text-polar-400 text-sm text-gray-500">
                      Amount to send
                    </span>
                    <span className="dark:text-white text-lg font-semibold text-gray-900">
                      {amount
                        ? formatCents(Math.round(parseFloat(amount) * 100))
                        : '$0.00'}
                    </span>
                  </div>
                  <div className="dark:border-polar-700 mt-2 flex items-center justify-between border-t border-gray-200 pt-2">
                    <span className="dark:text-polar-500 text-xs text-gray-400">
                      via{' '}
                      {paymentMethod === 'ach'
                        ? 'ACH Transfer'
                        : 'Domestic Wire'}
                    </span>
                    <span className="dark:text-polar-500 text-xs text-gray-400">
                      {paymentMethod === 'ach' ? '1-3 days' : 'Same day'}
                    </span>
                  </div>
                </div>

                <Button
                  fullWidth
                  disabled={!amount || parseFloat(amount) <= 0}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  {movementType === 'outbound_payment'
                    ? 'Send Payment'
                    : 'Initiate Transfer'}
                </Button>
              </div>
            </ShadowBoxOnMd>
          </div>

          {/* Payment History Sidebar */}
          <div className="lg:col-span-2">
            <ShadowBoxOnMd>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <h3 className="dark:text-white text-sm font-semibold text-gray-900">
                    Recent Payments
                  </h3>
                  <ArrowUpRight className="dark:text-polar-500 h-4 w-4 text-gray-400" />
                </div>
                <StripeConnectProvider organizationId={organization.id}>
                  <div className="dark:border-polar-700 mt-4 flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-gray-200">
                    <div className="text-center">
                      <Send className="dark:text-polar-500 mx-auto h-6 w-6 text-gray-300" />
                      <p className="dark:text-polar-400 mt-2 text-sm text-gray-500">
                        No payments yet
                      </p>
                      <p className="dark:text-polar-500 mt-1 text-xs text-gray-400">
                        Payment history will appear here
                      </p>
                    </div>
                  </div>
                </StripeConnectProvider>
              </div>
            </ShadowBoxOnMd>
          </div>
        </div>
      </div>
    </DashboardBody>
  )
}
