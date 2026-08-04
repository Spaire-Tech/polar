'use client'

// The course landing, alone on the page — the document the Landing tab's
// phone frame iframes. It renders exactly what a phone visitor sees, with
// direct manipulation kept for the edits that matter at phone size: drag
// the cover / lesson stills / portrait into place. Repositions run through
// the same edit pipeline as the desktop canvas (optimistic saves, ⌘Z/⌘⇧Z
// undo) against the same server; the desktop side refetches when the
// creator switches back.

import { CourseDesignEditor } from '@/components/Courses/editor/CourseDesignEditor'
import { useLandingEditor } from '@/components/Courses/editor/useLandingEditor'
import { useCourseById } from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'
import { useEffect, useState } from 'react'

function StatusChip({ label, error }: { label: string; error: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed bottom-3 left-1/2 z-[80] -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-semibold shadow-lg ${
        error ? 'bg-red-600 text-white' : 'bg-black/70 text-white'
      }`}
    >
      {label}
    </div>
  )
}

function Editor({
  organization,
  course,
}: {
  organization: schemas['Organization']
  course: NonNullable<ReturnType<typeof useCourseById>['data']>
}) {
  const editor = useLandingEditor(course)
  const [uploadBusy, setUploadBusy] = useState(false)
  const { undo, redo, status } = editor

  // Same ⌘Z / ⌘⇧Z handling as the desktop Landing tab, scoped to this frame.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const key = e.key.toLowerCase()
      const isUndo = key === 'z' && !e.shiftKey
      const isRedo = (key === 'z' && e.shiftKey) || key === 'y'
      if (!isUndo && !isRedo) return
      const el = document.activeElement as HTMLElement | null
      const inField =
        !!el &&
        (el.isContentEditable ||
          el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT')
      if (inField) return
      e.preventDefault()
      if (isRedo) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const saving = uploadBusy || status === 'saving'
  const label = saving
    ? 'Saving…'
    : status === 'error'
      ? "Couldn't save — retry"
      : status === 'saved'
        ? 'Saved'
        : ''

  return (
    <div className="min-h-screen bg-white">
      <CourseDesignEditor
        course={course}
        organization={organization}
        editor={editor}
        onBusyChange={setUploadBusy}
        mode="reposition"
      />
      {label && <StatusChip label={label} error={status === 'error'} />}
    </div>
  )
}

export default function LandingMobileEditor({
  organization,
  courseId,
}: {
  organization: schemas['Organization']
  courseId: string
}) {
  const { data: course, isLoading, error } = useCourseById(courseId)

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }
  if (error || !course) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <p className="text-sm text-gray-500">Course not found.</p>
      </div>
    )
  }
  return <Editor organization={organization} course={course} />
}
