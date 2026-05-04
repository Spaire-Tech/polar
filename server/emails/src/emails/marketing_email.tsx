import MarketingEmailWrapper from '../components/MarketingEmailWrapper'

export interface MarketingEmailProps {
  organizationName: string
  organizationLogoUrl?: string | null
  organizationWebsite?: string | null
  htmlContent: string
  unsubscribeUrl: string
  previewText?: string | null
}

export function MarketingEmail({
  organizationName,
  organizationLogoUrl,
  organizationWebsite,
  htmlContent,
  unsubscribeUrl,
  previewText,
}: MarketingEmailProps) {
  return (
    <MarketingEmailWrapper
      organizationName={organizationName}
      organizationLogoUrl={organizationLogoUrl}
      organizationWebsite={organizationWebsite}
      htmlContent={htmlContent}
      unsubscribeUrl={unsubscribeUrl}
      previewText={previewText}
    />
  )
}

MarketingEmail.PreviewProps = {
  organizationName: 'Acme Inc',
  organizationLogoUrl: null,
  organizationWebsite: 'https://acme.com',
  htmlContent: '<h2>Hello there!</h2><p>This is your weekly newsletter from Acme Inc. We have some exciting news to share with you this week.</p><p>Stay tuned for more updates!</p>',
  unsubscribeUrl: 'https://space.spairehq.com/email/unsubscribe?sid=preview',
  previewText: 'Your weekly update from Acme Inc',
} satisfies MarketingEmailProps

export default MarketingEmail
