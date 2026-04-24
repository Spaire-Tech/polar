'use client'

import CalendarTodayOutlined from '@mui/icons-material/CalendarTodayOutlined'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined'
import KeyboardArrowDownOutlined from '@mui/icons-material/KeyboardArrowDownOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
import WaterDropOutlined from '@mui/icons-material/WaterDropOutlined'
import { cn } from '@spaire/ui/lib/utils'
import { useEffect, useRef, useState } from 'react'

export type ModuleStatus = 'draft' | 'published' | 'scheduled' | 'drip' | 'locked'

const STATUS_OPTIONS: {
  value: ModuleStatus
  label: string
  Icon: typeof DescriptionOutlined
  tone: string
}[] = [
  { value: 'draft', label: 'Draft', Icon: DescriptionOutlined, tone: 'bg-gray-100 text-gray-700' },
  { value: 'published', label: 'Publish', Icon: CheckCircleOutlined, tone: 'bg-green-100 text-green-700' },
  { value: 'scheduled', label: 'Schedule', Icon: CalendarTodayOutlined, tone: 'bg-blue-100 text-blue-700' },
  { value: 'drip', label: 'Drip', Icon: WaterDropOutlined, tone: 'bg-indigo-100 text-indigo-700' },
  { value: 'locked', label: 'Lock', Icon: LockOutlined, tone: 'bg-gray-900 text-white' },
]

export function StatusDropdown({
  status,
  onChange,
}: {
  status: string
  onChange: (next: ModuleStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const current =
    STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0]
  const { Icon, label, tone } = current

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
          tone,
        )}
      >
        <Icon sx={{ fontSize: 14 }} />
        {label}
        <KeyboardArrowDownOutlined sx={{ fontSize: 14 }} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 flex w-44 flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
          {STATUS_OPTIONS.map(({ value, label, Icon, tone }) => (
            <button
              key={value}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange(value)
                setOpen(false)
              }}
              className="flex items-center justify-start rounded-xl px-2 py-1.5 hover:bg-gray-50"
            >
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                  tone,
                  status === value && 'ring-2 ring-offset-1 ring-gray-300',
                )}
              >
                <Icon sx={{ fontSize: 14 }} />
                {label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
