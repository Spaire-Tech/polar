'use client'

// Dashboard customize tab. The customize page opens fully — there's no left
// rail and no right inspector — so all edits happen directly on the canvas.
// Save/Publish lives in a slim top bar; the EditorProvider still tracks state.

import {
  CourseRead,
  LandingMedia,
  useUpdateCourse,
  useUploadCourseThumbnail,
  useUploadCourseTrailer,
  useUploadLandingMedia,
} from '@/hooks/queries/courses'
import { useProduct } from '@/hooks/queries/products'
import { schemas } from '@spaire/client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../../Toast/use-toast'
import { EditableCourseLandingView } from './EditableCourseLandingView'
import {
  EditorProvider,
  mergeOverrides,
  type ResolvedOverrides,
} from './EditorContext'

export function CustomizeTab({
  course,
  organization,
}: {
  course: CourseRead
  organization: schemas['Organization']
}) {
  const updateCourse = useUpdateCourse()
  const uploadThumb = useUploadCourseThumbnail()
  const uploadTrailer = useUploadCourseTrailer()
  const uploadMediaSlot = useUploadLandingMedia()
  const { data: product } = useProduct(course.product_id)

  const initial = useMemo(() => {
    const merged = mergeOverrides(course.landing_overrides ?? null)
    if (course.thumbnail_url && !merged.media['hero.backdrop']) {
      merged.media['hero.backdrop'] = {
        kind: 'image',
        url: course.thumbnail_url,
      }
    }
    if (course.trailer_url && !merged.media['trailer.video']) {
      merged.media['trailer.video'] = {
        kind: 'video',
        url: course.trailer_url,
      }
    }
    return merged
  }, [
    course.id,
    course.landing_overrides,
    course.thumbnail_url,
    course.trailer_url,
  ])

  const [overrides, setOverrides] = useState(initial)
  const [dirty, setDirty] = useState(false)
  const overridesRef = useRef(overrides)

  useEffect(() => {
    setOverrides(initial)
    overridesRef.current = initial
    setDirty(false)
  }, [initial])

  const handleChange = (next: ResolvedOverrides) => {
    setOverrides(next)
    overridesRef.current = next
    setDirty(true)
  }

  const heroUpload = async (file: File): Promise<LandingMedia> => {
    const updated = await uploadThumb.mutateAsync({ courseId: course.id, file })
    return { kind: 'image', url: updated.thumbnail_url ?? '', name: file.name }
  }

  const trailerUpload = async (file: File): Promise<LandingMedia> => {
    const updated = await uploadTrailer.mutateAsync({
      courseId: course.id,
      file,
    })
    return { kind: 'video', url: updated.trailer_url ?? '', name: file.name }
  }

  const slotUpload = async (file: File): Promise<LandingMedia> => {
    const res = await uploadMediaSlot.mutateAsync({ courseId: course.id, file })
    return { kind: res.kind, url: res.url, name: file.name }
  }

  // The hero has two separate slots — image (cover) and trailer (peek). Route
  // each to the right course column so the Netflix-style hero plays the
  // trailer for ~10s and then settles on the cover image.
  const heroImageUpload = async (file: File): Promise<LandingMedia> => {
    if (file.type.startsWith('video/')) return trailerUpload(file)
    return heroUpload(file)
  }
  const heroTrailerUpload = async (file: File): Promise<LandingMedia> => {
    if (file.type.startsWith('image/')) return heroUpload(file)
    return trailerUpload(file)
  }

  const uploaderForSlot = (slotId: string) => {
    if (slotId === 'hero.backdrop') return heroImageUpload
    if (slotId === 'hero.trailer') return heroTrailerUpload
    if (slotId === 'trailer.video') return trailerUpload
    return slotUpload
  }

  const handleSave = async () => {
    try {
      const persistedMedia = { ...overridesRef.current.media }
      // hero image / trailer are mirrored onto course columns, so don't
      // double-store them in landing_overrides.
      delete persistedMedia['hero.backdrop']
      delete persistedMedia['hero.trailer']
      delete persistedMedia['trailer.video']
      await updateCourse.mutateAsync({
        courseId: course.id,
        body: {
          landing_overrides: {
            ...overridesRef.current,
            media: persistedMedia,
          },
        },
      })
      setDirty(false)
      toast({ title: 'Landing saved' })
    } catch {
      toast({ title: 'Failed to save' })
    }
  }

  const flatLessons = useMemo(
    () => course.modules.flatMap((m) => m.lessons),
    [course.modules],
  )

  const saving = updateCourse.isPending

  return (
    <EditorProvider
      initialOverrides={overrides}
      onChange={handleChange}
      uploadMedia={slotUpload}
      uploaderForSlot={uploaderForSlot}
      isUploading={
        uploadThumb.isPending ||
        uploadTrailer.isPending ||
        uploadMediaSlot.isPending
      }
    >
      <div className="flex h-full flex-col bg-white">
        <CustomizeBar
          courseTitle={course.title ?? 'Untitled course'}
          previewHref={`/${organization.slug}/products/${course.product_id}`}
          dirty={dirty}
          saving={saving}
          onSave={handleSave}
        />
        <div className="flex-1 overflow-y-auto">
          <EditableCourseLandingView
            course={course}
            organizationName={organization.name}
            organizationSlug={organization.slug}
            flatLessons={flatLessons}
            product={product}
          />
        </div>
      </div>
    </EditorProvider>
  )
}

// Slim top bar — the only chrome in the customize page. No left rail, no
// right inspector; every change happens inline on the canvas.
function CustomizeBar({
  courseTitle,
  previewHref,
  dirty,
  saving,
  onSave,
}: {
  courseTitle: string
  previewHref: string
  dirty: boolean
  saving: boolean
  onSave: () => void
}) {
  return (
    <div className="flex h-12 flex-shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-[12px] text-gray-500">Course landing</span>
        <span className="text-[13px] text-gray-400">›</span>
        <span className="truncate text-[13px] font-medium text-gray-900">
          {courseTitle}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11.5px] text-gray-400">
          {dirty ? 'Unsaved changes' : saving ? '' : 'All changes saved'}
        </span>
        <a
          href={previewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-gray-200 bg-white px-3 py-[6px] text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Preview ↗
        </a>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !dirty}
          className="rounded-md bg-gray-900 px-3.5 py-[7px] text-[12px] font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save & publish'}
        </button>
      </div>
    </div>
  )
}
