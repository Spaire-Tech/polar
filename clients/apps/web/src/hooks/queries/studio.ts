import { getQueryClient } from '@/utils/api/query'
import { useMutation, useQuery } from '@tanstack/react-query'

/**
 * Studio conversation endpoints aren't yet in the generated `@spaire/client`
 * `v1.ts`, so we hit them with `fetch` against `NEXT_PUBLIC_API_URL`. Auth is
 * cookie-based; `credentials: 'include'` sends the existing dashboard session.
 * Once the client is regenerated these hooks can be switched to the typed
 * `api.GET` / `api.POST` form the rest of the dashboard uses.
 */

export type StudioConversationMessage = {
  id: string
  created_at: string
  modified_at: string | null
  conversation_id: string
  role: string
  parts: Array<Record<string, unknown>>
}

export type StudioConversation = {
  id: string
  created_at: string
  modified_at: string | null
  organization_id: string
  user_id: string
  title: string
  product_id: string | null
}

export type StudioConversationWithMessages = StudioConversation & {
  messages: StudioConversationMessage[]
}

type ListResponse = {
  items: StudioConversation[]
  pagination: { total_count: number; max_page: number }
}

const API_URL = () => process.env.NEXT_PUBLIC_API_URL

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const resp = await fetch(`${API_URL()}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    ...init,
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(
      `Studio request failed: ${resp.status} ${resp.statusText}${text ? ` — ${text}` : ''}`,
    )
  }
  if (resp.status === 204) return undefined as T
  return (await resp.json()) as T
}

export const useStudioConversations = (
  organizationId: string,
  opts?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: ['studio_conversations', organizationId],
    queryFn: () =>
      requestJson<ListResponse>(
        `/v1/studio/conversations/?organization_id=${encodeURIComponent(organizationId)}&limit=50`,
      ),
    enabled: opts?.enabled ?? !!organizationId,
  })

export const useStudioConversation = (id: string | null | undefined) =>
  useQuery({
    queryKey: ['studio_conversation', id],
    queryFn: () =>
      requestJson<StudioConversationWithMessages>(
        `/v1/studio/conversations/${id}`,
      ),
    enabled: !!id,
  })

export const useSyncStudioConversation = () =>
  useMutation({
    mutationFn: (body: {
      id?: string
      organization_id: string
      title: string
      product_id: string | null
      messages: Array<{
        role: string
        parts: Array<Record<string, unknown>>
      }>
    }) =>
      requestJson<StudioConversationWithMessages>(
        `/v1/studio/conversations/sync`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: (data) => {
      getQueryClient().invalidateQueries({
        queryKey: ['studio_conversations', data.organization_id],
      })
    },
  })

export const useUpdateStudioConversation = () =>
  useMutation({
    mutationFn: (vars: {
      id: string
      organization_id: string
      body: { title?: string; product_id?: string | null }
    }) =>
      requestJson<StudioConversation>(`/v1/studio/conversations/${vars.id}`, {
        method: 'PATCH',
        body: JSON.stringify(vars.body),
      }),
    onSuccess: (_data, vars) => {
      getQueryClient().invalidateQueries({
        queryKey: ['studio_conversations', vars.organization_id],
      })
      getQueryClient().invalidateQueries({
        queryKey: ['studio_conversation', vars.id],
      })
    },
  })

export const useDeleteStudioConversation = () =>
  useMutation({
    mutationFn: (vars: { id: string; organization_id: string }) =>
      requestJson<void>(`/v1/studio/conversations/${vars.id}`, {
        method: 'DELETE',
      }),
    onSuccess: (_data, vars) => {
      getQueryClient().invalidateQueries({
        queryKey: ['studio_conversations', vars.organization_id],
      })
    },
  })
