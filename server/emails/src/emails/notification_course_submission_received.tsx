import { Preview, Section, Text } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import Footer from '../components/Footer'
import IntroWithHi from '../components/IntroWithHi'
import WrapperPolar from '../components/WrapperPolar'
import type { schemas } from '../types'

export function NotificationCourseSubmissionReceived({
  organization_name,
  course_title,
  challenge_title,
  student_display_name,
  caption_preview,
  inbox_url,
}: schemas['MaintainerCourseSubmissionReceivedNotificationPayload']) {
  return (
    <WrapperPolar>
      <Preview>
        {student_display_name} submitted to “{challenge_title}”
      </Preview>
      <IntroWithHi>
        <strong>{student_display_name}</strong> just submitted to{' '}
        <strong>{challenge_title}</strong> in {course_title}.
      </IntroWithHi>
      {caption_preview ? (
        <BodyText>“{caption_preview}”</BodyText>
      ) : (
        <BodyText>
          They added a photo. Open the inbox to take a look and react.
        </BodyText>
      )}
      <Section className="mt-4 mb-8">
        <Text className="m-0 text-sm text-gray-600">
          One emoji from you, and the whole class sees you showed up.
        </Text>
      </Section>
      {inbox_url ? (
        <Section className="mt-6 mb-8">
          <Button href={inbox_url}>Open submissions inbox</Button>
        </Section>
      ) : null}
      <Footer email={null} />
    </WrapperPolar>
  )
}

NotificationCourseSubmissionReceived.PreviewProps = {
  organization_name: 'Acme Inc.',
  organization_slug: 'acme-inc',
  course_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  course_title: 'The Art of Baking Perfectly',
  challenge_title: 'Ship your first croissant',
  student_display_name: 'Maya',
  caption_preview:
    'First attempt. The dough was a little under-laminated but the butter held.',
  inbox_url:
    'https://app.spairehq.com/dashboard/acme-inc/courses/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa?tab=experience',
}

export default NotificationCourseSubmissionReceived
