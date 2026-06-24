'use client'

import { schemas } from '@spaire/client'

import { ComposerApp } from '../composer/ComposerApp'

export function NewBroadcastV2Screen({
  organization,
}: {
  organization: schemas['Organization']
}) {
  return <ComposerApp organization={organization} />
}
