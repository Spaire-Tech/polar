'use client'

import { schemas } from '@spaire/client'
import { usePathname } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { Navigation } from './Navigation'

const isImmersiveRoute = (pathname: string): boolean => {
  return /\/portal\/courses\/[^/]+/.test(pathname)
}

export const PortalShell = ({
  organization,
  children,
}: {
  organization: schemas['CustomerOrganization']
  children: React.ReactNode
}) => {
  const pathname = usePathname()
  const immersive = isImmersiveRoute(pathname)

  if (immersive) {
    return <div className="w-full">{children}</div>
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-6 px-4 py-8 md:mx-auto md:max-w-5xl md:flex-row md:gap-12 lg:px-0">
      <Navigation organization={organization} />
      <div className="flex w-full flex-col md:py-12">{children}</div>
    </div>
  )
}
