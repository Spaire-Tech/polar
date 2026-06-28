'use client'

import { toast } from '@/components/Toast/use-toast'
import { useCreateCustomerPortalSession } from '@/hooks/queries/spaireTier'
import CreditCardOutlined from '@mui/icons-material/CreditCardOutlined'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
import Button from '@spaire/ui/components/atoms/Button'
import { schemas } from '@spaire/client'
import { useCallback, useState } from 'react'

interface BillingManagementCardProps {
  organization: schemas['Organization']
}

/**
 * Entry point to the Spaire-as-buyer customer portal, where the creator can
 * update the card on file and view / download invoices for their Spaire
 * subscription. The session is minted server-side
 * (POST .../customer-portal-session) and authenticates as the platform-org
 * customer that represents this creator.
 */
const BillingManagementCard = ({ organization }: BillingManagementCardProps) => {
  const createSession = useCreateCustomerPortalSession(organization.id)
  const [pending, setPending] = useState(false)

  const openPortal = useCallback(async () => {
    setPending(true)
    try {
      const result = await createSession.mutateAsync({
        return_url: window.location.href,
      })
      window.open(result.customer_portal_url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      const detail =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err as any)?.detail ??
        'Could not open billing management. Please try again.'
      toast({ title: 'Billing unavailable', description: String(detail) })
    } finally {
      setPending(false)
    }
  }, [createSession])

  return (
    <div className="dark:border-polar-700 flex flex-col gap-y-4 rounded-2xl border border-gray-200 bg-white p-6 dark:bg-transparent">
      <div className="flex flex-col gap-y-1">
        <h3 className="text-base font-medium text-gray-900 dark:text-white">
          Payment method & invoices
        </h3>
        <p className="text-sm text-gray-500">
          Update the card used for your Spaire subscription and view or
          download your past invoices.
        </p>
      </div>

      <div className="flex flex-col gap-y-2 text-sm text-gray-600 dark:text-gray-300">
        <span className="flex flex-row items-center gap-x-2">
          <CreditCardOutlined style={{ fontSize: 18 }} className="text-gray-400" />
          Manage the card Spaire charges each billing period
        </span>
        <span className="flex flex-row items-center gap-x-2">
          <ReceiptLongOutlined style={{ fontSize: 18 }} className="text-gray-400" />
          View and download invoices and receipts
        </span>
      </div>

      <div>
        <Button onClick={openPortal} loading={pending} disabled={pending}>
          Manage billing & invoices
        </Button>
      </div>
    </div>
  )
}

export default BillingManagementCard
