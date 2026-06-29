'use client'

// Dashboard customize tab — a thin shell around CourseDesignEditor.
//
// Edits persist immediately, but through a single pipeline (useLandingEditor)
// that surfaces a real save status (Saving / Saved / Couldn't save), rolls
// failed saves back, and powers undo/redo. The old "Changes save
// automatically" label lied on failure; this bar tells the truth and adds the
// Undo/Redo affordance the editor never had.

import { CourseRead } from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'
import { useEffect, useState } from 'react'
import { CourseDesignEditor } from './CourseDesignEditor'
import { useLandingEditor } from './useLandingEditor'

const barButton =
  'rounded-md border border-gray-200 bg-white px-3 py-[6px] text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40'

export function CustomizeTab({
  course,
  organization,
}: {
  course: CourseRead
  organization: schemas['Organization']
}) {
  const editor = useLandingEditor(course)
  const [uploadBusy, setUploadBusy] = useState(false)
  const { undo, redo, canUndo, canRedo, status } = editor

  // ⌘Z / ⌘⇧Z (and Ctrl+Y) drive undo/redo — but only when the focus isn't in
  // an editable field, so native text-undo keeps working while you're typing.
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
  const statusLabel = saving
    ? 'Saving…'
    : status === 'error'
      ? "Couldn't save — retry"
      : status === 'saved'
        ? 'Saved'
        : 'All changes saved'
  const statusColor =
    status === 'error' && !saving ? 'text-red-500' : 'text-gray-400'

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Slim status bar — breadcrumb, undo/redo, save status, public preview. */}
      <div className="flex h-12 flex-shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[12px] text-gray-500">Course landing</span>
          <span className="text-[13px] text-gray-400">›</span>
          <span className="truncate text-[13px] font-medium text-gray-900">
            {course.title ?? 'Untitled course'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className={barButton}
              onClick={undo}
              disabled={!canUndo}
              title="Undo (⌘Z)"
            >
              Undo
            </button>
            <button
              type="button"
              className={barButton}
              onClick={redo}
              disabled={!canRedo}
              title="Redo (⌘⇧Z)"
            >
              Redo
            </button>
          </div>
          <span
            className={`text-[11.5px] ${statusColor}`}
            role="status"
            aria-live="polite"
          >
            {statusLabel}
          </span>
          <a
            href={`/${organization.slug}/products/${course.product_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={barButton}
          >
            Preview ↗
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <CourseDesignEditor
          course={course}
          organization={organization}
          editor={editor}
          onBusyChange={setUploadBusy}
        />
      </div>
    </div>
  )
}
