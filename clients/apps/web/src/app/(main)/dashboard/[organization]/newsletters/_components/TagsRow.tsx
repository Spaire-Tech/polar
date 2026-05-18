import { useState } from 'react'
import { Icon } from '../../email-marketing/_components/Icon'

/**
 * Content tags chip row. Persisted as a `string[]` on the post. Adding
 * a new tag is keyboard-driven (Enter commits, Esc cancels) to match
 * the rest of the editor's input flow.
 */
export function TagsRow({
  tags,
  onChange,
}: {
  tags: string[]
  onChange: (next: string[]) => void
}) {
  const [adding, setAdding] = useState(false)

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 18,
      }}
    >
      {tags.map((t, i) => (
        <span
          key={`${t}-${i}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 9px 3px 8px',
            border: '1px solid #e5e5ea',
            borderRadius: 999,
            background: '#fafafa',
            fontSize: 12,
            color: '#3a3a3c',
          }}
        >
          <Icon name="tag" size={11} />
          {t}
          <button
            type="button"
            aria-label={`Remove tag ${t}`}
            onClick={() => onChange(tags.filter((_, k) => k !== i))}
            style={{
              marginLeft: 2,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#86868b',
              display: 'inline-flex',
              padding: 0,
            }}
          >
            <Icon name="x" size={11} />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          placeholder="tag name"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const v = (e.target as HTMLInputElement).value.trim()
              if (v && !tags.includes(v)) onChange([...tags, v])
              setAdding(false)
            } else if (e.key === 'Escape') {
              setAdding(false)
            }
          }}
          onBlur={() => setAdding(false)}
          style={{
            padding: '3px 9px',
            border: '1px solid #e5e5ea',
            borderRadius: 999,
            background: '#fff',
            fontSize: 12,
            width: 120,
            outline: 'none',
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 9px',
            border: '1px dashed #d1d1d6',
            borderRadius: 999,
            background: 'transparent',
            color: '#86868b',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <Icon name="tag" size={11} />
          Add content tag
        </button>
      )}
    </div>
  )
}
