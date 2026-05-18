import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { PublishPostScreen } from '../../../../_components/PublishPostScreen'

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Publish · Newsletter' }
}

export default async function Page(props: {
  params: Promise<{
    organization: string
    newsletterId: string
    postId: string
  }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )
  return (
    <PublishPostScreen
      organization={organization}
      newsletterId={params.newsletterId}
      postId={params.postId}
    />
  )
}
