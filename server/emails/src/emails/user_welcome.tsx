import { Preview, Section, Text } from '@react-email/components'
import Button from '../components/Button'
import Footer from '../components/Footer'
import WrapperPolar from '../components/WrapperPolar'
import type { schemas } from '../types'

export function UserWelcome({ email }: schemas['UserWelcomeProps']) {
  return (
    <WrapperPolar>
      <Preview>Thanks for signing up to use Spaire!</Preview>
      <Section>
        <Text>Hey,</Text>
        <Text>Thanks for signing up to use Spaire!</Text>
        <Text>
          My name is Birk. I&apos;m the founder of Spaire and here to help you
          use Spaire to monetize your digital products or SaaS services.
        </Text>
        <Text className="font-bold">1. Create a product (2 min)</Text>
        <Text>
          You can offer one-time products, subscriptions and pay what you want
          pricing. Our built-in product benefits make it easy to sell License
          Keys, File Downloads, Discord- or GitHub invites, and more.
        </Text>
        <Text>
          You can then use Checkout Links to embed on an existing site or easily
          integrate Spaire more deeply in your site or service – checkout our
          docs for more guides.
        </Text>
      </Section>
      <Section className="text-center">
        <Button href="https://app.spairehq.com/dashboard">
          Get started
        </Button>
      </Section>
      <Section>
        <Text>
          I&apos;d love to hear from you if you have any questions, feedback or
          feature requests along the way. Just reply to this email and I will
          personally respond :)
        </Text>
        <Text>
          All my best,
          <br />
          Birk
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
