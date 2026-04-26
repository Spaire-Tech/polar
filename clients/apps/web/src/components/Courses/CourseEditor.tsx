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
  useReorderModules,
  useUpdateCourse,
  useUpdateCourseLesson,
  useUpdateCourseModule,
} from '@/hooks/queries/courses'
import { getQueryClient } from '@/utils/api/query'
import { schemas } from '@spaire/client'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'
import { toast } from '../Toast/use-toast'
import { CourseHeader, TabId } from './editor/CourseHeader'
import { CustomersTab } from './editor/CustomersTab'
import { EmptyTab } from './editor/EmptyTab'
import { LessonDetail, LessonEdits } from './editor/LessonDetail'
import { LessonContentType } from './editor/ModuleCard'
import { OutlineTab } from './editor/OutlineTab'
import { PricingTab } from './editor/PricingTab'
import { QuizDetail, QuizSaveBody } from './editor/QuizDetail'
import { ScheduleEdits } from './editor/ScheduleMenu'
import { CourseSettingsEdits } from './editor/SettingsTab'
import { ModuleStatus } from './editor/StatusDropdown'

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

  const [activeTab, setActiveTab] = useState<TabId>('outline')
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const addModule = useAddCourseModule()
  const updateModule = useUpdateCourseModule()
  const deleteModule = useDeleteCourseModule()
  const addLesson = useAddCourseLesson()
  const updateLesson = useUpdateCourseLesson()
  const deleteLesson = useDeleteCourseLesson()
  const updateCourse = useUpdateCourse()
  const reorderModules = useReorderModules()
  const reorderLessons = useReorderLessons()

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

  const handleAddModule = async () => {
    try {
      await addModule.mutateAsync({
        courseId: course.id,
        body: { title: 'New Module', position: course.modules.length },
      })
      invalidateCourse()
    } catch {
      toast({ title: 'Failed to add module' })
    }
  }

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

  const handleDeleteModule = async (mod: CourseModuleRead) => {
    try {
      await deleteModule.mutateAsync(mod.id)
      if (mod.lessons.some((l) => l.id === selectedLessonId))
        setSelectedLessonId(null)
      invalidateCourse()
    } catch {
      toast({ title: 'Failed to delete module' })
    }
  }

  const handleUpdateStatus = async (
    mod: CourseModuleRead,
    next: ModuleStatus,
  ) => {
    try {
      await updateModule.mutateAsync({
        moduleId: mod.id,
        body: { status: next },
      })
      invalidateCourse()
    } catch {
      toast({ title: 'Failed to update status' })
    }
  }

  const handleUpdateSchedule = async (
    mod: CourseModuleRead,
    edits: ScheduleEdits,
  ) => {
    try {
      await updateModule.mutateAsync({
        moduleId: mod.id,
        body: {
          drip_days: edits.drip_days,
          release_at: edits.release_at,
        },
      })
      invalidateCourse()
      toast({ title: 'Schedule updated' })
    } catch {
      toast({ title: 'Failed to update schedule' })
    }
  }

  const handleReorderModules = async (orderedIds: string[]) => {
    try {
      await reorderModules.mutateAsync({ courseId: course.id, orderedIds })
      invalidateCourse()
    } catch {
      toast({ title: 'Failed to reorder modules' })
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
          paywall_enabled: edits.paywall_enabled,
          paywall_position: edits.paywall_position,
        },
      })
      invalidateCourse()
      toast({ title: 'Settings saved' })
    } catch {
      toast({ title: 'Failed to save settings' })
    }
  }

  const handleRenameModule = async (mod: CourseModuleRead, title: string) => {
    try {
      await updateModule.mutateAsync({ moduleId: mod.id, body: { title } })
      invalidateCourse()
    } catch {
      toast({ title: 'Failed to rename module' })
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
          : edits.media === 'audio'
            ? 'audio'
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
          content_type: contentType,
          content: Object.keys(nextContent).length > 0 ? nextContent : null,
          video_asset_id:
            edits.media === 'video' ? edits.videoUrl || null : null,
          published: edits.published,
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
    setActiveTab(tab)
    if (tab !== 'outline') setSelectedLessonId(null)
  }

  const handleAddContent = () => {
    if (course.modules.length > 0) {
      handleAddLesson(course.modules[0])
    } else {
      handleAddModule()
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
          <LessonDetail
            key={selectedLessonInfo.lesson.id}
            lesson={selectedLessonInfo.lesson}
            module={selectedLessonInfo.module}
            course={course}
            organizationSlug={organization.slug}
            onSave={handleSaveLesson}
            onDelete={() => handleDeleteLesson(selectedLessonInfo.lesson)}
            isSaving={isSaving}
            onGenerateAI={handleGenerateAI}
            isGenerating={isGenerating}
            onStopAI={handleStopAI}
          />
        )
    } else {
      mainContent = (
        <OutlineTab
          course={course}
          selectedLessonId={selectedLessonId}
          onSelectLesson={setSelectedLessonId}
          onAddModule={handleAddModule}
          onAddLesson={(mod, ct) => handleAddLesson(mod, ct)}
          onDeleteLesson={handleDeleteLesson}
          onUpdateStatus={handleUpdateStatus}
          onUpdateSchedule={handleUpdateSchedule}
          onReorderModules={handleReorderModules}
          onReorderLessons={handleReorderLessons}
          onRenameModule={handleRenameModule}
          onDeleteModule={handleDeleteModule}
          onEditPaywall={() => setActiveTab('pricing')}
        />
      )
    }
  } else if (activeTab === 'customize') {
    mainContent = (
      <EmptyTab
        title="Customize"
        description="Branding and appearance settings coming soon."
      />
    )
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
    mainContent = <CustomersTab organization={organization} />
  }

  const handleClose = () =>
    router.push(`/dashboard/${organization.slug}/products`)
  const handleBack = () => {
    // Within the editor, "back" first returns from a lesson to the outline.
    if (selectedLessonId) {
      setSelectedLessonId(null)
      return
    }
    // Otherwise return to the previous page (typically the products list).
    // The wizard uses router.replace after creation so it never sits in history.
    router.back()
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <CourseHeader
        course={course}
        organizationSlug={organization.slug}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onAddContent={handleAddContent}
        onBack={handleBack}
        onClose={handleClose}
      />
      <div className="flex-1 overflow-y-auto">{mainContent}</div>
    </div>
  )
}
