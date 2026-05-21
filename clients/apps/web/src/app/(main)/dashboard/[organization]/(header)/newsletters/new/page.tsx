import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import NewsletterWizard from '@/components/Newsletters/NewsletterWizard'
import { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'New newsletter' }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )
  return <NewsletterWizard organization={organization} />
}
