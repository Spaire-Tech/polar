import { NextRequest, NextResponse } from 'next/server'

const SPACE_HOSTNAME =
  process.env.NEXT_PUBLIC_SPACE_BASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SPACE_BASE_URL).hostname
    : 'space.spairehq.com'

export function middleware(request: NextRequest) {
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? ''
  const hostname = host.split(':')[0]

  // Only apply logic for the space subdomain
  if (hostname !== SPACE_HOSTNAME) {
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl

  // Allow static assets, API routes, and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/ingest') ||
    pathname.startsWith('/monitoring') ||
    pathname.startsWith('/assets') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Block dashboard, login, and other non-storefront routes on the space domain
  const blockedPrefixes = [
    '/dashboard',
    '/login',
    '/signup',
    '/settings',
    '/start',
    '/checkout',
    '/oauth2',
    '/docs',
    '/blog',
  ]
  if (blockedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    // Redirect to the main app domain
    const mainUrl = new URL(
      pathname,
      process.env.NEXT_PUBLIC_FRONTEND_BASE_URL || 'https://app.spairehq.com',
    )
    return NextResponse.redirect(mainUrl)
  }

  // Everything else on the space domain (/{org-slug}, /{org-slug}/products/*, /{org-slug}/about)
  // is served as-is — the existing [organization] routes handle it
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
