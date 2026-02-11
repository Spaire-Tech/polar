'use client'

import Button from '@polar-sh/ui/components/atoms/Button'
import { Banknote, CreditCard, Landmark, Plus } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function FinanceQuickActions() {
  const params = useParams<{ organization: string }>()
  const base = `/dashboard/${params.organization}/finance/embedded`

  const actions = [
    {
      label: 'Issue Card',
      icon: <CreditCard className="h-4 w-4" />,
      href: `${base}/cards`,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20',
    },
    {
      label: 'Pay Vendor',
      icon: <Banknote className="h-4 w-4" />,
      href: `${base}/pay`,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20',
    },
    {
      label: 'Transfer to Bank',
      icon: <Landmark className="h-4 w-4" />,
      href: `${base}/pay`,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 dark:hover:bg-purple-500/20',
    },
    {
      label: 'Add Funds',
      icon: <Plus className="h-4 w-4" />,
      href: `${base}/balances`,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20',
    },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Link key={action.label} href={action.href}>
          <Button
            variant="ghost"
            size="sm"
            className={`${action.bg} ${action.color} gap-2 rounded-lg border-0 font-medium`}
          >
            {action.icon}
            {action.label}
          </Button>
        </Link>
      ))}
    </div>
  )
}
