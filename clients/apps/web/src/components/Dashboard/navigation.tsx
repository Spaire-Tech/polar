import { useOrganizationAccount } from '@/hooks/queries'
import { PolarHog, usePostHog } from '@/hooks/posthog'
import {
  MarkAnalytics,
  MarkBook,
  MarkCart,
  MarkCode,
  MarkCoin,
  MarkGrid,
  MarkLayers,
  MarkMailOpen,
  MarkPackage,
  MarkPeople,
  MarkSliders,
  MarkStore,
  MarkZap,
} from '@/components/Icons/MarkIcons'
import { schemas } from '@spaire/client'
import { usePathname } from 'next/navigation'
import { useCallback, useMemo } from 'react'

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
  readonly icon?: React.ReactElement<any>
  readonly link: string
  readonly if: boolean | undefined
  readonly subs?: SubRoute[]
  readonly showSubsInNav?: boolean
  readonly selectedExactMatchOnly?: boolean
  readonly selectedMatchFallback?: boolean
  readonly checkIsActive?: (currentPath: string) => boolean
}

export type SubRouteWithActive = SubRoute & { readonly isActive: boolean }

export type RouteWithActive = Route & {
  readonly isActive: boolean
  readonly subs?: SubRouteWithActive[]
}

const NAV_ICON_SIZE = 20

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

    return {
      ...r,
      isActive,
    }
  }
}

const applyIsActive = (path: string): ((r: Route) => RouteWithActive) => {
  return (r: Route): RouteWithActive => {
    let isActive = false

    if (r.checkIsActive !== undefined) {
      isActive = r.checkIsActive(path)
    } else {
      // Fallback
      isActive = Boolean(path && path.startsWith(r.link))
    }

    const subs = r.subs ? r.subs.map(applySubRouteIsActive(path, r)) : undefined

    return {
      ...r,
      isActive,
      subs,
    }
  }
}

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
        // Filter out child routes if they have an if-function and it evaluates to false
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

export const useDashboardRoutes = (
  org?: schemas['Organization'],
  allowAll?: boolean,
): RouteWithActive[] => {
  return useResolveRoutes((org) => dashboardRoutesList(org), org, allowAll)
}

export const useGeneralRoutes = (
  org?: schemas['Organization'],
  allowAll?: boolean,
): RouteWithActive[] => {
  return useResolveRoutes((org) => generalRoutesList(org), org, allowAll)
}

export const useOrganizationRoutes = (
  org?: schemas['Organization'],
  allowAll?: boolean,
): RouteWithActive[] => {
  const { data: account, error: accountError } = useOrganizationAccount(org?.id)
  // Explicit 404 = no account exists yet → send to setup
  const noAccount =
    accountError && (accountError as any)?.response?.status === 404
  // Pass false when no account or payouts disabled; undefined while still loading (no redirect)
  const payoutsReady = noAccount
    ? false
    : account?.is_payouts_enabled
  const resolver = useCallback(
    (o?: schemas['Organization'], posthog?: PolarHog) =>
      organizationRoutesList(o, posthog, payoutsReady),
    [payoutsReady],
  )
  return useResolveRoutes(resolver, org, allowAll)
}

export const useAccountRoutes = (): RouteWithActive[] => {
  const path = usePathname()
  return accountRoutesList()
    .filter((o) => o.if)
    .map(applyIsActive(path))
}

// internals below

const generalRoutesList = (org?: schemas['Organization']): Route[] => [
  {
    id: 'home',
    title: 'Overview',
    icon: <MarkGrid size={NAV_ICON_SIZE} />,
    link: `/dashboard/${org?.slug}`,
    checkIsActive: (currentRoute: string) =>
      currentRoute === `/dashboard/${org?.slug}`,
    if: true,
  },
  {
    id: 'space',
    title: 'Space',
    icon: <MarkStore size={NAV_ICON_SIZE} />,
    link: `/dashboard/${org?.slug}/storefront`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org?.slug}/storefront`)
    },
    if: true,
  },
  {
    id: 'catalog',
    title: 'Products',
    icon: <MarkPackage size={NAV_ICON_SIZE} />,
    link: `/dashboard/${org?.slug}/products`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org?.slug}/products`)
    },
    if: true,
    showSubsInNav: false,
    subs: [
      { title: 'Products', link: `/dashboard/${org?.slug}/products` },
      { title: 'Payment Links', link: `/dashboard/${org?.slug}/products/checkout-links` },
      { title: 'Discounts', link: `/dashboard/${org?.slug}/products/discounts` },
      { title: 'Files', link: `/dashboard/${org?.slug}/products/benefits` },
    ],
  },
  {
    id: 'courses',
    title: 'Courses',
    icon: <MarkBook size={NAV_ICON_SIZE} />,
    link: `/dashboard/${org?.slug}/courses`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org?.slug}/courses`)
    },
    if: true,
  },
  {
    id: 'customers',
    title: 'Customers',
    icon: <MarkPeople size={NAV_ICON_SIZE} />,
    link: `/dashboard/${org?.slug}/customers`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org?.slug}/customers`)
    },
    if: true,
  },
  {
    id: 'invoices',
    title: 'Invoices',
    icon: <MarkMailOpen size={NAV_ICON_SIZE} />,
    link: `/dashboard/${org?.slug}/invoices`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org?.slug}/invoices`)
    },
    if: false,
  },
  {
    id: 'analytics',
    title: 'Analytics',
    icon: <MarkAnalytics size={NAV_ICON_SIZE} />,
    link: `/dashboard/${org?.slug}/analytics`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org?.slug}/analytics`)
    },
    if: true,
  },
  {
    id: 'sales',
    title: 'Sales',
    icon: <MarkCart size={NAV_ICON_SIZE} />,
    link: `/dashboard/${org?.slug}/sales`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org?.slug}/sales`)
    },
    if: true,
  },
  {
    id: 'marketing',
    title: 'Marketing',
    icon: <MarkMailOpen size={NAV_ICON_SIZE} />,
    link: `/dashboard/${org?.slug}/email-marketing`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org?.slug}/email-marketing`)
    },
    if: true,
  },
  {
    id: 'developers',
    title: 'Developers',
    icon: <MarkZap size={NAV_ICON_SIZE} />,
    link: `/dashboard/${org?.slug}/developers`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org?.slug}/developers`)
    },
    if: true,
  },
  {
    id: 'founder-tools',
    title: 'Founder Tools',
    icon: <MarkLayers size={NAV_ICON_SIZE} />,
    link: `/dashboard/${org?.slug}/founder-tools`,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org?.slug}/founder-tools`)
    },
    if: true,
  },
]

const dashboardRoutesList = (org?: schemas['Organization']): Route[] => [
  ...accountRoutesList(),
  ...generalRoutesList(org),
  ...organizationRoutesList(org),
]

const accountRoutesList = (): Route[] => [
  {
    id: 'preferences',
    title: 'Preferences',
    link: `/dashboard/account/preferences`,
    icon: <MarkSliders size={NAV_ICON_SIZE} />,
    if: true,
    subs: undefined,
  },
  {
    id: 'developer',
    title: 'Developer',
    link: `/dashboard/account/developer`,
    icon: <MarkCode size={NAV_ICON_SIZE} />,
    if: true,
  },
]

const organizationRoutesList = (
  org?: schemas['Organization'],
  _posthog?: PolarHog,
  payoutsReady?: boolean,
): Route[] => [
  {
    id: 'finance',
    title: 'Payouts',
    // false = no account or disabled → account setup; undefined = still loading → keep /income
    link:
      payoutsReady === false
        ? `/dashboard/${org?.slug}/finance/account`
        : `/dashboard/${org?.slug}/finance/income`,
    icon: <MarkCoin size={NAV_ICON_SIZE} />,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org?.slug}/finance`)
    },
    if: true,
  },
  {
    id: 'settings',
    title: 'Settings',
    link: `/dashboard/${org?.slug}/settings`,
    icon: <MarkSliders size={NAV_ICON_SIZE} />,
    checkIsActive: (currentRoute: string): boolean => {
      return currentRoute.startsWith(`/dashboard/${org?.slug}/settings`)
    },
    if: true,
  },
]
