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
  useUpdateCourse,
  useUpdateCourseLesson,
  useUpdateCourseModule,
} from '@/hooks/queries/courses'
import { getQueryClient } from '@/utils/api/query'
import { schemas } from '@spaire/client'
import { useSearchParams } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'
import { toast } from '../Toast/use-toast'
import { CourseHeader, TabId } from './editor/CourseHeader'
import { EmptyTab } from './editor/EmptyTab'
import { LessonDetail, LessonEdits } from './editor/LessonDetail'
import { OutlineTab } from './editor/OutlineTab'
import { ScheduleEdits } from './editor/ScheduleMenu'
import { CourseSettingsEdits, SettingsTab } from './editor/SettingsTab'
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
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState<TabId>('outline')
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [aiBannerDismissed, setAiBannerDismissed] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const showAIBanner =
    searchParams?.get('new') === '1' && !aiBannerDismissed

  const addModule = useAddCourseModule()
  const updateModule = useUpdateCourseModule()
  const deleteModule = useDeleteCourseModule()
  const addLesson = useAddCourseLesson()
  const updateLesson = useUpdateCourseLesson()
  const deleteLesson = useDeleteCourseLesson()
  const updateCourse = useUpdateCourse()

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

  const handleAddLesson = async (mod: CourseModuleRead) => {
    try {
      const lesson = await addLesson.mutateAsync({
        moduleId: mod.id,
        body: { title: 'New Lesson', content_type: 'text', position: mod.lessons.length },
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

  const handleUpdateStatus = async (mod: CourseModuleRead, next: ModuleStatus) => {
    try {
      await updateModule.mutateAsync({ moduleId: mod.id, body: { status: next } })
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
      const contentType = edits.media === 'video' ? 'video' : edits.media === 'audio' ? 'audio' : 'text'
      await updateLesson.mutateAsync({
        lessonId: selectedLessonInfo.lesson.id,
        body: {
          title: edits.title,
          content_type: contentType,
          content: edits.textContent ? { text: edits.textContent } : null,
          video_asset_id: edits.media === 'video' ? edits.videoUrl || null : null,
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
      mainContent = (
        <LessonDetail
          key={selectedLessonInfo.lesson.id}
          lesson={selectedLessonInfo.lesson}
          module={selectedLessonInfo.module}
          course={course}
          onBack={() => setSelectedLessonId(null)}
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
          showAIBanner={showAIBanner}
          onDismissAIBanner={() => setAiBannerDismissed(true)}
          selectedLessonId={selectedLessonId}
          onSelectLesson={setSelectedLessonId}
          onAddModule={handleAddModule}
          onAddLesson={handleAddLesson}
          onDeleteLesson={handleDeleteLesson}
          onUpdateStatus={handleUpdateStatus}
          onUpdateSchedule={handleUpdateSchedule}
          onRenameModule={handleRenameModule}
          onDeleteModule={handleDeleteModule}
          onEditPaywall={() => setActiveTab('settings')}
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
  } else if (activeTab === 'offers') {
    mainContent = (
      <EmptyTab
        title="Offers"
        description="Pricing and offer management coming soon."
      />
    )
  } else if (activeTab === 'customers') {
    mainContent = (
      <EmptyTab
        title="Customers"
        description="Student enrollment and progress coming soon."
      />
    )
  } else if (activeTab === 'certificates') {
    mainContent = (
      <EmptyTab
        title="Certificates"
        description="Certificate templates and issuance coming soon."
      />
    )
  } else {
    mainContent = (
      <SettingsTab
        course={course}
        onSave={handleSaveSettings}
        isSaving={updateCourse.isPending}
      />
    )
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <CourseHeader
        course={course}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onAddContent={handleAddContent}
      />
      <div className="flex-1 overflow-y-auto">{mainContent}</div>
    </div>
  )
}
