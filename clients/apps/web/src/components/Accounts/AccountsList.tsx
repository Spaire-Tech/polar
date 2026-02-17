import EmbeddedPayouts from '@/components/Connect/EmbeddedPayouts'
import { ACCOUNT_TYPE_DISPLAY_NAMES } from '@/utils/account'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
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

  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(
    null,
  )

  const handleTogglePayouts = useCallback((accountId: string) => {
    setExpandedAccountId((prev) => (prev === accountId ? null : accountId))
  }, [])

  return (
    <div className="flex flex-col gap-4">
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
              onTogglePayouts={handleTogglePayouts}
              isExpanded={expandedAccountId === account.id}
            />
          ))}
        </tbody>
      </table>

      {expandedAccountId && (
        <div className="dark:border-polar-700 rounded-xl border border-gray-200 p-4">
          {accountOrgs
            .filter(({ account }) => account.id === expandedAccountId)
            .map(({ account }) => (
              <EmbeddedPayouts key={account.id} account={account} />
            ))}
        </div>
      )}
    </div>
  )
}

export default AccountsList

interface AccountListItemProps {
  account: schemas['Account']
  organization: schemas['Organization']
  onTogglePayouts: (accountId: string) => void
  isExpanded: boolean
}

const AccountListItem = ({
  account,
  organization,
  onTogglePayouts,
  isExpanded,
}: AccountListItemProps) => {
  const childClass = twMerge(
    'dark:group-hover:bg-polar-700 px-4 py-2 transition-colors group-hover:bg-blue-50 group-hover:text-gray-950 text-gray-700 dark:text-polar-200 group-hover:dark:text-white',
  )

  const isActive = account?.stripe_id !== null

  return (
    <tr className="group text-sm">
      <td className={twMerge(childClass, 'rounded-l-xl')}>
        {ACCOUNT_TYPE_DISPLAY_NAMES[account.account_type]}
      </td>
      <td className={childClass}>{organization.slug}</td>
      <td className={twMerge(childClass, 'rounded-r-xl')}>
        {isActive && (
          <Button size="sm" onClick={() => onTogglePayouts(account.id)}>
            {isExpanded ? (
              <>
                Hide payouts
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Manage payouts
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </>
            )}
          </Button>
        )}
      </td>
    </tr>
  )
}
