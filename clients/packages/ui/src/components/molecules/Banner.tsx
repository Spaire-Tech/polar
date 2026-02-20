import React from 'react'
import { twMerge } from 'tailwind-merge'

type Color = 'default' | 'muted' | 'red' | 'green' | 'blue'

const Banner = ({
  children,
  right,
  color,
}: {
  children: React.ReactNode
  right?: React.ReactNode
  color: Color
}) => {
  return (
    <div
      className={twMerge(
        'flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm',
        color === 'default'
          ? 'bg-white/[0.04] ring-1 ring-white/[0.06]'
          : '',
        color === 'muted'
          ? 'border border-white/[0.06] bg-white/[0.04] text-polar-500'
          : '',
        color === 'red'
          ? 'border border-red-900 bg-red-950/50 text-red-600'
          : '',
        color === 'green'
          ? 'border border-green-800 bg-green-900 text-green-200'
          : '',
        color === 'blue'
          ? 'border border-blue-700 bg-blue-900 text-blue-300'
          : '',
      )}
    >
      <div className="flex flex-1 items-center gap-2">{children}</div>
      {right && <div>{right}</div>}
    </div>
  )
}

export default Banner
