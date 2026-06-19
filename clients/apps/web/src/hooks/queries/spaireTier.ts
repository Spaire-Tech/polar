import { api } from '@/utils/client'
import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query'
import { defaultRetry } from './retry'

/**
 * The Spaire-tier endpoints are generated into @spaire/client after
 * `pnpm generate` runs against a deployed API. Until that's been
 * regenerated, the typed client doesn't know about these paths and
 * TypeScript would refuse to call api.GET('/v1/platform/plans'). We
 * cast the api to a permissive shape so these hooks compile today;
 * once the generated types catch up, drop the cast and the literal
 * paths in the existing client gain full type-safety automatically.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const platformApi = api as unknown as any

// -----------------------------------------------------------------------------
// Types — mirror polar/platform/schemas.py
// -----------------------------------------------------------------------------

export type SpaireTierKey =
  | 'starter'
  | 'studio'
  | 'scale'
  // No-plan fallbacks: `inactive` = real creator with no active plan;
  // `unmanaged` = dev / self-host (platform billing not configured).
  | 'inactive'
  | 'unmanaged'

export type PaidTierKey = 'starter' | 'studio' | 'scale'

export type BillingInterval = 'month' | 'year'

export interface TransactionFee {
  percent_basis_points: number
  fixed_cents: number
}

export interface TierLimits {
  published_courses: number | null
  lessons_per_course: number | null
  active_email_sequences: number | null
  video_hours_hosted: number | null
  video_views_monthly: number | null
  storage_gb: number | null
  email_subscribers: number | null
  email_sends_monthly: number | null
  dashboard_team_seats: number | null
}

export interface TierFeatures {
  drip_scheduling: boolean
  email_sequences_and_segments: boolean
  email_ab_testing: boolean
  stackable_discounts: boolean
  custom_email_sender_domain: boolean
  seat_based_product_pricing: boolean
  cohort_analytics: boolean
  custom_pricing_negotiation: boolean
  customer_wallet: boolean
  white_label_course_player: boolean
  sandbox_mode: boolean
  custom_storefront_domain: boolean
  custom_checkout_domain: boolean
  sso: boolean
  audit_logs: boolean
}

export interface Entitlements {
  tier: SpaireTierKey
  transaction_fee: TransactionFee
  limits: TierLimits
  features: TierFeatures
  rate_limit_group: string
  monthly_price_cents: number
}

export interface TierPlan {
  tier: SpaireTierKey
  name: string
  description: string | null
  product_id: string | null
  annual_product_id: string | null
  monthly_price_cents: number
  annual_price_cents: number | null
  annual_savings_percent: number
  currency: string
  trial_days: number | null
  transaction_fee: TransactionFee
  features: TierFeatures
  limits: TierLimits
}

export interface CurrentSpaireSubscription {
  tier: SpaireTierKey
  billing_interval: BillingInterval | null
  status: string
  monthly_price_cents: number
  currency: string
  current_period_end: string | null
  trial_end: string | null
  cancel_at_period_end: boolean
  // Set only while status === 'past_due' (a Spaire charge failed). past_due_at
  // is when it first failed; suspension_at is the deadline to pay before the
  // subscription is canceled and the org drops to no-plan.
  past_due_at: string | null
  suspension_at: string | null
  // True only while the active sub is the auto-created Starter trial
  // (managed_by=trial). Flips False once the creator goes through
  // upgrade-checkout. Onboarding review uses this to verify a Stripe
  // checkout actually finished when it sees ?upgraded=1.
  is_default_trial: boolean
  entitlements: Entitlements
}

export interface QuotaUsage {
  quota: string
  limit: number | null
  used: number
  remaining: number | null
  is_unlimited: boolean
  is_exceeded: boolean
}

export interface OrganizationUsage {
  items: QuotaUsage[]
}

export interface UpgradeCheckout {
  checkout_id: string
  checkout_url: string
  client_secret: string
}

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

export const useSpairePlans: () => UseQueryResult<{ items: TierPlan[] }> = () =>
  useQuery({
    queryKey: ['spaire', 'plans'],
    queryFn: async () => {
      const { data, error } = await platformApi.GET('/v1/platform/plans')
      if (error) throw error
      return data as { items: TierPlan[] }
    },
    retry: defaultRetry,
    staleTime: 5 * 60 * 1000, // 5 minutes — plans rarely change
  })

export const useSpaireSubscription = (
  organizationId: string | undefined,
): UseQueryResult<CurrentSpaireSubscription> =>
  useQuery({
    queryKey: ['spaire', 'subscription', organizationId],
    queryFn: async () => {
      const { data, error } = await platformApi.GET(
        '/v1/platform/organizations/{organization_id}/subscription',
        { params: { path: { organization_id: organizationId as string } } },
      )
      if (error) throw error
      return data as CurrentSpaireSubscription
    },
    retry: defaultRetry,
    enabled: !!organizationId,
  })

export const useSpaireUsage = (
  organizationId: string | undefined,
): UseQueryResult<OrganizationUsage> =>
  useQuery({
    queryKey: ['spaire', 'usage', organizationId],
    queryFn: async () => {
      const { data, error } = await platformApi.GET(
        '/v1/platform/organizations/{organization_id}/usage',
        { params: { path: { organization_id: organizationId as string } } },
      )
      if (error) throw error
      return data as OrganizationUsage
    },
    retry: defaultRetry,
    enabled: !!organizationId,
    staleTime: 60 * 1000, // 1 minute — usage updates as events flow
  })

// -----------------------------------------------------------------------------
// Mutations
// -----------------------------------------------------------------------------

export const useCreateUpgradeCheckout = (organizationId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      tier: PaidTierKey
      billing_interval?: BillingInterval
      success_url?: string
      billing_email?: string
    }): Promise<UpgradeCheckout> => {
      const { data, error } = await platformApi.POST(
        '/v1/platform/organizations/{organization_id}/upgrade-checkout',
        {
          params: { path: { organization_id: organizationId } },
          body: input,
        },
      )
      if (error) throw error
      return data as UpgradeCheckout
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['spaire', 'subscription', organizationId],
      })
    },
  })
}

export const useSwitchSpairePlan = (organizationId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      tier: PaidTierKey
      billing_interval?: BillingInterval
    }) => {
      const { data, error } = await platformApi.POST(
        '/v1/platform/organizations/{organization_id}/switch-plan',
        {
          params: { path: { organization_id: organizationId } },
          body: input,
        },
      )
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['spaire', 'subscription', organizationId],
      })
    },
  })
}

export const useCancelSpaireSubscription = (organizationId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await platformApi.POST(
        '/v1/platform/organizations/{organization_id}/cancel',
        {
          params: { path: { organization_id: organizationId } },
          body: {},
        },
      )
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['spaire', 'subscription', organizationId],
      })
    },
  })
}

export const useCreateCustomerPortalSession = (organizationId: string) =>
  useMutation({
    mutationFn: async (
      input: { return_url?: string } = {},
    ): Promise<{ customer_portal_url: string; token: string }> => {
      const { data, error } = await platformApi.POST(
        '/v1/platform/organizations/{organization_id}/customer-portal-session',
        {
          params: { path: { organization_id: organizationId } },
          body: input,
        },
      )
      if (error) throw error
      return data as { customer_portal_url: string; token: string }
    },
  })

// -----------------------------------------------------------------------------
// Formatting helpers
// -----------------------------------------------------------------------------

export const formatMonthlyPrice = (cents: number, currency = 'usd'): string => {
  if (cents === 0) return '$0'
  const dollars = cents / 100
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  })
  return `${formatter.format(dollars)}/mo`
}

/**
 * Headline price for a plan card, given the user-selected billing
 * interval. Annual subs are displayed as their monthly equivalent
 * (e.g. $39/mo with the "billed annually" subtitle) to match the
 * Webflow / Framer pricing-card pattern.
 */
export const headlinePriceForPlan = (
  plan: TierPlan,
  interval: BillingInterval,
): { dollars: number; cents: number } => {
  if (interval === 'year' && plan.annual_price_cents != null) {
    const monthlyEquivalentCents = Math.round(plan.annual_price_cents / 12)
    return {
      cents: monthlyEquivalentCents,
      dollars: Math.round(monthlyEquivalentCents / 100),
    }
  }
  return {
    cents: plan.monthly_price_cents,
    dollars: Math.round(plan.monthly_price_cents / 100),
  }
}

export const formatTransactionFee = (fee: TransactionFee): string => {
  const pct = (fee.percent_basis_points / 100).toFixed(
    fee.percent_basis_points % 100 === 0 ? 0 : 1,
  )
  const dollars = fee.fixed_cents / 100
  return `${pct}% + $${dollars.toFixed(2)}`
}

/**
 * Match the screenshot's renewal copy:
 *   "This site is charged on a monthly basis and renews on Jun 12th, 2026."
 * Returns null if there's no active subscription yet (no plan / pre-trial).
 */
export const renewalSentence = (
  sub: CurrentSpaireSubscription,
): string | null => {
  if (!sub.current_period_end) return null
  const cadence = sub.billing_interval === 'year' ? 'annual' : 'monthly'
  const date = new Date(sub.current_period_end)
  const formatted = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  if (sub.cancel_at_period_end) {
    return `This site is on a ${cadence} plan that ends on ${formatted}.`
  }
  if (sub.status === 'trialing') {
    return `Your trial ends on ${formatted}. You won't be charged until then.`
  }
  return `This site is charged on a ${cadence} basis and renews on ${formatted}.`
}

const TIER_DISPLAY_NAME: Record<SpaireTierKey, string> = {
  starter: 'Starter',
  studio: 'Studio',
  scale: 'Scale',
  inactive: 'No plan',
  unmanaged: 'Unmanaged',
}

// The Starter tier shipped originally as "pro". The backend now normalizes
// it to "starter" everywhere, but tolerate a stale/cached "pro" value so the
// UI never renders an empty plan name.
export const tierDisplayName = (tier: SpaireTierKey | 'pro'): string =>
  tier === 'pro' ? 'Starter' : TIER_DISPLAY_NAME[tier]
