'use client'

import { useCustomerCourses } from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
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

// Portal-wide dark mode: the creator's landing theme follows the customer
// into EVERY portal page (Overview / Courses / Downloads / Orders /
// Billing). Dark when any enrolled course's landing theme is dark; the
// answer is cached per org so revisits don't flash light while the
// courses query resolves.
const themeCacheKey = (slug: string) => `sp_theme:${slug}`

const usePortalDark = (slug: string, token: string): boolean => {
  const { data: enrollments } = useCustomerCourses(token || null)
  const [dark, setDark] = useState(false)
  useEffect(() => {
    try {
      setDark(window.localStorage.getItem(themeCacheKey(slug)) === 'dark')
    } catch {
      /* ignore */
    }
  }, [slug])
  useEffect(() => {
    if (!enrollments) return
    const isDark = enrollments.some((e) => e.course.theme_mode === 'dark')
    setDark(isDark)
    try {
      window.localStorage.setItem(
        themeCacheKey(slug),
        isDark ? 'dark' : 'light',
      )
    } catch {
      /* ignore */
    }
  }, [enrollments, slug])
  return dark
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
  const dark = usePortalDark(organization.slug, token)
  const rootClass = `spaire-portal sp-app sp-app--mobile-tabs${
    dark ? ' sp-dark' : ''
  }`
  // Only the in-lesson player is immersive (full-bleed, no portal nav). The
  // course portal page itself keeps the standard TopBar.
  const immersive = isCourseRoute(pathname) && !!searchParams.get('lesson')
  const auth = isAuthRoute(pathname)

  // The browser canvas (overscroll) must match the theme on every page.
  useEffect(() => {
    if (immersive || auth) return
    const bg = dark ? '#141416' : '#ffffff'
    const root = document.documentElement
    const prevRoot = root.style.backgroundColor
    const prevBody = document.body.style.backgroundColor
    root.style.backgroundColor = bg
    document.body.style.backgroundColor = bg
    return () => {
      root.style.backgroundColor = prevRoot
      document.body.style.backgroundColor = prevBody
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
  // Mobile bottom tab bar stays — the customer needs to be able to leave the
  // course back to Overview / Orders / Billing.
  if (isCourseRoute(pathname)) {
    return (
      <div className={rootClass}>
        <TopBar organization={organization} />
        <main className="sp-course-portal">{children}</main>
        <MobileTabBar organization={organization} />
      </div>
    )
  }

  return (
    <div className={rootClass}>
      <TopBar organization={organization} />
      <main className="sp-page">{children}</main>
      <MobileTabBar organization={organization} />
    </div>
  )
}
