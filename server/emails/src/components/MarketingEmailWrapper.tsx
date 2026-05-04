import {
  Body,
  Column,
  Container,
  Hr,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'
import WrapperBase from './WrapperBase'

interface MarketingEmailWrapperProps {
  organizationName: string
  organizationLogoUrl?: string | null
  organizationWebsite?: string | null
  htmlContent: string
  unsubscribeUrl: string
  previewText?: string | null
}

const MarketingEmailWrapper = ({
  organizationName,
  organizationLogoUrl,
  organizationWebsite,
  htmlContent,
  unsubscribeUrl,
  previewText,
}: MarketingEmailWrapperProps) => {
  const header = (
    <Section className="pt-[10px] pb-[4px]">
      <Row>
        {organizationLogoUrl && (
          <Column className="w-10">
            <Img
              alt={organizationName}
              src={organizationLogoUrl}
              className="size-8 overflow-hidden rounded-full object-cover"
            />
          </Column>
        )}
        <Column>
          <Text className="my-0 text-lg font-bold text-gray-900">
            {organizationName}
          </Text>
        </Column>
      </Row>
    </Section>
  )

  return (
    <WrapperBase>
      {previewText && <Preview>{previewText}</Preview>}
      <Body className="bg-white font-sans">
        <Container className="px-[20px] pt-[20px] pb-[10px]">
          {organizationWebsite ? (
            <Link href={organizationWebsite} className="no-underline">
              {header}
            </Link>
          ) : (
            header
          )}
        </Container>
        <Container className="px-[20px] pt-[10px] pb-[20px]">
          {/* User-composed HTML content */}
          <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
        </Container>
        <Container className="px-[20px] pb-[20px]">
          <Hr className="border-gray-200" />
          <Section className="text-center text-sm">
            <Text className="text-gray-500">
              You're receiving this email because you subscribed to updates from{' '}
              <span className="font-semibold">{organizationName}</span>.
            </Text>
            <Text>
              <Link
                href={unsubscribeUrl}
                className="text-gray-500 underline"
              >
                Unsubscribe
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </WrapperBase>
  )
}

export default MarketingEmailWrapper
