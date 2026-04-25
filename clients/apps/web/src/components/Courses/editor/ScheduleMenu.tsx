'use client'

import { CourseModuleRead } from '@/hooks/queries/courses'
import CalendarTodayOutlined from '@mui/icons-material/CalendarTodayOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined'
import { cn } from '@spaire/ui/lib/utils'
import { useEffect, useRef, useState } from 'react'

type Mode = 'always' | 'drip' | 'release'

export type ScheduleEdits = {
  drip_days: number | null
  release_at: string | null
}

export function ScheduleMenu({
  module,
  onSave,
}: {
  module: CourseModuleRead
  onSave: (edits: ScheduleEdits) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const summary = describe(module)
  const isScheduled = summary !== 'Available immediately'

  return (
    <div ref={containerRef} className="relative">
      <button
        title={summary}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium transition-colors',
          isScheduled
            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700',
        )}
      >
        <ScheduleOutlined sx={{ fontSize: 14 }} />
        {isScheduled && <span className="hidden md:inline">{summary}</span>}
      </button>

      {open && (
        <SchedulePanel
          module={module}
          onClose={() => setOpen(false)}
          onSave={(edits) => {
            onSave(edits)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

function SchedulePanel({
  module,
  onClose,
  onSave,
}: {
  module: CourseModuleRead
  onClose: () => void
  onSave: (edits: ScheduleEdits) => void
}) {
  const initialMode: Mode = module.release_at
    ? 'release'
    : module.drip_days != null
      ? 'drip'
      : 'always'

  const [mode, setMode] = useState<Mode>(initialMode)
  const [dripDays, setDripDays] = useState<number>(module.drip_days ?? 7)
  const [releaseAt, setReleaseAt] = useState<string>(
    module.release_at ? module.release_at.slice(0, 10) : '',
  )

  const save = () => {
    if (mode === 'always') {
      onSave({ drip_days: null, release_at: null })
    } else if (mode === 'drip') {
      onSave({ drip_days: Math.max(0, dripDays), release_at: null })
    } else {
      const iso = releaseAt
        ? new Date(`${releaseAt}T00:00:00Z`).toISOString()
        : null
      onSave({ drip_days: null, release_at: iso })
    }
  }

  return (
    <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-bold text-gray-900">Module schedule</h4>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700"
        >
          <CloseOutlined sx={{ fontSize: 16 }} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <ModeRow
          selected={mode === 'always'}
          onSelect={() => setMode('always')}
          label="Available immediately"
          description="Students see this module as soon as they enroll."
        />
        <ModeRow
          selected={mode === 'drip'}
          onSelect={() => setMode('drip')}
          label="Drip after enrollment"
          description="Unlock N days after the student enrolls."
        />
        {mode === 'drip' && (
          <div className="ml-7 mt-1 flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={dripDays}
              onChange={(e) => setDripDays(parseInt(e.target.value || '0'))}
              className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
            />
            <span className="text-sm text-gray-600">
              day{dripDays === 1 ? '' : 's'} after enrollment
            </span>
          </div>
        )}
        <ModeRow
          selected={mode === 'release'}
          onSelect={() => setMode('release')}
          label="Release on a specific date"
          description="Unlock for everyone on a fixed date."
        />
        {mode === 'release' && (
          <div className="ml-7 mt-1 flex items-center gap-2">
            <CalendarTodayOutlined
              sx={{ fontSize: 14 }}
              className="text-gray-400"
            />
            <input
              type="date"
              value={releaseAt}
              onChange={(e) => setReleaseAt(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-3">
        <button
          onClick={onClose}
          className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={save}
          className="rounded-full bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
        >
          Save schedule
        </button>
      </div>
    </div>
  )
}

function ModeRow({
  selected,
  onSelect,
  label,
  description,
}: {
  selected: boolean
  onSelect: () => void
  label: string
  description: string
}) {
  return (
    <button
      onClick={onSelect}
      className="flex items-start gap-3 rounded-lg p-2 text-left hover:bg-gray-50"
    >
      <span
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
          selected ? 'border-gray-900' : 'border-gray-300',
        )}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-gray-900" />}
      </span>
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
    </button>
  )
}

function describe(module: CourseModuleRead): string {
  if (module.release_at) {
    const d = new Date(module.release_at)
    return `Releases ${d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })}`
  }
  if (module.drip_days != null) {
    return `Drips ${module.drip_days}d after enrollment`
  }
  return 'Available immediately'
}
