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
  thumbnail_object_position: string | null
  description?: string | null
  comments_mode?: 'visible' | 'hidden' | 'locked'
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

export type CourseFormat = 'course' | 'series'

// Series-only "Episode Sample" block configuration. The creator picks one
// lesson and a window inside it (start_seconds + duration_seconds), and
// the public landing renders an auto-play-on-scroll sub-hero clip of that
// window. duration_seconds is enforced server-side to 5–180s.
//
// On the public landing endpoint, the same payload is enriched with the
// lesson's playback data (mux_playback_id, signed url, title, poster) so
// the player doesn't have to look the lesson up in flatLessons — public
// lessons that aren't free-preview strip their mux_* fields, but the
// sample intentionally bypasses that gate since it's a marketing slice.
export type CourseSample = {
  enabled: boolean
  lesson_id: string
  start_seconds: number
  duration_seconds: number
  // Public-landing-only fields. Absent in dashboard reads — the editor
  // already has full lesson data via course.modules[].lessons.
  lesson_title?: string | null
  thumbnail_url?: string | null
  mux_playback_id?: string | null
  mux_playback_url?: string | null
}

export type CourseRead = {
  id: string
  product_id: string
  organization_id: string
  title: string | null
  slug: string | null
  course_type: string
  format: CourseFormat
  paywall_enabled: boolean
  paywall_lesson_id: string | null
  paywall_position: number | null
  ai_generated: boolean
  description: string | null
  thumbnail_url: string | null
  thumbnail_object_position: string | null
  instructor_name: string | null
  instructor_bio: string | null
  trailer_url: string | null
  instructor_name_italic: boolean
  instructor_name_bold: boolean
  instructor_name_uppercase: boolean
  landing_overrides: LandingOverrides | null
  sample: CourseSample | null
  modules: CourseModuleRead[]
  created_at: string
  modified_at: string | null
}

export type LandingMediaKind = 'image' | 'video'
export type LandingMedia = {
  kind: LandingMediaKind
  url: string
  name?: string
  /**
   * CSS object-position string (e.g. "50% 30%") used when the media is
   * rendered with object-fit: cover. Persisted on the media slot so the
   * same crop applies wherever the slot is shown — landing, mobile view,
   * customer portal.
   */
  objectPosition?: string
}

export type LandingTheme = {
  fontHeading: string
  fontBody: string
  accentId: string
  surfaceId: string
  typeScale: number
  headingWeight: number
  bodyWeight: number
  headingItalic: boolean
  headingAlign: 'left' | 'center' | 'right'
  headingTracking: number
  headingLeading: number
  density: 'compact' | 'comfortable' | 'spacious'
  cornerStyle: 'sharp' | 'rounded' | 'pill'
}

export type LandingOverrides = {
  text?: Record<string, string>
  media?: Record<string, LandingMedia | null>
  visible?: Record<string, boolean>
  order?: string[]
  theme?: Partial<LandingTheme>
  // The full AI-generated landing payload, stored here so the human-facing
  // description stays clean.
  ai_landing?: Record<string, unknown> | null
}

async function courseApiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
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
            l.mux_upload_id && (!l.mux_playback_id || l.mux_status !== 'ready'),
        ),
      )
      return hasPendingMux ? 5000 : false
    },
  })

export const useCourseByProduct = (productId: string | undefined) =>
  useQuery<CourseRead>({
    queryKey: ['courses', { productId }],
    queryFn: () =>
      courseApiFetch<CourseRead>(`/v1/courses/product/${productId}`),
    enabled: !!productId,
  })

export const useOrganizationCourses = (organizationId: string | undefined) =>
  useQuery<CourseRead[]>({
    queryKey: ['courses', { organizationId }],
    queryFn: () =>
      courseApiFetch<CourseRead[]>(
        `/v1/courses/organization/${organizationId}`,
      ),
    enabled: !!organizationId,
  })

export const useCreateCourse = () =>
  useMutation({
    mutationFn: (body: {
      product_id: string
      organization_id: string
      title?: string | null
      course_type?: string
      format?: CourseFormat
      paywall_enabled?: boolean
      ai_generated?: boolean
      description?: string | null
      thumbnail_url?: string | null
      thumbnail_object_position?: string | null
      instructor_name?: string | null
      instructor_bio?: string | null
      trailer_url?: string | null
      instructor_name_italic?: boolean
      instructor_name_bold?: boolean
      instructor_name_uppercase?: boolean
      modules: {
        title: string
        description?: string | null
        position: number
        lessons: {
          title: string
          content_type: string
          position: number
          // Pre-staged uploads from the wizard: when the user picked a
          // file before the lesson row existed we already started the
          // upload, and pass the resulting identifiers here so the
          // lesson is created already pointing at them.
          mux_upload_id?: string | null
          thumbnail_url?: string | null
          description?: string | null
        }[]
      }[]
    }) =>
      courseApiFetch<CourseRead>('/v1/courses/', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
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
        format?: CourseFormat
        paywall_enabled?: boolean
        paywall_position?: number | null
        description?: string | null
        thumbnail_url?: string | null
        thumbnail_object_position?: string | null
        instructor_name?: string | null
        instructor_bio?: string | null
        trailer_url?: string | null
        instructor_name_italic?: boolean
        instructor_name_bold?: boolean
        instructor_name_uppercase?: boolean
        landing_overrides?: LandingOverrides | null
        sample?: CourseSample | null
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
      courseApiFetch<void>(`/v1/courses/modules/${moduleId}`, {
        method: 'DELETE',
      }),
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
      courseApiFetch<CourseLessonRead>(
        `/v1/courses/modules/${moduleId}/lessons`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      ),
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
        thumbnail_url?: string | null
        thumbnail_object_position?: string | null
        comments_mode?: 'visible' | 'hidden' | 'locked'
      }
    }) =>
      courseApiFetch<CourseLessonRead>(`/v1/courses/lessons/${lessonId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: invalidateCourseQueries,
  })

export const useDeleteCourseLesson = () =>
  useMutation({
    mutationFn: (lessonId: string) =>
      courseApiFetch<void>(`/v1/courses/lessons/${lessonId}`, {
        method: 'DELETE',
      }),
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

export type CourseEnrollmentRead = {
  id: string
  customer_id: string
  enrolled_at: string
  customer: {
    id: string
    email: string
    name: string | null
    avatar_url: string | null
  } | null
}

type EnrollmentsListResource = {
  items: CourseEnrollmentRead[]
  pagination: { page: number; total_count: number }
}

export const useCourseEnrollments = (
  courseId: string | undefined,
  options?: { page?: number; limit?: number },
) => {
  const page = options?.page ?? 1
  const limit = options?.limit ?? 50
  return useQuery<EnrollmentsListResource>({
    queryKey: ['course-enrollments', courseId, page, limit],
    queryFn: () =>
      courseApiFetch<EnrollmentsListResource>(
        `/v1/courses/${courseId}/enrollments?page=${page}&limit=${limit}`,
      ),
    enabled: !!courseId,
  })
}

export const useRevokeCourseEnrollment = (courseId: string | undefined) =>
  useMutation({
    mutationFn: (enrollmentId: string) =>
      courseApiFetch<void>(
        `/v1/courses/${courseId}/enrollments/${enrollmentId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['course-enrollments', courseId],
      })
    },
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
    thumbnail_url: string | null
    thumbnail_object_position: string | null
    total_duration_seconds: number
  }
  progress: {
    total_lessons: number
    completed_lessons: number
    completion_percent: number
  }
  completed_at: string | null
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
  mux_playback_url?: string | null
  mux_status: string | null
  thumbnail_url: string | null
  thumbnail_object_position?: string | null
  completed: boolean
  description?: string | null
  comments_mode?: 'visible' | 'hidden' | 'locked'
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
    thumbnail_object_position?: string | null
    instructor_name?: string | null
    instructor_bio?: string | null
    trailer_url?: string | null
    instructor_name_italic?: boolean
    instructor_name_bold?: boolean
    instructor_name_uppercase?: boolean
    course_type: string
    paywall_enabled: boolean
    paywall_position: number | null
    landing_overrides?: LandingOverrides | null
    modules: CustomerModuleRead[]
    lessons?: CustomerLessonRead[]
  }
}

export type CourseLandingLesson = {
  id: string
  module_id?: string
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
  thumbnail_object_position?: string | null
  instructor_name?: string | null
  instructor_bio?: string | null
  trailer_url?: string | null
  instructor_name_italic?: boolean
  instructor_name_bold?: boolean
  instructor_name_uppercase?: boolean
  course_type: string
  lesson_count: number
  total_duration_seconds: number
  lessons: CourseLandingLesson[]
  modules?: {
    id: string
    title: string
    description?: string | null
    position: number
  }[]
  paywall_enabled?: boolean
  paywall_position?: number | null
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
    // Always re-check on mount and refocus so a course bought via a recent
    // checkout shows up immediately after the customer lands back here.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
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
      courseApiFetch<MuxUploadRead>(
        `/v1/courses/lessons/${lessonId}/mux-upload`,
        {
          method: 'POST',
        },
      ),
  })

// Wizard-only: create a Mux direct upload that isn't attached to a lesson
// yet. Returned upload_id later rides on CourseLessonCreate.mux_upload_id
// so the webhook can attach the Mux asset once it finishes processing.
export const useStageMuxUpload = () =>
  useMutation({
    mutationFn: (organizationId: string) =>
      courseApiFetch<MuxUploadRead>(
        `/v1/courses/staging/mux-upload?organization_id=${organizationId}`,
        { method: 'POST' },
      ),
  })

// Wizard-only: upload an image / video to S3 before the course exists.
// Returns {url, kind}; the URL is passed into the course-create payload.
export const useStageOrgMedia = () =>
  useMutation({
    mutationFn: async ({
      organizationId,
      file,
    }: {
      organizationId: string
      file: File
    }) => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/staging/media?organization_id=${organizationId}`,
        { method: 'POST', body: form, credentials: 'include' },
      )
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`API ${res.status}: ${text}`)
      }
      return res.json() as Promise<{ url: string; kind: 'image' | 'video' }>
    },
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
    mutationFn: async ({
      lessonId,
      file,
    }: {
      lessonId: string
      file: File
    }) => {
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
    onSuccess: invalidateCourseQueries,
  })

export const useUploadCourseThumbnail = () =>
  useMutation({
    mutationFn: async ({
      courseId,
      file,
    }: {
      courseId: string
      file: File
    }) => {
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

export const useUploadLandingMedia = () =>
  useMutation({
    mutationFn: async ({
      courseId,
      file,
    }: {
      courseId: string
      file: File
    }) => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/${courseId}/landing-media`,
        { method: 'POST', body: form, credentials: 'include' },
      )
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`API ${res.status}: ${text}`)
      }
      return res.json() as Promise<{ url: string; kind: 'image' | 'video' }>
    },
  })

export const useUploadCourseTrailer = () =>
  useMutation({
    mutationFn: async ({
      courseId,
      file,
    }: {
      courseId: string
      file: File
    }) => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/${courseId}/trailer`,
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
    mutationFn: async ({
      lessonId,
      file,
    }: {
      lessonId: string
      file: File
    }) => {
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
  // Soft-deleted parents come back as tombstones so their replies stay in
  // the tree. The frontend renders them as "Comment deleted" placeholders.
  deleted?: boolean
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

// ── Notes ────────────────────────────────────────────────────────────────

export interface CourseNoteRead {
  id: string
  lesson_id: string
  content: string
  created_at: string
  modified_at: string | null
}

// Single fetch of every note in the course; per-lesson selection happens
// client-side via useLessonNote. Previously each lesson had its own
// query that re-downloaded the whole notes collection on every mount.
const courseNotesQueryKey = (
  token: string | null | undefined,
  courseId: string | undefined,
) => ['course-notes', token, courseId]

export const useCourseNotes = (
  token: string | null | undefined,
  courseId: string | undefined,
) =>
  useQuery<CourseNoteRead[]>({
    queryKey: courseNotesQueryKey(token, courseId),
    queryFn: () =>
      portalApiFetch<CourseNoteRead[]>(
        `/v1/customer-portal/courses/${courseId}/notes`,
        token!,
      ),
    enabled: !!token && !!courseId,
  })

export const useLessonNote = (
  token: string | null | undefined,
  courseId: string | undefined,
  lessonId: string | null | undefined,
) => {
  const { data, isLoading } = useCourseNotes(token, courseId)
  const note =
    data && lessonId ? (data.find((n) => n.lesson_id === lessonId) ?? null) : null
  return { data: data ? note : undefined, isLoading }
}

export const useUpsertLessonNote = (
  token: string | null | undefined,
  courseId: string | undefined,
  lessonId: string | null | undefined,
) =>
  useMutation({
    mutationFn: (content: string) =>
      portalApiFetch<CourseNoteRead>(
        `/v1/customer-portal/courses/${courseId}/lessons/${lessonId}/notes`,
        token!,
        { method: 'PUT', body: JSON.stringify({ content }) },
      ),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: courseNotesQueryKey(token, courseId),
      })
    },
  })
