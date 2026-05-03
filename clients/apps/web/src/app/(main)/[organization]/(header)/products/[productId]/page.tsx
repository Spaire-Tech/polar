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

  const otherProducts = products.filter((p) => p.id !== product.id)

  return (
    <ProductLandingPage
      organization={organization}
      product={product}
      otherProducts={otherProducts}
    />
  )
}
