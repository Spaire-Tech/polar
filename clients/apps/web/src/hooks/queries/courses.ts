import { getQueryClient } from '@/utils/api/query'
import { useMutation, useQuery } from '@tanstack/react-query'

export type CourseLessonRead = {
  id: string
  module_id: string
  title: string
  content_type: string
  content: Record<string, unknown> | null
  video_asset_id: string | null
  duration_seconds: number | null
  position: number
  is_free_preview: boolean
  published: boolean
  mux_upload_id: string | null
  mux_asset_id: string | null
  mux_playback_id: string | null
  mux_status: string | null
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
        content_type?: string
        content?: Record<string, unknown> | null
        video_asset_id?: string | null
        duration_seconds?: number | null
        position?: number
        is_free_preview?: boolean
        published?: boolean
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
  content: { text?: string } | null
  position: number
  duration_seconds: number | null
  is_free_preview: boolean
  mux_playback_id: string | null
  mux_status: string | null
  completed: boolean
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
  progress: CustomerCourseProgress
  course: {
    id: string
    title: string | null
    course_type: string
    paywall_enabled: boolean
    paywall_position: number | null
    modules: CustomerModuleRead[]
  }
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
