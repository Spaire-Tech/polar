import revalidate from '@/app/actions'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getAuthenticatedUser, getUserOrganizations } from '@/utils/user'
import { schemas } from '@spaire/client'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import CreatePage from './CreatePage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Create Organization', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  searchParams: Promise<{
    slug?: string
    auto?: string
    existing_org?: boolean
    from_welcome?: string
  }>
}) {
  const searchParams = await props.searchParams

  const { slug, auto, existing_org, from_welcome } = searchParams

  let validationErrors: schemas['ValidationError'][] = []
  const error: string | undefined = undefined

  // Always show welcome first for brand-new users who haven't come from it yet
  if (!from_welcome && !existing_org) {
    const api = await getServerSideAPI()
    const existingOrgs = await getUserOrganizations(api, true)
    if (existingOrgs.length === 0) {
      // Carry slug/auto through so the welcome page can forward them back
      const params = new URLSearchParams()
      if (slug) params.set('slug', slug)
      if (auto) params.set('auto', auto)
      const qs = params.toString()
      return redirect(`/welcome${qs ? `?${qs}` : ''}`)
    }
  }

  // Create the organization automatically if the slug is provided and auto is true
  if (auto === 'true' && slug) {

    const api = await getServerSideAPI()
    const { data: organization, error } = await api.POST('/v1/organizations/', {
      body: {
        name: slug,
        slug,
      },
    })
    if (error && error.detail) {
      validationErrors = error.detail
    }
    if (organization) {
      await revalidate(`organizations:${organization.id}`)
      await revalidate(`organizations:${organization.slug}`)
      await revalidate(`storefront:${organization.slug}`)
      const currentUser = await getAuthenticatedUser()
      await revalidate(`users:${currentUser?.id}:organizations`, { expire: 0 })
      return redirect(`/dashboard/${organization.slug}/onboarding/review`)
    }
  }

  return (
    <CreatePage
      hasExistingOrg={!!existing_org}
      validationErrors={validationErrors}
      error={error}
    />
  )
}
