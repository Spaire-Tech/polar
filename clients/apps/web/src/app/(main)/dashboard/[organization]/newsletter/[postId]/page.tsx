import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { NewsletterPostScreen } from '../_components/NewsletterPostScreen'

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Newsletter post' }
}

export default async function Page(props: {
  params: Promise<{ organization: string; postId: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )
  return (
    <NewsletterPostScreen organization={organization} postId={params.postId} />
  )
}
