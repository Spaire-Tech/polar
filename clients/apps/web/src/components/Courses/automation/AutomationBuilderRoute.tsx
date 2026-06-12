'use client'

// Standalone, course-linked automation builder. Mounted OUTSIDE the
// email-marketing tabbed area (under /courses/[courseId]/automations) so it
// reads as its own editor — like the lesson editor — with no Subscribers /
// Broadcasts / Sequences / Analytics chrome. "Back" returns to the course
// editor at the lesson the creator came from.

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
  courseId,
  sequenceId,
}: {
  organization: schemas['Organization']
  courseId?: string
  sequenceId: string | null
}) {
  const router = useRouter()
  const params = useSearchParams()
  const lessonId = params.get('lesson_id') ?? undefined

  const { data: sequence, isLoading } = useEmailSequence(sequenceId ?? '')

  // Return to the course editor — at the originating lesson when we have one,
  // otherwise the course's outline.
  const back = () => {
    if (!courseId) {
      router.push(`/dashboard/${organization.slug}`)
      return
    }
    const base = `/dashboard/${organization.slug}/courses/${courseId}`
    router.push(lessonId ? `${base}?lesson=${lessonId}` : base)
  }

  if (sequenceId && isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-gray-400">
        Loading automation…
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
          : { trigger: { type: 'enrol' } as never }
      }
      onBack={back}
    />
  )
}

export default AutomationBuilderRoute
