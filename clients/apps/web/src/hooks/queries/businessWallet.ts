import { api } from '@/utils/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { defaultRetry } from './retry'

// -----------------------------------------------------------------------
// Financial Account
// -----------------------------------------------------------------------

export const useFinancialAccount = (organizationId?: string) =>
  useQuery({
    queryKey: ['business-wallet', 'financial-account', organizationId],
    queryFn: async () => {
      const res = await api.GET('/v1/business-wallets/financial-account', {
        params: { query: { organization_id: organizationId ?? '' } },
      })
      if (res.error) throw res.error
      return res.data
    },
    enabled: !!organizationId,
    retry: defaultRetry,
  })

export const useCreateFinancialAccount = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (organizationId: string) => {
      const res = await api.POST('/v1/business-wallets/financial-account', {
        body: { organization_id: organizationId },
      })
      if (res.error) throw res.error
      return res.data
    },
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
    queryFn: async () => {
      const res = await api.GET('/v1/business-wallets/onboarding-status', {
        params: { query: { organization_id: organizationId ?? '' } },
      })
      if (res.error) throw res.error
      return res.data
    },
    enabled: !!organizationId,
    retry: defaultRetry,
  })

export const useOnboardingLink = () => {
  return useMutation({
    mutationFn: async ({
      organizationId,
      returnPath,
    }: {
      organizationId: string
      returnPath: string
    }) => {
      const res = await api.POST('/v1/business-wallets/onboarding-link', {
        params: {
          query: {
            organization_id: organizationId,
            return_path: returnPath,
          },
        },
      })
      if (res.error) throw res.error
      return res.data
    },
  })
}

// -----------------------------------------------------------------------
// Issuing Cards
// -----------------------------------------------------------------------

export const useIssuingCards = (organizationId?: string) =>
  useQuery({
    queryKey: ['business-wallet', 'cards', organizationId],
    queryFn: async () => {
      const res = await api.GET('/v1/business-wallets/cards', {
        params: { query: { organization_id: organizationId ?? '' } },
      })
      if (res.error) throw res.error
      return res.data
    },
    enabled: !!organizationId,
    retry: defaultRetry,
  })

export const useCreateIssuingCard = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      financial_account_id: string
      card_type?: 'virtual' | 'physical'
      cardholder_name: string
      card_color?: string
      spending_limit_amount?: number | null
      spending_limit_interval?: string | null
    }) => {
      const res = await api.POST('/v1/business-wallets/cards', {
        body,
      })
      if (res.error) throw res.error
      return res.data
    },
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
    mutationFn: async ({
      cardId,
      ...body
    }: {
      cardId: string
      status?: string | null
      card_color?: string | null
      spending_limit_amount?: number | null
      spending_limit_interval?: string | null
    }) => {
      const res = await api.PATCH('/v1/business-wallets/cards/{card_id}', {
        params: { path: { card_id: cardId } },
        body,
      })
      if (res.error) throw res.error
      return res.data
    },
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
    queryFn: async () => {
      const res = await api.GET(
        '/v1/business-wallets/cards/{card_id}/details',
        {
          params: { path: { card_id: cardId ?? '' } },
        },
      )
      if (res.error) throw res.error
      return res.data
    },
    enabled: false, // only fetch on demand
    retry: defaultRetry,
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
    queryFn: async () => {
      const res = await api.GET('/v1/business-wallets/transactions', {
        params: {
          query: {
            financial_account_id: financialAccountId ?? '',
            page: page ?? 1,
            limit: limit ?? 20,
          },
        },
      })
      if (res.error) throw res.error
      return res.data
    },
    enabled: !!financialAccountId,
    retry: defaultRetry,
  })

export const useSyncTransactions = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (financialAccountId: string) => {
      const res = await api.POST('/v1/business-wallets/transactions/sync', {
        params: {
          query: { financial_account_id: financialAccountId },
        },
      })
      if (res.error) throw res.error
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['business-wallet', 'transactions'],
      })
    },
  })
}
