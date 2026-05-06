'use client'

import { CourseRead, useUploadCourseThumbnail } from '@/hooks/queries/courses'
import GroupOutlined from '@mui/icons-material/GroupOutlined'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ThumbnailPositioner } from './ThumbnailPositioner'

export type CourseSettingsEdits = {
  paywall_enabled: boolean
  paywall_position: number | null
  paywall_lesson_id?: string | null
  course_type?: 'evergreen' | 'cohort'
  instructor_name_italic?: boolean
  instructor_name_bold?: boolean
  instructor_name_uppercase?: boolean
  thumbnail_object_position?: string | null
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
  const [paywallLessonId, setPaywallLessonId] = useState<string | null>(
    course.paywall_lesson_id ?? null,
  )
  const [paywallMode, setPaywallMode] = useState<'module' | 'lesson'>(
    course.paywall_lesson_id ? 'lesson' : 'module',
  )
  const [courseType, setCourseType] = useState<'evergreen' | 'cohort'>(
    (course.course_type as 'evergreen' | 'cohort') ?? 'evergreen',
  )
  const [italic, setItalic] = useState(course.instructor_name_italic ?? true)
  const [bold, setBold] = useState(course.instructor_name_bold ?? true)
  const [uppercase, setUppercase] = useState(
    course.instructor_name_uppercase ?? true,
  )
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(
    course.thumbnail_url ?? null,
  )
  const [thumbnailPosition, setThumbnailPosition] = useState<string | null>(
    course.thumbnail_object_position ?? null,
  )

  const flatLessons = useMemo(
    () => course.modules.flatMap((m) => m.lessons),
    [course.modules],
  )
  const thumbnailInputRef = useRef<HTMLInputElement>(null)
  const uploadThumbnail = useUploadCourseThumbnail()

  useEffect(() => {
    setEnabled(course.paywall_enabled)
    setPosition(course.paywall_position)
    setPaywallLessonId(course.paywall_lesson_id ?? null)
    setPaywallMode(course.paywall_lesson_id ? 'lesson' : 'module')
    setCourseType((course.course_type as 'evergreen' | 'cohort') ?? 'evergreen')
    setItalic(course.instructor_name_italic ?? true)
    setBold(course.instructor_name_bold ?? true)
    setUppercase(course.instructor_name_uppercase ?? true)
    setThumbnailUrl(course.thumbnail_url ?? null)
    setThumbnailPosition(course.thumbnail_object_position ?? null)
  }, [
    course.id,
    course.paywall_enabled,
    course.paywall_position,
    course.paywall_lesson_id,
    course.course_type,
    course.instructor_name_italic,
    course.instructor_name_bold,
    course.instructor_name_uppercase,
    course.thumbnail_url,
    course.thumbnail_object_position,
  ])

  const handleThumbnailChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const updated = await uploadThumbnail.mutateAsync({
        courseId: course.id,
        file,
      })
      setThumbnailUrl(updated.thumbnail_url ?? null)
    } catch {
      // mutation surfaces error
    }
    e.target.value = ''
  }

  const dirty =
    enabled !== course.paywall_enabled ||
    position !== course.paywall_position ||
    paywallLessonId !== (course.paywall_lesson_id ?? null) ||
    courseType !==
      ((course.course_type as 'evergreen' | 'cohort') ?? 'evergreen') ||
    italic !== (course.instructor_name_italic ?? true) ||
    bold !== (course.instructor_name_bold ?? true) ||
    uppercase !== (course.instructor_name_uppercase ?? true) ||
    (thumbnailPosition ?? null) !== (course.thumbnail_object_position ?? null)

  const lockedCount =
    enabled && position != null
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

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <ImageOutlined sx={{ fontSize: 18 }} />
          </span>
          <div className="flex-1">
            <h2 className="text-base font-bold text-gray-900">
              Course thumbnail
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Shown on the course card and the student portal. JPG or PNG with a
              non-transparent background. Recommended dimensions{' '}
              <span className="font-semibold text-gray-700">1280×720</span>.
            </p>
          </div>
        </div>

        <input
          ref={thumbnailInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleThumbnailChange}
        />

        {thumbnailUrl ? (
          <div className="flex flex-col gap-3">
            <ThumbnailPositioner
              src={thumbnailUrl}
              value={thumbnailPosition}
              onChange={setThumbnailPosition}
            />
            <p className="text-xs text-gray-500">
              Drag the image to choose the focal point shown on the landing page
              hero.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                disabled={uploadThumbnail.isPending}
                onClick={() => thumbnailInputRef.current?.click()}
                className="rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
              >
                {uploadThumbnail.isPending ? 'Uploading…' : 'Replace image'}
              </button>
            </div>
          </div>
        ) : (
          <div
            className="flex cursor-pointer items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 transition-colors hover:border-gray-300"
            onClick={() => thumbnailInputRef.current?.click()}
          >
            <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white">
              <ImageOutlined className="text-gray-300" sx={{ fontSize: 32 }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                Upload an image
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {uploadThumbnail.isPending
                  ? 'Uploading…'
                  : 'Click to select a file'}
              </p>
            </div>
            <button
              type="button"
              disabled={uploadThumbnail.isPending}
              className="rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              {uploadThumbnail.isPending ? 'Uploading…' : 'Select image'}
            </button>
          </div>
        )}
      </section>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <GroupOutlined sx={{ fontSize: 18 }} />
          </span>
          <div className="flex-1">
            <h2 className="text-base font-bold text-gray-900">Course type</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Evergreen courses are open-ended for self-paced students. Cohort
              courses run on a fixed schedule with a shared start date.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setCourseType('evergreen')}
            className={`flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-colors ${
              courseType === 'evergreen'
                ? 'border-gray-900 bg-white'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <span className="text-sm font-semibold text-gray-900">
              Evergreen
            </span>
            <span className="text-xs text-gray-500">
              Always-open self-paced learning.
            </span>
          </button>
          <button
            type="button"
            onClick={() => setCourseType('cohort')}
            className={`flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-colors ${
              courseType === 'cohort'
                ? 'border-gray-900 bg-white'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <span className="text-sm font-semibold text-gray-900">Cohort</span>
            <span className="text-xs text-gray-500">
              Group of students moving through together.
            </span>
          </button>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-base font-bold text-gray-900">
            Instructor name styling
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            How the instructor&rsquo;s name is displayed on the landing page.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <StyleToggle label="Italic" checked={italic} onChange={setItalic} />
          <StyleToggle label="Bold" checked={bold} onChange={setBold} />
          <StyleToggle
            label="Uppercase"
            checked={uppercase}
            onChange={setUppercase}
          />
        </div>
        {course.instructor_name && (
          <div
            className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm"
            style={{
              fontStyle: italic ? 'italic' : 'normal',
              fontWeight: bold ? 700 : 400,
              textTransform: uppercase ? 'uppercase' : 'none',
            }}
          >
            {course.instructor_name}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <LockOutlined sx={{ fontSize: 18 }} />
          </span>
          <div className="flex-1">
            <h2 className="text-base font-bold text-gray-900">Paywall</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Lock content behind purchase. Choose how far into the course
              students can preview before paying.
            </p>
          </div>
          <Toggle checked={enabled} onChange={setEnabled} />
        </div>

        {enabled && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="mb-4 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setPaywallMode('module')
                  setPaywallLessonId(null)
                }}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  paywallMode === 'module'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                By module
              </button>
              <button
                type="button"
                onClick={() => setPaywallMode('lesson')}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  paywallMode === 'lesson'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                By lesson
              </button>
            </div>

            {paywallMode === 'module' ? (
              <>
                <label className="block text-sm font-bold text-gray-900">
                  Paywall position
                </label>
                <p className="mt-0.5 text-xs text-gray-500">
                  Number of modules visible before the paywall.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={course.modules.length}
                    value={position ?? 0}
                    onChange={(e) =>
                      setPosition(parseInt(e.target.value || '0'))
                    }
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
                    With this position, no modules are locked — every module is
                    a free preview.
                  </p>
                )}
              </>
            ) : (
              <>
                <label className="block text-sm font-bold text-gray-900">
                  Paywall lesson
                </label>
                <p className="mt-0.5 text-xs text-gray-500">
                  Lessons before this one are free preview; this lesson and
                  everything after are locked until purchase.
                </p>
                <select
                  value={paywallLessonId ?? ''}
                  onChange={(e) => setPaywallLessonId(e.target.value || null)}
                  className="mt-3 w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                >
                  <option value="">— Select a lesson —</option>
                  {flatLessons.map((l, idx) => (
                    <option key={l.id} value={l.id}>
                      {idx + 1}. {l.title || 'Untitled lesson'}
                    </option>
                  ))}
                </select>
                {paywallLessonId && (
                  <div className="mt-4 flex flex-col gap-1">
                    {flatLessons.map((l, idx) => {
                      const lockIdx = flatLessons.findIndex(
                        (x) => x.id === paywallLessonId,
                      )
                      const locked = lockIdx >= 0 && idx >= lockIdx
                      return (
                        <div
                          key={l.id}
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
                            {l.title || 'Untitled lesson'}
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
              </>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button
            disabled={!dirty || isSaving}
            onClick={() => {
              setEnabled(course.paywall_enabled)
              setPosition(course.paywall_position)
              setPaywallLessonId(course.paywall_lesson_id ?? null)
              setPaywallMode(course.paywall_lesson_id ? 'lesson' : 'module')
              setCourseType(
                (course.course_type as 'evergreen' | 'cohort') ?? 'evergreen',
              )
              setItalic(course.instructor_name_italic ?? true)
              setBold(course.instructor_name_bold ?? true)
              setUppercase(course.instructor_name_uppercase ?? true)
              setThumbnailPosition(course.thumbnail_object_position ?? null)
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
                paywall_position:
                  enabled && paywallMode === 'module' ? position : null,
                paywall_lesson_id:
                  enabled && paywallMode === 'lesson' ? paywallLessonId : null,
                course_type: courseType,
                instructor_name_italic: italic,
                instructor_name_bold: bold,
                instructor_name_uppercase: uppercase,
                thumbnail_object_position: thumbnailPosition,
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

function StyleToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
      <span className="font-medium text-gray-900">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </label>
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
