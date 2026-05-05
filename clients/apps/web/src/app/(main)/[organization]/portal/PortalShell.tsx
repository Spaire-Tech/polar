'use client'

import { schemas } from '@spaire/client'
import { usePathname } from 'next/navigation'
import { TopBar } from './_components/TopBar'
import './portal.css'

const isImmersiveRoute = (pathname: string): boolean => {
  return /\/portal\/courses\/[^/]+/.test(pathname)
}

const isAuthRoute = (pathname: string): boolean => {
  return (
    pathname.endsWith('/portal/request') ||
    pathname.endsWith('/portal/authenticate') ||
    pathname.endsWith('/portal/claim')
  )
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
  const auth = isAuthRoute(pathname)

  if (immersive) {
    // Course player keeps its own immersive layout.
    return <div className="w-full">{children}</div>
  }

  if (auth) {
    // Sign-in / claim screens render full-bleed without the portal nav.
    return <div className="spaire-portal sp-app">{children}</div>
  }

  return (
    <div className="spaire-portal sp-app">
      <TopBar organization={organization} />
      <main className="sp-page">{children}</main>
    </div>
  )
}
