'use client'

// Minimal swatch grid + hex input. No new deps; matches the design's
// monochrome aesthetic. Used by both the bubble menu (text colour) and
// the button context panel (background + text).

import { useState } from 'react'

const SWATCHES = [
  '#000000', '#525252', '#9a9ea4', '#ffffff',
  '#c8414b', '#e07b00', '#d4a017', '#1f8a4c',
  '#0e7490', '#2563eb', '#7c3aed', '#be185d',
]

export function ColorPicker({
  value,
  onChange,
  label,
  size = 22,
}: {
  value: string
  onChange: (color: string) => void
  label?: string
  size?: number
}) {
  const [hex, setHex] = useState(value)

  const apply = (next: string) => {
    setHex(next)
    onChange(next)
  }

  return (
    <div>
      {label && (
        <div className="cp-label" style={{ marginBottom: 8 }}>
          {label}
        </div>
      )}
      <div className="cp-row">
        <div className="cp-swatches">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              className={'cp-swatch' + (value.toLowerCase() === c.toLowerCase() ? ' on' : '')}
              style={{ background: c, width: size, height: size }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => apply(c)}
            />
          ))}
        </div>
        <label className="cp-hex">
          <span>#</span>
          <input
            value={hex.replace(/^#/, '')}
            placeholder="000000"
            maxLength={6}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
              setHex('#' + v)
              if (v.length === 3 || v.length === 6) onChange('#' + v)
            }}
            spellCheck={false}
          />
        </label>
      </div>
    </div>
  )
}
