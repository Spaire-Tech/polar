import { Heading, Preview, Section } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import Footer from '../components/Footer'
import WrapperPolar from '../components/WrapperPolar'
import type { schemas } from '../types'

export function PlatformWelcome({
  email,
  plan_name,
  trial_end_date,
  url,
}: schemas['PlatformWelcomeProps']) {
  return (
    <WrapperPolar>
      <Preview>Your Spaire {plan_name} trial is active</Preview>
      <Section>
        <Heading as="h1" className="text-xl font-bold text-gray-900">
          Welcome to Spaire
        </Heading>
        <BodyText>
          Your <span className="font-bold">{plan_name}</span> plan is now active
          and your free trial has started.
        </BodyText>
        {trial_end_date && (
          <BodyText>
            You won&apos;t be charged until your trial ends on{' '}
            <span className="font-bold">{trial_end_date}</span>. You can cancel
            anytime before then from your dashboard.
          </BodyText>
        )}
        <BodyText>
          A few things to try first:
          <br />– Set up your first offer — a course, newsletter, or digital
          product
          <br />– Connect your payouts so you can take real payments
          <br />– Customize your storefront so it feels like yours
        </BodyText>
      </Section>
      <Section className="my-8 text-center">
        <Button href={url}>Go to my dashboard</Button>
      </Section>
      <Section>
        <BodyText>
          Questions? Just reply to this email — a real person reads every one.
        </BodyText>
      </Section>
      <Footer email={email} />
    </WrapperPolar>
  )
}

PlatformWelcome.PreviewProps = {
  email: 'creator@example.com',
  plan_name: 'Studio',
  trial_end_date: 'July 13, 2026',
  url: 'https://app.spairehq.com/dashboard',
}

export default PlatformWelcome
