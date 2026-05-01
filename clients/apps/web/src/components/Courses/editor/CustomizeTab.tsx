'use client'

// Dashboard customize tab: hosts the EditorShell + EditableCourseLandingView,
// wires uploads (hero → course.thumbnail_url, trailer → course.trailer_url,
// everything else → POST /v1/courses/{id}/landing-media), and persists the
// override blob into course.landing_overrides on Save / Publish.

import {
  CourseRead,
  LandingMedia,
  useUpdateCourse,
  useUploadCourseThumbnail,
  useUploadCourseTrailer,
  useUploadLandingMedia,
} from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../../Toast/use-toast'
import { EditableCourseLandingView } from './EditableCourseLandingView'
import {
  EditorProvider,
  mergeOverrides,
  type ResolvedOverrides,
} from './EditorContext'
import { EditorShell } from './EditorShell'

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

  // Seed overrides from course; preload hero/trailer so the canvas shows them.
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
  }, [course.id, course.landing_overrides, course.thumbnail_url, course.trailer_url])

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

  // Hero upload writes to course.thumbnail_url so onboarding & customize stay in sync.
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

  const uploaderForSlot = (slotId: string) => {
    if (slotId === 'hero.backdrop') return heroUpload
    if (slotId === 'trailer.video') return trailerUpload
    return slotUpload
  }

  const handleSave = async () => {
    try {
      // Strip the auto-seeded hero/trailer media from what we persist into
      // landing_overrides so they live solely on the course columns.
      const persistedMedia = { ...overridesRef.current.media }
      delete persistedMedia['hero.backdrop']
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
      <EditorShell
        breadcrumb={{ course: course.title ?? 'Untitled course' }}
        organizationSlug={organization.slug}
        onSave={handleSave}
        onPublish={handleSave}
        saving={updateCourse.isPending}
        dirty={dirty}
      >
        <EditableCourseLandingView
          course={course}
          organizationName={organization.name}
          flatLessons={flatLessons}
        />
      </EditorShell>
    </EditorProvider>
  )
}
