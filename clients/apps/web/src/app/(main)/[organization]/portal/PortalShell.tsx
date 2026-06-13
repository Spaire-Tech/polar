'use client'

import { schemas } from '@spaire/client'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { MobileTabBar } from './_components/MobileTabBar'
import { TopBar } from './_components/TopBar'
import { usePortalTheme } from './usePortalTheme'
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
  const token =
    searchParams.get('customer_session_token') ??
    searchParams.get('member_session_token') ??
    ''
  const { dark } = usePortalTheme(organization.slug, token)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const rootClass = `spaire-portal sp-app sp-app--mobile-tabs${
    dark ? ' sp-dark' : ''
  }`
  // Only the in-lesson player is immersive (full-bleed, no portal nav). The
  // course portal page itself keeps the standard TopBar.
  const immersive = isCourseRoute(pathname) && !!searchParams.get('lesson')
  const auth = isAuthRoute(pathname)

  // Paint every ancestor (and the browser canvas) the theme colour. The
  // (main) layout wraps the portal in a bg-white div; without this the
  // short pages (Courses / Downloads / Orders) leaked white below the
  // content and the overscroll flashed white.
  useEffect(() => {
    if (immersive || auth) return
    const bg = dark ? '#141416' : '#ffffff'
    const touched: { el: HTMLElement; prev: string }[] = []
    let node: HTMLElement | null = rootRef.current?.parentElement ?? null
    while (node && node !== document.body) {
      touched.push({ el: node, prev: node.style.backgroundColor })
      node.style.backgroundColor = bg
      node = node.parentElement
    }
    const root = document.documentElement
    const body = document.body
    const prevRoot = root.style.backgroundColor
    const prevBody = body.style.backgroundColor
    root.style.backgroundColor = bg
    body.style.backgroundColor = bg
    return () => {
      for (const { el, prev } of touched) el.style.backgroundColor = prev
      root.style.backgroundColor = prevRoot
      body.style.backgroundColor = prevBody
    }
  }, [dark, immersive, auth])

  if (immersive) {
    return <div className="w-full">{children}</div>
  }

  if (auth) {
    // Sign-in / claim screens render full-bleed without the portal nav.
    return (
      <div className={`spaire-portal sp-app${dark ? ' sp-dark' : ''}`}>
        {children}
      </div>
    )
  }

  // The course portal page renders its own full-bleed layout (cinematic hero
  // + module rows) and so opts out of the standard .sp-page max-width wrapper.
  if (isCourseRoute(pathname)) {
    return (
      <div ref={rootRef} className={rootClass}>
        <TopBar organization={organization} />
        <main className="sp-course-portal">{children}</main>
        <MobileTabBar organization={organization} />
      </div>
    )
  }

  return (
    <div ref={rootRef} className={rootClass}>
      <TopBar organization={organization} />
      <main className="sp-page">{children}</main>
      <MobileTabBar organization={organization} />
    </div>
  )
}
