'use client'

import {
  useCustomerCourse,
  type CustomerLessonRead,
  type CustomerModuleRead,
} from '@/hooks/queries/courses'
import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import OndemandVideoOutlined from '@mui/icons-material/OndemandVideoOutlined'
import TextSnippetOutlined from '@mui/icons-material/TextSnippetOutlined'
import { schemas } from '@spaire/client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

const LessonIcon = ({ contentType }: { contentType: string }) =>
  contentType === 'video' ? (
    <OndemandVideoOutlined fontSize="small" className="text-gray-400" />
  ) : (
    <TextSnippetOutlined fontSize="small" className="text-gray-400" />
  )

const ModuleAccordion = ({
  module,
  currentLessonId,
  onSelectLesson,
}: {
  module: CustomerModuleRead
  currentLessonId: string | null
  onSelectLesson: (lesson: CustomerLessonRead) => void
}) => {
  const isActive = module.lessons.some((l) => l.id === currentLessonId)
  const [open, setOpen] = useState(isActive)

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-800 hover:bg-gray-50"
      >
        <span>{module.title}</span>
        <ExpandMoreOutlined
          fontSize="small"
          className={twMerge(
            'flex-none text-gray-400 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div className="flex flex-col pb-2">
          {module.lessons.map((lesson) => (
            <button
              key={lesson.id}
              onClick={() => onSelectLesson(lesson)}
              className={twMerge(
                'flex items-center gap-x-3 px-4 py-2 text-left text-sm transition-colors hover:bg-gray-50',
                lesson.id === currentLessonId
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600',
              )}
            >
              <LessonIcon contentType={lesson.content_type} />
              <span className="flex-1">{lesson.title}</span>
              {lesson.content?.text?.trim() && (
                <CheckCircleOutlined
                  fontSize="small"
                  className="flex-none text-green-500 opacity-60"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const LessonContent = ({ lesson }: { lesson: CustomerLessonRead }) => {
  const text = lesson.content?.text ?? ''

  if (!text.trim()) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
        <p>No content yet for this lesson.</p>
      </div>
    )
  }

  if (lesson.content_type === 'video') {
    return (
      <div className="flex flex-col gap-y-6">
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
          Video script — the actual video will be embedded here once published.
        </div>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-700">
          {text}
        </pre>
      </div>
    )
  }

  return (
    <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-code:rounded prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-sm prose-pre:rounded-xl prose-pre:bg-gray-900 prose-pre:text-gray-100">
      <MemoizedMarkdown content={text} />
    </div>
  )
}

const LessonViewerPage = ({
  organization,
  courseId,
  customerSessionToken,
  initialLessonId,
}: {
  organization: schemas['CustomerOrganization']
  courseId: string
  customerSessionToken: string
  initialLessonId?: string
}) => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data, isLoading, error } = useCustomerCourse(
    customerSessionToken,
    courseId,
  )

  const allLessons =
    data?.course.modules.flatMap((m) => m.lessons) ?? []

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    initialLessonId ?? null,
  )

  const currentLessonId =
    selectedLessonId ?? allLessons[0]?.id ?? null

  const currentLesson = allLessons.find((l) => l.id === currentLessonId) ?? null

  const handleSelectLesson = (lesson: CustomerLessonRead) => {
    setSelectedLessonId(lesson.id)
    const params = new URLSearchParams(searchParams.toString())
    params.set('lesson', lesson.id)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  const backHref = `/${organization.slug}/portal/courses?${searchParams.toString()}`

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-xl bg-red-50 p-4 text-red-600">
        Could not load course. You may not have access.
      </div>
    )
  }

  return (
    <div className="-mx-4 flex min-h-screen flex-col md:-mx-0">
      {/* Header */}
      <div className="flex items-center gap-x-4 border-b border-gray-100 px-4 py-3 md:px-0">
        <Link
          href={backHref}
          className="flex items-center gap-x-2 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowBackOutlined fontSize="small" />
          <span>My Courses</span>
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="truncate text-sm font-medium text-gray-900">
          {data.course.title ?? 'Course'}
        </h1>
      </div>

      <div className="flex flex-1 flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="w-full flex-none border-b border-gray-100 md:w-72 md:border-b-0 md:border-r">
          <div className="px-2 py-4">
            <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-gray-400">
              Contents
            </p>
            {data.course.modules.map((module) => (
              <ModuleAccordion
                key={module.id}
                module={module}
                currentLessonId={currentLessonId}
                onSelectLesson={handleSelectLesson}
              />
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 px-4 py-8 md:px-10 md:py-12">
          {currentLesson ? (
            <div className="flex flex-col gap-y-6">
              <div className="flex flex-col gap-y-1">
                <div className="flex items-center gap-x-2 text-xs text-gray-400">
                  <LessonIcon contentType={currentLesson.content_type} />
                  <span>
                    {currentLesson.content_type === 'video'
                      ? 'Video Lesson'
                      : 'Text Lesson'}
                  </span>
                  {currentLesson.duration_seconds && (
                    <>
                      <span>·</span>
                      <span>
                        {Math.ceil(currentLesson.duration_seconds / 60)} min
                      </span>
                    </>
                  )}
                </div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  {currentLesson.title}
                </h2>
              </div>
              <LessonContent lesson={currentLesson} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
              <p>Select a lesson from the sidebar to get started.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default LessonViewerPage
