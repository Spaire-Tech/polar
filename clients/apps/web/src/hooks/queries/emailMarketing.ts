import { getServerURL } from '@/utils/api'
import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

// Helper for fetching JSON from API endpoints with credentials
const fetchApi = async <T>(path: string): Promise<T> => {
  const res = await fetch(getServerURL(path), { credentials: 'include' })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// ── Subscribers ──

export const useEmailSubscribers = (
  organizationId: string,
  parameters?: {
    status?: string
    page?: number
    limit?: number
  },
) =>
  useQuery({
    queryKey: ['email_subscribers', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      api
        .GET('/v1/email-subscribers/', {
          params: {
            query: {
              organization_id: organizationId,
              ...parameters,
            },
          },
        })
        .then((r) => r.data),
    retry: defaultRetry,
    placeholderData: keepPreviousData,
  })

export const useEmailSubscriberStats = (organizationId: string) =>
  useQuery({
    queryKey: ['email_subscriber_stats', organizationId],
    queryFn: () =>
      api
        .GET('/v1/email-subscribers/stats', {
          params: { query: { organization_id: organizationId } },
        })
        .then((r) => r.data),
    retry: defaultRetry,
  })

export const useSubscriberDailyGrowth = (organizationId: string, days = 30) =>
  useQuery({
    queryKey: ['subscriber_daily_growth', organizationId, days],
    queryFn: () =>
      fetchApi<{ day: string; count: number }[]>(
        `/v1/email-subscribers/daily-growth?organization_id=${organizationId}&days=${days}`,
      ),
    retry: defaultRetry,
  })

export const useSubscriberDailyUnsubscribes = (organizationId: string, days = 30) =>
  useQuery({
    queryKey: ['subscriber_daily_unsubscribes', organizationId, days],
    queryFn: () =>
      fetchApi<{ day: string; count: number }[]>(
        `/v1/email-subscribers/daily-unsubscribes?organization_id=${organizationId}&days=${days}`,
      ),
    retry: defaultRetry,
  })

export const useCreateEmailSubscriber = (organizationId: string) =>
  useMutation({
    mutationFn: (body: { email: string; name?: string }) =>
      api.POST('/v1/email-subscribers/', {
        params: { query: { organization_id: organizationId } },
        body,
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['email_subscribers'],
      })
      getQueryClient().invalidateQueries({
        queryKey: ['email_subscriber_stats'],
      })
    },
  })

export const useUpdateEmailSubscriber = () =>
  useMutation({
    mutationFn: ({
      subscriberId,
      body,
    }: {
      subscriberId: string
      body: { name?: string; status?: string }
    }) =>
      api.PATCH('/v1/email-subscribers/{subscriber_id}', {
        params: { path: { subscriber_id: subscriberId } },
        body,
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['email_subscribers'],
      })
      getQueryClient().invalidateQueries({
        queryKey: ['email_subscriber_stats'],
      })
    },
  })

// ── Broadcasts ──

export const useBroadcastAggregateAnalytics = (organizationId: string) =>
  useQuery({
    queryKey: ['broadcast_aggregate_analytics', organizationId],
    queryFn: () =>
      fetchApi<{
        total_sent: number
        delivered: number
        opened: number
        clicked: number
        unsubscribed: number
        open_rate: number
        click_rate: number
      }>(`/v1/email-broadcasts/aggregate-analytics?organization_id=${organizationId}`),
    retry: defaultRetry,
  })

export const useBroadcastDailySends = (organizationId: string, days = 30) =>
  useQuery({
    queryKey: ['broadcast_daily_sends', organizationId, days],
    queryFn: () =>
      fetchApi<{ day: string; count: number }[]>(
        `/v1/email-broadcasts/daily-sends?organization_id=${organizationId}&days=${days}`,
      ),
    retry: defaultRetry,
  })

export const useEmailBroadcasts = (
  organizationId: string,
  parameters?: {
    page?: number
    limit?: number
  },
) =>
  useQuery({
    queryKey: ['email_broadcasts', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      api
        .GET('/v1/email-broadcasts/', {
          params: {
            query: {
              organization_id: organizationId,
              ...parameters,
            },
          },
        })
        .then((r) => r.data),
    retry: defaultRetry,
    placeholderData: keepPreviousData,
  })

export const useCreateEmailBroadcast = (organizationId: string) =>
  useMutation({
    mutationFn: (body: {
      subject: string
      sender_name: string
      reply_to_email?: string
      content_html?: string
      content_json?: Record<string, unknown>
      segment_id?: string
    }) =>
      api.POST('/v1/email-broadcasts/', {
        params: { query: { organization_id: organizationId } },
        body,
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['email_broadcasts'],
      })
    },
  })

export const useUpdateEmailBroadcast = () =>
  useMutation({
    mutationFn: ({
      broadcastId,
      body,
    }: {
      broadcastId: string
      body: {
        subject?: string
        sender_name?: string
        reply_to_email?: string
        content_html?: string
        content_json?: Record<string, unknown>
      }
    }) =>
      api.PATCH('/v1/email-broadcasts/{broadcast_id}', {
        params: { path: { broadcast_id: broadcastId } },
        body,
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['email_broadcasts'],
      })
    },
  })

export const useSendEmailBroadcast = () =>
  useMutation({
    mutationFn: (broadcastId: string) =>
      api.POST('/v1/email-broadcasts/{broadcast_id}/send', {
        params: { path: { broadcast_id: broadcastId } },
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['email_broadcasts'],
      })
    },
  })

export const useEmailBroadcastAnalytics = (broadcastId: string) =>
  useQuery({
    queryKey: ['email_broadcast_analytics', broadcastId],
    queryFn: () =>
      api
        .GET('/v1/email-broadcasts/{broadcast_id}/analytics', {
          params: { path: { broadcast_id: broadcastId } },
        })
        .then((r) => r.data),
    retry: defaultRetry,
    enabled: !!broadcastId,
  })

// ── Segments ──

export const useEmailSegments = (organizationId: string) =>
  useQuery({
    queryKey: ['email_segments', organizationId],
    queryFn: () =>
      api
        .GET('/v1/email-segments/', {
          params: { query: { organization_id: organizationId } },
        })
        .then((r) => r.data),
    retry: defaultRetry,
  })

export const useCreateEmailSegment = (organizationId: string) =>
  useMutation({
    mutationFn: (body: {
      name: string
      slug: string
      type?: string
      product_id?: string
    }) =>
      api.POST('/v1/email-segments/', {
        params: { query: { organization_id: organizationId } },
        body,
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['email_segments'],
      })
    },
  })

export const useDeleteEmailSegment = () =>
  useMutation({
    mutationFn: (segmentId: string) =>
      api.DELETE('/v1/email-segments/{segment_id}', {
        params: { path: { segment_id: segmentId } },
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['email_segments'],
      })
    },
  })

// ── Storefront Subscribe (public) ──

export const useStorefrontSubscribe = () =>
  useMutation({
    mutationFn: ({ slug, email, name }: { slug: string; email: string; name?: string }) =>
      api.POST('/v1/storefronts/{slug}/subscribe', {
        params: { path: { slug } },
        body: { email, name },
      }),
  })

// ── Email Sequences ──

export const useEmailSequences = (
  organizationId: string,
  params?: { page?: number; limit?: number },
) =>
  useQuery({
    queryKey: ['email_sequences', { organizationId, ...(params ?? {}) }],
    queryFn: () =>
      api
        .GET('/v1/email-sequences/', {
          params: { query: { organization_id: organizationId, ...params } },
        })
        .then((r) => r.data),
    retry: defaultRetry,
    placeholderData: keepPreviousData,
  })

export const useEmailSequence = (sequenceId: string) =>
  useQuery({
    queryKey: ['email_sequence', sequenceId],
    queryFn: () =>
      api
        .GET('/v1/email-sequences/{sequence_id}', {
          params: { path: { sequence_id: sequenceId } },
        })
        .then((r) => r.data),
    retry: defaultRetry,
    enabled: !!sequenceId,
  })

export const useCreateEmailSequence = (organizationId: string) =>
  useMutation({
    mutationFn: (body: {
      name: string
      description?: string
      trigger_type?: string
      trigger_config?: Record<string, unknown>
    }) =>
      api.POST('/v1/email-sequences/', {
        params: { query: { organization_id: organizationId } },
        body,
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['email_sequences'] })
    },
  })

export const useUpdateEmailSequence = () =>
  useMutation({
    mutationFn: ({
      sequenceId,
      ...body
    }: {
      sequenceId: string
      name?: string
      description?: string
      trigger_type?: string
      trigger_config?: Record<string, unknown>
      status?: string
    }) =>
      api.PATCH('/v1/email-sequences/{sequence_id}', {
        params: { path: { sequence_id: sequenceId } },
        body,
      }),
    onSuccess: (_data, vars) => {
      getQueryClient().invalidateQueries({ queryKey: ['email_sequences'] })
      getQueryClient().invalidateQueries({
        queryKey: ['email_sequence', vars.sequenceId],
      })
    },
  })

export const useDeleteEmailSequence = () =>
  useMutation({
    mutationFn: (sequenceId: string) =>
      api.DELETE('/v1/email-sequences/{sequence_id}', {
        params: { path: { sequence_id: sequenceId } },
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ['email_sequences'] })
    },
  })

// ── Sequence Steps ──

export const useSequenceSteps = (sequenceId: string) =>
  useQuery({
    queryKey: ['email_sequence_steps', sequenceId],
    queryFn: () =>
      api
        .GET('/v1/email-sequences/{sequence_id}/steps', {
          params: { path: { sequence_id: sequenceId } },
        })
        .then((r) => r.data),
    retry: defaultRetry,
    enabled: !!sequenceId,
  })

export const useCreateSequenceStep = (sequenceId: string) =>
  useMutation({
    mutationFn: (body: {
      delay_hours?: number
      subject: string
      sender_name: string
      sender_email?: string
      reply_to_email?: string
      content_html?: string
    }) =>
      api.POST('/v1/email-sequences/{sequence_id}/steps', {
        params: { path: { sequence_id: sequenceId } },
        body,
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['email_sequence_steps', sequenceId],
      })
    },
  })

export const useUpdateSequenceStep = (sequenceId: string) =>
  useMutation({
    mutationFn: ({
      stepId,
      ...body
    }: {
      stepId: string
      delay_hours?: number
      subject?: string
      sender_name?: string
      sender_email?: string
      reply_to_email?: string
      content_html?: string
    }) =>
      api.PATCH('/v1/email-sequences/{sequence_id}/steps/{step_id}', {
        params: {
          path: { sequence_id: sequenceId, step_id: stepId },
        },
        body,
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['email_sequence_steps', sequenceId],
      })
    },
  })

export const useDeleteSequenceStep = (sequenceId: string) =>
  useMutation({
    mutationFn: (stepId: string) =>
      api.DELETE('/v1/email-sequences/{sequence_id}/steps/{step_id}', {
        params: {
          path: { sequence_id: sequenceId, step_id: stepId },
        },
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['email_sequence_steps', sequenceId],
      })
    },
  })

export const useReorderSequenceSteps = (sequenceId: string) =>
  useMutation({
    mutationFn: (items: Array<{ id: string; position: number }>) =>
      api.POST('/v1/email-sequences/{sequence_id}/steps/reorder', {
        params: { path: { sequence_id: sequenceId } },
        body: items,
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['email_sequence_steps', sequenceId],
      })
    },
  })

// ── Sequence Enrollments ──

export const useSequenceEnrollments = (sequenceId: string) =>
  useQuery({
    queryKey: ['email_sequence_enrollments', sequenceId],
    queryFn: () =>
      api
        .GET('/v1/email-sequences/{sequence_id}/enrollments', {
          params: { path: { sequence_id: sequenceId } },
        })
        .then((r) => r.data),
    retry: defaultRetry,
    enabled: !!sequenceId,
  })

export const useEnrollSubscriber = (sequenceId: string) =>
  useMutation({
    mutationFn: (subscriberId: string) =>
      api.POST('/v1/email-sequences/{sequence_id}/enrollments', {
        params: { path: { sequence_id: sequenceId } },
        body: { subscriber_id: subscriberId },
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['email_sequence_enrollments', sequenceId],
      })
    },
  })

export const useUnenrollSubscriber = (sequenceId: string) =>
  useMutation({
    mutationFn: (subscriberId: string) =>
      api.DELETE(
        '/v1/email-sequences/{sequence_id}/enrollments/{subscriber_id}',
        {
          params: {
            path: { sequence_id: sequenceId, subscriber_id: subscriberId },
          },
        },
      ),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['email_sequence_enrollments', sequenceId],
      })
    },
  })

// ── Sequence Analytics ──

export const useSequenceAnalytics = (sequenceId: string) =>
  useQuery({
    queryKey: ['email_sequence_analytics', sequenceId],
    queryFn: () =>
      api
        .GET('/v1/email-sequences/{sequence_id}/analytics', {
          params: { path: { sequence_id: sequenceId } },
        })
        .then((r) => r.data),
    retry: defaultRetry,
    enabled: !!sequenceId,
  })
