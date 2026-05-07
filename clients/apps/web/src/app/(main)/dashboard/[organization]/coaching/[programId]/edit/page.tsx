import { getCoachingProgram } from '@/components/Coaching/api'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import EditClient from './EditClient'

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Edit landing page' }
}

export default async function Page(props: {
  params: Promise<{ organization: string; programId: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  // We don't have a typed coaching client yet — call the REST endpoint
  // directly. If it 4xxs (e.g. backend not deployed yet) we 404.
  const program = await getCoachingProgram(params.programId)
  if (!program) {
    notFound()
  }

  return <EditClient organization={organization} program={program} />
}
