'use client'

// BroadcastEditorDesign — the creator's email editor, rebuilt faithfully from
// their design. React owns a single container; the design's engine drives the
// three panes (palette · themed email canvas · inspector) imperatively, exactly
// as designed. Each lifecycle trigger loads its own full template, bound to the
// real course (lessons, cover, instructor, facts) and editable inline.

import { useEffect, useRef } from 'react'

import type { CourseData } from '../v3/courseData'
import { bindCourse, makeAssetResolver } from './courseBind'
import './design.css'
import { createEditor, type EditorHandle, type EditorState } from './emailEngine'
import { SHELL_HTML } from './shellMarkup'

export interface BroadcastEditorDesignProps {
  /** Real course name shown in the crumb. */
  courseName?: string
  /** Real course, bound into every freshly-loaded template (editable). */
  course?: CourseData
  /** Lifecycle trigger to open on (enrolment, firstLesson, halfway, …). */
  initialTrigger?: string
  /** Subject seed (overrides the template default when restoring an old email). */
  initialSubject?: string
  /** Previously-saved editor state to restore instead of a fresh template. */
  initialState?: EditorState | null
  /** Upload a chosen image → hosted URL (S3). */
  onUploadImage?: (file: File) => Promise<string>
  /** Persist the authored email. */
  onSave?: (v: { subject: string; preview: string; html: string; json: EditorState }) => void
  /** Back / close. */
  onClose?: () => void
}

export function BroadcastEditorDesign({
  courseName,
  course,
  initialTrigger,
  initialSubject,
  initialState,
  onUploadImage,
  onSave,
  onClose,
}: BroadcastEditorDesignProps) {
  const ref = useRef<HTMLDivElement>(null)
  const handleRef = useRef<EditorHandle | null>(null)

  // Keep the latest callbacks/data without re-mounting the imperative engine.
  const cbRef = useRef({ onUploadImage, onSave, onClose, course })
  cbRef.current = { onUploadImage, onSave, onClose, course }

  // Re-mount the engine only when the bound course identity changes (e.g. the
  // async course query resolves once). Edits haven't begun at that point.
  const courseKey = course ? course.title + '·' + course.lessons.length : 'none'

  useEffect(() => {
    const rootEl = ref.current
    if (!rootEl) return
    rootEl.innerHTML = SHELL_HTML

    const seededState =
      initialState && initialState.blocks?.length
        ? initialSubject
          ? { ...initialState, broadcast: { ...initialState.broadcast, subject: initialSubject } }
          : initialState
        : null

    const handle = createEditor(rootEl, {
      courseName,
      initialTrigger,
      initialState: seededState,
      resolveAsset: makeAssetResolver(cbRef.current.course),
      applyCourse: (blocks) => bindCourse(blocks, cbRef.current.course),
      onUploadImage: (file) => cbRef.current.onUploadImage!(file),
      onSave: (v) =>
        cbRef.current.onSave &&
        cbRef.current.onSave({ subject: v.subject, preview: v.preview, html: v.html, json: v.json }),
      onClose: () => cbRef.current.onClose && cbRef.current.onClose(),
    })
    handleRef.current = handle
    return () => {
      handle.destroy()
      handleRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseKey, courseName, initialTrigger])

  return <div className="bedesign" ref={ref} />
}

export default BroadcastEditorDesign
