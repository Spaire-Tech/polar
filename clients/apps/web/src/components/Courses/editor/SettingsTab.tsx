'use client'

import { CourseRead } from '@/hooks/queries/courses'
import LockOutlined from '@mui/icons-material/LockOutlined'
import { useEffect, useState } from 'react'

export type CourseSettingsEdits = {
  paywall_enabled: boolean
  paywall_position: number | null
}

export function SettingsTab({
  course,
  onSave,
  isSaving,
}: {
  course: CourseRead
  onSave: (edits: CourseSettingsEdits) => void
  isSaving: boolean
}) {
  const [enabled, setEnabled] = useState(course.paywall_enabled)
  const [position, setPosition] = useState<number | null>(
    course.paywall_position ?? (course.modules.length > 1 ? 1 : null),
  )

  useEffect(() => {
    setEnabled(course.paywall_enabled)
    setPosition(course.paywall_position)
  }, [course.id, course.paywall_enabled, course.paywall_position])

  const dirty =
    enabled !== course.paywall_enabled || position !== course.paywall_position

  const lockedCount = enabled && position != null
    ? Math.max(0, course.modules.length - position)
    : 0

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Course settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Control how students access content in this course.
        </p>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <LockOutlined sx={{ fontSize: 18 }} />
          </span>
          <div className="flex-1">
            <h2 className="text-base font-bold text-gray-900">Paywall</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Place a paywall between modules. Modules above the paywall are
              free preview; everything after is locked until purchase.
            </p>
          </div>
          <Toggle checked={enabled} onChange={setEnabled} />
        </div>

        {enabled && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <label className="block text-sm font-bold text-gray-900">
              Paywall position
            </label>
            <p className="mt-0.5 text-xs text-gray-500">
              Number of modules visible before the paywall. Modules after this
              count are locked.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={course.modules.length}
                value={position ?? 0}
                onChange={(e) => setPosition(parseInt(e.target.value || '0'))}
                className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
              />
              <span className="text-sm text-gray-600">
                of {course.modules.length} modules visible
              </span>
            </div>

            {course.modules.length > 0 && position != null && (
              <div className="mt-4 flex flex-col gap-1">
                {course.modules.map((m, idx) => {
                  const locked = idx >= position
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                      style={{
                        backgroundColor: locked
                          ? 'rgb(254 242 242)'
                          : 'rgb(240 253 244)',
                      }}
                    >
                      <span className="text-xs text-gray-400">
                        {idx + 1}.
                      </span>
                      <span className="flex-1 truncate text-gray-900">
                        {m.title}
                      </span>
                      <span
                        className={
                          locked
                            ? 'text-xs font-medium text-red-700'
                            : 'text-xs font-medium text-green-700'
                        }
                      >
                        {locked ? 'Locked' : 'Free preview'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {lockedCount === 0 && position != null && (
              <p className="mt-3 text-xs text-amber-600">
                With this position, no modules are locked — every module is a
                free preview.
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button
            disabled={!dirty || isSaving}
            onClick={() => {
              setEnabled(course.paywall_enabled)
              setPosition(course.paywall_position)
            }}
            className="rounded-full border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Reset
          </button>
          <button
            disabled={!dirty || isSaving}
            onClick={() =>
              onSave({
                paywall_enabled: enabled,
                paywall_position: enabled ? position : null,
              })
            }
            className="rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </section>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
        checked ? 'bg-gray-900' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
