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
  useUpdateCourseLesson,
  useUpdateCourseModule,
  useUploadCourseThumbnail,
  useUploadCourseTrailer,
  useUploadLandingMedia,
  useUploadLessonThumbnail,
  type CourseRead,
} from '@/hooks/queries/courses'
import { useProduct } from '@/hooks/queries/products'
import type { schemas } from '@spaire/client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../../Toast/use-toast'
import {
  GeneratedPortalPage,
  type EditField,
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
  organization,
  onBusyChange,
}: {
  course: CourseRead
  organization?: schemas['Organization']
  /** Reports in-flight saves so the host can show a status indicator. */
  onBusyChange?: (saving: boolean) => void
}) {
  const updateCourse = useUpdateCourse()
  const updateLesson = useUpdateCourseLesson()
  const updateModule = useUpdateCourseModule()
  const uploadThumb = useUploadCourseThumbnail()
  const uploadTrailer = useUploadCourseTrailer()
  const uploadLessonThumb = useUploadLessonThumbnail()
  const uploadLandingMedia = useUploadLandingMedia()
  const { data: product } = useProduct(course.product_id)

  // ── landing_overrides writes — ALL go through one accumulating ref.
  // Each write builds on the latest LOCAL state (not the query-cache
  // snapshot), so two quick edits can't clobber each other while the
  // first PATCH is still in flight. The ref re-syncs from the server
  // whenever the course query refreshes.
  const overridesRef = useRef<NonNullable<CourseRead['landing_overrides']>>(
    course.landing_overrides ?? {},
  )
  useEffect(() => {
    overridesRef.current = course.landing_overrides ?? {}
  }, [course.landing_overrides])
  const writeOverrides = useCallback(
    (
      mutate: (
        cur: NonNullable<CourseRead['landing_overrides']>,
      ) => NonNullable<CourseRead['landing_overrides']>,
    ) => {
      const next = mutate(overridesRef.current)
      overridesRef.current = next
      updateCourse.mutate({
        courseId: course.id,
        body: { landing_overrides: next },
      })
    },
    [course.id, updateCourse],
  )

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
      writeOverrides((cur) => ({
        ...cur,
        theme_mode: next ? 'dark' : 'light',
      }))
      return next
    })
  }, [writeOverrides])

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

  // ── modules, in render order — for moduleTitle edits by groupIdx ──────────
  const sortedModules = useMemo(
    () => [...course.modules].sort((a, b) => a.position - b.position),
    [course.modules],
  )

  // ── touch-to-edit text → persist to the right field ──────────────────────
  const aiHero = course.landing_overrides?.ai_hero ?? null
  const patchAiHero = useCallback(
    (patch: Record<string, unknown>) => {
      writeOverrides((cur) => ({
        ...cur,
        ai_hero: { ...(cur.ai_hero ?? {}), ...patch },
      }))
    },
    [writeOverrides],
  )
  const patchOverrides = useCallback(
    (patch: Partial<NonNullable<CourseRead['landing_overrides']>>) => {
      writeOverrides((cur) => ({ ...cur, ...patch }))
    },
    [writeOverrides],
  )

  // ── instructor portrait (its own media slot, S3-backed) ──────────────────
  const aiInstructor = course.landing_overrides?.ai_instructor ?? null
  const aiFaq = course.landing_overrides?.ai_faq ?? []
  const [portraitBusy, setPortraitBusy] = useState(false)
  const onAddPortrait = useCallback(() => {
    pickFile('image/*', async (file) => {
      setPortraitBusy(true)
      try {
        const { url } = await uploadLandingMedia.mutateAsync({
          courseId: course.id,
          file,
        })
        patchOverrides({ portrait_url: url })
        toast({ title: 'Portrait updated' })
      } catch {
        toast({ title: 'Upload failed', description: 'Please try again.' })
      } finally {
        setPortraitBusy(false)
      }
    })
  }, [course.id, uploadLandingMedia, patchOverrides])

  const onEditText = useCallback(
    (
      field: EditField,
      value: string,
      ctx?: { flatIdx?: number; groupIdx?: number; idx?: number },
    ) => {
      switch (field) {
        case 'title':
          updateCourse.mutate({ courseId: course.id, body: { title: value } })
          break
        case 'instructorName':
          updateCourse.mutate({
            courseId: course.id,
            body: { instructor_name: value },
          })
          break
        case 'desc':
          patchAiHero({ description: value })
          break
        case 'byline':
          patchAiHero({ byline: value })
          break
        case 'eyebrow':
          patchAiHero({ eyebrow: value })
          break
        case 'badge':
          patchAiHero({ badge: value })
          break
        case 'lessonTitle':
        case 'lessonDesc': {
          const lesson =
            ctx?.flatIdx != null ? flatLessons[ctx.flatIdx] : undefined
          if (!lesson) break
          updateLesson.mutate({
            lessonId: lesson.id,
            body:
              field === 'lessonTitle'
                ? { title: value }
                : { description: value },
          })
          break
        }
        case 'moduleTitle': {
          const mod =
            ctx?.groupIdx != null ? sortedModules[ctx.groupIdx] : undefined
          if (!mod) break
          updateModule.mutate({ moduleId: mod.id, body: { title: value } })
          break
        }
        case 'instructorSub':
          writeOverrides((cur) => ({
            ...cur,
            ai_instructor: { ...(cur.ai_instructor ?? {}), sub: value },
          }))
          break
        case 'instructorBioP': {
          if (ctx?.idx == null) break
          const i = ctx.idx
          writeOverrides((cur) => {
            const bio = [...(cur.ai_instructor?.bio ?? [])]
            bio[i] = value
            return {
              ...cur,
              ai_instructor: { ...(cur.ai_instructor ?? {}), bio },
            }
          })
          break
        }
        case 'portraitCaption':
          writeOverrides((cur) => ({
            ...cur,
            ai_instructor: { ...(cur.ai_instructor ?? {}), caption: value },
          }))
          break
        case 'faqQ':
        case 'faqA': {
          if (ctx?.idx == null) break
          const i = ctx.idx
          const key = field === 'faqQ' ? 'q' : 'a'
          writeOverrides((cur) => ({
            ...cur,
            ai_faq: (cur.ai_faq ?? []).map((f, j) =>
              j === i ? { ...f, [key]: value } : f,
            ),
          }))
          break
        }
      }
    },
    [
      course.id,
      flatLessons,
      sortedModules,
      patchAiHero,
      writeOverrides,
      updateCourse,
      updateLesson,
      updateModule,
    ],
  )

  // ── hero copy (the AI-written hero, falling back to course fields) ────────
  const [sampleOpen, setSampleOpen] = useState(false)
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

  // Report in-flight saves to the host bar.
  const busy =
    updateCourse.isPending ||
    updateLesson.isPending ||
    updateModule.isPending ||
    uploadThumb.isPending ||
    uploadTrailer.isPending ||
    uploadLessonThumb.isPending ||
    uploadLandingMedia.isPending ||
    coverBusy ||
    trailerBusy ||
    portraitBusy ||
    lessonImageBusy != null
  useEffect(() => {
    onBusyChange?.(busy)
  }, [busy, onBusyChange])

  const saveSample = useCallback(
    (next: {
      enabled: boolean
      lesson_id: string
      start_seconds: number
      duration_seconds: number
    }) => {
      updateCourse.mutate({ courseId: course.id, body: { sample: next } })
      setSampleOpen(false)
      toast({ title: next.enabled ? 'Sample saved' : 'Sample disabled' })
    },
    [course.id, updateCourse],
  )

  return (
    <>
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
      samplePlaybackId={sampleLesson?.mux_playback_id ?? null}
      sampleStart={sample?.start_seconds ?? 0}
      sampleDuration={sample?.duration_seconds ?? 0}
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
      onConfigureSample={() => setSampleOpen(true)}
      onEditText={onEditText}
      avatarUrl={organization?.avatar_url ?? null}
      instructorSub={aiInstructor?.sub ?? ''}
      instructorBio={aiInstructor?.bio ?? []}
      portraitUrl={course.landing_overrides?.portrait_url ?? null}
      portraitCaption={aiInstructor?.caption ?? ''}
      onAddPortrait={onAddPortrait}
      portraitBusy={portraitBusy}
      faq={aiFaq}
    />
      {sampleOpen && (
        <SampleSettingsModal
          course={course}
          lessons={flatLessons}
          onClose={() => setSampleOpen(false)}
          onSave={saveSample}
        />
      )}
    </>
  )
}

// Minimal sample configuration — pick the source lesson and the clip window.
// Persists to course.sample; the backend embeds the Mux playback id on the
// public payload once the lesson's asset is ready.
export function SampleSettingsModal({
  course,
  lessons,
  onClose,
  onSave,
}: {
  course: CourseRead
  lessons: CourseRead['modules'][number]['lessons']
  onClose: () => void
  onSave: (next: {
    enabled: boolean
    lesson_id: string
    start_seconds: number
    duration_seconds: number
  }) => void
}) {
  const existing = course.sample
  const videoLessons = lessons.filter((l) => l.content_type === 'video')
  const [lessonId, setLessonId] = useState(
    existing?.lesson_id ?? videoLessons[0]?.id ?? '',
  )
  const [startStr, setStartStr] = useState(String(existing?.start_seconds ?? 0))
  const [durStr, setDurStr] = useState(
    String(existing?.duration_seconds ?? 120),
  )
  const [enabled, setEnabled] = useState(existing?.enabled ?? true)

  const selected = lessons.find((l) => l.id === lessonId)
  const ready = (selected?.mux_status ?? '').toLowerCase() === 'ready'

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(20,20,22,0.34)',
        backdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(460px, 100%)',
          background: '#fff',
          borderRadius: 20,
          padding: '24px 24px 20px',
          boxShadow: '0 40px 100px -28px rgba(0,0,0,0.5)',
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
          color: '#1d1d1f',
        }}
      >
        <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0 }}>
          Free sample
        </h2>
        <p style={{ fontSize: 13.5, color: '#86868b', margin: '6px 0 18px' }}>
          Pick a video lesson and the clip window prospects can watch for free.
        </p>

        <label style={labelStyle}>Source lesson</label>
        <select
          value={lessonId}
          onChange={(e) => setLessonId(e.target.value)}
          style={inputStyle}
        >
          {videoLessons.length === 0 && (
            <option value="">No video lessons yet</option>
          )}
          {videoLessons.map((l, i) => (
            <option key={l.id} value={l.id}>
              {i + 1}. {l.title}
            </option>
          ))}
        </select>
        {lessonId && !ready && (
          <p style={{ fontSize: 12, color: '#c2410c', marginTop: 6 }}>
            This lesson's video isn't processed yet — the sample will start
            playing once it's ready.
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Start (seconds)</label>
            <input
              type="number"
              min={0}
              value={startStr}
              onChange={(e) => setStartStr(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Length (seconds)</label>
            <input
              type="number"
              min={5}
              value={durStr}
              onChange={(e) => setDurStr(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            marginTop: 16,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Show the free sample on the course page
        </label>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 22,
          }}
        >
          <button type="button" onClick={onClose} style={btnGhost}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!lessonId}
            onClick={() =>
              onSave({
                enabled,
                lesson_id: lessonId,
                start_seconds: Math.max(0, parseInt(startStr || '0', 10) || 0),
                duration_seconds: Math.max(
                  5,
                  parseInt(durStr || '120', 10) || 120,
                ),
              })
            }
            style={{ ...btnPrimary, opacity: lessonId ? 1 : 0.4 }}
          >
            Save sample
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: '#86868b',
  marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 40,
  padding: '0 12px',
  borderRadius: 10,
  border: '1.5px solid #e8e8ed',
  fontSize: 14,
  background: '#fff',
  color: '#1d1d1f',
}
const btnGhost: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 980,
  background: 'none',
  boxShadow: 'inset 0 0 0 1px #e8e8ed',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
}
const btnPrimary: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 980,
  background: '#1d1d1f',
  color: '#fff',
  border: 'none',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}

export default CourseDesignEditor
