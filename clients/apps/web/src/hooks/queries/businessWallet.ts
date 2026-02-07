import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

async function fetchJSON<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw body
  }
  return res.json()
}

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export interface FinancialAccountData {
  id: string
  created_at: string
  modified_at: string | null
  stripe_financial_account_id: string
  status: string
  currency: string
  balance_cash: number
  balance_inbound_pending: number
  balance_outbound_pending: number
  available_balance: number
  pending_balance: number
  aba_routing_number: string | null
  aba_account_number: string | null
  features_card_issuing: boolean
  features_deposit_insurance: boolean
  features_inbound_transfers_ach: boolean
  features_outbound_payments_ach: boolean
  features_outbound_transfers_ach: boolean
  organization_id: string
  onboarding_completed_at: string | null
  is_active: boolean
}

export interface OnboardingStatusData {
  has_financial_account: boolean
  financial_account_status: string | null
  has_cards: boolean
  card_count: number
  is_fully_onboarded: boolean
  stripe_connected_account_id: string | null
  requirements_pending: string[]
}

export interface IssuingCardData {
  id: string
  created_at: string
  modified_at: string | null
  stripe_card_id: string
  stripe_cardholder_id: string
  status: string
  card_type: string
  last4: string
  exp_month: number
  exp_year: number
  brand: string
  currency: string
  cardholder_name: string
  card_color: string
  spending_limit_amount: number | null
  spending_limit_interval: string | null
  total_spent: number
  canceled_at: string | null
  financial_account_id: string
  organization_id: string
  is_active: boolean
  display_name: string
  expiration: string
}

export interface TreasuryTransactionData {
  id: string
  created_at: string
  modified_at: string | null
  stripe_transaction_id: string
  transaction_type: string
  status: string
  amount: number
  currency: string
  description: string
  flow_type: string | null
  flow_id: string | null
  counterparty_name: string | null
  financial_account_id: string
}

interface PaginatedResult<T> {
  items: T[]
  pagination: {
    total_count: number
    max_page: number
  }
}

// -----------------------------------------------------------------------
// Financial Account
// -----------------------------------------------------------------------

export const useFinancialAccount = (organizationId?: string) =>
  useQuery({
    queryKey: ['business-wallet', 'financial-account', organizationId],
    queryFn: () =>
      fetchJSON<FinancialAccountData>(
        `/v1/business-wallets/financial-account?organization_id=${organizationId}`,
      ),
    enabled: !!organizationId,
    retry: false,
  })

export const useCreateFinancialAccount = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (organizationId: string) =>
      fetchJSON<FinancialAccountData>(
        '/v1/business-wallets/financial-account',
        {
          method: 'POST',
          body: JSON.stringify({ organization_id: organizationId }),
        },
      ),
    onSuccess: (_data, organizationId) => {
      queryClient.invalidateQueries({
        queryKey: ['business-wallet', 'financial-account', organizationId],
      })
      queryClient.invalidateQueries({
        queryKey: ['business-wallet', 'onboarding-status', organizationId],
      })
    },
  })
}

export const useOnboardingStatus = (organizationId?: string) =>
  useQuery({
    queryKey: ['business-wallet', 'onboarding-status', organizationId],
    queryFn: () =>
      fetchJSON<OnboardingStatusData>(
        `/v1/business-wallets/onboarding-status?organization_id=${organizationId}`,
      ),
    enabled: !!organizationId,
    retry: false,
  })

export const useOnboardingLink = () => {
  return useMutation({
    mutationFn: ({
      organizationId,
      returnPath,
    }: {
      organizationId: string
      returnPath: string
    }) =>
      fetchJSON<{ url: string }>(
        `/v1/business-wallets/onboarding-link?organization_id=${organizationId}&return_path=${encodeURIComponent(returnPath)}`,
        { method: 'POST' },
      ),
  })
}

// -----------------------------------------------------------------------
// Issuing Cards
// -----------------------------------------------------------------------

export const useIssuingCards = (organizationId?: string) =>
  useQuery({
    queryKey: ['business-wallet', 'cards', organizationId],
    queryFn: () =>
      fetchJSON<IssuingCardData[]>(
        `/v1/business-wallets/cards?organization_id=${organizationId}`,
      ),
    enabled: !!organizationId,
    retry: false,
  })

export const useCreateIssuingCard = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      financial_account_id: string
      card_type?: 'virtual' | 'physical'
      cardholder_name: string
      card_color?: string
      spending_limit_amount?: number | null
      spending_limit_interval?: string | null
    }) =>
      fetchJSON<IssuingCardData>('/v1/business-wallets/cards', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['business-wallet', 'cards'],
      })
    },
  })
}

export const useUpdateIssuingCard = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      cardId,
      ...body
    }: {
      cardId: string
      status?: string | null
      card_color?: string | null
      spending_limit_amount?: number | null
      spending_limit_interval?: string | null
    }) =>
      fetchJSON<IssuingCardData>(
        `/v1/business-wallets/cards/${cardId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(body),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['business-wallet', 'cards'],
      })
    },
  })
}

export const useIssuingCardDetails = (cardId?: string) =>
  useQuery({
    queryKey: ['business-wallet', 'card-details', cardId],
    queryFn: () =>
      fetchJSON<{ number: string; cvc: string; exp_month: number; exp_year: number }>(
        `/v1/business-wallets/cards/${cardId}/details`,
      ),
    enabled: false, // only fetch on demand
    retry: false,
  })

// -----------------------------------------------------------------------
// Treasury Transactions
// -----------------------------------------------------------------------

export const useTreasuryTransactions = (
  financialAccountId?: string,
  page?: number,
  limit?: number,
) =>
  useQuery({
    queryKey: [
      'business-wallet',
      'transactions',
      financialAccountId,
      page,
      limit,
    ],
    queryFn: () =>
      fetchJSON<PaginatedResult<TreasuryTransactionData>>(
        `/v1/business-wallets/transactions?financial_account_id=${financialAccountId}&page=${page ?? 1}&limit=${limit ?? 20}`,
      ),
    enabled: !!financialAccountId,
    retry: false,
  })

export const useSyncTransactions = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (financialAccountId: string) =>
      fetchJSON<{ synced: number }>(
        `/v1/business-wallets/transactions/sync?financial_account_id=${financialAccountId}`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['business-wallet', 'transactions'],
      })
    },
  })
}
