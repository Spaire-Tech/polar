'use client'

import { OrganizationContext } from '@/providers/maintainerOrganization'
import { useOnboardingTracking } from '@/hooks'
import { useRouter } from 'next/navigation'
import { useContext, useEffect } from 'react'

export default function ClientPage() {
  const { organization } = useContext(OrganizationContext)
  const router = useRouter()
  const { trackStepStarted, trackStepCompleted, getSession } =
    useOnboardingTracking()

  useEffect(() => {
    const session = getSession()
    if (session) {
      trackStepStarted('integrate', organization.id)
      trackStepCompleted('integrate', organization.id)
    }
    router.replace(`/dashboard/${organization.slug}/onboarding/appearance`)
  }, [organization, router, getSession, trackStepStarted, trackStepCompleted])

  return null
}
