'use client'

// CourseDesignEditor — the dashboard Customize canvas. Renders the SAME
// GeneratedPortalPage the public sees, in editable mode, and wires the
// design's creator affordances to the existing (S3/Mux-backed) endpoints:
//
//   Add / Change cover   → POST /courses/{id}/thumbnail  (S3)
//   ⤧ Reposition         → drag the cover; debounced PATCH of
//                          thumbnail_object_position
//   Add / Change trailer → POST /courses/{id}/trailer    (S3)
//   hover-trailer peek   → plays muted while hovering, snaps back on
//                          scroll/leave (the original HeroMedia behavior)
//   per-lesson stills    → POST lesson thumbnail (S3)
//   Set up sample        → jumps to the existing sample settings (Outline
//                          tab) until its dedicated sheet lands here
//   theme toggle         → persists landing_overrides.theme_mode
//
// The creator edits the real page, not a parallel mock — what they see is
// what buyers get.

import {
  useUpdateCourse,
  useUploadCourseThumbnail,
  useUploadCourseTrailer,
  useUploadLessonThumbnail,
  type CourseRead,
} from '@/hooks/queries/courses'
import { useProduct } from '@/hooks/queries/products'
import type { schemas } from '@spaire/client'
import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from '../../Toast/use-toast'
import {
  GeneratedPortalPage,
  type GeneratedGroup,
} from './GeneratedPortalPage'

function pickFile(accept: string, cb: (file: File) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.onchange = () => {
    const f = input.files && input.files[0]
    if (f) cb(f)
  }
  input.click()
}

function formatPrice(product: schemas['Product'] | undefined): {
  priceLabel: string
  recurring: boolean
} {
  if (!product) return { priceLabel: '—', recurring: false }
  const prices = (product.prices ?? []) as Array<{
    amount_type?: string
    price_amount?: number | null
    price_currency?: string
    type?: string
  }>
  const first = prices[0]
  if (!first || first.amount_type === 'free')
    return { priceLabel: 'Free', recurring: false }
  const cents = first.price_amount ?? 0
  let label: string
  try {
    label = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (first.price_currency ?? 'usd').toUpperCase(),
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100)
  } catch {
    label = `$${(cents / 100).toFixed(0)}`
  }
  return { priceLabel: label, recurring: first.type === 'recurring' }
}

export function CourseDesignEditor({
  course,
  onOpenSampleSettings,
}: {
  course: CourseRead
  onOpenSampleSettings?: () => void
}) {
  const updateCourse = useUpdateCourse()
  const uploadThumb = useUploadCourseThumbnail()
  const uploadTrailer = useUploadCourseTrailer()
  const uploadLessonThumb = useUploadLessonThumbnail()
  const { data: product } = useProduct(course.product_id)

  const isEpisodic = course.format === 'series'
  const unit = isEpisodic ? 'episode' : 'lesson'
  const unitCap = isEpisodic ? 'Episode' : 'Lesson'
  const trialMode = course.trial_mode ?? 'free_preview'

  // ── theme (persisted on the course) ──────────────────────────────────────
  const persistedDark = course.landing_overrides?.theme_mode === 'dark'
  const [dark, setDark] = useState(persistedDark)
  const toggleDark = useCallback(() => {
    setDark((d) => {
      const next = !d
      updateCourse.mutate({
        courseId: course.id,
        body: {
          landing_overrides: {
            ...(course.landing_overrides ?? {}),
            theme_mode: next ? 'dark' : 'light',
          },
        },
      })
      return next
    })
  }, [course.id, course.landing_overrides, updateCourse])

  // ── cover ─────────────────────────────────────────────────────────────────
  const [coverBusy, setCoverBusy] = useState(false)
  const onAddCover = useCallback(() => {
    pickFile('image/*', async (file) => {
      setCoverBusy(true)
      try {
        await uploadThumb.mutateAsync({ courseId: course.id, file })
        toast({ title: 'Cover updated' })
      } catch {
        toast({ title: 'Upload failed', description: 'Please try again.' })
      } finally {
        setCoverBusy(false)
      }
    })
  }, [course.id, uploadThumb])

  // ── reposition (debounced commit, same pattern the old canvas used) ──────
  const repositionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onCoverPosition = useCallback(
    (pos: string) => {
      if (repositionTimer.current) clearTimeout(repositionTimer.current)
      repositionTimer.current = setTimeout(() => {
        updateCourse.mutate({
          courseId: course.id,
          body: { thumbnail_object_position: pos },
        })
      }, 600)
    },
    [course.id, updateCourse],
  )

  // ── trailer ───────────────────────────────────────────────────────────────
  const [trailerBusy, setTrailerBusy] = useState(false)
  const onAddTrailer = useCallback(() => {
    pickFile('video/*', async (file) => {
      setTrailerBusy(true)
      try {
        await uploadTrailer.mutateAsync({ courseId: course.id, file })
        toast({ title: 'Trailer updated' })
      } catch {
        toast({ title: 'Upload failed', description: 'Please try again.' })
      } finally {
        setTrailerBusy(false)
      }
    })
  }, [course.id, uploadTrailer])

  // ── lessons → render groups; per-lesson stills ────────────────────────────
  const flatLessons = useMemo(
    () =>
      [...course.modules]
        .sort((a, b) => a.position - b.position)
        .flatMap((m) => [...m.lessons].sort((a, b) => a.position - b.position)),
    [course.modules],
  )

  const paywallEnabled = course.paywall_enabled
  const freeCount =
    trialMode === 'free_preview'
      ? Math.max(0, course.paywall_position ?? 0)
      : 0
  const isLocked = (flatIdx: number) => {
    if (!paywallEnabled) return false
    if (trialMode === 'lesson_sample') return true
    return flatIdx >= freeCount
  }

  const fmtDur = (secs: number | null) =>
    secs ? `${Math.max(1, Math.round(secs / 60))}m` : null

  const groups: GeneratedGroup[] = useMemo(() => {
    let flat = 0
    if (isEpisodic) {
      return [
        {
          title: null,
          lessons: flatLessons.map((l) => {
            const flatIdx = flat++
            return {
              title: l.title,
              description: l.description ?? '',
              flatIdx,
              imageUrl: l.thumbnail_url ?? null,
              durationLabel: fmtDur(l.duration_seconds),
              free: !isLocked(flatIdx),
              locked: isLocked(flatIdx),
            }
          }),
        },
      ]
    }
    return [...course.modules]
      .sort((a, b) => a.position - b.position)
      .map((m) => ({
        title: m.title,
        lessons: [...m.lessons]
          .sort((a, b) => a.position - b.position)
          .map((l) => {
            const flatIdx = flat++
            return {
              title: l.title,
              description: l.description ?? '',
              flatIdx,
              imageUrl: l.thumbnail_url ?? null,
              durationLabel: fmtDur(l.duration_seconds),
              free: !isLocked(flatIdx),
              locked: isLocked(flatIdx),
            }
          }),
      }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.modules, isEpisodic, paywallEnabled, trialMode, freeCount])

  const [lessonImageBusy, setLessonImageBusy] = useState<number | null>(null)
  const onAddLessonImage = useCallback(
    (flatIdx: number) => {
      const lesson = flatLessons[flatIdx]
      if (!lesson) return
      pickFile('image/*', async (file) => {
        setLessonImageBusy(flatIdx)
        try {
          await uploadLessonThumb.mutateAsync({ lessonId: lesson.id, file })
          toast({ title: `${unitCap} image updated` })
        } catch {
          toast({ title: 'Upload failed', description: 'Please try again.' })
        } finally {
          setLessonImageBusy(null)
        }
      })
    },
    [flatLessons, uploadLessonThumb, unitCap],
  )

  // ── hero copy (the AI-written hero, falling back to course fields) ────────
  const aiHero = course.landing_overrides?.ai_hero ?? null
  const { priceLabel, recurring } = formatPrice(product)
  const cadence = recurring ? 'cancel anytime' : 'one-time purchase'
  const buyLabel = !paywallEnabled
    ? 'Enroll Free'
    : recurring
      ? `Subscribe — ${priceLabel}`
      : `Buy — ${priceLabel}`
  const playLabel = !paywallEnabled
    ? 'Start Watching'
    : trialMode === 'lesson_sample'
      ? 'Play Sample'
      : freeCount > 0
        ? `Play ${unitCap} 1 Free`
        : 'Watch Preview'
  const freeLine = !paywallEnabled
    ? 'Free for everyone'
    : trialMode === 'lesson_sample'
      ? `Sample clip free · ${cadence}`
      : freeCount > 0
        ? `${freeCount} ${unit}${freeCount === 1 ? '' : 's'} free · ${cadence}`
        : cadence

  const sample = course.sample
  const sampleLesson = sample?.lesson_id
    ? flatLessons.find((l) => l.id === sample.lesson_id)
    : null
  const samplePlayable = Boolean(
    sample?.enabled && sampleLesson?.mux_playback_id,
  )

  return (
    <GeneratedPortalPage
      brand="Spaire Originals"
      title={course.title ?? 'Untitled Original'}
      titleLines={aiHero?.titleLines ?? null}
      eyebrow={aiHero?.eyebrow || 'A Spaire Original'}
      badge={aiHero?.badge || (isEpisodic ? 'New Series' : 'New Course')}
      desc={aiHero?.description || course.description || ''}
      byline={aiHero?.byline || course.instructor_bio || ''}
      instructorName={course.instructor_name ?? ''}
      heroVariant={course.hero_variant ?? 'cover'}
      cardVariant={course.lesson_card_variant ?? 'catalog'}
      structure={isEpisodic ? 'episodic' : 'modules'}
      trialMode={trialMode}
      paywallEnabled={paywallEnabled}
      freeLessons={freeCount}
      playLabel={playLabel}
      buyLabel={buyLabel}
      freeLine={freeLine}
      coverUrl={course.thumbnail_url}
      coverPosition={course.thumbnail_object_position}
      sampleImageUrl={sampleLesson?.thumbnail_url ?? null}
      samplePlayable={samplePlayable}
      groups={groups}
      lessonCount={flatLessons.length}
      unit={unit}
      dark={dark}
      onToggleDark={toggleDark}
      editable
      trailerUrl={course.trailer_url}
      onAddCover={onAddCover}
      coverBusy={coverBusy}
      onAddTrailer={onAddTrailer}
      trailerBusy={trailerBusy}
      onCoverPosition={onCoverPosition}
      onAddLessonImage={onAddLessonImage}
      lessonImageBusy={lessonImageBusy}
      onConfigureSample={onOpenSampleSettings}
    />
  )
}

export default CourseDesignEditor
