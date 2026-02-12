import { ACCOUNT_TYPE_DISPLAY_NAMES } from '@/utils/account'
import { toast } from '@/components/Toast/use-toast'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface AccountsListProps {
  accounts: schemas['Account'][]
  pauseActions?: boolean
}

const AccountsList = ({ accounts }: AccountsListProps) => {
  const accountOrgs = useMemo(
    () =>
      accounts.flatMap((account) =>
        account.organizations.map((organization) => ({
          account,
          organization,
        })),
      ),
    [accounts],
  )

  return (
    <table className="-mx-4 w-full text-left">
      <thead className="dark:text-polar-500 text-gray-500">
        <tr className="text-sm">
          <th
            scope="col"
            className="relative isolate px-4 py-3.5 pr-2 text-left font-normal whitespace-nowrap"
          >
            Type
          </th>
          <th
            scope="col"
            className="relative isolate px-4 py-3.5 pr-2 text-left font-normal whitespace-nowrap"
          >
            Status
          </th>
          <th
            scope="col"
            className="relative isolate px-4 py-3.5 pr-2 text-left font-normal whitespace-nowrap"
          >
            Used by
          </th>
          <th
            scope="col"
            className="relative isolate px-4 py-3.5 pr-2 font-normal whitespace-nowrap"
          >
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {accountOrgs.map(({ account, organization }) => (
          <AccountListItem
            key={organization.id}
            account={account}
            organization={organization}
          />
        ))}
      </tbody>
    </table>
  )
}

export default AccountsList

interface AccountListItemProps {
  account: schemas['Account']
  organization: schemas['Organization']
}

const AccountListItem = ({ account, organization }: AccountListItemProps) => {
  const childClass = twMerge(
    'dark:group-hover:bg-polar-700 px-4 py-2 transition-colors group-hover:bg-blue-50 group-hover:text-gray-950 text-gray-700 dark:text-polar-200 group-hover:dark:text-white',
  )

  const isActive = account?.stripe_id !== null
  const [loading, setLoading] = useState(false)

  const goToDashboard = async () => {
    setLoading(true)
    try {
      const link = await unwrap(
        api.POST('/v1/accounts/{id}/dashboard_link', {
          params: {
            path: {
              id: account.id,
            },
          },
        }),
      )
      window.location.href = link.url
    } catch {
      toast({
        title: 'Unable to open dashboard',
        description:
          'Please complete account onboarding first, or try again later.',
      })
      setLoading(false)
    }
  }

  return (
    <tr className="group text-sm">
      <td className={twMerge(childClass, 'rounded-l-xl')}>
        {ACCOUNT_TYPE_DISPLAY_NAMES[account.account_type]}
      </td>
      <td className={childClass}>{organization.slug}</td>
      <td className={twMerge(childClass, 'rounded-r-xl uppercase')}>
        {isActive && (
          <Button size="sm" onClick={goToDashboard} loading={loading}>
            Open dashboard
          </Button>
        )}
      </td>
    </tr>
  )
}
