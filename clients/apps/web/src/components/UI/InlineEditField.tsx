'use client'

import { useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface InlineEditFieldProps {
  label: string
  value: string
  onSave: (value: string) => Promise<void>
  inputType?: 'text' | 'email' | 'number' | 'url'
  placeholder?: string
  className?: string
}

/**
 * A settings field that renders as label+text until clicked,
 * then becomes an input with Save/Cancel inline.
 *
 * Stripe uses this pattern extensively in settings pages.
 * Replaces the full-form-submit pattern.
 */
export const InlineEditField = ({
  label,
  value,
  onSave,
  inputType = 'text',
  placeholder,
  className,
}: InlineEditFieldProps) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleEdit = () => {
    setDraft(value)
    setEditing(true)
    // Focus after render
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleSave = async () => {
    if (draft === value) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') {
      setDraft(value)
      setEditing(false)
    }
  }

  return (
    <div
      className={twMerge(
        'dark:border-spaire-800 group flex items-center justify-between gap-4 border-b border-gray-100 py-3',
        className,
      )}
    >
      <span className="dark:text-spaire-400 shrink-0 text-sm text-gray-500">
        {label}
      </span>

      {editing ? (
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <input
            ref={inputRef}
            type={inputType}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="dark:bg-spaire-950 dark:border-spaire-700 dark:text-white dark:placeholder-spaire-600 min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-right text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-500 dark:focus:border-blue-500"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 text-xs font-medium text-blue-500 hover:text-blue-600 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => {
              setDraft(value)
              setEditing(false)
            }}
            className="dark:text-spaire-500 shrink-0 text-xs font-medium text-gray-400 hover:text-gray-700 dark:hover:text-white"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={handleEdit}
          className="group/edit flex min-w-0 items-center gap-2 text-right"
        >
          <span className="min-w-0 truncate text-sm text-gray-900 dark:text-white">
            {value || (
              <span className="dark:text-spaire-600 text-gray-300 italic">
                {placeholder ?? 'Not set'}
              </span>
            )}
          </span>
          <span className="dark:text-spaire-600 shrink-0 text-xs text-gray-300 opacity-0 transition-opacity group-hover:opacity-100">
            Edit
          </span>
        </button>
      )}
    </div>
  )
}
