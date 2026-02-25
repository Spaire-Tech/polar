import { getServerURL } from '@/utils/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { defaultRetry } from './retry'

// Types matching the backend ManualInvoiceRead schema
export interface ManualInvoiceItem {
  id: string
  created_at: string
  modified_at: string | null
  description: string
  quantity: number
  unit_amount: number
  amount: number
}

export interface ManualInvoice {
  id: string
  created_at: string
  modified_at: string | null
  status: 'draft' | 'issued' | 'paid' | 'void'
  currency: string
  billing_name: string | null
  billing_address: Record<string, any> | null
  notes: string | null
  invoice_number: string | null
  due_date: string | null
  issued_at: string | null
  paid_at: string | null
  voided_at: string | null
  checkout_url: string | null
  email_sent_at: string | null
  organization_id: string
  customer_id: string | null
  order_id: string | null
  schedule_id: string | null
  subtotal_amount: number
  total_amount: number
  items: ManualInvoiceItem[]
  metadata: Record<string, string>
}

export interface ManualInvoiceListResponse {
  items: ManualInvoice[]
  pagination: {
    total_count: number
    max_page: number
  }
}

export interface ManualInvoiceItemCreate {
  description: string
  quantity: number
  unit_amount: number
}

export interface ManualInvoiceCreateBody {
  organization_id: string
  currency: string
  customer_id?: string | null
  billing_name?: string | null
  notes?: string | null
  items?: ManualInvoiceItemCreate[]
}

export interface ManualInvoiceUpdateBody {
  customer_id?: string | null
  billing_name?: string | null
  notes?: string | null
  currency?: string | null
  items?: ManualInvoiceItemCreate[] | null
}

const fetchWithAuth = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(error.detail || `Request failed: ${response.status}`)
  }
  if (response.status === 204) return null
  return response.json()
}

export const useManualInvoices = (
  organizationId?: string,
  params?: {
    page?: number
    limit?: number
    sorting?: string[]
    status?: string
  },
) =>
  useQuery<ManualInvoiceListResponse>({
    queryKey: ['manual_invoices', { organizationId, ...(params || {}) }],
    queryFn: () => {
      const searchParams = new URLSearchParams()
      if (organizationId) searchParams.set('organization_id', organizationId)
      if (params?.page) searchParams.set('page', params.page.toString())
      if (params?.limit) searchParams.set('limit', params.limit.toString())
      if (params?.status) searchParams.set('status', params.status)
      if (params?.sorting) {
        params.sorting.forEach((s) => searchParams.append('sorting', s))
      }
      return fetchWithAuth(
        `${getServerURL()}/v1/manual-invoices/?${searchParams}`,
      )
    },
    retry: defaultRetry,
    enabled: !!organizationId,
  })

export const useManualInvoice = (id: string) =>
  useQuery<ManualInvoice>({
    queryKey: ['manual_invoices', { id }],
    queryFn: () =>
      fetchWithAuth(`${getServerURL()}/v1/manual-invoices/${id}`),
    retry: defaultRetry,
    enabled: !!id,
  })

export const useCreateManualInvoice = () => {
  const queryClient = useQueryClient()
  return useMutation<ManualInvoice, Error, ManualInvoiceCreateBody>({
    mutationFn: (body) =>
      fetchWithAuth(`${getServerURL()}/v1/manual-invoices/`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual_invoices'] })
    },
  })
}

export const useUpdateManualInvoice = (id: string) => {
  const queryClient = useQueryClient()
  return useMutation<ManualInvoice, Error, ManualInvoiceUpdateBody>({
    mutationFn: (body) =>
      fetchWithAuth(`${getServerURL()}/v1/manual-invoices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual_invoices'] })
    },
  })
}

export const useIssueManualInvoice = () => {
  const queryClient = useQueryClient()
  return useMutation<ManualInvoice, Error, string>({
    mutationFn: (id) =>
      fetchWithAuth(
        `${getServerURL()}/v1/manual-invoices/${id}/issue`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual_invoices'] })
    },
  })
}

export const useMarkPaidManualInvoice = () => {
  const queryClient = useQueryClient()
  return useMutation<ManualInvoice, Error, string>({
    mutationFn: (id) =>
      fetchWithAuth(
        `${getServerURL()}/v1/manual-invoices/${id}/mark-paid`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual_invoices'] })
    },
  })
}

export const useVoidManualInvoice = () => {
  const queryClient = useQueryClient()
  return useMutation<ManualInvoice, Error, string>({
    mutationFn: (id) =>
      fetchWithAuth(
        `${getServerURL()}/v1/manual-invoices/${id}/void`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual_invoices'] })
    },
  })
}

export const useGeneratePaymentLink = () => {
  const queryClient = useQueryClient()
  return useMutation<ManualInvoice, Error, string>({
    mutationFn: (id) =>
      fetchWithAuth(
        `${getServerURL()}/v1/manual-invoices/${id}/generate-payment-link`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual_invoices'] })
    },
  })
}

export const useSendInvoiceEmail = () => {
  const queryClient = useQueryClient()
  return useMutation<ManualInvoice, Error, string>({
    mutationFn: (id) =>
      fetchWithAuth(
        `${getServerURL()}/v1/manual-invoices/${id}/send-email`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual_invoices'] })
    },
  })
}

export const useDeleteManualInvoice = () => {
  const queryClient = useQueryClient()
  return useMutation<null, Error, string>({
    mutationFn: (id) =>
      fetchWithAuth(`${getServerURL()}/v1/manual-invoices/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual_invoices'] })
    },
  })
}
