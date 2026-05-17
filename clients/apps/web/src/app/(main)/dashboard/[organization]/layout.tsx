import { OrganizationContextProvider } from '@/providers/maintainerOrganization'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { getUserOrganizations } from '@/utils/user'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import React from 'react'

export async function generateMetadata(props: {
  params: Promise<{ organization: string }>
}): Promise<Metadata> {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )
  return {
    title: {
      template: `%s | ${organization.name} | Spaire`,
      default: organization.name,
    },
  }
}

export default async function Layout(props: {
  params: Promise<{ organization: string }>
  children: React.ReactNode
}) {
  const params = await props.params

  const { children } = props

  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  let userOrganizations = await getUserOrganizations(api, false)

  // If the organization is not in the user's organizations, refetch bypassing the cache
  // This avoids race conditions with new organizations (e.g. during onboarding) without losing
  // the cache in 99% of the cases
  if (!userOrganizations.some((org) => org.id === organization.id)) {
    userOrganizations = await getUserOrganizations(api, true)
  }

  // If we can't find the organization even after a refresh, redirect
  if (!userOrganizations.some((org) => org.id === organization.id)) {
    return redirect('/dashboard')
  }

  // Plan-selection gate: keep half-onboarded creators out of the
  // dashboard until they finish the onboarding flow. Until
  // `ai_onboarding_completed_at` is stamped (which happens after
  // plan + review + assistant complete), every dashboard route
  // bounces back to /onboarding/plan. This closes the
  // "create-slug-then-bookmark-the-dashboard" bypass that used to
  // give a fresh org full feature access.
  //
  // /onboarding/* is exempted so the user can actually progress
  // through onboarding; /finance/account is exempted so connect-
  // a-payout flows initiated from the AI assistant can finish even
  // when the assistant marks onboarding complete from a side path.
  const requestHeaders = await headers()
  const pathname = requestHeaders.get('x-spaire-pathname') ?? ''
  const orgPathPrefix = `/dashboard/${params.organization}`
  const isOnboardingRoute = pathname.startsWith(`${orgPathPrefix}/onboarding`)
  const isFinanceAccountRoute = pathname.startsWith(
    `${orgPathPrefix}/finance/account`,
  )
  const onboardingCompletedAt = (
    organization as typeof organization & {
      ai_onboarding_completed_at?: string | null
    }
  ).ai_onboarding_completed_at
  if (
    !onboardingCompletedAt &&
    !isOnboardingRoute &&
    !isFinanceAccountRoute
  ) {
    return redirect(`${orgPathPrefix}/onboarding/plan`)
  }

  return (
    <OrganizationContextProvider
      organization={organization}
      organizations={userOrganizations}
    >
      {children}
    </OrganizationContextProvider>
  )
}
