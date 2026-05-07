import { getPublicCoachingProgram } from '@/components/Coaching/api'
import CoachingLanding from '@/components/Coaching/CoachingLanding'
import { defaultCoachingLandingData } from '@/components/Coaching/CoachingLanding.defaults'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export async function generateMetadata(props: {
  params: Promise<{ organization: string; slug: string }>
}): Promise<Metadata> {
  const params = await props.params
  const program = await getPublicCoachingProgram(
    params.organization,
    params.slug,
  )
  if (!program) return { title: 'Coaching program' }
  return {
    title: program.title || 'Coaching program',
    description: program.promise || program.description || undefined,
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string; slug: string }>
}) {
  const params = await props.params
  const program = await getPublicCoachingProgram(
    params.organization,
    params.slug,
  )
  if (!program || !program.published_at) {
    notFound()
  }

  // The product detail page is the canonical buyer entry-point — see
  // /(main)/[organization]/(header)/products/[productId]/ProductDetailPage.tsx
  // which creates a checkout client_secret and forwards to /checkout/{secret}.
  // Linking there keeps a single checkout flow for coaching + non-coaching
  // products. Stubbed if the pattern changes — see report.
  const buyHref = `/${params.organization}/products/${program.product_id}`

  const landingData = program.landing_data ?? defaultCoachingLandingData

  return (
    <CoachingLanding
      program={landingData}
      editable={false}
      buyHref={buyHref}
    />
  )
}
