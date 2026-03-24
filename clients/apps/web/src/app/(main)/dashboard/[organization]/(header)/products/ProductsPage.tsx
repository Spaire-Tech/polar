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
import { ShadowBoxOnMd } from '@spaire/ui/components/atoms/ShadowBox'
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
          <ShadowBoxOnMd className="relative overflow-hidden p-0 md:p-0">
            <img
              src="https://spaire-production-files-public.s3.us-east-1.amazonaws.com/Untitled+design+(39).png"
              alt=""
              aria-hidden="true"
              className="h-[420px] w-full object-cover object-top md:h-[560px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between md:p-8">
              <div className="flex flex-col gap-2 md:gap-3">
                <h3 className="text-2xl font-bold text-white md:text-4xl">
                  Create your first product
                </h3>
                <p className="text-sm text-gray-400">
                  Sell subscriptions, one-time payments, or usage-based plans
                  with checkout built in.
                </p>
              </div>
              <Button
                size="lg"
                className="w-full shrink-0 bg-white text-black hover:bg-gray-100 hover:opacity-100 border-white/20 md:w-auto md:ml-8"
                onClick={showCreateModal}
              >
                Create Product
              </Button>
            </div>
          </ShadowBoxOnMd>
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
