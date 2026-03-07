import { PolarHog, usePostHog } from '@/hooks/posthog'
import { schemas } from '@spaire/client'
import {
  Code2,
  CreditCard,
  Layers,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type RouteGroup =
  | 'core'
  | 'monetization'
  | 'customers'
  | 'reporting'
  | 'founder-tools'
  | 'platform'

export type SubRoute = {
  readonly title: string
  readonly link: string
  readonly icon?: React.ReactNode
  readonly if?: boolean | (() => boolean)
  readonly extra?: React.ReactNode
}

export type Route = {
  readonly id: string
  readonly title: string
  readonly group?: RouteGroup
  readonly icon?: React.ReactElement<any>
  readonly link: string
  readonly if: boolean | undefined
  readonly subs?: SubRoute[]
  readonly selectedExactMatchOnly?: boolean
  readonly selectedMatchFallback?: boolean
  readonly checkIsActive?: (currentPath: string) => boolean
}

export type SubRouteWithActive = SubRoute & { readonly isActive: boolean }

export type RouteWithActive = Route & {
  readonly isActive: boolean
  readonly subs?: SubRouteWithActive[]
}

// ── Active-state helpers ──────────────────────────────────────────────────────

const applySubRouteIsActive = (
  path: string,
  parentRoute?: Route,
): ((r: SubRoute) => SubRouteWithActive) => {
  return (r: SubRoute): SubRouteWithActive => {
    let isActive = r.link === path

    if (!isActive && path.startsWith(r.link)) {
      if (parentRoute?.link !== r.link) {
        isActive = true
      } else if (parentRoute.subs) {
        const hasMoreSpecificMatch = parentRoute.subs.some(
          (sub) =>
            sub !== r && sub.link !== r.link && path.startsWith(sub.link),
        )
        isActive = !hasMoreSpecificMatch
      }
    }

    return { ...r, isActive }
  }
}

const applyIsActive = (path: string): ((r: Route) => RouteWithActive) => {
  return (r: Route): RouteWithActive => {
    let isActive = false

    if (r.checkIsActive !== undefined) {
      isActive = r.checkIsActive(path)
    } else {
      isActive = Boolean(path && path.startsWith(r.link))
    }

    const subs = r.subs ? r.subs.map(applySubRouteIsActive(path, r)) : undefined

    return { ...r, isActive, subs }
  }
}

// ── Route resolvers ───────────────────────────────────────────────────────────

const useResolveRoutes = (
  routesResolver: (
    org?: schemas['Organization'],
    posthog?: PolarHog,
  ) => Route[],
  org?: schemas['Organization'],
  allowAll?: boolean,
): RouteWithActive[] => {
  const path = usePathname()
  const posthog = usePostHog()

  return useMemo(() => {
    return (
      routesResolver(org, posthog)
        .filter((o) => allowAll || o.if)
        .map((route) => {
          if (route.subs && Array.isArray(route.subs)) {
            return {
              ...route,
              subs: route.subs.filter(
                (child) =>
                  typeof child.if === 'undefined' ||
                  (typeof child.if === 'function' ? child.if() : child.if),
              ),
            }
          }
          return route
        })
        .map(applyIsActive(path))
    )
  }, [org, path, allowAll, routesResolver, posthog])
}

// ── Public hooks ──────────────────────────────────────────────────────────────

/** All dashboard routes (org + account) — used by OmniSearch etc. */
export const useDashboardRoutes = (
  org?: schemas['Organization'],
  allowAll?: boolean,
): RouteWithActive[] => {
  return useResolveRoutes((org) => dashboardRoutesList(org), org, allowAll)
}

/** General (non-org-specific) routes */
export const useGeneralRoutes = (
  org?: schemas['Organization'],
  allowAll?: boolean,
): RouteWithActive[] => {
  return useResolveRoutes((org) => generalRoutesList(org), org, allowAll)
}

/** Org-specific routes (Finance, Settings) */
export const useOrganizationRoutes = (
  org?: schemas['Organization'],
  allowAll?: boolean,
): RouteWithActive[] => {
  return useResolveRoutes(organizationRoutesList, org, allowAll)
}

/** Account settings routes */
export const useAccountRoutes = (): RouteWithActive[] => {
  const path = usePathname()
  return accountRoutesList()
    .filter((o) => o.if)
    .map(applyIsActive(path))
}

// ── Route definitions ─────────────────────────────────────────────────────────

/**
 * General routes — shown for any logged-in org.
 * Grouped into the new Spaire IA:
 *   core → Overview
 *   monetization → Billing, Checkout (Sales), Products
 *   customers → Customers
 *   reporting → Analytics
 *   founder-tools → Startup Stack
 */
const generalRoutesList = (org?: schemas['Organization']): Route[] => [
  // ── CORE ──────────────────────────────────────────────────────────────────
  {
    id: 'home',
    title: 'Overview',
    group: 'core',
    icon: <LayoutDashboard size={14} />,
    link: `/dashboard/${org?.slug}`,
    checkIsActive: (currentRoute: string) =>
      currentRoute === `/dashboard/${org?.slug}`,
    if: true,
  },

  // ── MONETIZATION ──────────────────────────────────────────────────────────
  {
    id: 'revenue',
    title: 'Billing',
    group: 'monetization',
    icon: <CreditCard size={14} />,
    link: `/dashboard/${org?.slug}/sales`,
    checkIsActive: (currentRoute: string) =>
      currentRoute.startsWith(`/dashboard/${org?.slug}/sales`),
    if: true,
  },
  {
    id: 'catalog',
    title: 'Products',
    group: 'monetization',
    icon: <Package size={14} />,
    link: `/dashboard/${org?.slug}/products`,
    checkIsActive: (currentRoute: string) =>
      currentRoute.startsWith(`/dashboard/${org?.slug}/products`),
    if: true,
  },

  // ── CUSTOMERS ─────────────────────────────────────────────────────────────
  {
    id: 'customers',
    title: 'Customers',
    group: 'customers',
    icon: <Users size={14} />,
    link: `/dashboard/${org?.slug}/customers`,
    checkIsActive: (currentRoute: string) =>
      currentRoute.startsWith(`/dashboard/${org?.slug}/customers`),
    if: true,
  },

  // ── REPORTING ─────────────────────────────────────────────────────────────
  {
    id: 'analytics',
    title: 'Analytics',
    group: 'reporting',
    icon: <TrendingUp size={14} />,
    link: `/dashboard/${org?.slug}/analytics`,
    checkIsActive: (currentRoute: string) =>
      currentRoute.startsWith(`/dashboard/${org?.slug}/analytics`),
    if: true,
  },

  // ── FOUNDER TOOLS ─────────────────────────────────────────────────────────
  {
    id: 'startup-stack',
    title: 'Startup Stack',
    group: 'founder-tools',
    icon: <Layers size={14} />,
    link: `/dashboard/${org?.slug}/startup-stack`,
    checkIsActive: (currentRoute: string) =>
      currentRoute.startsWith(`/dashboard/${org?.slug}/startup-stack`),
    if: true,
  },
]

/**
 * Org-specific routes — Finance + Settings.
 * These live in the REPORTING and PLATFORM groups respectively.
 */
const organizationRoutesList = (org?: schemas['Organization']): Route[] => [
  // ── REPORTING ─────────────────────────────────────────────────────────────
  {
    id: 'finance',
    title: 'Finance',
    group: 'reporting',
    link: `/dashboard/${org?.slug}/finance/income`,
    icon: <Wallet size={14} />,
    checkIsActive: (currentRoute: string) =>
      currentRoute.startsWith(`/dashboard/${org?.slug}/finance`),
    if: true,
  },

  // ── PLATFORM ──────────────────────────────────────────────────────────────
  {
    id: 'integrations',
    title: 'Developers',
    group: 'platform',
    icon: <Code2 size={14} />,
    link: `/dashboard/${org?.slug}/integrations`,
    checkIsActive: (currentRoute: string) =>
      currentRoute.startsWith(`/dashboard/${org?.slug}/integrations`),
    if: true,
  },
  {
    id: 'settings',
    title: 'Settings',
    group: 'platform',
    link: `/dashboard/${org?.slug}/settings`,
    icon: <Settings size={14} />,
    checkIsActive: (currentRoute: string) =>
      currentRoute.startsWith(`/dashboard/${org?.slug}/settings`),
    if: true,
  },
]

/** Combined list for OmniSearch / global lookup */
const dashboardRoutesList = (org?: schemas['Organization']): Route[] => [
  ...accountRoutesList(),
  ...generalRoutesList(org),
  ...organizationRoutesList(org),
]

/** Account settings routes */
const accountRoutesList = (): Route[] => [
  {
    id: 'preferences',
    title: 'Preferences',
    link: `/dashboard/account/preferences`,
    icon: <SlidersHorizontal size={14} />,
    if: true,
    subs: undefined,
  },
  {
    id: 'developer',
    title: 'Developer',
    link: `/dashboard/account/developer`,
    icon: <Code2 size={14} />,
    if: true,
  },
]
