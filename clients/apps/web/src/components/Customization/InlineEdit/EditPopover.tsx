'use client'

import { useEffect, type ReactNode } from 'react'

/**
 * Modal popover used by every inline-edit affordance that needs more
 * space than a contentEditable allows (tag inputs, social rows,
 * available-for-work toggle, profile-title select, etc.).
 *
 * Backdrop is blurred per the editor's "anything modal blurs the
 * background" principle (matches the picker).
 */
export const EditPopover = ({
  title,
  open,
  onClose,
  onConfirm,
  confirmLabel = 'Done',
  cancelLabel = 'Cancel',
  children,
}: {
  title: string
  open: boolean
  onClose: () => void
  onConfirm?: () => void
  confirmLabel?: string
  cancelLabel?: string
  children: ReactNode
}) => {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null
  return (
    <>
      <div className="edit-pop-backdrop" onClick={onClose} />
      <div
        className="edit-pop"
        role="dialog"
        aria-label={title}
        aria-modal="true"
      >
        <div className="edit-pop-head">
          <div className="edit-pop-title">{title}</div>
          <button
            type="button"
            className="hc-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="edit-pop-body">{children}</div>
        <div className="edit-pop-foot">
          <button
            type="button"
            className="edit-pop-cta ghost"
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="edit-pop-cta"
            onClick={() => {
              onConfirm?.()
              onClose()
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  )
}
