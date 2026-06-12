'use client'

// Mounts the new AutomationSequenceBuilder design at the email-marketing
// sequence route (/sequences/new and /sequences/[id]/edit). Reads the
// course/lesson scope from the query string (the lesson editor links here
// with ?course_id=&lesson_id=), and on edit hydrates the builder from the
// sequence's stored flow_doc.

import type { schemas } from '@spaire/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEmailSequence } from '@/hooks/queries/emailMarketing'
import {
  AutomationSequenceBuilder,
  type Step,
} from '@/components/Courses/automation/AutomationSequenceBuilder'

type FlowDoc = {
  course_trigger?: Record<string, unknown>
  send_settings?: Record<string, unknown>
  steps?: Step[]
}

export function AutomationBuilderRoute({
  organization,
  sequenceId,
}: {
  organization: schemas['Organization']
  sequenceId: string | null
}) {
  const router = useRouter()
  const params = useSearchParams()
  const courseId = params.get('course_id') ?? undefined
  const lessonId = params.get('lesson_id') ?? undefined

  const { data: sequence, isLoading } = useEmailSequence(sequenceId ?? '')

  const back = () =>
    router.push(
      `/dashboard/${organization.slug}/email-marketing/sequences`,
    )

  // On edit, wait for the sequence so we can hydrate the builder from its
  // stored flow (trigger_config.flow_doc). New sequences start blank.
  if (sequenceId && isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-gray-400">
        Loading sequence…
      </div>
    )
  }

  const tc =
    ((sequence as { trigger_config?: Record<string, unknown> } | undefined)
      ?.trigger_config as Record<string, unknown> | undefined) ?? {}
  const flow = (tc['flow_doc'] as FlowDoc | undefined) ?? {
    course_trigger: tc['course_trigger'] as Record<string, unknown> | undefined,
    send_settings: tc['send_settings'] as Record<string, unknown> | undefined,
    steps: undefined,
  }
  const seq = sequence as
    | { name?: string; description?: string; status?: string }
    | undefined

  return (
    <AutomationSequenceBuilder
      organizationId={organization.id}
      courseId={courseId}
      lessonId={lessonId}
      sequenceId={sequenceId ?? undefined}
      initial={
        sequenceId
          ? {
              name: seq?.name,
              desc: seq?.description ?? '',
              trigger: flow.course_trigger as never,
              send: flow.send_settings as never,
              steps: flow.steps,
              live: seq?.status === 'active',
            }
          : courseId
            ? { trigger: { type: 'enrol' } as never }
            : undefined
      }
      onBack={back}
    />
  )
}

export default AutomationBuilderRoute
