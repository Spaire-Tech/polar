'use client'

import {
  CourseRead,
  useUpdateCourse,
  useUploadCourseThumbnail,
} from '@/hooks/queries/courses'
import { toast } from '../../Toast/use-toast'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import { useEffect, useRef, useState } from 'react'
import { ThumbnailPositioner } from './ThumbnailPositioner'

export type CourseSettingsEdits = {
  title?: string | null
  description?: string | null
  instructor_name?: string | null
  instructor_bio?: string | null
  // Paywall lives on the PRICING tab; Settings no longer sends these.
  paywall_enabled?: boolean
  paywall_position?: number | null
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
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(
    course.thumbnail_url ?? null,
  )
  const [thumbnailPosition, setThumbnailPosition] = useState<string | null>(
    course.thumbnail_object_position ?? null,
  )
  const thumbnailInputRef = useRef<HTMLInputElement>(null)
  const uploadThumbnail = useUploadCourseThumbnail()
  const updateCourse = useUpdateCourse()

  const handleRemoveThumbnail = async () => {
    try {
      // Send `thumbnail_url: null` so the server clears the column.
      // CourseUpdate uses exclude_unset so an explicit null persists.
      await updateCourse.mutateAsync({
        courseId: course.id,
        body: { thumbnail_url: null, thumbnail_object_position: null },
      })
      setThumbnailUrl(null)
      setThumbnailPosition(null)
      toast({ title: 'Thumbnail removed' })
    } catch (err) {
      toast({
        title: 'Failed to remove thumbnail',
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  useEffect(() => {
    setTitle(course.title ?? '')
    setDescription(course.description ?? '')
    setInstructorName(course.instructor_name ?? '')
    setInstructorBio(course.instructor_bio ?? '')
    setThumbnailUrl(course.thumbnail_url ?? null)
    setThumbnailPosition(course.thumbnail_object_position ?? null)
  }, [
    course.id,
    course.title,
    course.description,
    course.instructor_name,
    course.instructor_bio,
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
    (thumbnailPosition ?? null) !== (course.thumbnail_object_position ?? null)

  const handleSave = () => {
    if (titleError) return
    onSave({
      title: titleTrim,
      description: description.trim() || null,
      instructor_name: instructorName.trim() || null,
      instructor_bio: instructorBio.trim() || null,
      thumbnail_object_position: thumbnailPosition,
    })
  }

  const handleReset = () => {
    setTitle(course.title ?? '')
    setDescription(course.description ?? '')
    setInstructorName(course.instructor_name ?? '')
    setInstructorBio(course.instructor_bio ?? '')
    setThumbnailPosition(course.thumbnail_object_position ?? null)
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-8">
      <div className="mb-8">
        <h1 className="text-lg font-medium text-gray-900">Course settings</h1>
        <p className="mt-1 text-gray-500">
          The course title, description, instructor and thumbnail used on the
          landing page.
        </p>
      </div>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium text-gray-900">Details</h2>
          <p className="mt-1 text-gray-500">
            Shown on the course landing and student portal.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-900">
              Course title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={titleError}
              className={
                'mt-2 w-full rounded-xl border px-3.5 py-2.5 text-sm text-gray-900 focus:ring-2 focus:outline-none ' +
                (titleError
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                  : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-100')
              }
              placeholder="e.g. The Art of Persuasive Writing"
            />
            {titleError && (
              <p className="mt-1 text-xs text-red-500">Title is required.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900">
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
              className="mt-2 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
              placeholder="What learners walk away with."
            />
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium text-gray-900">Instructor</h2>
          <p className="mt-1 text-gray-500">
            Used in the hero, instructor section, and pull-quote attribution.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-900">
              Instructor name
            </label>
            <input
              type="text"
              value={instructorName}
              onChange={(e) => setInstructorName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
              placeholder="e.g. Dr. Lena Marchetti"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900">
              Instructor bio
            </label>
            <textarea
              value={instructorBio}
              onChange={(e) => setInstructorBio(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
              placeholder="Short third-person bio."
            />
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium text-gray-900">Course thumbnail</h2>
          <p className="mt-1 text-gray-500">
            Shown on the course card and the student portal. JPG or PNG with a
            non-transparent background. Recommended dimensions{' '}
            <span className="font-medium text-gray-700">1280×720</span>.
          </p>
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
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={updateCourse.isPending || uploadThumbnail.isPending}
                onClick={handleRemoveThumbnail}
                className="rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {updateCourse.isPending ? 'Removing…' : 'Remove'}
              </button>
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
