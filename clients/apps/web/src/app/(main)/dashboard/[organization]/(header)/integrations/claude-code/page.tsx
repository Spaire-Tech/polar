'use client'

import IntegrationAgentPage from '@/components/Integrations/IntegrationAgentPage'
import ClaudeCodeIcon from '@/components/Icons/frameworks/claude-code'
import { CLAUDE_CODE_INTEGRATION } from '@/components/Integrations/integrations'

export default function Page() {
  return (
    <IntegrationAgentPage
      integration={CLAUDE_CODE_INTEGRATION}
      icon={<ClaudeCodeIcon size={40} />}
    />
  )
}
