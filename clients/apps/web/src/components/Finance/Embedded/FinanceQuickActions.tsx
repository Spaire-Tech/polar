'use client'

import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function FinanceQuickActions() {
  const params = useParams<{ organization: string }>()
  const base = `/dashboard/${params.organization}/finance/embedded`

  return (
    <div className="flex flex-row flex-wrap gap-2">
      <Link href={`${base}/cards`}>
        <Button variant="secondary" size="sm">
          Issue Card
        </Button>
      </Link>
      <Link href={`${base}/pay`}>
        <Button variant="secondary" size="sm">
          Pay Vendor
        </Button>
      </Link>
      <Link href={`${base}/pay`}>
        <Button variant="secondary" size="sm">
          Transfer to Bank
        </Button>
      </Link>
      <Link href={`${base}/balances`}>
        <Button variant="secondary" size="sm">
          Add Funds
        </Button>
      </Link>
    </div>
  )
}
