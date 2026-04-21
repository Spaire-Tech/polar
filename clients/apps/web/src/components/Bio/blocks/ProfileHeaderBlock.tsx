import Avatar from '@spaire/ui/components/atoms/Avatar'
import { BioSocialIcons } from '../BioSocialIcons'
import { BioOrganizationLite, ProfileHeaderBlockSettings } from '../types'

export const ProfileHeaderBlock = ({
  organization,
  settings,
}: {
  organization: BioOrganizationLite
  settings: ProfileHeaderBlockSettings
}) => {
  const { avatar_shape, display_title, short_bio } = organization.bio_settings
  const showSocials = settings.show_socials ?? true
  const shapeClass = avatar_shape === 'rounded' ? 'rounded-2xl' : 'rounded-full'

  return (
    <header className="flex flex-col items-center gap-5 text-center">
      {organization.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={organization.avatar_url}
          alt={organization.name}
          className={`h-24 w-24 object-cover ${shapeClass}`}
        />
      ) : (
        <Avatar
          className={`h-24 w-24 text-2xl ${shapeClass}`}
          name={organization.name}
          avatar_url={null}
        />
      )}
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          {organization.name}
        </h1>
        {display_title && (
          <p className="text-sm font-medium text-gray-500">{display_title}</p>
        )}
        {short_bio && (
          <p className="max-w-sm text-sm leading-relaxed text-gray-500">
            {short_bio}
          </p>
        )}
      </div>
      {showSocials && <BioSocialIcons socials={organization.socials} />}
    </header>
  )
}
