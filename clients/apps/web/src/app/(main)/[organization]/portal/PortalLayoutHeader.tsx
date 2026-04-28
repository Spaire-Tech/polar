'use client'

import { schemas } from '@spaire/client'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import { usePathname } from 'next/navigation'

export const PortalLayoutHeader = ({
  organization,
}: {
  organization: schemas['CustomerOrganization']
}) => {
  const pathname = usePathname()
  const immersive = /\/portal\/courses\/[^/]+/.test(pathname)

  if (immersive) return null

  return (
    <div className="flex w-full flex-col">
      <div className="flex flex-col justify-center gap-y-12 px-4 py-4 lg:px-8 lg:py-8">
        <Avatar
          className="h-8 w-8"
          avatar_url={organization.avatar_url}
          name={organization.name}
        />
      </div>
    </div>
  )
}
