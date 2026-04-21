import { BioProfile } from '@/components/Bio/BioProfile'
import { ForceLightMode } from '@/components/Profile/ForceLightMode'
import { getServerURL } from '@/utils/api'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

type BioPage = {
  organization: {
    id: string
    slug: string
    name: string
    avatar_url: string | null
    socials: { platform: string; url: string }[]
    bio_settings: {
      enabled?: boolean
      display_title?: string | null
      short_bio?: string | null
      avatar_shape?: 'circle' | 'rounded'
      show_powered_by?: boolean
      newsletter_enabled?: boolean
      newsletter_heading?: string | null
      newsletter_description?: string | null
    }
  }
  blocks: {
    id: string
    organization_id: string
    type: string
    order: number
    enabled: boolean
    settings: Record<string, unknown>
    created_at: string
    modified_at: string | null
  }[]
}

async function fetchBioPage(slug: string): Promise<BioPage | null> {
  const res = await fetch(getServerURL(`/v1/bio/public/${slug}`), {
    next: { revalidate: 30 },
  })
  if (!res.ok) return null
  return (await res.json()) as BioPage
}

export async function generateMetadata(props: {
  params: Promise<{ organization: string }>
}): Promise<Metadata> {
  const { organization: slug } = await props.params
  const page = await fetchBioPage(slug)
  if (!page) return {}
  const { organization } = page
  const title = organization.name
  const description =
    organization.bio_settings?.short_bio ?? `${organization.name} on Spaire`
  return { title, description }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const { organization: slug } = await props.params
  const page = await fetchBioPage(slug)
  if (!page) notFound()

  return (
    <>
      <ForceLightMode />
      <BioProfile organization={page.organization} blocks={page.blocks} />
    </>
  )
}
