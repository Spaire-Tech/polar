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
  /** Disable the top-bar template/trigger switcher (automation context, where
   *  the sequence owns the trigger and switching would wipe the email). */
  lockTrigger?: boolean
  /** Real number of students enrolled (replaces the placeholder count). */
  enrolledCount?: number
  /** Creator/organization name — the fallback instructor + default "from" name
   *  when the course itself has no instructor set. */
  creatorName?: string
  /** Subject seed (overrides the template default when restoring an old email). */
  initialSubject?: string
  /** Previously-saved editor state to restore instead of a fresh template. */
  initialState?: EditorState | null
  /** Upload a chosen image → hosted URL (S3). */
  onUploadImage?: (file: File) => Promise<string>
  /** Send a test of the current email to the creator's inbox. */
  onSendTest?: (v: { subject: string; preview: string; html: string }) => Promise<void>
  /** Persist the authored email. */
  onSave?: (v: { subject: string; preview: string; html: string; json: EditorState }) => void
  /** Persist edits in the background (debounced) without closing — makes the
   *  "Saved" status truthful and prevents losing work on Back. */
  onAutosave?: (v: { subject: string; preview: string; html: string; json: EditorState }) => void
  /** Back / close. */
  onClose?: () => void
}

export function BroadcastEditorDesign({
  courseName,
  course,
  initialTrigger,
  lockTrigger,
  enrolledCount,
  creatorName,
  initialSubject,
  initialState,
  onUploadImage,
  onSendTest,
  onSave,
  onAutosave,
  onClose,
}: BroadcastEditorDesignProps) {
  const ref = useRef<HTMLDivElement>(null)
  const handleRef = useRef<EditorHandle | null>(null)

  // Keep the latest callbacks/data without re-mounting the imperative engine.
  const cbRef = useRef({ onUploadImage, onSendTest, onSave, onAutosave, onClose, course, creatorName })
  cbRef.current = { onUploadImage, onSendTest, onSave, onAutosave, onClose, course, creatorName }

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
      lockTrigger,
      enrolledCount,
      fromName: creatorName,
      initialState: seededState,
      resolveAsset: makeAssetResolver(cbRef.current.course),
      applyCourse: (blocks) => bindCourse(blocks, cbRef.current.course, cbRef.current.creatorName),
      onUploadImage: (file) => cbRef.current.onUploadImage!(file),
      onSendTest: cbRef.current.onSendTest
        ? (v) => cbRef.current.onSendTest!(v)
        : undefined,
      onSave: (v) =>
        cbRef.current.onSave &&
        cbRef.current.onSave({ subject: v.subject, preview: v.preview, html: v.html, json: v.json }),
      onAutosave: (v) =>
        cbRef.current.onAutosave &&
        cbRef.current.onAutosave({ subject: v.subject, preview: v.preview, html: v.html, json: v.json }),
      onClose: () => cbRef.current.onClose && cbRef.current.onClose(),
    })
    handleRef.current = handle
    return () => {
      handle.destroy()
      handleRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseKey, courseName, initialTrigger, lockTrigger, enrolledCount, creatorName])

  return <div className="bedesign" ref={ref} />
}

export default BroadcastEditorDesign
