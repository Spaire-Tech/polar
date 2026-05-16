import { getServerSideAPI } from '@/utils/client/serverside'
import { getStorefrontOrNotFound } from '@/utils/storefront'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProductLandingPage } from './ProductLandingPage'

export async function generateMetadata(props: {
  params: Promise<{ organization: string; productId: string }>
}): Promise<Metadata> {
  const params = await props.params
  const api = await getServerSideAPI()
  const { organization, products } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )
  const product = products.find((p) => p.id === params.productId)

  if (!product) {
    notFound()
  }

  return {
    title: `${product.name} by ${organization.name}`,
    openGraph: {
      title: `${product.name}`,
      description: product.description || `A product from ${organization.name}`,
      siteName: 'Spaire',
      type: 'website',
      images: [
        {
          url:
            product.medias[0]?.public_url ??
            `https://spairehq.com/og?org=${organization.slug}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url:
            product.medias[0]?.public_url ??
            `https://spairehq.com/og?org=${organization.slug}`,
          width: 1200,
          height: 630,
          alt: `${product.name}`,
        },
      ],
      card: 'summary_large_image',
      title: `${product.name}`,
      description: product.description || `A product from ${organization.name}`,
    },
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string; productId: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const { organization, products } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )
  const product = products.find((p) => p.id === params.productId)

  if (!product) {
    notFound()
  }

  // "More from <org>" must respect the Space curation — only show
  // products the creator has actually allowed on their Space. In
  // 'curated' mode, featured_product_ids is the visibility list; in
  // 'all' mode every active product is implicitly allowed. The list
  // is also sorted by featured_product_ids when set, so the "more"
  // strip matches the order on the Space landing page.
  const settings = organization.storefront_settings
  const featuredMode = settings?.featured_mode ?? 'curated'
  const featuredIds = settings?.featured_product_ids ?? []
  const scoped =
    featuredMode === 'curated'
      ? products.filter((p) => featuredIds.includes(p.id))
      : products
  const ranked = featuredIds.length
    ? (() => {
        const rank = new Map(featuredIds.map((id, i) => [id, i]))
        const inRank = scoped
          .filter((p) => rank.has(p.id))
          .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
        const outRank = scoped.filter((p) => !rank.has(p.id))
        return [...inRank, ...outRank]
      })()
    : scoped
  const otherProducts = ranked.filter((p) => p.id !== product.id)

  return (
    <ProductLandingPage
      organization={organization}
      product={product}
      otherProducts={otherProducts}
    />
  )
}
