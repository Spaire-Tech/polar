'use client'

import { CreateCustomerModal } from '@/components/Customer/CreateCustomerModal'
import { CustomerDetailPanel } from '@/components/Customer/CustomerDetailPanel'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import Spinner from '@/components/Shared/Spinner'
import { useCustomers } from '@/hooks/queries'
import { useInViewport } from '@/hooks/utils'
import { getServerURL } from '@/utils/api'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import Search from '@mui/icons-material/Search'
import { schemas } from '@spaire/client'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import Button from '@spaire/ui/components/atoms/Button'
import Input from '@spaire/ui/components/atoms/Input'
import { ShadowBoxOnMd } from '@spaire/ui/components/atoms/ShadowBox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@spaire/ui/components/ui/dropdown-menu'
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface CustomerListPageProps {
  organization: schemas['Organization']
}

export const CustomerListPage = ({ organization }: CustomerListPageProps) => {
  const [sorting, setSorting] = useQueryState(
    'sorting',
    parseAsStringLiteral([
      '-created_at',
      'email',
      'created_at',
      '-email',
      'name',
      '-name',
    ] as const).withDefault('-created_at'),
  )
  const [query, setQuery] = useQueryState('query', parseAsString)

  const { data, fetchNextPage, hasNextPage } = useCustomers(organization.id, {
    query: query ?? undefined,
    sorting: [sorting],
  })

  const customers = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  )

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)

  const {
    show: showCreateModal,
    hide: hideCreateModal,
    isShown: isCreateModalOpen,
  } = useModal()

  const { ref: loadingRef, inViewport } = useInViewport<HTMLDivElement>()

  useEffect(() => {
    if (inViewport && hasNextPage) {
      fetchNextPage()
    }
  }, [inViewport, hasNextPage, fetchNextPage])

  const onExport = useCallback(() => {
    const url = new URL(
      `${getServerURL()}/v1/customers/export?organization_id=${organization.id}`,
    )
    window.open(url, '_blank')
  }, [organization.id])

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-6">
        {customers.length > 0 ? (
          <>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-row items-center gap-3">
                <Input
                  className="w-full md:max-w-64"
                  preSlot={<Search fontSize="small" />}
                  placeholder="Search customers"
                  value={query ?? ''}
                  onChange={(e) => setQuery(e.target.value || null)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() =>
                    setSorting(
                      sorting === '-created_at' ? 'created_at' : '-created_at',
                    )
                  }
                >
                  {sorting === 'created_at' ? (
                    <ArrowUpward fontSize="small" />
                  ) : (
                    <ArrowDownward fontSize="small" />
                  )}
                </Button>
              </div>
              <div className="flex flex-row items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm">
                      Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onExport}>
                      Export customers
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button onClick={showCreateModal}>
                  <AddOutlined className="h-4 w-4" />
                  <span>Add customer</span>
                </Button>
              </div>
            </div>
            <div className="dark:border-spaire-700 dark:divide-spaire-700 flex flex-col divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  className="dark:hover:bg-spaire-800 flex flex-row items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-gray-50"
                  onClick={() => setSelectedCustomerId(customer.id)}
                >
                  <Avatar
                    className="h-9 w-9 shrink-0"
                    avatar_url={customer.avatar_url}
                    name={customer.name || customer.email}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {customer.name || customer.email}
                    </span>
                    {customer.name && (
                      <span className="dark:text-spaire-500 truncate text-xs text-gray-500">
                        {customer.email}
                      </span>
                    )}
                  </div>
                  <span className="dark:text-spaire-600 shrink-0 text-xs text-gray-400">
                    {new Date(customer.created_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
              {hasNextPage && (
                <div
                  ref={loadingRef}
                  className="flex w-full items-center justify-center py-6"
                >
                  <Spinner />
                </div>
              )}
            </div>
          </>
        ) : (
          <ShadowBoxOnMd className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-spaire-700 p-0 md:p-0">
            <img
              src="https://spaire-production-files-public.s3.us-east-1.amazonaws.com/Untitled+design+-+2026-03-19T000326.960.png"
              alt=""
              aria-hidden="true"
              className="h-[420px] w-full object-cover object-top md:h-[640px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between md:p-8">
              <div className="flex flex-col gap-2 md:gap-3">
                <h3 className="text-2xl font-bold text-white md:text-4xl">
                  Your customers, all in one place
                </h3>
                <p className="text-sm text-gray-400">
                  Customers are added automatically at checkout, or you can add
                  them manually.
                </p>
              </div>
              <Button
                size="lg"
                className="w-full shrink-0 bg-white text-black hover:bg-gray-100 hover:opacity-100 border-white/20 md:w-auto md:ml-8"
                onClick={showCreateModal}
              >
                Add Customer
              </Button>
            </div>
          </ShadowBoxOnMd>
        )}
      </div>

      <InlineModal
        isShown={isCreateModalOpen}
        hide={hideCreateModal}
        className="md:w-[680px]"
        modalContent={
          <CreateCustomerModal
            organization={organization}
            onClose={hideCreateModal}
          />
        }
      />

      <InlineModal
        isShown={!!selectedCustomerId}
        hide={() => setSelectedCustomerId(null)}
        className="md:w-[720px]"
        modalContent={
          selectedCustomerId ? (
            <CustomerDetailPanel
              customerId={selectedCustomerId}
              organization={organization}
              onClose={() => setSelectedCustomerId(null)}
            />
          ) : (
            <div />
          )
        }
      />
    </DashboardBody>
  )
}
