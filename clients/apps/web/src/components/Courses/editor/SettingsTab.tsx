'use client'

import { CourseRead, useUploadCourseThumbnail } from '@/hooks/queries/courses'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
import PersonOutline from '@mui/icons-material/PersonOutline'
import { useEffect, useRef, useState } from 'react'
import { ThumbnailPositioner } from './ThumbnailPositioner'

export type CourseSettingsEdits = {
  title?: string | null
  description?: string | null
  instructor_name?: string | null
  instructor_bio?: string | null
  paywall_enabled: boolean
  paywall_position: number | null
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
  const [title, setTitle] = useState(course.title ?? '')
  const [description, setDescription] = useState(course.description ?? '')
  const [instructorName, setInstructorName] = useState(
    course.instructor_name ?? '',
  )
  const [instructorBio, setInstructorBio] = useState(
    course.instructor_bio ?? '',
  )
  const [enabled, setEnabled] = useState(course.paywall_enabled)
  const [position, setPosition] = useState<number | null>(
    course.paywall_position ?? (course.modules.length > 1 ? 1 : null),
  )
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(
    course.thumbnail_url ?? null,
  )
  const [thumbnailPosition, setThumbnailPosition] = useState<string | null>(
    course.thumbnail_object_position ?? null,
  )
  const thumbnailInputRef = useRef<HTMLInputElement>(null)
  const uploadThumbnail = useUploadCourseThumbnail()

  useEffect(() => {
    setTitle(course.title ?? '')
    setDescription(course.description ?? '')
    setInstructorName(course.instructor_name ?? '')
    setInstructorBio(course.instructor_bio ?? '')
    setEnabled(course.paywall_enabled)
    setPosition(course.paywall_position)
    setThumbnailUrl(course.thumbnail_url ?? null)
    setThumbnailPosition(course.thumbnail_object_position ?? null)
  }, [
    course.id,
    course.title,
    course.description,
    course.instructor_name,
    course.instructor_bio,
    course.paywall_enabled,
    course.paywall_position,
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

  const titleTrim = title.trim()
  const titleError = titleTrim.length === 0
  const detailsDirty =
    titleTrim !== (course.title ?? '').trim() ||
    description.trim() !== (course.description ?? '').trim() ||
    instructorName.trim() !== (course.instructor_name ?? '').trim() ||
    instructorBio.trim() !== (course.instructor_bio ?? '').trim()
  const dirty =
    detailsDirty ||
    enabled !== course.paywall_enabled ||
    position !== course.paywall_position ||
    (thumbnailPosition ?? null) !== (course.thumbnail_object_position ?? null)

  const lockedCount =
    enabled && position != null
      ? Math.max(0, course.modules.length - position)
      : 0

  const handleSave = () => {
    if (titleError) return
    onSave({
      title: titleTrim,
      description: description.trim() || null,
      instructor_name: instructorName.trim() || null,
      instructor_bio: instructorBio.trim() || null,
      paywall_enabled: enabled,
      paywall_position: enabled ? position : null,
      thumbnail_object_position: thumbnailPosition,
    })
  }

  const handleReset = () => {
    setTitle(course.title ?? '')
    setDescription(course.description ?? '')
    setInstructorName(course.instructor_name ?? '')
    setInstructorBio(course.instructor_bio ?? '')
    setEnabled(course.paywall_enabled)
    setPosition(course.paywall_position)
    setThumbnailPosition(course.thumbnail_object_position ?? null)
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Course settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          The course title, description, instructor and thumbnail used on the
          landing page, plus paywall and access controls.
        </p>
      </div>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <InfoOutlined sx={{ fontSize: 18 }} />
          </span>
          <div className="flex-1">
            <h2 className="text-base font-bold text-gray-900">Details</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Shown on the course landing and student portal.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-900">
              Course title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={titleError}
              className={
                'mt-2 w-full rounded-xl border px-3.5 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-gray-100 focus:outline-none ' +
                (titleError
                  ? 'border-red-400 focus:border-red-500'
                  : 'border-gray-300 focus:border-gray-900')
              }
              placeholder="e.g. The Art of Persuasive Writing"
            />
            {titleError && (
              <p className="mt-1 text-xs text-red-500">Title is required.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-900">
              Course description
            </label>
            <p className="mt-0.5 text-xs text-gray-500">
              A short paragraph describing what the course covers — shown in
              meta tags and product previews.
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:ring-2 focus:ring-gray-100 focus:outline-none"
              placeholder="What learners walk away with."
            />
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <PersonOutline sx={{ fontSize: 18 }} />
          </span>
          <div className="flex-1">
            <h2 className="text-base font-bold text-gray-900">Instructor</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Used in the hero, instructor section, and pull-quote attribution.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-900">
              Instructor name
            </label>
            <input
              type="text"
              value={instructorName}
              onChange={(e) => setInstructorName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:ring-2 focus:ring-gray-100 focus:outline-none"
              placeholder="e.g. Dr. Lena Marchetti"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-900">
              Instructor bio
            </label>
            <textarea
              value={instructorBio}
              onChange={(e) => setInstructorBio(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:ring-2 focus:ring-gray-100 focus:outline-none"
              placeholder="Short third-person bio."
            />
          </div>
        </div>
      </section>

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
                      <span className="text-xs text-gray-400">{idx + 1}.</span>
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
      </section>

      <div className="sticky bottom-0 z-10 -mx-2 mt-6 flex justify-end gap-2 rounded-2xl border border-gray-200 bg-white/85 px-4 py-3 backdrop-blur">
        <button
          type="button"
          disabled={!dirty || isSaving}
          onClick={handleReset}
          className="rounded-full border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Reset
        </button>
        <button
          type="button"
          disabled={!dirty || isSaving || titleError}
          onClick={handleSave}
          title={titleError ? 'Title is required' : undefined}
          className="rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
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
