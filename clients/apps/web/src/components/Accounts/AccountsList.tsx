import EmbeddedPayouts from '@/components/Connect/EmbeddedPayouts'
import { ACCOUNT_TYPE_DISPLAY_NAMES } from '@/utils/account'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
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

  const hasStripeId = account?.stripe_id !== null
  const isFullyActive =
    hasStripeId &&
    account.is_details_submitted &&
    account.is_charges_enabled &&
    account.is_payouts_enabled

  const statusLabel = isFullyActive
    ? 'Active'
    : hasStripeId
      ? 'Setup required'
      : 'Pending'
  const statusClass = isFullyActive
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
    : hasStripeId
      ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
      : 'bg-gray-100 text-gray-600 dark:bg-polar-700 dark:text-polar-400'

  const [loadingDashboard, setLoadingDashboard] = useState(false)

  const goToDashboard = useCallback(async () => {
    setLoadingDashboard(true)
    try {
      const link = await unwrap(
        api.POST('/v1/accounts/{id}/dashboard_link', {
          params: {
            path: { id: account.id },
          },
        }),
      )
      window.location.href = link.url
    } catch {
      setLoadingDashboard(false)
    }
  }, [account.id])

  return (
    <tr className="group text-sm">
      <td className={twMerge(childClass, 'rounded-l-xl')}>
        {ACCOUNT_TYPE_DISPLAY_NAMES[account.account_type]}
      </td>
      <td className={childClass}>
        <span
          className={twMerge(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
            statusClass,
          )}
        >
          {statusLabel}
        </span>
      </td>
      <td className={childClass}>{organization.slug}</td>
      <td className={twMerge(childClass, 'rounded-r-xl')}>
        {hasStripeId && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={goToDashboard}
              loading={loadingDashboard}
            >
              Open dashboard
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
            {isFullyActive && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onTogglePayouts(account.id)}
              >
                {isExpanded ? (
                  <>
                    Hide payouts
                    <ChevronDown className="ml-1 h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    Payouts
                    <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}
