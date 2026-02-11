'use client'

import StripeConnectProvider from '@/components/Finance/Embedded/StripeConnectProvider'
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
import { useState } from 'react'

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

type PaymentMethod = 'ach' | 'us_domestic_wire'
type MovementType = 'outbound_payment' | 'outbound_transfer'

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

  return (
    <div className="flex flex-col gap-y-8">
      <ShadowBoxOnMd>
        <div className="flex flex-col gap-y-6 p-6">
          <h2 className="text-lg font-medium">Send Money</h2>

          <div className="flex flex-col gap-y-4">
            <div>
              <label className="dark:text-polar-300 mb-1 block text-sm text-gray-700">
                Type
              </label>
              <Select
                value={movementType}
                onValueChange={(v) => setMovementType(v as MovementType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound_payment">Pay Vendor</SelectItem>
                  <SelectItem value="outbound_transfer">
                    Transfer to Bank
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {movementType === 'outbound_payment' && (
              <div>
                <label className="dark:text-polar-300 mb-1 block text-sm text-gray-700">
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
              <label className="dark:text-polar-300 mb-1 block text-sm text-gray-700">
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
              <label className="dark:text-polar-300 mb-1 block text-sm text-gray-700">
                Method
              </label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
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
              <p className="dark:text-polar-500 mt-1 text-xs text-gray-400">
                {paymentMethod === 'ach'
                  ? 'Settles in 1-3 business days'
                  : 'Settles same day'}
              </p>
            </div>

            <div>
              <label className="dark:text-polar-300 mb-1 block text-sm text-gray-700">
                Description
              </label>
              <Input
                type="text"
                placeholder="Payment for invoice #1234"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="dark:bg-polar-800 flex items-center justify-between rounded-lg bg-gray-50 p-4">
              <span className="dark:text-polar-400 text-sm text-gray-500">
                Total
              </span>
              <span className="text-lg font-medium">
                {amount
                  ? formatCents(Math.round(parseFloat(amount) * 100))
                  : '$0.00'}
              </span>
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

      <StripeConnectProvider organizationId={organization.id}>
        <ShadowBoxOnMd>
          <div className="flex flex-col gap-y-4 p-6">
            <h2 className="text-lg font-medium">Payment History</h2>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              Requires active Stripe Treasury program access.
            </p>
          </div>
        </ShadowBoxOnMd>
      </StripeConnectProvider>
    </div>
  )
}
