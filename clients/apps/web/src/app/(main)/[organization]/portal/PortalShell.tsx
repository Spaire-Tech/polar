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

  return (
    <div
      className={twMerge(
        'flex w-full flex-col items-stretch gap-6 px-4 py-8 md:flex-row md:gap-12 lg:px-0',
        immersive ? 'md:px-8' : 'md:mx-auto md:max-w-5xl',
      )}
    >
      {!immersive && <Navigation organization={organization} />}
      <div
        className={twMerge(
          'flex w-full flex-col',
          immersive ? '' : 'md:py-12',
        )}
      >
        {children}
      </div>
    </div>
  )
}
