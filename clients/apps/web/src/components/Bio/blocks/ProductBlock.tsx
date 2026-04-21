'use client'

import OpenInNew from '@mui/icons-material/OpenInNew'
import ShoppingBagOutlined from '@mui/icons-material/ShoppingBagOutlined'
import { getServerURL } from '@/utils/api'
import { useQuery } from '@tanstack/react-query'
import { ProductBlockSettings } from '../types'

interface PublicProduct {
  id: string
  name: string
  description: string | null
  medias?: { public_url: string | null }[]
  organization: { slug: string }
}

export const ProductBlock = ({
  organizationSlug,
  settings,
}: {
  organizationSlug: string
  settings: ProductBlockSettings
}) => {
  const { data: product } = useQuery({
    queryKey: ['bio_product_preview', settings.product_id],
    queryFn: async () => {
      const res = await fetch(
        getServerURL(`/v1/products/${settings.product_id}`),
        { credentials: 'include' },
      )
      if (!res.ok) return null
      return (await res.json()) as PublicProduct
    },
    enabled: !!settings.product_id,
    retry: false,
  })

  if (!product) {
    return (
      <a
        href="#"
        className="flex flex-row items-center gap-4 border-b border-t border-gray-200 px-4 py-4 text-gray-400"
      >
        <ShoppingBagOutlined className="h-6 w-6" />
        <span className="flex-1 text-sm">Loading product…</span>
      </a>
    )
  }

  const thumb = product.medias?.[0]?.public_url
  const href = `/${product.organization.slug}/products/${product.id}`

  return (
    <a
      href={href}
      className="group flex flex-row items-center gap-4 border-b border-t border-gray-200 px-4 py-4 transition-colors hover:bg-gray-50"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <ShoppingBagOutlined className="h-5 w-5 text-gray-400" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold text-gray-900">
          {product.name}
        </span>
        {product.description && (
          <span className="truncate text-[13px] text-gray-500">
            {product.description}
          </span>
        )}
      </div>
      <OpenInNew className="h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-gray-900" />
    </a>
  )
}
