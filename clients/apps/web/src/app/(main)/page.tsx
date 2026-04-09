import Homepage from '@/components/Marketing/Homepage'
import { Metadata } from 'next/types'

export const metadata: Metadata = {
  title: 'Spaire | Payment infrastructure for software',
  description:
    'Spaire is a Merchant of Record for software companies and digital product creators. Accept payments, manage billing, automate tax compliance, and grow revenue — we handle the financial operations so you can focus on building.',
  openGraph: {
    title: 'Spaire | Payment infrastructure for software',
    description:
      'Accept payments, manage billing, automate tax compliance, and grow revenue.',
    url: 'https://www.spairehq.com',
  },
  alternates: {
    canonical: 'https://www.spairehq.com',
  },
}

export default function Page() {
  return <Homepage />
}
