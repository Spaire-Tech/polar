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
      const response = await api.POST('/v1/intelligence/query' as any, {
        body: body as any,
      })
      if ((response as any).error) {
        throw new Error(
          (response as any).error?.detail ?? 'Intelligence query failed',
        )
      }
      return (response as any).data as InsightResponse
    },
  })
}
