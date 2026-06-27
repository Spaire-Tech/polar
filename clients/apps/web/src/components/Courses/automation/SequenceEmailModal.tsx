'use client'

// SequenceEmailModal — hosts the creator's faithfully-rebuilt broadcast editor
// (BroadcastEditorDesign) as an automation step's email editor, full-screen.
// The sequence defines the audience and trigger, so the editor opens on the
// matching lifecycle template (enrolment, first lesson, halfway, …), bound to
// the automation's course. "Back" returns to the builder; saving hands the
// authored subject + inbox-correct HTML + editor JSON back to the sequence.

import type { schemas } from '@spaire/client'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

import { BroadcastEditorDesign } from '@/app/(main)/dashboard/[organization]/email-marketing/_components/composer/design/BroadcastEditorDesign'
import type { EditorState } from '@/app/(main)/dashboard/[organization]/email-marketing/_components/composer/design/emailEngine'
import { mapCourse } from '@/app/(main)/dashboard/[organization]/email-marketing/_components/composer/v3/courseMap'
import { useCourseById, useCourseEnrollments } from '@/hooks/queries/courses'
import {
  useSendTestEmail,
  useUploadEmailImage,
} from '@/hooks/queries/emailMarketing'

// The sequence's trigger type → the editor's lifecycle template key.
const MOMENT_TO_TRIGGER: Record<string, string> = {
  enrol: 'enrolment',
  enrolment: 'enrolment',
  lesson: 'specificLesson',
  specificLesson: 'specificLesson',
  first: 'firstLesson',
  firstLesson: 'firstLesson',
  half: 'halfway',
  halfway: 'halfway',
  complete: 'courseComplete',
  courseComplete: 'courseComplete',
  inactive: 'inactive',
}

export function SequenceEmailModal({
  organization,
  courseId,
  moment,
  initialSubject,
  initialContentJson,
  onSave,
  onClose,
}: {
  organization: schemas['Organization']
  courseId?: string
  moment?: string
  sequenceName?: string
  initialSubject?: string
  initialContentJson?: Record<string, unknown> | null
  onSave: (v: {
    subject: string
    content_html: string
    content_json: Record<string, unknown>
  }) => void
  onClose: () => void
}) {
  // Lock page scroll while the full-screen editor is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // The editor is a full-viewport overlay. It MUST render as a direct child of
  // <body>, not inline in the dashboard tree: the dashboard content lives inside
  // framer-motion / overflow wrappers (DashboardLayout) that become the
  // containing block for `position: fixed`, which would trap this overlay inside
  // the narrow content column — squeezing the 640px email stage and breaking the
  // design's proportions. Portaling to <body> gives it the true full viewport the
  // standalone design assumes, so the embedded editor mirrors it exactly.

  const upload = useUploadEmailImage(organization.id)
  const sendTest = useSendTestEmail(organization.id)
  const { data: courseRead } = useCourseById(courseId)
  const course = courseRead ? mapCourse(courseRead) : undefined
  // Real enrolled count — one row is enough; we only read pagination.total_count.
  const { data: enrollments } = useCourseEnrollments(courseId, { page: 1, limit: 1 })
  const enrolledCount = enrollments?.pagination.total_count

  const initialTrigger = moment ? MOMENT_TO_TRIGGER[moment] ?? 'enrolment' : 'enrolment'

  // Only restore state the design editor itself wrote (version 3). Emails
  // authored in earlier composers use a different shape and start fresh from
  // the lifecycle template instead.
  const initialState =
    initialContentJson && (initialContentJson as { version?: number }).version === 3
      ? (initialContentJson as unknown as EditorState)
      : null

  // 'use client' + mounted only on user interaction ⇒ always client-side here.
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black">
      <BroadcastEditorDesign
        courseName={courseRead?.title ?? course?.title ?? 'Course'}
        course={course}
        initialTrigger={initialTrigger}
        enrolledCount={enrolledCount}
        creatorName={
          courseRead?.instructor_name || organization.name || organization.slug
        }
        initialSubject={initialSubject}
        initialState={initialState}
        onUploadImage={async (file) => (await upload.mutateAsync(file)).url}
        onSendTest={async (v) => {
          await sendTest.mutateAsync({
            subject: v.subject,
            content_html: v.html,
            preview_text: v.preview,
          })
        }}
        onSave={(p) => {
          onSave({
            subject: p.subject,
            content_html: p.html,
            content_json: p.json as unknown as Record<string, unknown>,
          })
          onClose()
        }}
        onClose={onClose}
      />
    </div>,
    document.body,
  )
}

export default SequenceEmailModal
