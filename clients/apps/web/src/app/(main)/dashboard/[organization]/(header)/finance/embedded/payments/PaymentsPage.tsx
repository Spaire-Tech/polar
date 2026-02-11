'use client'

import StripeConnectProvider from '@/components/Finance/Embedded/StripeConnectProvider'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { schemas } from '@polar-sh/client'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import { useState } from 'react'

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

type PaymentMethod = 'ach' | 'us_domestic_wire'
type MovementType = 'outbound_payment' | 'outbound_transfer'

export default function PaymentsPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const [movementType, setMovementType] =
    useState<MovementType>('outbound_payment')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ach')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  return (
    <DashboardBody>
      <div className="space-y-6 p-4 md:p-8">
        <div>
          <h2 className="dark:text-white text-xl font-bold text-gray-900">
            Payments
          </h2>
          <p className="dark:text-polar-400 mt-1 text-sm text-gray-500">
            Send payments to vendors, transfer funds to external bank accounts,
            and view payment history.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* New Payment Form */}
          <ShadowBoxOnMd>
            <div className="space-y-5 p-6">
              <h3 className="dark:text-white text-lg font-semibold text-gray-900">
                Send Money
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="dark:text-polar-300 mb-1 block text-sm font-medium text-gray-700">
                    Type
                  </label>
                  <Select
                    value={movementType}
                    onValueChange={(v) =>
                      setMovementType(v as MovementType)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="outbound_payment">
                        Pay Vendor
                      </SelectItem>
                      <SelectItem value="outbound_transfer">
                        Transfer to Bank
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="dark:text-polar-300 mb-1 block text-sm font-medium text-gray-700">
                    Method
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
                      <SelectItem value="ach">ACH</SelectItem>
                      <SelectItem value="us_domestic_wire">
                        Domestic Wire
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="dark:text-polar-300 mb-1 block text-sm font-medium text-gray-700">
                    Amount (USD)
                  </label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <div>
                  <label className="dark:text-polar-300 mb-1 block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <Input
                    type="text"
                    placeholder="Payment for invoice #1234"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="dark:bg-polar-800 rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="dark:text-polar-400 text-sm text-gray-500">
                      Amount to send
                    </span>
                    <span className="dark:text-white font-semibold text-gray-900">
                      {amount
                        ? formatCents(Math.round(parseFloat(amount) * 100))
                        : '$0.00'}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="dark:text-polar-500 text-xs text-gray-400">
                      via{' '}
                      {paymentMethod === 'ach' ? 'ACH' : 'Domestic Wire'}
                    </span>
                  </div>
                </div>

                <Button
                  fullWidth
                  disabled={!amount || parseFloat(amount) <= 0}
                >
                  {movementType === 'outbound_payment'
                    ? 'Send Payment'
                    : 'Initiate Transfer'}
                </Button>
              </div>
            </div>
          </ShadowBoxOnMd>

          {/* Recent Payments */}
          <ShadowBoxOnMd>
            <div className="p-6">
              <h3 className="dark:text-white mb-4 text-lg font-semibold text-gray-900">
                Recent Activity
              </h3>
              <StripeConnectProvider organizationId={organization.id}>
                {/*
                  Stripe Connect embedded component for payment history.
                  Renders Financial Account transaction list filtered to
                  outbound payments and transfers.

                  import { ConnectFinancialAccountTransactions } from '@stripe/react-connect-js'
                  <ConnectFinancialAccountTransactions financialAccount={faId} />
                */}
                <div className="dark:border-polar-700 dark:bg-polar-900 flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
                  <p className="dark:text-polar-400 text-sm text-gray-500">
                    Payment history will render here.
                    Requires active Stripe Treasury program access.
                  </p>
                </div>
              </StripeConnectProvider>
            </div>
          </ShadowBoxOnMd>
        </div>
      </div>
    </DashboardBody>
  )
}
