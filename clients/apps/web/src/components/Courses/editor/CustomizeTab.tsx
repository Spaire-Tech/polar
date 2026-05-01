'use client'

import { CourseLandingView } from '@/app/(main)/[organization]/portal/courses/[courseId]/CourseLandingView'
import type { FlatLesson } from '@/app/(main)/[organization]/portal/courses/[courseId]/MasterClassLessonList'
import {
  CourseRead,
  useUpdateCourse,
  useUploadCourseTrailer,
} from '@/hooks/queries/courses'
import {
  joinLanding,
  splitLanding,
  type StoredLanding,
} from '../landingStorage'
import { schemas } from '@spaire/client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../../Toast/use-toast'

type Section =
  | 'hero'
  | 'value'
  | 'curriculum'
  | 'lessons'
  | 'instructor'
  | 'reviews'
  | 'final'
  | 'trailer'

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'hero', label: 'Hero' },
  { id: 'trailer', label: 'Trailer' },
  { id: 'value', label: "What's included" },
  { id: 'curriculum', label: 'Curriculum' },
  { id: 'lessons', label: 'Lesson list' },
  { id: 'instructor', label: 'Instructor' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'final', label: 'Final CTA' },
]

const DEFAULT_LANDING: StoredLanding = {
  eyebrow: 'SPAIRE ORIGINAL',
  series_label: 'NEW SERIES',
  tagline: '',
  description: '',
  level: 'All levels',
  value_props_label: "WHAT'S INCLUDED",
  value_props: [],
  curriculum_label: 'CURRICULUM',
  curriculum_heading: '',
  curriculum_subheading: '',
  lessons_label: 'EVERY LESSON',
  lessons_heading: '',
  lessons_subheading: '',
  instructor_label: 'YOUR INSTRUCTOR',
  instructor_pull_quote: '',
  instructor_credentials: [],
  reviews_label: 'FROM STUDENTS',
  reviews: [],
  final_cta_label: 'READY?',
  final_cta_title: '',
  final_cta_subtitle: '',
  final_cta_primary: 'Enroll',
  final_cta_secondary: 'Watch trailer',
}

export function CustomizeTab({
  course,
  organization,
}: {
  course: CourseRead
  organization: schemas['Organization']
}) {
  const updateCourse = useUpdateCourse()
  const uploadTrailer = useUploadCourseTrailer()
  const trailerInputRef = useRef<HTMLInputElement>(null)

  const initial = useMemo(() => {
    const { humanDescription, landing } = splitLanding(course.description)
    return {
      title: course.title ?? '',
      description: humanDescription ?? '',
      instructorName: course.instructor_name ?? '',
      instructorBio: course.instructor_bio ?? '',
      trailerUrl: course.trailer_url ?? '',
      landing: { ...DEFAULT_LANDING, ...(landing ?? {}) } as StoredLanding,
    }
  }, [course.id])

  const [draft, setDraft] = useState(initial)
  const [activeSection, setActiveSection] = useState<Section>('hero')

  useEffect(() => {
    setDraft(initial)
  }, [initial])

  const isDirty = useMemo(() => {
    return (
      draft.title !== initial.title ||
      draft.description !== initial.description ||
      draft.instructorName !== initial.instructorName ||
      draft.instructorBio !== initial.instructorBio ||
      draft.trailerUrl !== initial.trailerUrl ||
      JSON.stringify(draft.landing) !== JSON.stringify(initial.landing)
    )
  }, [draft, initial])

  const flatLessons: FlatLesson[] = useMemo(() => {
    let pos = 0
    return course.modules.flatMap((m) =>
      m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description ?? null,
        position: pos++,
        duration_seconds: l.duration_seconds ?? 0,
        thumbnail_url: l.thumbnail_url ?? null,
        thumbnail_object_position: l.thumbnail_object_position ?? null,
        mux_playback_id: l.mux_playback_id ?? null,
        mux_status: l.mux_status ?? null,
        completed: false,
        is_free_preview: l.is_free_preview ?? false,
        content_type: l.content_type,
        content: l.content ?? null,
      })),
    )
  }, [course.modules])

  const handleTrailerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const updated = await uploadTrailer.mutateAsync({
        courseId: course.id,
        file,
      })
      setDraft((d) => ({ ...d, trailerUrl: updated.trailer_url ?? '' }))
      toast({ title: 'Trailer uploaded' })
    } catch {
      toast({ title: 'Failed to upload trailer' })
    }
    e.target.value = ''
  }

  const handleSave = async () => {
    try {
      await updateCourse.mutateAsync({
        courseId: course.id,
        body: {
          title: draft.title,
          description: joinLanding(draft.description, draft.landing),
          instructor_name: draft.instructorName || null,
          instructor_bio: draft.instructorBio || null,
          trailer_url: draft.trailerUrl || null,
        },
      })
      toast({ title: 'Landing page saved' })
    } catch {
      toast({ title: 'Failed to save' })
    }
  }

  const setLandingField = <K extends keyof StoredLanding>(
    key: K,
    value: StoredLanding[K],
  ) => setDraft((d) => ({ ...d, landing: { ...d.landing, [key]: value } }))

  return (
    <div className="grid h-full grid-cols-[360px_1fr] overflow-hidden bg-gray-50">
      {/* Editor panel */}
      <aside className="flex flex-col overflow-hidden border-r border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="text-[13px] font-semibold tracking-tight text-gray-900">
            Customize landing
          </div>
          <button
            onClick={handleSave}
            disabled={!isDirty || updateCourse.isPending}
            className="rounded-full bg-blue-600 px-3 py-[5px] text-xs font-medium tracking-tight text-white transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {updateCourse.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>

        {/* Section picker */}
        <div className="flex flex-shrink-0 flex-wrap gap-1 border-b border-gray-200 bg-gray-50 p-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`rounded-md px-2 py-1 text-[11.5px] font-medium tracking-tight transition-colors ${
                activeSection === s.id
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {activeSection === 'hero' && (
            <Form>
              <Field label="Course title">
                <Input
                  value={draft.title}
                  onChange={(v) => setDraft((d) => ({ ...d, title: v }))}
                />
              </Field>
              <Field label="Eyebrow (top-left tag)">
                <Input
                  value={draft.landing.eyebrow ?? ''}
                  onChange={(v) => setLandingField('eyebrow', v)}
                />
              </Field>
              <Field label="Series pill">
                <Input
                  value={draft.landing.series_label ?? ''}
                  onChange={(v) => setLandingField('series_label', v)}
                />
              </Field>
              <Field label="Tagline">
                <Textarea
                  rows={2}
                  value={draft.landing.tagline ?? ''}
                  onChange={(v) => setLandingField('tagline', v)}
                />
              </Field>
              <Field label="Description (above the fold)">
                <Textarea
                  rows={3}
                  value={draft.description}
                  onChange={(v) => setDraft((d) => ({ ...d, description: v }))}
                />
              </Field>
              <Field label="Level">
                <Input
                  value={draft.landing.level ?? ''}
                  onChange={(v) => setLandingField('level', v)}
                />
              </Field>
            </Form>
          )}

          {activeSection === 'trailer' && (
            <Form>
              <Field label="Trailer URL">
                <Input
                  value={draft.trailerUrl}
                  onChange={(v) => setDraft((d) => ({ ...d, trailerUrl: v }))}
                  placeholder="https://…"
                />
              </Field>
              <input
                ref={trailerInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleTrailerFile}
              />
              <button
                type="button"
                onClick={() => trailerInputRef.current?.click()}
                disabled={uploadTrailer.isPending}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-3 text-[12px] font-medium tracking-tight text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50"
              >
                {uploadTrailer.isPending
                  ? 'Uploading…'
                  : draft.trailerUrl
                    ? 'Replace trailer file'
                    : 'Upload trailer file (MP4, max 500 MB)'}
              </button>
              {draft.trailerUrl && (
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, trailerUrl: '' }))}
                  className="text-left text-[12px] tracking-tight text-red-500 hover:text-red-600"
                >
                  Remove trailer
                </button>
              )}
            </Form>
          )}

          {activeSection === 'value' && (
            <Form>
              <Field label="Section label">
                <Input
                  value={draft.landing.value_props_label ?? ''}
                  onChange={(v) => setLandingField('value_props_label', v)}
                />
              </Field>
              <ListEditor
                label="Value props"
                items={draft.landing.value_props ?? []}
                empty={{ title: '', description: '' }}
                onChange={(items) => setLandingField('value_props', items)}
                renderItem={(item, set) => (
                  <>
                    <Input
                      value={item.title}
                      placeholder="Title"
                      onChange={(v) => set({ ...item, title: v })}
                    />
                    <Textarea
                      rows={2}
                      value={item.description}
                      placeholder="Description"
                      onChange={(v) => set({ ...item, description: v })}
                    />
                  </>
                )}
              />
            </Form>
          )}

          {activeSection === 'curriculum' && (
            <Form>
              <Field label="Section label">
                <Input
                  value={draft.landing.curriculum_label ?? ''}
                  onChange={(v) => setLandingField('curriculum_label', v)}
                />
              </Field>
              <Field label="Heading">
                <Input
                  value={draft.landing.curriculum_heading ?? ''}
                  onChange={(v) => setLandingField('curriculum_heading', v)}
                />
              </Field>
              <Field label="Subheading">
                <Textarea
                  rows={3}
                  value={draft.landing.curriculum_subheading ?? ''}
                  onChange={(v) => setLandingField('curriculum_subheading', v)}
                />
              </Field>
            </Form>
          )}

          {activeSection === 'lessons' && (
            <Form>
              <Field label="Section label">
                <Input
                  value={draft.landing.lessons_label ?? ''}
                  onChange={(v) => setLandingField('lessons_label', v)}
                />
              </Field>
              <Field label="Heading">
                <Input
                  value={draft.landing.lessons_heading ?? ''}
                  onChange={(v) => setLandingField('lessons_heading', v)}
                />
              </Field>
              <Field label="Subheading">
                <Textarea
                  rows={3}
                  value={draft.landing.lessons_subheading ?? ''}
                  onChange={(v) => setLandingField('lessons_subheading', v)}
                />
              </Field>
            </Form>
          )}

          {activeSection === 'instructor' && (
            <Form>
              <Field label="Section label">
                <Input
                  value={draft.landing.instructor_label ?? ''}
                  onChange={(v) => setLandingField('instructor_label', v)}
                />
              </Field>
              <Field label="Instructor name">
                <Input
                  value={draft.instructorName}
                  onChange={(v) =>
                    setDraft((d) => ({ ...d, instructorName: v }))
                  }
                />
              </Field>
              <Field label="Pull quote">
                <Textarea
                  rows={3}
                  value={draft.landing.instructor_pull_quote ?? ''}
                  onChange={(v) => setLandingField('instructor_pull_quote', v)}
                />
              </Field>
              <Field label="Bio">
                <Textarea
                  rows={4}
                  value={draft.instructorBio}
                  onChange={(v) =>
                    setDraft((d) => ({ ...d, instructorBio: v }))
                  }
                />
              </Field>
              <ListEditor
                label="Credentials"
                items={draft.landing.instructor_credentials ?? []}
                empty={{ number: '', label: '' }}
                onChange={(items) =>
                  setLandingField('instructor_credentials', items)
                }
                renderItem={(item, set) => (
                  <div className="grid grid-cols-[80px_1fr] gap-2">
                    <Input
                      value={item.number}
                      placeholder="3"
                      onChange={(v) => set({ ...item, number: v })}
                    />
                    <Input
                      value={item.label}
                      placeholder="Published novels"
                      onChange={(v) => set({ ...item, label: v })}
                    />
                  </div>
                )}
              />
            </Form>
          )}

          {activeSection === 'reviews' && (
            <Form>
              <Field label="Section label">
                <Input
                  value={draft.landing.reviews_label ?? ''}
                  onChange={(v) => setLandingField('reviews_label', v)}
                />
              </Field>
              <ListEditor
                label="Reviews"
                items={draft.landing.reviews ?? []}
                empty={{ name: '', role: '', text: '' }}
                onChange={(items) => setLandingField('reviews', items)}
                renderItem={(item, set) => (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={item.name}
                        placeholder="Name"
                        onChange={(v) => set({ ...item, name: v })}
                      />
                      <Input
                        value={item.role}
                        placeholder="Role"
                        onChange={(v) => set({ ...item, role: v })}
                      />
                    </div>
                    <Textarea
                      rows={3}
                      value={item.text}
                      placeholder="Quote"
                      onChange={(v) => set({ ...item, text: v })}
                    />
                  </>
                )}
              />
            </Form>
          )}

          {activeSection === 'final' && (
            <Form>
              <Field label="Section label">
                <Input
                  value={draft.landing.final_cta_label ?? ''}
                  onChange={(v) => setLandingField('final_cta_label', v)}
                />
              </Field>
              <Field label="Title">
                <Input
                  value={draft.landing.final_cta_title ?? ''}
                  onChange={(v) => setLandingField('final_cta_title', v)}
                />
              </Field>
              <Field label="Subtitle">
                <Textarea
                  rows={3}
                  value={draft.landing.final_cta_subtitle ?? ''}
                  onChange={(v) => setLandingField('final_cta_subtitle', v)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Primary button">
                  <Input
                    value={draft.landing.final_cta_primary ?? ''}
                    onChange={(v) => setLandingField('final_cta_primary', v)}
                  />
                </Field>
                <Field label="Secondary button">
                  <Input
                    value={draft.landing.final_cta_secondary ?? ''}
                    onChange={(v) => setLandingField('final_cta_secondary', v)}
                  />
                </Field>
              </div>
            </Form>
          )}
        </div>
      </aside>

      {/* Live preview */}
      <div className="overflow-y-auto bg-white">
        <div className="border-b border-gray-200 bg-white px-5 py-2 text-[11px] uppercase tracking-[0.06em] text-gray-500">
          Live preview
        </div>
        <CourseLandingView
          organizationName={organization.name}
          instructorName={draft.instructorName || null}
          instructorBio={draft.instructorBio || null}
          courseTitle={draft.title || 'Untitled course'}
          courseDescription={draft.description || null}
          thumbnailUrl={course.thumbnail_url ?? null}
          thumbnailObjectPosition={course.thumbnail_object_position ?? null}
          trailerUrl={draft.trailerUrl || null}
          isStarted={false}
          paywallEnabled={course.paywall_enabled}
          paywallPosition={course.paywall_position}
          flatLessons={flatLessons}
          landing={draft.landing}
          onStart={() => {}}
          onTrailer={() => {
            document
              .getElementById('preview-trailer')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
      </div>
    </div>
  )
}

// ─── Form primitives ──────────────────────────────────────────────────────

function Form({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3.5">{children}</div>
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-gray-500">
        {label}
      </span>
      {children}
    </label>
  )
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] tracking-tight text-gray-900 transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
    />
  )
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] leading-snug tracking-tight text-gray-900 transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
    />
  )
}

function ListEditor<T>({
  label,
  items,
  empty,
  onChange,
  renderItem,
}: {
  label: string
  items: T[]
  empty: T
  onChange: (items: T[]) => void
  renderItem: (item: T, set: (next: T) => void) => React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-gray-500">
        {label}
      </div>
      {items.map((item, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2.5"
        >
          {renderItem(item, (next) => {
            const copy = [...items]
            copy[i] = next
            onChange(copy)
          })}
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="self-start text-[11px] font-medium tracking-tight text-red-500 hover:text-red-600"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, empty])}
        className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-[12px] font-medium tracking-tight text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
      >
        + Add
      </button>
    </div>
  )
}
