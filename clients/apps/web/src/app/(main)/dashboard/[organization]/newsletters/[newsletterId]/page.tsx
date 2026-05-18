import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { NewsletterDetailScreen } from '../_components/NewsletterDetailScreen'

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Newsletter' }
}

export default async function Page(props: {
  params: Promise<{ organization: string; newsletterId: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )
  return (
    <NewsletterDetailScreen
      organization={organization}
      newsletterId={params.newsletterId}
    />
  )
}
