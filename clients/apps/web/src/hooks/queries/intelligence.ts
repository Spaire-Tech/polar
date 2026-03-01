import { api } from '@/utils/client'
import { useMutation } from '@tanstack/react-query'

// ---------------------------------------------------------------------------
// Types — mirror server/polar/intelligence/schemas.py
// ---------------------------------------------------------------------------

export interface InsightDriver {
  dimension: string
  key: string
  current_value: number
  baseline_value: number
  delta: number
  pct_change: number
  share_of_total_change: number
  evidence_query_id: string
}

export interface InsightAction {
  action: string
  why: string
  estimated_impact: string | null
  effort: 'low' | 'medium' | 'high'
  requires_human_approval: boolean
}

export interface InsightDebug {
  queries_executed: string[]
  time_range: string
  baseline_range: string | null
  warnings: string[]
  model_used: string
  plan_intent: string
  interpretation_note: string
}

export interface InsightResponse {
  answer: string
  confidence: 'high' | 'medium' | 'low'
  confidence_reasons: string[]
  summary_bullets: string[]
  drivers: InsightDriver[]
  recommended_actions: InsightAction[]
  followup_questions: string[]
  debug: InsightDebug
}

export interface IntelligenceQueryRequest {
  question: string
  organization_id: string
  start_date?: string
  end_date?: string
  timezone?: string
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useIntelligenceQuery = () => {
  return useMutation({
    mutationFn: async (
      body: IntelligenceQueryRequest,
    ): Promise<InsightResponse> => {
      // The intelligence endpoint is private and not yet in the generated OpenAPI
      // client, so we call it directly via fetch using the configured base URL.
      const { CONFIG } = await import('@/utils/config')
      const res = await fetch(`${CONFIG.BASE_URL}/v1/intelligence/query`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.detail ?? `Intelligence query failed (${res.status})`)
      }
      return res.json() as Promise<InsightResponse>
    },
  })
}
