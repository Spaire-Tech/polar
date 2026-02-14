'use client'

import IntegrationDetailPage from '@/components/Integrations/IntegrationDetailPage'
import SupabaseIcon from '@/components/Icons/frameworks/supabase'
import { SUPABASE_INTEGRATION } from '@/components/Integrations/integrations'

export default function Page() {
  return (
    <IntegrationDetailPage
      integration={SUPABASE_INTEGRATION}
      icon={<SupabaseIcon size={40} />}
    />
  )
}
