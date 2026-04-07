import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

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
