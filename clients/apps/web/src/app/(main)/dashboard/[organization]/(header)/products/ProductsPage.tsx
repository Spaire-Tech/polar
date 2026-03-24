'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import Pagination from '@/components/Pagination/Pagination'
import { CreateProductPage } from '@/components/Products/CreateProductPage'
import { ProductListItem } from '@/components/Products/ProductListItem'
import { useProducts } from '@/hooks/queries/products'
import { useDebouncedCallback } from '@/hooks/utils'
import {
  DataTablePaginationState,
  DataTableSortingState,
  serializeSearchParams,
  sortingStateToQueryParam,
} from '@/utils/datatable'
import AddOutlined from '@mui/icons-material/AddOutlined'
import Search from '@mui/icons-material/Search'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import Input from '@spaire/ui/components/atoms/Input'
import { List } from '@spaire/ui/components/atoms/List'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@spaire/ui/components/atoms/Select'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { useCallback, useState } from 'react'

export default function ClientPage({
  organization: org,
  pagination,
  sorting,
  query: _query,
}: {
  organization: schemas['Organization']
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  query: string | undefined
}) {
  const [query, setQuery] = useState(_query)

  const [show, setShow] = useQueryState('show', {
    defaultValue: 'active',
  })

  const {
    isShown: isCreateModalShown,
    show: showCreateModal,
    hide: hideCreateModal,
  } = useModal()

  const router = useRouter()
  const pathname = usePathname()

  const onPageChange = useCallback(
    (page: number) => {
      const searchParams = serializeSearchParams(pagination, sorting)
      searchParams.set('page', page.toString())
      if (query) {
        searchParams.set('query', query)
      } else {
        searchParams.delete('query')
      }
      router.replace(`${pathname}?${searchParams}`)
    },
    [pagination, router, sorting, pathname, query],
  )

  const onLimitChange = useCallback(
    (limit: string) => {
      const searchParams = serializeSearchParams(
        { ...pagination, pageSize: parseInt(limit), pageIndex: 0 },
        sorting,
      )
      if (query) {
        searchParams.set('query', query)
      } else {
        searchParams.delete('query')
      }
      router.replace(`${pathname}?${searchParams}`)
    },
    [pagination, router, sorting, pathname, query],
  )

  const onSortingChange = useCallback(
    (value: string) => {
      const desc = value.startsWith('-')
      const id = desc ? value.slice(1) : value
      const newSorting: DataTableSortingState = [{ id, desc }]
      const searchParams = serializeSearchParams(
        { ...pagination, pageIndex: 0 },
        newSorting,
      )
      if (query) {
        searchParams.set('query', query)
      } else {
        searchParams.delete('query')
      }
      router.replace(`${pathname}?${searchParams}`)
    },
    [pagination, router, pathname, query],
  )

  const currentSortingValue =
    sorting.length > 0
      ? `${sorting[0].desc ? '-' : ''}${sorting[0].id}`
      : 'name'

  const debouncedQueryChange = useDebouncedCallback(
    (query: string) => {
      const searchParams = serializeSearchParams(pagination, sorting)
      if (query) {
        searchParams.set('query', query)
      } else {
        searchParams.delete('query')
      }
      router.replace(`${pathname}?${searchParams}`)
    },
    500,
    [pagination, sorting, query, router, pathname],
  )

  const onQueryChange = useCallback(
    (query: string) => {
      setQuery(query)
      debouncedQueryChange(query)
    },
    [debouncedQueryChange],
  )

  const products = useProducts(org.id, {
    query,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    sorting: sortingStateToQueryParam(sorting),
    is_archived: show === 'all' ? null : show === 'active' ? false : true,
  })

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-8">
        {products.data && products.data.items.length > 0 ? (
          <>
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <Input
                  className="w-full md:max-w-64"
                  preSlot={<Search fontSize="small" />}
                  placeholder="Search Products"
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                />
                <Select value={show} onValueChange={setShow}>
                  <SelectTrigger className="w-full md:max-w-fit">
                    <SelectValue placeholder="Show archived products" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={currentSortingValue} onValueChange={onSortingChange}>
                  <SelectTrigger className="w-full md:max-w-fit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name A-Z</SelectItem>
                    <SelectItem value="-name">Name Z-A</SelectItem>
                    <SelectItem value="-created_at">Newest</SelectItem>
                    <SelectItem value="created_at">Oldest</SelectItem>
                    <SelectItem value="price_amount">Price: Low to High</SelectItem>
                    <SelectItem value="-price_amount">
                      Price: High to Low
                    </SelectItem>
                  </SelectContent>
                </Select>
                {(products.data?.pagination.total_count ?? 0) > 20 && (
                  <Select
                    value={pagination.pageSize.toString()}
                    onValueChange={onLimitChange}
                  >
                    <SelectTrigger className="w-full md:max-w-fit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">Show 20</SelectItem>
                      <SelectItem value="50">Show 50</SelectItem>
                      <SelectItem value="100">Show 100</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Button
                wrapperClassNames="gap-x-2 md:w-fit"
                className="w-full md:w-fit"
                onClick={showCreateModal}
              >
                <AddOutlined className="h-4 w-4" />
                <span>Create product</span>
              </Button>
            </div>
            <Pagination
              currentPage={pagination.pageIndex + 1}
              pageSize={pagination.pageSize}
              totalCount={products.data?.pagination.total_count || 0}
              currentURL={serializeSearchParams(pagination, sorting)}
              onPageChange={onPageChange}
            >
              <List size="small">
                {products.data.items
                  .sort((a, b) => {
                    if (a.is_archived === b.is_archived) return 0
                    return a.is_archived ? 1 : -1
                  })
                  .map((product) => (
                    <ProductListItem
                      key={product.id}
                      organization={org}
                      product={product}
                    />
                  ))}
              </List>
            </Pagination>
          </>
        ) : (
          <div className="flex flex-col items-center gap-10 py-12 text-center">
            {/* Floating UI mockup */}
            <div className="relative mx-auto h-[300px] w-full max-w-[680px] select-none">
              {/* Back card: storefront product catalog */}
              <div
                className="absolute left-0 top-8 w-[420px] overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5"
                style={{ transform: 'rotate(-1.5deg)' }}
              >
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                  <div className="h-1.5 w-16 rounded-full bg-gray-300" />
                  <div className="h-5 w-20 rounded-lg bg-blue-500/10" />
                </div>
                {[
                  { nameW: 64, sub: true, price: '$29/mo', barW: 72 },
                  { nameW: 48, sub: true, price: '$9/mo', barW: 52 },
                  { nameW: 76, sub: false, price: '$49', barW: 40 },
                ].map((row, i) => (
                  <div key={i} className="flex items-center gap-4 border-b border-gray-50 px-5 py-3.5 last:border-0">
                    {/* Product icon placeholder */}
                    <div className="h-9 w-9 shrink-0 rounded-xl bg-gray-100" />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 rounded-full bg-gray-800" style={{ width: `${row.nameW}px` }} />
                        <div className={`h-4 w-14 rounded-full ${row.sub ? 'bg-blue-500/15' : 'bg-gray-100'}`} />
                      </div>
                      {/* Mini subscriber bar */}
                      <div className="h-1 rounded-full bg-gray-100">
                        <div className="h-1 rounded-full bg-blue-500/40" style={{ width: `${row.barW}%` }} />
                      </div>
                    </div>
                    <div className="h-2 w-10 rounded-full bg-gray-300" />
                  </div>
                ))}
              </div>

              {/* Front card: subscriber stats */}
              <div className="absolute right-0 top-0 w-[244px] rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl ring-1 ring-black/5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">
                    Pro Plan
                  </p>
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-500">
                    Live
                  </span>
                </div>
                <p className="mt-3 text-2xl font-bold text-gray-900">
                  $29<span className="text-sm font-normal text-gray-400">/mo</span>
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                    <p className="text-[10px] text-gray-400">Subscribers</p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900">48</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                    <p className="text-[10px] text-gray-400">MRR</p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900">$1,392</p>
                  </div>
                </div>
                <button className="mt-3 w-full rounded-lg bg-blue-500 py-2 text-xs font-semibold text-white">
                  Create product
                </button>
              </div>
            </div>

            {/* Title + description */}
            <div className="flex flex-col gap-3 max-w-lg">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                Create your first product
              </h2>
              <p className="text-gray-500 dark:text-spaire-400">
                Sell subscriptions, one-time payments, or usage-based plans —
                checkout included.
              </p>
            </div>

            {/* CTA */}
            <Button size="lg" onClick={showCreateModal} className="gap-2">
              <AddOutlined fontSize="small" />
              Create Product
            </Button>
          </div>
        )}
      </div>
      <InlineModal
        isShown={isCreateModalShown}
        hide={hideCreateModal}
        className="md:w-[720px]"
        modalContent={
          <CreateProductPage
            organization={org}
            panelMode={true}
            onClose={hideCreateModal}
          />
        }
      />
    </DashboardBody>
  )
}
