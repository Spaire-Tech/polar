import { getQueryClient } from '@/utils/api/query'
import { useMutation, useQuery } from '@tanstack/react-query'

export type LessonAttachment = {
  id: string
  filename: string
  url: string
  size: number
  content_type: string
  path?: string
}

export type QuizOption = {
  id: string
  text: string
  image_url?: string | null
  is_correct: boolean
  explanation?: string | null
}

export type QuizQuestion = {
  id: string
  text: string
  type: 'multiple_choice' | 'multiple_select' | 'short_answer'
  graded: boolean
  image_url?: string | null
  options: QuizOption[]
}

export type QuizSettings = {
  title?: string
  description?: string | null
  thumbnail_url?: string | null
  passing_grade: number
  send_email_results: boolean
  prevent_complete_without_passing: boolean
  hide_answers_on_results: boolean
}

export type QuizContent = QuizSettings & {
  questions: QuizQuestion[]
  attachments?: LessonAttachment[]
}

export type CourseLessonRead = {
  id: string
  module_id: string
  title: string
  content_type: string
  content:
    | (Record<string, unknown> & {
        text?: string
        attachments?: LessonAttachment[]
      })
    | null
  video_asset_id: string | null
  duration_seconds: number | null
  position: number
  is_free_preview: boolean
  published: boolean
  mux_upload_id: string | null
  mux_asset_id: string | null
  mux_playback_id: string | null
  mux_status: string | null
  thumbnail_url: string | null
  created_at: string
  modified_at: string | null
}

export type MuxUploadRead = {
  upload_id: string
  upload_url: string
}

export type CourseModuleRead = {
  id: string
  course_id: string
  title: string
  description: string | null
  position: number
  status: string
  release_at: string | null
  drip_days: number | null
  lessons: CourseLessonRead[]
  created_at: string
  modified_at: string | null
}

export type CourseRead = {
  id: string
  product_id: string
  organization_id: string
  title: string | null
  slug: string | null
  course_type: string
  paywall_enabled: boolean
  paywall_lesson_id: string | null
  paywall_position: number | null
  ai_generated: boolean
  description: string | null
  thumbnail_url: string | null
  modules: CourseModuleRead[]
  created_at: string
  modified_at: string | null
}

async function courseApiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const useCourseById = (courseId: string | undefined) =>
  useQuery<CourseRead>({
    queryKey: ['courses', { courseId }],
    queryFn: () => courseApiFetch<CourseRead>(`/v1/courses/${courseId}`),
    enabled: !!courseId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return false
      const hasPendingMux = data.modules.some((m) =>
        m.lessons.some(
          (l) =>
            l.mux_upload_id &&
            (!l.mux_playback_id || l.mux_status !== 'ready'),
        ),
      )
      return hasPendingMux ? 5000 : false
    },
  })

export const useCourseByProduct = (productId: string | undefined) =>
  useQuery<CourseRead>({
    queryKey: ['courses', { productId }],
    queryFn: () => courseApiFetch<CourseRead>(`/v1/courses/product/${productId}`),
    enabled: !!productId,
  })

export const useOrganizationCourses = (organizationId: string | undefined) =>
  useQuery<CourseRead[]>({
    queryKey: ['courses', { organizationId }],
    queryFn: () =>
      courseApiFetch<CourseRead[]>(`/v1/courses/organization/${organizationId}`),
    enabled: !!organizationId,
  })

export const useCreateCourse = () =>
  useMutation({
    mutationFn: (body: {
      product_id: string
      organization_id: string
      title?: string | null
      course_type?: string
      paywall_enabled?: boolean
      ai_generated?: boolean
      description?: string | null
      thumbnail_url?: string | null
      modules: {
        title: string
        description?: string | null
        position: number
        lessons: {
          title: string
          content_type: string
          position: number
        }[]
      }[]
    }) => courseApiFetch<CourseRead>('/v1/courses/', { method: 'POST', body: JSON.stringify(body) }),
  })

export const useUpdateCourse = () =>
  useMutation({
    mutationFn: ({
      courseId,
      body,
    }: {
      courseId: string
      body: {
        title?: string | null
        slug?: string | null
        course_type?: string
        paywall_enabled?: boolean
        paywall_position?: number | null
        description?: string | null
        thumbnail_url?: string | null
      }
    }) =>
      courseApiFetch<CourseRead>(`/v1/courses/${courseId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      getQueryClient().invalidateQueries({
        queryKey: ['courses', { courseId: data.id }],
      })
    },
  })

export const useAddCourseModule = () =>
  useMutation({
    mutationFn: ({
      courseId,
      body,
    }: {
      courseId: string
      body: { title: string; description?: string | null; position: number }
    }) =>
      courseApiFetch<CourseModuleRead>(`/v1/courses/${courseId}/modules`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  })

export const useUpdateCourseModule = () =>
  useMutation({
    mutationFn: ({
      moduleId,
      body,
    }: {
      moduleId: string
      body: {
        title?: string
        description?: string | null
        position?: number
        status?: string
        release_at?: string | null
        drip_days?: number | null
      }
    }) =>
      courseApiFetch<CourseModuleRead>(`/v1/courses/modules/${moduleId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
  })

export const useDeleteCourseModule = () =>
  useMutation({
    mutationFn: (moduleId: string) =>
      courseApiFetch<void>(`/v1/courses/modules/${moduleId}`, { method: 'DELETE' }),
  })

export const useAddCourseLesson = () =>
  useMutation({
    mutationFn: ({
      moduleId,
      body,
    }: {
      moduleId: string
      body: {
        title: string
        content_type: string
        position: number
        is_free_preview?: boolean
      }
    }) =>
      courseApiFetch<CourseLessonRead>(`/v1/courses/modules/${moduleId}/lessons`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  })

export const useUpdateCourseLesson = () =>
  useMutation({
    mutationFn: ({
      lessonId,
      body,
    }: {
      lessonId: string
      body: {
        title?: string
        description?: string | null
        content_type?: string
        content?: Record<string, unknown> | null
        video_asset_id?: string | null
        duration_seconds?: number | null
        position?: number
        is_free_preview?: boolean
        published?: boolean
        release_at?: string | null
        drip_days?: number | null
      }
    }) =>
      courseApiFetch<CourseLessonRead>(`/v1/courses/lessons/${lessonId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
  })

export const useDeleteCourseLesson = () =>
  useMutation({
    mutationFn: (lessonId: string) =>
      courseApiFetch<void>(`/v1/courses/lessons/${lessonId}`, { method: 'DELETE' }),
  })

export const useReorderModules = () =>
  useMutation({
    mutationFn: ({
      courseId,
      orderedIds,
    }: {
      courseId: string
      orderedIds: string[]
    }) =>
      courseApiFetch<CourseRead>(`/v1/courses/${courseId}/modules/reorder`, {
        method: 'POST',
        body: JSON.stringify({ ordered_ids: orderedIds }),
      }),
  })

export const useReorderLessons = () =>
  useMutation({
    mutationFn: ({
      moduleId,
      orderedIds,
    }: {
      moduleId: string
      orderedIds: string[]
    }) =>
      courseApiFetch<CourseModuleRead>(
        `/v1/courses/modules/${moduleId}/lessons/reorder`,
        {
          method: 'POST',
          body: JSON.stringify({ ordered_ids: orderedIds }),
        },
      ),
  })

// --- Customer portal (learner side) ---

export type CustomerCourseEnrollment = {
  enrollment_id: string
  enrolled_at: string
  course: {
    id: string
    title: string | null
    course_type: string
    module_count: number
    lesson_count: number
  }
}

export type CustomerLessonRead = {
  id: string
  title: string
  content_type: string
  content:
    | (Record<string, unknown> & {
        text?: string
        attachments?: LessonAttachment[]
        questions?: QuizQuestion[]
        passing_grade?: number
        hide_answers_on_results?: boolean
      })
    | null
  position: number
  duration_seconds: number | null
  is_free_preview: boolean
  mux_playback_id: string | null
  mux_status: string | null
  thumbnail_url: string | null
  completed: boolean
  description?: string | null
  locked?: boolean
  locked_until?: string | null
}

export type CustomerModuleRead = {
  id: string
  title: string
  description: string | null
  position: number
  locked: boolean
  locked_until: string | null
  lessons: CustomerLessonRead[]
}

export type CustomerCourseProgress = {
  total_lessons: number
  completed_lessons: number
  completion_percent: number
  completed: Record<string, string>
}

export type CustomerCourseDetail = {
  enrollment_id: string
  enrolled_at: string
  customer_name: string | null
  progress: CustomerCourseProgress
  course: {
    id: string
    title: string | null
    description: string | null
    thumbnail_url: string | null
    instructor_bio?: string | null
    course_type: string
    paywall_enabled: boolean
    paywall_position: number | null
    modules: CustomerModuleRead[]
    lessons?: CustomerLessonRead[]
  }
}

export type CourseLandingLesson = {
  id: string
  title: string
  description: string | null
  content_type: string
  position: number
  is_free_preview: boolean
  duration_seconds: number | null
  thumbnail_url: string | null
  mux_playback_id?: string | null
  mux_status?: string | null
  locked?: boolean
  locked_until?: string | null
  completed?: boolean
}

export type CourseLandingPageData = {
  id: string
  title: string | null
  description: string | null
  thumbnail_url: string | null
  course_type: string
  lesson_count: number
  total_duration_seconds: number
  lessons: CourseLandingLesson[]
  has_access: boolean
}

async function portalApiFetch<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const useCustomerCourses = (token: string | null | undefined) =>
  useQuery<CustomerCourseEnrollment[]>({
    queryKey: ['customer-courses', token],
    queryFn: () =>
      portalApiFetch<CustomerCourseEnrollment[]>(
        '/v1/customer-portal/courses/',
        token!,
      ),
    enabled: !!token,
  })

export const useCustomerCourse = (
  token: string | null | undefined,
  courseId: string | undefined,
) =>
  useQuery<CustomerCourseDetail>({
    queryKey: ['customer-courses', token, courseId],
    queryFn: () =>
      portalApiFetch<CustomerCourseDetail>(
        `/v1/customer-portal/courses/${courseId}`,
        token!,
      ),
    enabled: !!token && !!courseId,
  })

export const useCreateMuxUpload = () =>
  useMutation({
    mutationFn: (lessonId: string) =>
      courseApiFetch<MuxUploadRead>(`/v1/courses/lessons/${lessonId}/mux-upload`, {
        method: 'POST',
      }),
  })

export const usePreviewAccess = () =>
  useMutation({
    mutationFn: (courseId: string) =>
      courseApiFetch<{ token: string; portal_url: string }>(
        `/v1/courses/${courseId}/preview-access`,
        { method: 'POST' },
      ),
  })

export const useUploadLessonThumbnail = () =>
  useMutation({
    mutationFn: async ({ lessonId, file }: { lessonId: string; file: File }) => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/lessons/${lessonId}/thumbnail`,
        { method: 'POST', body: form, credentials: 'include' },
      )
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`API ${res.status}: ${text}`)
      }
      return res.json() as Promise<CourseLessonRead>
    },
  })

export const useUploadCourseThumbnail = () =>
  useMutation({
    mutationFn: async ({ courseId, file }: { courseId: string; file: File }) => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/${courseId}/thumbnail`,
        { method: 'POST', body: form, credentials: 'include' },
      )
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`API ${res.status}: ${text}`)
      }
      return res.json() as Promise<CourseRead>
    },
    onSuccess: (data) => {
      getQueryClient().invalidateQueries({
        queryKey: ['courses', { courseId: data.id }],
      })
    },
  })

const invalidateCourseQueries = () => {
  getQueryClient().invalidateQueries({ queryKey: ['courses'] })
}

export const useUploadLessonAttachment = () =>
  useMutation({
    mutationFn: async ({ lessonId, file }: { lessonId: string; file: File }) => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/lessons/${lessonId}/attachments`,
        { method: 'POST', body: form, credentials: 'include' },
      )
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`API ${res.status}: ${text}`)
      }
      return res.json() as Promise<CourseLessonRead>
    },
    onSuccess: invalidateCourseQueries,
  })

export const useDeleteLessonAttachment = () =>
  useMutation({
    mutationFn: ({
      lessonId,
      attachmentId,
    }: {
      lessonId: string
      attachmentId: string
    }) =>
      courseApiFetch<CourseLessonRead>(
        `/v1/courses/lessons/${lessonId}/attachments/${attachmentId}`,
        { method: 'DELETE' },
      ),
    onSuccess: invalidateCourseQueries,
  })

export type QuizAttemptResult = {
  score: number
  passed: boolean
  passing_grade: number
  total_questions: number
  correct_count: number
  answers: {
    question_id: string
    correct: boolean
    correct_option_ids: string[]
    explanations: Record<string, string>
  }[]
}

export const useSubmitQuizAttempt = (
  token: string | null | undefined,
  courseId: string | undefined,
) =>
  useMutation({
    mutationFn: ({
      lessonId,
      answers,
    }: {
      lessonId: string
      answers: { question_id: string; selected_option_ids: string[] }[]
    }) =>
      portalApiFetch<QuizAttemptResult>(
        `/v1/customer-portal/courses/${courseId}/lessons/${lessonId}/quiz-attempt`,
        token!,
        { method: 'POST', body: JSON.stringify({ answers }) },
      ),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['customer-courses', token, courseId],
      })
    },
  })

export const useMarkLessonComplete = (
  token: string | null | undefined,
  courseId: string | undefined,
) =>
  useMutation({
    mutationFn: (lessonId: string) =>
      portalApiFetch<void>(
        `/v1/customer-portal/courses/${courseId}/lessons/${lessonId}/complete`,
        token!,
        { method: 'POST' },
      ),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['customer-courses', token, courseId],
      })
    },
  })

// --- Lesson comments (customer portal) ---

export type LessonCommentRead = {
  id: string
  lesson_id: string
  parent_id: string | null
  content: string
  created_at: string
  is_own: boolean
  author: { enrollment_id: string; name: string | null }
}

export const useLessonComments = (
  token: string | null | undefined,
  courseId: string | undefined,
  lessonId: string | null | undefined,
) =>
  useQuery<LessonCommentRead[]>({
    queryKey: ['lesson-comments', token, courseId, lessonId],
    queryFn: () =>
      portalApiFetch<LessonCommentRead[]>(
        `/v1/customer-portal/courses/${courseId}/lessons/${lessonId}/comments`,
        token!,
      ),
    enabled: !!token && !!courseId && !!lessonId,
  })

export const useCreateLessonComment = (
  token: string | null | undefined,
  courseId: string | undefined,
  lessonId: string | null | undefined,
) =>
  useMutation({
    mutationFn: (body: { content: string; parent_id?: string | null }) =>
      portalApiFetch<LessonCommentRead>(
        `/v1/customer-portal/courses/${courseId}/lessons/${lessonId}/comments`,
        token!,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['lesson-comments', token, courseId, lessonId],
      })
    },
  })

export const useDeleteLessonComment = (
  token: string | null | undefined,
  courseId: string | undefined,
  lessonId: string | null | undefined,
) =>
  useMutation({
    mutationFn: (commentId: string) =>
      portalApiFetch<void>(
        `/v1/customer-portal/courses/${courseId}/lessons/${lessonId}/comments/${commentId}`,
        token!,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['lesson-comments', token, courseId, lessonId],
      })
    },
  })
