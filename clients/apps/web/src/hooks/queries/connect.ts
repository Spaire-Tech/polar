import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { useMutation } from '@tanstack/react-query'

export type ConnectSessionScenario = 'onboarding' | 'payouts'

export const useCreateConnectSession = () =>
  useMutation({
    mutationFn: ({
      accountId,
      scenario,
    }: {
      accountId: string
      scenario: ConnectSessionScenario
    }) =>
      unwrap(
        api.POST('/v1/accounts/{id}/connect_session', {
          params: { path: { id: accountId } },
          body: { scenario },
        }),
      ),
  })
