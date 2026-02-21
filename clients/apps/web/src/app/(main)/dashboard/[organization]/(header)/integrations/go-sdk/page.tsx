'use client'

import IntegrationSdkPage from '@/components/Integrations/IntegrationSdkPage'
import GoIcon from '@/components/Icons/frameworks/go'
import { GO_SDK_INTEGRATION } from '@/components/Integrations/integrations'

export default function Page() {
  return (
    <IntegrationSdkPage
      integration={GO_SDK_INTEGRATION}
      icon={<GoIcon size={40} />}
    />
  )
}
