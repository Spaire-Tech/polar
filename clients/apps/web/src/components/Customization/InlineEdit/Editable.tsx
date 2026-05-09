'use client'

import { useEffect, useRef } from 'react'

/**
 * A small contentEditable wrapper that gives a text node the
 * design's inline-edit affordance: dashed indigo outline on hover,
 * solid on focus, blur or Enter (single-line) commits.
 */
export const Editable = ({
  value,
  onCommit,
  placeholder,
  multiline = false,
  className = '',
  as: Tag = 'span',
  maxLength,
}: {
  value: string
  onCommit: (next: string) => void
  placeholder?: string
  multiline?: boolean
  className?: string
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p' | 'div'
  maxLength?: number
}) => {
  const ref = useRef<HTMLElement>(null)

  // Keep the DOM in sync if the prop value changes externally (e.g.
  // form.reset). React doesn't manage contentEditable's text content.
  useEffect(() => {
    if (ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value
    }
  }, [value])

  const commit = () => {
    const next = ref.current?.innerText.trim() ?? ''
    if (next !== value) onCommit(next)
  }

  const TagName = Tag as React.ElementType
  const empty = !value && !!placeholder

  return (
    <TagName
      ref={ref as React.Ref<HTMLElement>}
      className={`editable ${className}`}
      contentEditable
      suppressContentEditableWarning
      data-block={Tag !== 'span'}
      data-empty={empty}
      data-placeholder={placeholder}
      onBlur={commit}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (!multiline && e.key === 'Enter') {
          e.preventDefault()
          ;(e.target as HTMLElement).blur()
        }
        if (
          maxLength !== undefined &&
          (e.target as HTMLElement).innerText.length >= maxLength &&
          e.key.length === 1 &&
          !e.metaKey &&
          !e.ctrlKey
        ) {
          e.preventDefault()
        }
      }}
    >
      {value}
    </TagName>
  )
}
