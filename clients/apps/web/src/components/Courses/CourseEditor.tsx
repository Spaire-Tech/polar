'use client'

import {
  CourseLessonRead,
  CourseModuleRead,
  CourseRead,
  useAddCourseLesson,
  useAddCourseModule,
  useCourseById,
  useDeleteCourseLesson,
  useDeleteCourseModule,
  useReorderLessons,
  useUpdateCourse,
  useUpdateCourseLesson,
  useUpdateCourseModule,
} from '@/hooks/queries/courses'
import '@/styles/editor-dark.css'
import { getQueryClient } from '@/utils/api/query'
import { schemas } from '@spaire/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '../Toast/use-toast'
import { AnalyticsTab } from './editor/AnalyticsTab'
import { AuthTab } from './editor/AuthTab'
import { AutomationsPanel } from './editor/AutomationsPanel'
import { CommunityTab } from './editor/CommunityTab'
import { CourseHeader, TabId } from './editor/CourseHeader'
import { CustomersTab } from './editor/CustomersTab'
import { CustomizeTab } from './editor/CustomizeTab'
import { LessonEdits } from './editor/LessonDetail'
import { LessonEditorV2 } from './editor/LessonEditorV2'
import { LessonContentType } from './editor/ModuleCard'
import { OutlineTab } from './editor/OutlineTab'
import { PricingTab } from './editor/PricingTab'
import { QuizDetail, QuizSaveBody } from './editor/QuizDetail'
import { SalesTab } from './editor/SalesTab'
import { CourseSettingsEdits, SettingsTab } from './editor/SettingsTab'

async function streamLessonContent(
  organizationSlug: string,
  params: {
    courseTitle: string | null
    moduleTitle: string
    lessonTitle: string
    contentType: string
  },
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(
    `/dashboard/${organizationSlug}/courses/lesson-content`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal,
    },
  )
  if (!res.ok || !res.body) throw new Error(`Generation failed (${res.status})`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    onChunk(decoder.decode(value, { stream: true }))
  }
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
  const router = useRouter()
  const searchParams = useSearchParams()

  const tabFromQs = searchParams.get('tab') as TabId | null
  const KNOWN_TABS: ReadonlySet<TabId> = new Set([
    'outline',
    'customize',
    'community',
    'automations',
    'settings',
    'auth',
    'pricing',
    'sales',
    'analytics',
    'customers',
  ])
  const initialTab: TabId =
    tabFromQs && KNOWN_TABS.has(tabFromQs) ? tabFromQs : 'outline'
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)
  // Returning from the standalone automation builder deep-links back to the
  // lesson via ?lesson=<id>; preselect it (and the outline tab).
  const lessonFromQs = searchParams.get('lesson')
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    lessonFromQs ?? null,
  )
  // LessonDetail reports its dirty state up here so the host can guard
  // navigation (lesson swap, outline click) against silently dropping
  // the user's unsaved typing.
  const [lessonDirty, setLessonDirty] = useState(false)
  // Id of a lesson that was just added from the outline. The redesigned editor
  // (LessonEditorV2) persists eagerly, so a blank "New Lesson" card would
  // otherwise be left behind the moment you open it. We track the fresh id and,
  // if you leave it still untouched, offer Save-as-draft / Discard instead of
  // silently keeping the empty row.
  const [newLessonId, setNewLessonId] = useState<string | null>(null)
  const confirmLeaveDirty = (): boolean => {
    if (!lessonDirty) return true
    return window.confirm(
      'This lesson has unsaved changes. Leave without saving?',
    )
  }

  const DEFAULT_LESSON_TITLES = new Set([
    'New Lesson',
    'New Video Lesson',
    'Untitled quiz',
  ])
  const findLessonById = (id: string): CourseLessonRead | null => {
    for (const mod of course.modules) {
      const l = mod.lessons.find((x) => x.id === id)
      if (l) return l
    }
    return null
  }
  // A freshly-added lesson still looks "empty" — default title, no copy, no
  // video, not published, no authored content.
  const lessonLooksEmpty = (l: CourseLessonRead): boolean => {
    const c = (l.content ?? {}) as {
      overview?: string
      takeaways?: string[]
      attachments?: unknown[]
      textContent?: string
    }
    const hasContent =
      !!(c.overview && c.overview.trim()) ||
      !!(c.takeaways && c.takeaways.some((t) => t && t.trim())) ||
      !!(c.attachments && c.attachments.length > 0) ||
      !!(c.textContent && c.textContent.trim())
    return (
      DEFAULT_LESSON_TITLES.has((l.title ?? '').trim()) &&
      !(l.description ?? '').trim() &&
      !l.mux_playback_id &&
      !l.published &&
      !hasContent
    )
  }
  // Returns true if it's OK to proceed with the navigation. When leaving an
  // untouched brand-new lesson, ask whether to keep it as a draft or discard.
  const reconcileNewLesson = (): boolean => {
    if (!newLessonId || selectedLessonId !== newLessonId) return true
    const lesson = findLessonById(newLessonId)
    const id = newLessonId
    setNewLessonId(null)
    if (!lesson || !lessonLooksEmpty(lesson)) return true
    const keepDraft = window.confirm(
      'This new lesson is still empty.\n\n' +
        'Click OK to keep it as a draft, or Cancel to discard it.',
    )
    if (!keepDraft) {
      deleteLesson
        .mutateAsync(id)
        .then(invalidateCourse)
        .catch(() => {
          /* best-effort cleanup */
        })
    }
    return true
  }

  const guardedSetSelectedLessonId = (next: string | null) => {
    if (next === selectedLessonId) return
    if (!confirmLeaveDirty()) return
    if (!reconcileNewLesson()) return
    setLessonDirty(false)
    setSelectedLessonId(next)
  }
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Universal editor theme. Persisted under one key shared with the community
  // hub so a single toggle drives both surfaces (and the dark matches the
  // community/landing palette).
  const [dark, setDark] = useState(false)
  useEffect(() => {
    setDark(localStorage.getItem('spaire_theme') === 'dark')
  }, [])
  const toggleDark = useCallback(() => {
    setDark((d) => {
      const next = !d
      localStorage.setItem('spaire_theme', next ? 'dark' : 'light')
      return next
    })
  }, [])

  const addLesson = useAddCourseLesson()
  const updateLesson = useUpdateCourseLesson()
  const deleteLesson = useDeleteCourseLesson()
  const updateCourse = useUpdateCourse()
  const reorderLessons = useReorderLessons()
  const addModule = useAddCourseModule()
  const updateModule = useUpdateCourseModule()
  const deleteModule = useDeleteCourseModule()

  const invalidateCourse = useCallback(() => {
    getQueryClient().invalidateQueries({ queryKey: ['courses', { courseId }] })
  }, [courseId])

  const selectedLessonInfo = (() => {
    for (const mod of course.modules) {
      const lesson = mod.lessons.find((l) => l.id === selectedLessonId)
      if (lesson) return { lesson, module: mod }
    }
    return null
  })()

  const handleAddLesson = async (
    mod: CourseModuleRead,
    contentType: LessonContentType = 'text',
  ) => {
    try {
      const titleByType: Record<LessonContentType, string> = {
        text: 'New Lesson',
        video: 'New Video Lesson',
        quiz: 'Untitled quiz',
      }
      const lesson = await addLesson.mutateAsync({
        moduleId: mod.id,
        body: {
          title: titleByType[contentType],
          content_type: contentType,
          position: mod.lessons.length,
        },
      })
      invalidateCourse()
      setNewLessonId(lesson.id)
      setSelectedLessonId(lesson.id)
    } catch {
      toast({ title: 'Failed to add lesson' })
    }
  }

  const handleDeleteLesson = async (lesson: CourseLessonRead) => {
    const confirmed = window.confirm(
      `Delete lesson "${lesson.title}"? This cannot be undone.`,
    )
    if (!confirmed) return
    try {
      await deleteLesson.mutateAsync(lesson.id)
      if (selectedLessonId === lesson.id) setSelectedLessonId(null)
      invalidateCourse()
    } catch {
      toast({ title: 'Failed to delete lesson' })
    }
  }

  const handleAddModule = async () => {
    const title = window.prompt('New module title:', 'New module')
    if (!title || !title.trim()) return
    try {
      await addModule.mutateAsync({
        courseId: course.id,
        body: { title: title.trim(), position: course.modules.length },
      })
      invalidateCourse()
    } catch {
      toast({ title: 'Failed to add module' })
    }
  }

  const handleRenameModule = async (mod: CourseModuleRead, title: string) => {
    try {
      await updateModule.mutateAsync({
        moduleId: mod.id,
        body: { title },
      })
      invalidateCourse()
    } catch {
      toast({ title: 'Failed to rename module' })
    }
  }

  const handleDeleteModule = async (mod: CourseModuleRead) => {
    try {
      await deleteModule.mutateAsync(mod.id)
      // Clear lesson selection if it pointed at one of this module's lessons.
      if (mod.lessons.some((l) => l.id === selectedLessonId)) {
        setSelectedLessonId(null)
      }
      invalidateCourse()
    } catch {
      toast({ title: 'Failed to delete module' })
    }
  }

  const handleReorderLessons = async (
    moduleId: string,
    orderedIds: string[],
  ) => {
    try {
      await reorderLessons.mutateAsync({ moduleId, orderedIds })
      invalidateCourse()
    } catch {
      toast({ title: 'Failed to reorder lessons' })
    }
  }

  const handleSaveSettings = async (edits: CourseSettingsEdits) => {
    try {
      await updateCourse.mutateAsync({
        courseId: course.id,
        body: {
          ...(edits.title !== undefined ? { title: edits.title } : {}),
          ...(edits.description !== undefined
            ? { description: edits.description }
            : {}),
          ...(edits.instructor_name !== undefined
            ? { instructor_name: edits.instructor_name }
            : {}),
          ...(edits.instructor_bio !== undefined
            ? { instructor_bio: edits.instructor_bio }
            : {}),
          paywall_enabled: edits.paywall_enabled,
          paywall_position: edits.paywall_position,
          thumbnail_object_position: edits.thumbnail_object_position,
        },
      })
      invalidateCourse()
      toast({ title: 'Settings saved' })
    } catch {
      toast({ title: 'Failed to save settings' })
    }
  }

  const handleSaveLesson = async (edits: LessonEdits) => {
    if (!selectedLessonInfo) return
    setIsSaving(true)
    try {
      const isQuiz = selectedLessonInfo.lesson.content_type === 'quiz'
      const contentType = isQuiz
        ? 'quiz'
        : edits.media === 'video'
          ? 'video'
          : 'text'
      const existingContent = (selectedLessonInfo.lesson.content ??
        {}) as Record<string, unknown>
      const nextContent: Record<string, unknown> = { ...existingContent }
      if (!isQuiz) {
        if (edits.textContent) nextContent.text = edits.textContent
        else delete nextContent.text
      }
      await updateLesson.mutateAsync({
        lessonId: selectedLessonInfo.lesson.id,
        body: {
          title: edits.title,
          description: edits.description || null,
          content_type: contentType,
          content: Object.keys(nextContent).length > 0 ? nextContent : null,
          published: edits.published,
          comments_mode: edits.commentsMode,
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

  const handleSaveQuiz = async (body: QuizSaveBody) => {
    if (!selectedLessonInfo) return
    setIsSaving(true)
    try {
      await updateLesson.mutateAsync({
        lessonId: selectedLessonInfo.lesson.id,
        body: {
          title: body.title,
          content_type: 'quiz',
          content: body.content as unknown as Record<string, unknown>,
          published: body.published,
        },
      })
      invalidateCourse()
      toast({ title: 'Quiz saved' })
    } catch {
      toast({ title: 'Failed to save quiz' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateLessonOptions = async (
    lesson: CourseLessonRead,
    patch: {
      published?: boolean
      is_free_preview?: boolean
      release_at?: string | null
      drip_days?: number | null
    },
  ) => {
    try {
      await updateLesson.mutateAsync({ lessonId: lesson.id, body: patch })
      invalidateCourse()
      const labels: Record<string, string> = {
        published: patch.published ? 'Lesson published' : 'Lesson unpublished',
        is_free_preview: patch.is_free_preview
          ? 'Marked as free preview'
          : 'Removed from free preview',
        release_at: 'Schedule saved',
        drip_days: 'Schedule saved',
      }
      const key = Object.keys(patch)[0]
      if (key && labels[key]) toast({ title: labels[key] })
    } catch {
      toast({ title: 'Failed to update lesson' })
    }
  }

  const handleGenerateAI = async (
    edits: LessonEdits,
    onChunk: (chunk: string) => void,
  ) => {
    if (!selectedLessonInfo) return
    const controller = new AbortController()
    abortRef.current = controller
    setIsGenerating(true)
    try {
      await streamLessonContent(
        organization.slug,
        {
          courseTitle: course.title,
          moduleTitle: selectedLessonInfo.module.title,
          lessonTitle: edits.title,
          contentType: edits.media === 'none' ? 'text' : edits.media,
        },
        onChunk,
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

  const handleStopAI = () => {
    abortRef.current?.abort()
    setIsGenerating(false)
  }

  const handleTabChange = (tab: TabId) => {
    if (tab !== activeTab && !confirmLeaveDirty()) return
    if (tab !== activeTab && !reconcileNewLesson()) return
    setActiveTab(tab)
    if (tab !== 'outline') {
      setSelectedLessonId(null)
      setLessonDirty(false)
    }
  }

  const handleAddContent = async () => {
    if (course.modules.length > 0) {
      handleAddLesson(course.modules[0])
      return
    }
    // No modules yet — create one (titled "Lessons" by default) and drop the
    // first lesson in. Keeps the empty-state Add lesson button working
    // instead of silently no-op'ing.
    try {
      const mod = await addModule.mutateAsync({
        courseId: course.id,
        body: { title: 'Lessons', position: 0 },
      })
      await handleAddLesson(mod)
    } catch {
      toast({ title: 'Failed to add module' })
    }
  }

  let mainContent: React.ReactNode

  if (activeTab === 'outline') {
    if (selectedLessonId && selectedLessonInfo) {
      mainContent =
        selectedLessonInfo.lesson.content_type === 'quiz' ? (
          <QuizDetail
            key={selectedLessonInfo.lesson.id}
            lesson={selectedLessonInfo.lesson}
            module={selectedLessonInfo.module}
            course={course}
            organizationSlug={organization.slug}
            onSave={handleSaveQuiz}
            onDelete={() => handleDeleteLesson(selectedLessonInfo.lesson)}
            isSaving={isSaving}
          />
        ) : (
          <LessonEditorV2
            key={selectedLessonInfo.lesson.id}
            lesson={selectedLessonInfo.lesson}
            module={selectedLessonInfo.module}
            course={course}
            organization={organization}
            organizationSlug={organization.slug}
            onDelete={() => guardedSetSelectedLessonId(null)}
          />
        )
    } else {
      mainContent = (
        <OutlineTab
          course={course}
          organizationSlug={organization.slug}
          selectedLessonId={selectedLessonId}
          onSelectLesson={guardedSetSelectedLessonId}
          onAddLesson={(mod, ct) => handleAddLesson(mod, ct)}
          onUpdateLesson={handleUpdateLessonOptions}
          onDeleteLesson={handleDeleteLesson}
          onReorderLessons={handleReorderLessons}
          onEditPaywall={() => setActiveTab('pricing')}
          onAddModule={handleAddModule}
          onRenameModule={handleRenameModule}
          onDeleteModule={handleDeleteModule}
        />
      )
    }
  } else if (activeTab === 'customize') {
    mainContent = <CustomizeTab course={course} organization={organization} />
  } else if (activeTab === 'community') {
    mainContent = (
      <CommunityTab course={course} organization={organization} dark={dark} />
    )
  } else if (activeTab === 'automations') {
    mainContent = (
      <div className="mx-auto w-full max-w-3xl px-8 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-medium text-gray-900">Automations</h1>
          <p className="mt-1 text-gray-500">
            Email sequences that fire on course enrolment, lesson completion,
            and other course events. Pick a template or start from scratch.
          </p>
        </div>
        <AutomationsPanel
          organization={organization}
          courseId={course.id}
          scopeLabel="course"
        />
      </div>
    )
  } else if (activeTab === 'settings') {
    mainContent = (
      <SettingsTab
        course={course}
        onSave={handleSaveSettings}
        isSaving={updateCourse.isPending}
      />
    )
  } else if (activeTab === 'auth') {
    mainContent = <AuthTab course={course} organization={organization} />
  } else if (activeTab === 'analytics') {
    mainContent = <AnalyticsTab organization={organization} course={course} />
  } else if (activeTab === 'sales') {
    mainContent = <SalesTab organization={organization} course={course} />
  } else if (activeTab === 'pricing') {
    mainContent = (
      <PricingTab
        organization={organization}
        course={course}
        onSave={handleSaveSettings}
        isSaving={updateCourse.isPending}
      />
    )
  } else {
    mainContent = (
      <CustomersTab organization={organization} courseId={course.id} />
    )
  }

  const handleClose = () =>
    router.push(`/dashboard/${organization.slug}/products`)
  const handleBack = () => {
    // Within the editor, "back" first returns from a lesson to the outline.
    if (selectedLessonId) {
      setSelectedLessonId(null)
      return
    }
    // Otherwise leave the editor for the Courses list. This is a DETERMINISTIC
    // push, not router.back(): visiting the standalone automation builder (and
    // other sub-routes) pushes entries onto history, so router.back() would
    // retrace into the automation builder instead of leaving the course.
    router.push(`/dashboard/${organization.slug}/courses`)
  }

  return (
    <div
      className={`flex h-screen flex-col bg-gray-50 ${dark ? 'editor-dark' : ''}`}
    >
      <CourseHeader
        course={course}
        organizationSlug={organization.slug}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onAddContent={handleAddContent}
        onBack={handleBack}
        onClose={handleClose}
        dark={dark}
        onToggleDark={toggleDark}
      />
      <div className="flex-1 overflow-y-auto">{mainContent}</div>
    </div>
  )
}
