'use client'

import { schemas } from '@spaire/client'
import { usePathname, useSearchParams } from 'next/navigation'
import { MobileTabBar } from './_components/MobileTabBar'
import { TopBar } from './_components/TopBar'
import './portal.css'

const isCourseRoute = (pathname: string): boolean => {
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
  const searchParams = useSearchParams()
  // Only the in-lesson player is immersive (full-bleed, no portal nav). The
  // course portal page itself keeps the standard TopBar.
  const immersive =
    isCourseRoute(pathname) && !!searchParams.get('lesson')
  const auth = isAuthRoute(pathname)

  if (immersive) {
    return <div className="w-full">{children}</div>
  }

  if (auth) {
    // Sign-in / claim screens render full-bleed without the portal nav.
    return <div className="spaire-portal sp-app">{children}</div>
  }

  // The course portal page renders its own full-bleed layout (cinematic hero
  // + module rows) and so opts out of the standard .sp-page max-width wrapper.
  // Mobile bottom tab bar stays — the customer needs to be able to leave the
  // course back to Overview / Orders / Billing.
  if (isCourseRoute(pathname)) {
    return (
      <div className="spaire-portal sp-app sp-app--mobile-tabs">
        <TopBar organization={organization} />
        <main className="sp-course-portal">{children}</main>
        <MobileTabBar organization={organization} />
      </div>
    )
  }

  return (
    <div className="spaire-portal sp-app sp-app--mobile-tabs">
      <TopBar organization={organization} />
      <main className="sp-page">{children}</main>
      <MobileTabBar organization={organization} />
    </div>
  )
}
