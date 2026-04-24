'use client'

import {
  CourseModuleRead,
  CourseLessonRead,
  CourseRead,
  useAddCourseLesson,
  useAddCourseModule,
  useDeleteCourseLesson,
  useDeleteCourseModule,
  useUpdateCourseLesson,
  useUpdateCourseModule,
  useCourseById,
} from '@/hooks/queries/courses'
import { getQueryClient } from '@/utils/api/query'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import OndemandVideoOutlined from '@mui/icons-material/OndemandVideoOutlined'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import StopOutlined from '@mui/icons-material/StopOutlined'
import TextSnippetOutlined from '@mui/icons-material/TextSnippetOutlined'
import { schemas } from '@spaire/client'
import { cn } from '@spaire/ui/lib/utils'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '../Toast/use-toast'

type LessonEdits = {
  title: string
  content_type: string
  textContent: string
  videoUrl: string
}

type LessonContentParams = {
  courseTitle: string | null
  courseDescription?: string | null
  targetAudience?: string | null
  moduleTitle: string
  lessonTitle: string
  contentType: string
}

async function streamLessonContent(
  organizationSlug: string,
  params: LessonContentParams,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(
    `/dashboard/${organizationSlug}/courses/lesson-content`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal,
    },
  )
  if (!res.ok || !res.body) {
    throw new Error(`Generation failed (${res.status})`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value, { stream: true })
    full += text
    onChunk(text)
  }
  return full
}

function LessonEditor({
  lesson,
  module,
  course,
  organization,
  onSave,
  isSaving,
}: {
  lesson: CourseLessonRead
  module: CourseModuleRead
  course: CourseRead
  organization: schemas['Organization']
  onSave: (edits: LessonEdits) => void
  isSaving: boolean
}) {
  const [edits, setEdits] = useState<LessonEdits>(() => ({
    title: lesson.title,
    content_type: lesson.content_type,
    textContent: (lesson.content as { text?: string } | null)?.text ?? '',
    videoUrl: lesson.video_asset_id ?? '',
  }))
  const [isGenerating, setIsGenerating] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setEdits({
      title: lesson.title,
      content_type: lesson.content_type,
      textContent: (lesson.content as { text?: string } | null)?.text ?? '',
      videoUrl: lesson.video_asset_id ?? '',
    })
  }, [lesson.id])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const handleGenerate = async () => {
    const controller = new AbortController()
    abortRef.current = controller
    setIsGenerating(true)
    setEdits((prev) => ({ ...prev, textContent: '' }))
    try {
      await streamLessonContent(
        organization.slug,
        {
          courseTitle: course.title,
          moduleTitle: module.title,
          lessonTitle: edits.title,
          contentType: edits.content_type,
        },
        (chunk) =>
          setEdits((prev) => ({
            ...prev,
            textContent: prev.textContent + chunk,
          })),
        controller.signal,
      )
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        toast({ title: 'Failed to generate content' })
      }
    } finally {
      setIsGenerating(false)
      abortRef.current = null
    }
  }

  const handleStopGenerate = () => {
    abortRef.current?.abort()
    setIsGenerating(false)
  }

  const canGenerate = edits.title.trim().length > 0

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">
          Lesson Title
        </label>
        <input
          type="text"
          value={edits.title}
          onChange={(e) =>
            setEdits((prev) => ({ ...prev, title: e.target.value }))
          }
          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-base font-medium text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs font-medium uppercase tracking-wide text-gray-400">
          Content Type
        </label>
        {(['text', 'video'] as const).map((ct) => (
          <button
            key={ct}
            onClick={() =>
              setEdits((prev) => ({ ...prev, content_type: ct }))
            }
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              edits.content_type === ct
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50',
            )}
          >
            {ct === 'video' ? (
              <OndemandVideoOutlined fontSize="inherit" />
            ) : (
              <TextSnippetOutlined fontSize="inherit" />
            )}
            {ct === 'text' ? 'Text' : 'Video'}
          </button>
        ))}
      </div>

      {edits.content_type === 'video' && (
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">
            Video URL
          </label>
          <input
            type="url"
            value={edits.videoUrl}
            onChange={(e) =>
              setEdits((prev) => ({ ...prev, videoUrl: e.target.value }))
            }
            placeholder="https://..."
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-400">
            {edits.content_type === 'video' ? 'Video Script' : 'Content'}
          </label>
          {isGenerating ? (
            <button
              onClick={handleStopGenerate}
              className="flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
            >
              <StopOutlined fontSize="inherit" />
              Stop
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <AutoAwesomeOutlined fontSize="inherit" />
              {edits.textContent.trim() ? 'Regenerate with AI' : 'Generate with AI'}
            </button>
          )}
        </div>
        <textarea
          value={edits.textContent}
          onChange={(e) =>
            setEdits((prev) => ({ ...prev, textContent: e.target.value }))
          }
          placeholder={
            edits.content_type === 'video'
              ? 'Video script goes here…'
              : 'Write your lesson content here…'
          }
          rows={18}
          className="w-full resize-y rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 font-mono leading-relaxed"
        />
      </div>

      <button
        onClick={() => onSave(edits)}
        disabled={isSaving || isGenerating}
        className="flex w-fit items-center gap-2 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
      >
        <SaveOutlined fontSize="small" />
        {isSaving ? 'Saving…' : 'Save Lesson'}
      </button>
    </div>
  )
}

export default function CourseEditor({
  organization,
  courseId,
  initialCourse,
}: {
  organization: schemas['Organization']
  courseId: string
  initialCourse: CourseRead
}) {
  const { data: course = initialCourse } = useCourseById(courseId)

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    initialCourse.modules[0]?.lessons[0]?.id ?? null,
  )
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>(
    Object.fromEntries(initialCourse.modules.map((m) => [m.id, true])),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [fillAll, setFillAll] = useState<{
    total: number
    current: number
  } | null>(null)
  const fillAllAbortRef = useRef<AbortController | null>(null)

  const addModule = useAddCourseModule()
  const updateModule = useUpdateCourseModule()
  const deleteModule = useDeleteCourseModule()
  const addLesson = useAddCourseLesson()
  const updateLesson = useUpdateCourseLesson()
  const deleteLesson = useDeleteCourseLesson()

  const invalidateCourse = useCallback(() => {
    getQueryClient().invalidateQueries({
      queryKey: ['courses', { courseId }],
    })
  }, [courseId])

  const selectedLessonInfo = (() => {
    for (const mod of course.modules) {
      const lesson = mod.lessons.find((l) => l.id === selectedLessonId)
      if (lesson) return { lesson, module: mod }
    }
    return null
  })()

  const handleAddModule = async () => {
    const position = course.modules.length
    try {
      const mod = await addModule.mutateAsync({
        courseId: course.id,
        body: { title: 'New Module', position },
      })
      invalidateCourse()
      setExpandedModules((prev) => ({ ...prev, [mod.id]: true }))
    } catch {
      toast({ title: 'Failed to add module' })
    }
  }

  const handleDeleteModule = async (mod: CourseModuleRead) => {
    try {
      await deleteModule.mutateAsync(mod.id)
      if (mod.lessons.some((l) => l.id === selectedLessonId)) {
        setSelectedLessonId(null)
      }
      invalidateCourse()
    } catch {
      toast({ title: 'Failed to delete module' })
    }
  }

  const handleAddLesson = async (mod: CourseModuleRead) => {
    const position = mod.lessons.length
    try {
      const lesson = await addLesson.mutateAsync({
        moduleId: mod.id,
        body: { title: 'New Lesson', content_type: 'text', position },
      })
      invalidateCourse()
      setSelectedLessonId(lesson.id)
    } catch {
      toast({ title: 'Failed to add lesson' })
    }
  }

  const handleDeleteLesson = async (lesson: CourseLessonRead) => {
    try {
      await deleteLesson.mutateAsync(lesson.id)
      if (selectedLessonId === lesson.id) setSelectedLessonId(null)
      invalidateCourse()
    } catch {
      toast({ title: 'Failed to delete lesson' })
    }
  }

  const handleSaveLesson = async (edits: LessonEdits) => {
    if (!selectedLessonInfo) return
    setIsSaving(true)
    try {
      await updateLesson.mutateAsync({
        lessonId: selectedLessonInfo.lesson.id,
        body: {
          title: edits.title,
          content_type: edits.content_type,
          content:
            edits.content_type === 'text' || edits.content_type === 'video'
              ? { text: edits.textContent }
              : null,
          video_asset_id:
            edits.content_type === 'video' ? edits.videoUrl || null : null,
        },
      })
      invalidateCourse()
      toast({ title: 'Lesson saved' })
    } catch {
      toast({ title: 'Failed to save lesson' })
    } finally {
      setIsSaving(false)
    }
  }

  const emptyLessons = course.modules.flatMap((mod) =>
    mod.lessons
      .filter(
        (l) => !((l.content as { text?: string } | null)?.text ?? '').trim(),
      )
      .map((l) => ({ module: mod, lesson: l })),
  )

  const handleFillAll = async () => {
    if (fillAll) return
    const targets = emptyLessons
    if (targets.length === 0) {
      toast({ title: 'All lessons already have content' })
      return
    }
    const controller = new AbortController()
    fillAllAbortRef.current = controller
    setFillAll({ total: targets.length, current: 0 })

    try {
      for (let i = 0; i < targets.length; i++) {
        if (controller.signal.aborted) break
        const { module: mod, lesson } = targets[i]
        setFillAll({ total: targets.length, current: i + 1 })
        try {
          const full = await streamLessonContent(
            organization.slug,
            {
              courseTitle: course.title,
              moduleTitle: mod.title,
              lessonTitle: lesson.title,
              contentType: lesson.content_type,
            },
            () => {},
            controller.signal,
          )
          if (controller.signal.aborted) break
          await updateLesson.mutateAsync({
            lessonId: lesson.id,
            body: { content: { text: full } },
          })
        } catch (err) {
          if ((err as Error).name === 'AbortError') break
          console.error('[fillAll] lesson failed:', lesson.id, err)
        }
      }
      invalidateCourse()
      if (!controller.signal.aborted) {
        toast({ title: 'All lessons generated' })
      }
    } finally {
      setFillAll(null)
      fillAllAbortRef.current = null
    }
  }

  const handleStopFillAll = () => {
    fillAllAbortRef.current?.abort()
  }

  useEffect(() => {
    return () => fillAllAbortRef.current?.abort()
  }, [])

  const toggleModule = (id: string) =>
    setExpandedModules((prev) => ({ ...prev, [id]: !prev[id] }))

  const courseTitle = course.title ?? initialCourse.title ?? 'Course Editor'

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-4 border-b border-gray-200 bg-white px-6 py-3">
        <Link
          href={`/dashboard/${organization.slug}/courses`}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowBackOutlined fontSize="small" />
          Courses
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-900 truncate max-w-xs">
          {courseTitle}
        </span>

        <div className="ml-auto">
          {fillAll ? (
            <button
              onClick={handleStopFillAll}
              className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
            >
              <StopOutlined fontSize="inherit" />
              Stop ({fillAll.current}/{fillAll.total})
            </button>
          ) : emptyLessons.length > 0 ? (
            <button
              onClick={handleFillAll}
              className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <AutoAwesomeOutlined fontSize="inherit" />
              Fill {emptyLessons.length} empty lesson
              {emptyLessons.length !== 1 ? 's' : ''} with AI
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="flex w-72 flex-col border-r border-gray-200 bg-gray-50 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3">
            {course.modules.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-gray-400">
                No modules yet. Add one below.
              </p>
            )}
            {course.modules.map((mod) => (
              <div key={mod.id} className="mb-1">
                <div className="group flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-gray-100">
                  <button
                    onClick={() => toggleModule(mod.id)}
                    className="mr-0.5 text-gray-400 hover:text-gray-600"
                  >
                    {expandedModules[mod.id] ? (
                      <ExpandLessOutlined fontSize="small" />
                    ) : (
                      <ExpandMoreOutlined fontSize="small" />
                    )}
                  </button>
                  <span className="flex-1 truncate text-xs font-semibold text-gray-700">
                    {mod.title}
                  </span>
                  <button
                    onClick={() => handleAddLesson(mod)}
                    className="hidden rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 group-hover:flex"
                    title="Add lesson"
                  >
                    <AddOutlined fontSize="small" />
                  </button>
                  <button
                    onClick={() => handleDeleteModule(mod)}
                    className="hidden rounded p-0.5 text-gray-400 hover:bg-red-100 hover:text-red-500 group-hover:flex"
                    title="Delete module"
                  >
                    <DeleteOutlined fontSize="small" />
                  </button>
                </div>

                {expandedModules[mod.id] && (
                  <div className="ml-6">
                    {mod.lessons.map((lesson) => {
                      const hasContent = (
                        (lesson.content as { text?: string } | null)?.text ?? ''
                      ).trim().length > 0
                      return (
                        <div key={lesson.id} className="group flex items-center gap-1">
                          <button
                            onClick={() => setSelectedLessonId(lesson.id)}
                            className={cn(
                              'flex flex-1 items-center gap-2 truncate rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
                              selectedLessonId === lesson.id
                                ? 'bg-blue-50 font-medium text-blue-700'
                                : 'text-gray-600 hover:bg-gray-100',
                            )}
                          >
                            {lesson.content_type === 'video' ? (
                              <OndemandVideoOutlined
                                fontSize="inherit"
                                className="shrink-0 text-purple-400"
                              />
                            ) : (
                              <TextSnippetOutlined
                                fontSize="inherit"
                                className="shrink-0 text-blue-400"
                              />
                            )}
                            <span className="truncate">{lesson.title}</span>
                            {!hasContent && (
                              <span
                                className="ml-auto shrink-0 h-1.5 w-1.5 rounded-full bg-amber-400"
                                title="Empty"
                              />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteLesson(lesson)}
                            className="hidden rounded p-0.5 text-gray-400 hover:bg-red-100 hover:text-red-500 group-hover:flex shrink-0"
                            title="Delete lesson"
                          >
                            <DeleteOutlined fontSize="inherit" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 p-3">
            <button
              onClick={handleAddModule}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-600"
            >
              <AddOutlined fontSize="small" />
              Add Module
            </button>
          </div>
        </aside>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto bg-white p-8">
          {selectedLessonInfo ? (
            <LessonEditor
              key={selectedLessonInfo.lesson.id}
              lesson={selectedLessonInfo.lesson}
              module={selectedLessonInfo.module}
              course={course}
              organization={organization}
              onSave={handleSaveLesson}
              isSaving={isSaving}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
                <TextSnippetOutlined
                  className="text-gray-400"
                  sx={{ fontSize: 28 }}
                />
              </div>
              <p className="text-sm font-medium text-gray-600">
                Select a lesson to edit
              </p>
              <p className="text-xs text-gray-400">
                Or add a module and lesson from the sidebar
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
