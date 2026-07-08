'use client'

import {
  CurrentSpaireSubscription,
  SpaireTierKey,
  TierFeatures,
  TierLimits,
  tierDisplayName,
  useSpaireSubscription,
} from './spaireTier'

export type FeatureKey = keyof TierFeatures
export type LimitKey = keyof TierLimits

/**
 * The minimum paid tier that unlocks each feature. Mirrors
 * polar/entitlements/tiers.py — every plan is the whole platform, so
 * every shipped feature unlocks at Starter. Roadmap features
 * (stackable_discounts, cohort_analytics, custom_checkout_domain, sso)
 * will also ship to every plan, so they're 'starter' too — the gate
 * only shows for orgs with no active plan. The one exception is the
 * Scale-only custom-pricing sales lever.
 */
const FEATURE_REQUIRED_TIER: Record<FeatureKey, SpaireTierKey> = {
  drip_scheduling: 'starter',
  email_sequences_and_segments: 'starter',
  email_ab_testing: 'starter',
  stackable_discounts: 'starter',
  custom_email_sender_domain: 'starter',
  seat_based_product_pricing: 'starter',
  cohort_analytics: 'starter',
  customer_wallet: 'starter',
  white_label_course_player: 'starter',
  sandbox_mode: 'starter',
  custom_pricing_negotiation: 'scale',
  custom_storefront_domain: 'starter',
  custom_checkout_domain: 'starter',
  sso: 'starter',
  audit_logs: 'starter',
}

export interface Entitlements {
  isLoading: boolean
  tier: SpaireTierKey | null
  status: string | null
  trialEnd: Date | null
  /**
   * Whole days between now and trial_end (negative when expired).
   * null when the subscription is not currently trialing.
   */
  daysLeftInTrial: number | null
  features: TierFeatures | null
  limits: TierLimits | null
  /** Does the current tier include this feature? */
  hasFeature: (feature: FeatureKey) => boolean
  /**
   * Minimum tier that unlocks the feature, in display form ("Studio",
   * "Scale", etc.). Useful for upgrade prompts.
   */
  requiredTierFor: (feature: FeatureKey) => string
}

/**
 * One-stop shop for "what is this org allowed to do?" — feature gates,
 * limit headroom, trial countdown. Built on top of useSpaireSubscription
 * so it stays in sync with whatever the platform-org subscription says.
 */
export const useEntitlements = (
  organizationId: string | undefined,
): Entitlements => {
  const sub = useSpaireSubscription(organizationId)
  const data: CurrentSpaireSubscription | undefined = sub.data

  const tier = (data?.tier ?? null) as SpaireTierKey | null
  const features = data?.entitlements.features ?? null
  const limits = data?.entitlements.limits ?? null
  const status = data?.status ?? null
  const trialEnd = data?.trial_end ? new Date(data.trial_end) : null

  const daysLeftInTrial =
    status === 'trialing' && trialEnd
      ? Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null

  const hasFeature = (feature: FeatureKey): boolean =>
    Boolean(features?.[feature])

  const requiredTierFor = (feature: FeatureKey): string =>
    tierDisplayName(FEATURE_REQUIRED_TIER[feature])

  return {
    isLoading: sub.isLoading,
    tier,
    status,
    trialEnd,
    daysLeftInTrial,
    features,
    limits,
    hasFeature,
    requiredTierFor,
  }
}
