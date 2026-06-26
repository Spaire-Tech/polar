'use client'

// SequenceEmailModal — hosts the v3 broadcast editor (BroadcastEditorV3) as an
// automation step's email editor, full-screen. The sequence defines the
// audience and trigger, so the editor is used purely to author the email: the
// "Back" button returns to the builder, and saving hands the authored subject +
// inbox-correct HTML + TipTap JSON back to the sequence builder.
//
// The editor binds to the automation's course (data-bound blocks + AI recap
// copy) and uploads images to S3 — exactly like the standalone studio route.

import type { schemas } from '@spaire/client'
import { useEffect } from 'react'

import { BroadcastEditorV3 } from '@/app/(main)/dashboard/[organization]/email-marketing/_components/composer/v3/BroadcastEditorV3'
import { mapCourse } from '@/app/(main)/dashboard/[organization]/email-marketing/_components/composer/v3/courseMap'
import { useCourseById } from '@/hooks/queries/courses'
import {
  useGenerateEmailCopy,
  useUploadEmailImage,
} from '@/hooks/queries/emailMarketing'

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

  const upload = useUploadEmailImage(organization.id)
  const generateCopy = useGenerateEmailCopy()
  const { data: courseRead } = useCourseById(courseId)
  const course = courseRead ? mapCourse(courseRead) : undefined

  // Only restore a document the v3 editor itself wrote (a TipTap `doc`); emails
  // authored in the previous composer use a different shape and start fresh.
  const initialDocument =
    initialContentJson && initialContentJson.type === 'doc'
      ? (initialContentJson as Record<string, unknown>)
      : undefined

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-black">
      <BroadcastEditorV3
        courseName={courseRead?.title ?? 'Course automation'}
        course={course}
        initialSubject={initialSubject}
        initialDocument={initialDocument}
        onUploadImage={(file) => upload.mutateAsync(file)}
        onGenerateCopy={
          courseId
            ? (m) =>
                generateCopy.mutateAsync({ courseId, moment: moment ?? m })
            : undefined
        }
        onSave={(p) => {
          onSave({
            subject: p.subject,
            content_html: p.html,
            content_json: p.json,
          })
          onClose()
        }}
        onClose={onClose}
      />
    </div>
  )
}

export default SequenceEmailModal
