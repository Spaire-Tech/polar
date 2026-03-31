import { spacePageLink } from '@/utils/nav'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getStorefrontOrNotFound } from '@/utils/storefront'
import type { Metadata } from 'next'
import AppPage from './AppPage'

export async function generateMetadata(props: {
  params: Promise<{ organization: string }>
}): Promise<Metadata> {
  const params = await props.params
  const api = await getServerSideAPI()
  const { organization } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )

  const description =
    organization.storefront_settings?.description ??
    `${organization.name} on Spaire`
  const ogImage =
    organization.storefront_settings?.header_image_url ??
    `https://spairehq.com/og?org=${organization.slug}`
  const canonicalUrl = spacePageLink(organization)

  return {
    title: `${organization.name} — Spaire Space`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${organization.name} — Spaire Space`,
      description,
      siteName: 'Spaire',
      type: 'website',
      url: canonicalUrl,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${organization.name} — Spaire Space`,
        },
      ],
      card: 'summary_large_image',
      title: `${organization.name} — Spaire Space`,
      description,
    },
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const { organization, products } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )

  return <AppPage organization={organization} products={products} />
}
