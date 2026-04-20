import { getServerURL } from '@/utils/api'
import { getQueryClient } from '@/utils/api/query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export interface OrganizationLink {
  id: string
  organization_id: string
  label: string
  url: string
  icon: string | null
  order: number
  enabled: boolean
  created_at: string
  modified_at: string | null
}

export interface OrganizationLinkCreate {
  organization_id: string
  label: string
  url: string
  icon?: string | null
  order?: number | null
  enabled?: boolean
}

export interface OrganizationLinkUpdate {
  label?: string
  url?: string
  icon?: string | null
  order?: number
  enabled?: boolean
}

const fetchApi = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(getServerURL(path), {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })
  if (res.status === 204) {
    return undefined as T
  }
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`)
  }
  return res.json() as Promise<T>
}

const queryKey = (organizationId: string) =>
  ['organization_links', organizationId] as const

export const useOrganizationLinks = (organizationId: string) =>
  useQuery({
    queryKey: queryKey(organizationId),
    queryFn: () =>
      fetchApi<OrganizationLink[]>(
        `/v1/organization-links/?organization_id=${organizationId}`,
      ),
    retry: defaultRetry,
    enabled: !!organizationId,
  })

export const useCreateOrganizationLink = (organizationId: string) =>
  useMutation({
    mutationFn: (body: Omit<OrganizationLinkCreate, 'organization_id'>) =>
      fetchApi<OrganizationLink>('/v1/organization-links/', {
        method: 'POST',
        body: JSON.stringify({ ...body, organization_id: organizationId }),
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: queryKey(organizationId) })
    },
  })

export const useUpdateOrganizationLink = (organizationId: string) =>
  useMutation({
    mutationFn: ({ id, body }: { id: string; body: OrganizationLinkUpdate }) =>
      fetchApi<OrganizationLink>(`/v1/organization-links/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: queryKey(organizationId) })
    },
  })

export const useDeleteOrganizationLink = (organizationId: string) =>
  useMutation({
    mutationFn: (id: string) =>
      fetchApi<void>(`/v1/organization-links/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: queryKey(organizationId) })
    },
  })

export const useReorderOrganizationLinks = (organizationId: string) =>
  useMutation({
    mutationFn: (ids: string[]) =>
      fetchApi<OrganizationLink[]>('/v1/organization-links/reorder', {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId, ids }),
      }),
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: queryKey(organizationId) })
    },
  })
