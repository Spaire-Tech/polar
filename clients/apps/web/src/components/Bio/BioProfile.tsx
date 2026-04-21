import { BookingBlock } from './blocks/BookingBlock'
import { DividerBlock } from './blocks/DividerBlock'
import { LinksBlock } from './blocks/LinksBlock'
import { NewsletterBlock } from './blocks/NewsletterBlock'
import { ProductBlock } from './blocks/ProductBlock'
import { ProfileHeaderBlock } from './blocks/ProfileHeaderBlock'
import { TextBlock } from './blocks/TextBlock'
import { VideoBlock } from './blocks/VideoBlock'
import {
  BioBlock,
  BioOrganizationLite,
  LinksBlockSettings,
  ProductBlockSettings,
  ProfileHeaderBlockSettings,
} from './types'

const renderBlock = (
  block: BioBlock,
  organization: BioOrganizationLite,
): React.ReactNode => {
  switch (block.type) {
    case 'profile_header':
      return (
        <ProfileHeaderBlock
          organization={organization}
          settings={block.settings as ProfileHeaderBlockSettings}
        />
      )
    case 'links':
      return <LinksBlock settings={block.settings as LinksBlockSettings} />
    case 'product':
      return (
        <ProductBlock
          organizationSlug={organization.slug}
          settings={block.settings as unknown as ProductBlockSettings}
        />
      )
    case 'video':
      return <VideoBlock settings={block.settings as never} />
    case 'booking':
      return <BookingBlock settings={block.settings as never} />
    case 'text':
      return <TextBlock settings={block.settings as never} />
    case 'divider':
      return <DividerBlock />
    case 'newsletter':
      return (
        <NewsletterBlock
          heading={
            (block.settings?.heading as string | null | undefined) ??
            organization.bio_settings.newsletter_heading ??
            null
          }
          description={
            (block.settings?.description as string | null | undefined) ??
            organization.bio_settings.newsletter_description ??
            null
          }
          organizationSlug={organization.slug}
        />
      )
    default:
      return null
  }
}

export const BioProfile = ({
  organization,
  blocks,
}: {
  organization: BioOrganizationLite
  blocks: BioBlock[]
}) => {
  const hasProfileHeader = blocks.some(
    (b) => b.type === 'profile_header' && b.enabled,
  )
  const ordered = [...blocks]
    .filter((b) => b.enabled)
    .sort((a, b) => a.order - b.order)
  const showNewsletterFallback =
    organization.bio_settings.newsletter_enabled &&
    !ordered.some((b) => b.type === 'newsletter')

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-5 py-10 sm:py-14">
      {!hasProfileHeader && (
        <ProfileHeaderBlock
          organization={organization}
          settings={{ show_socials: true }}
        />
      )}
      {ordered.map((block) => (
        <div key={block.id}>{renderBlock(block, organization)}</div>
      ))}
      {showNewsletterFallback && (
        <NewsletterBlock
          heading={organization.bio_settings.newsletter_heading ?? null}
          description={organization.bio_settings.newsletter_description ?? null}
          organizationSlug={organization.slug}
        />
      )}
      {organization.bio_settings.show_powered_by !== false && (
        <footer className="mt-10 flex justify-center">
          <a
            href="https://spairehq.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 transition-colors hover:text-gray-900"
          >
            Powered by Spaire
          </a>
        </footer>
      )}
    </main>
  )
}
