'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import Pagination from '@/components/Pagination/Pagination'
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

  const router = useRouter()
  const pathname = usePathname()

  const handleCreateProduct = useCallback(() => {
    router.push(`/dashboard/${org.slug}/products/new`)
  }, [router, org.slug])

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
                onClick={handleCreateProduct}
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
          <div className="flex flex-col items-center gap-8 pt-4 pb-12 text-center">
            <div className="overflow-hidden rounded-2xl">
              <img
                src="https://spaire-production-files-public.s3.us-east-1.amazonaws.com/Untitled+design+(39).png"
                alt="Products"
                className="h-[260px] w-auto object-cover"
              />
            </div>
            <div className="flex max-w-lg flex-col gap-3">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                Create your first product
              </h2>
              <p className="text-gray-500 dark:text-spaire-400">
                Sell subscriptions, one-time payments, or usage-based plans
                with checkout built in.
              </p>
            </div>
            <Button size="lg" onClick={handleCreateProduct} className="gap-2">
              Create Product
            </Button>
          </div>
        )}
      </div>
    </DashboardBody>
  )
}
