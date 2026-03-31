import { Preview, Section, Text } from '@react-email/components'
import Button from '../components/Button'
import Footer from '../components/Footer'
import WrapperPolar from '../components/WrapperPolar'
import type { schemas } from '../types'

export function UserWelcome({ email }: schemas['UserWelcomeProps']) {
  return (
    <WrapperPolar>
      <Preview>Thanks for signing up to Spaire.</Preview>
      <Section>
        <Text>Hey,</Text>
        <Text>Thanks for signing up to Spaire.</Text>
        <Text>
          We&apos;re really glad you&apos;re here. We built Spaire to make this
          part of running a SaaS feel a lot simpler, and we&apos;re around if
          you need anything while getting set up.
        </Text>
        <Text>To get going:</Text>
        <Text>
          <span className="font-bold">Create your first product</span>
          <br />
          Set up subscriptions, one time payments, or usage based pricing.
        </Text>
        <Text>
          <span className="font-bold">Set up checkout</span>
          <br />
          Use a checkout link on your site, or plug it directly into your
          product.
        </Text>
        <Text>
          <span className="font-bold">Make your first sale</span>
          <br />
          Once that&apos;s live, you&apos;re good to go.
        </Text>
      </Section>
      <Section className="text-center">
        <Button href="https://docs.spairehq.com">Read the docs</Button>
      </Section>
      <Section>
        <Text>
          If anything feels unclear or you get stuck, just reply to this email
          and we&apos;ll help you out.
        </Text>
        <Text>
          Cheers,
          <br />
          <br />
          Bass
          <br />
          Founder | Spaire
        </Text>
      </Section>
      <Footer email={email} />
    </WrapperPolar>
  )
}

UserWelcome.PreviewProps = {
  email: 'john@example.com',
}

export default UserWelcome
