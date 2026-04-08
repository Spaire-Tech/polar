import Homepage from '@/components/Marketing/Homepage'
import { Metadata } from 'next/types'

export const metadata: Metadata = {
  title: 'Spaire | The financial backbone for SaaS',
  description:
    'Spaire is a Merchant of Record built for SaaS. Accept payments, manage subscriptions, handle global tax compliance, and grow revenue — without building financial infrastructure from scratch.',
  openGraph: {
    title: 'Spaire | The financial backbone for SaaS',
    description:
      'Accept payments, manage subscriptions, handle global tax compliance, and grow revenue.',
    url: 'https://www.spairehq.com',
  },
  alternates: {
    canonical: 'https://www.spairehq.com',
  },
}

export default function Page() {
  return <Homepage />
}
