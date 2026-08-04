import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import LandingMobileEditor from './LandingMobileEditor'

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Landing — mobile preview' }
}

// Bare editable landing canvas, loaded inside the Landing tab's phone frame
// via an iframe. Because the iframe IS the viewport, the landing's real
// mobile media queries apply and every editor affordance (touch-to-edit,
// reposition, cover/trailer pills) works at true phone size.
export default async function Page(props: {
  params: Promise<{ organization: string; courseId: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  return (
    <LandingMobileEditor
      organization={organization}
      courseId={params.courseId}
    />
  )
}
