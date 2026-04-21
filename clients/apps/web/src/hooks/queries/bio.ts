import { getQueryClient } from '@/utils/api/query'
import { getServerURL } from '@/utils/api'
import { useMutation, useQuery } from '@tanstack/react-query'
import { BioBlock } from '@/components/Bio/types'

const bioFetch = async (
  path: string,
  init?: RequestInit,
): Promise<Response> => {
  const res = await fetch(getServerURL(`/v1${path}`), {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })
  return res
}

const parseJsonOrThrow = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed (${res.status})`)
  }
  if (res.status === 204) return null as T
  return (await res.json()) as T
}

export const useBioBlocks = (organizationId: string) =>
  useQuery({
    queryKey: ['bio_blocks', organizationId],
    queryFn: async () => {
      const res = await bioFetch(
        `/bio/blocks?organization_id=${organizationId}`,
      )
      return parseJsonOrThrow<BioBlock[]>(res)
    },
    enabled: !!organizationId,
  })

export const useCreateBioBlock = (organizationId: string) =>
  useMutation({
    mutationFn: async (payload: {
      type: string
      enabled?: boolean
      order?: number | null
      settings?: Record<string, unknown>
    }) => {
      const res = await bioFetch('/bio/blocks', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          type: payload.type,
          enabled: payload.enabled ?? true,
          order: payload.order ?? null,
          settings: payload.settings ?? {},
        }),
      })
      return parseJsonOrThrow<BioBlock>(res)
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['bio_blocks', organizationId],
      })
    },
  })

export const useUpdateBioBlock = (organizationId: string) =>
  useMutation({
    mutationFn: async (variables: {
      id: string
      body: {
        enabled?: boolean
        order?: number
        settings?: Record<string, unknown>
      }
    }) => {
      const res = await bioFetch(`/bio/blocks/${variables.id}`, {
        method: 'PATCH',
        body: JSON.stringify(variables.body),
      })
      return parseJsonOrThrow<BioBlock>(res)
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['bio_blocks', organizationId],
      })
    },
  })

export const useDeleteBioBlock = (organizationId: string) =>
  useMutation({
    mutationFn: async (id: string) => {
      const res = await bioFetch(`/bio/blocks/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Request failed (${res.status})`)
      }
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['bio_blocks', organizationId],
      })
    },
  })

export const useReorderBioBlocks = (organizationId: string) =>
  useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await bioFetch('/bio/blocks/reorder', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          ids: orderedIds,
        }),
      })
      return parseJsonOrThrow<BioBlock[]>(res)
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['bio_blocks', organizationId],
      })
    },
  })

export const useUpdateBioSettings = (organizationId: string) =>
  useMutation({
    mutationFn: async (body: {
      enabled?: boolean
      display_title?: string | null
      short_bio?: string | null
      avatar_shape?: 'circle' | 'rounded'
      show_powered_by?: boolean
      newsletter_enabled?: boolean
      newsletter_heading?: string | null
      newsletter_description?: string | null
    }) => {
      const res = await bioFetch(`/bio/settings/${organizationId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      return parseJsonOrThrow<{
        organization_id: string
        bio_settings: Record<string, unknown>
        bio_enabled: boolean
      }>(res)
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['organizations'],
      })
    },
  })
