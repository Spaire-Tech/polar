import { Preview, Section } from '@react-email/components'
import BodyText from '../components/BodyText'
import Footer from '../components/Footer'
import IntroWithHi from '../components/IntroWithHi'
import WrapperPolar from '../components/WrapperPolar'
import type { schemas } from '../types'

export function UserWelcome({ email }: schemas['UserWelcomeProps']) {
  return (
    <WrapperPolar>
      <Preview>Welcome to Spaire — a quick note from Bass</Preview>
      <IntroWithHi hiMsg="Hey,">
        Thanks for starting your trial with Spaire — really glad you&apos;re
        here.
      </IntroWithHi>
      <Section>
        <BodyText>
          I&apos;m Bass, founder and CEO. I started Spaire because I kept
          watching talented creators hand over a huge cut of what they earn to
          platforms that didn&apos;t really care whether they succeeded. Spaire
          exists to flip that: give you the tools to actually monetize your
          creativity, and get out of your way.
        </BodyText>
        <BodyText>
          Over the next 14 days you&apos;ve got the full run of the product. A
          few things I&apos;d suggest trying first:
        </BodyText>
        <BodyText>
          – Set up your first offer (course, newsletter, digital product —
          whatever fits)
          <br />– Connect your payouts so you can start taking real payments
          <br />– Customize your storefront so it feels like yours
        </BodyText>
        <BodyText>
          If you get stuck, hit reply. This inbox comes to me. I read
          everything, and especially in these early days, the fastest way to
          make Spaire better for you is to tell me what&apos;s not working.
        </BodyText>
        <BodyText>Excited to see what you build.</BodyText>
        <BodyText>
          Bass
          <br />
          Founder &amp; CEO, Spaire
        </BodyText>
      </Section>
      <Footer email={email} />
    </WrapperPolar>
  )
}

UserWelcome.PreviewProps = {
  email: 'john@example.com',
}

export default UserWelcome
