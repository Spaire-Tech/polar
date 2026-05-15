import { getServerSideAPI } from '@/utils/client/serverside'
import { getAuthenticatedUser, getUserOrganizations } from '@/utils/user'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import PlanSelectPage from './PlanSelectPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Choose a plan',
  }
}

export default async function Page() {
  const api = await getServerSideAPI()
  const user = await getAuthenticatedUser()
  if (!user) {
    return redirect('/login')
  }

  // If the user already has an organization, skip the plan-select step
  // entirely and route them into their dashboard. Plan changes after
  // first signup live under Settings > Plan.
  const orgs = await getUserOrganizations(api, true)
  if (orgs.length > 0) {
    return redirect(`/dashboard/${orgs[0].slug}`)
  }

  return <PlanSelectPage userDisplayName={user.email} />
}
