'use client'

import WebhookSettings from '@/components/Settings/Webhook/WebhookSettings'
import { schemas } from '@spaire/client'

export default function ClientPage({
  organization: org,
}: {
  organization: schemas['Organization']
}) {
  return <WebhookSettings org={org} />
}
