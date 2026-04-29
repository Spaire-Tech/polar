'use client'

import { Upload } from '@/components/FileUpload/Upload'
import { useCreateCourse } from '@/hooks/queries/courses'
import { useCreateProduct } from '@/hooks/queries/products'
import { ProductEditOrCreateForm } from '@/utils/product'
import { experimental_useObject as useObject } from '@ai-sdk/react'
import { schemas } from '@spaire/client'
import { Form } from '@spaire/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import { OutlineScreen } from './CourseWizard.outline'
import { LandingPreview } from './CourseWizard.preview'
import { CreatingScreen, GeneratingScreen } from './CourseWizard.status'
import {
  Intro,
  SpaireOnboardingStyles,
  StepCourse,
  StepInstructor,
  StepMedia,
} from './CourseWizard.steps'
import { outlineSchema } from './schemas'

type WizardStep =
  | 'intro'
  | 'instructor'
  | 'course'
  | 'media'
  | 'preview'
  | 'generating'
  | 'outline'
  | 'creating'

type InstructorState = { name: string; bio: string }
type CourseState = { title: string; desc: string }
type MediaFormat = 'thumbnail' | 'trailer' | null
type MediaState = {
  format: MediaFormat
  thumbFile: File | null
  thumbName: string
  videoFile: File | null
  videoName: string
}
type DraftState = {
  name: string
  courseTitle: string
  desc: string
  nameItalic: boolean
  nameBold: boolean
  nameUppercase: boolean
}

type PartialModule = {
  title?: string
  description?: string
  lessons?: { title?: string; content_type?: 'text' | 'video' }[]
}
type PartialOutline = { modules?: PartialModule[] }

function uploadCourseThumbnail(
  organization: schemas['Organization'],
  file: File,
): Promise<string | null> {
  return new Promise((resolve) => {
    const upload = new Upload({
      organization,
      service: 'organization_avatar',
      file,
      onFileProcessing: () => {},
      onFileCreate: () => {},
      onFileUploadProgress: () => {},
      onFileUploaded: (response) => {
        resolve(
          (response as schemas['OrganizationAvatarFileRead']).public_url ??
            null,
        )
      },
      onFileError: () => resolve(null),
    })
    upload.run()
  })
}

// ─── Main wizard ─────────────────────────────────────────────────────────────

export default function CourseWizard({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const createProduct = useCreateProduct(organization)
  const createCourse = useCreateCourse()

  const [screen, setScreen] = useState<WizardStep>('intro')
  const [instructor, setInstructor] = useState<InstructorState>({
    name: '',
    bio: '',
  })
  const [course, setCourse] = useState<CourseState>({ title: '', desc: '' })
  const [media, setMedia] = useState<MediaState>({
    format: null,
    thumbFile: null,
    thumbName: '',
    videoFile: null,
    videoName: '',
  })
  const [draft, setDraft] = useState<DraftState>({
    name: '',
    courseTitle: '',
    desc: '',
    nameItalic: true,
    nameBold: true,
    nameUppercase: true,
  })
  const [editOpen, setEditOpen] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const form = useForm<ProductEditOrCreateForm>({
    defaultValues: {
      name: '',
      description: '',
      recurring_interval: null,
      visibility: 'public',
      prices: [
        {
          amount_type: 'fixed',
          price_amount: 0,
          price_currency: organization.default_presentment_currency,
        },
      ],
      medias: [],
      full_medias: [],
      organization_id: organization.id,
      metadata: [],
    },
  })

  const {
    object: partialOutline,
    submit: submitOutline,
    isLoading: isOutlineStreaming,
    error: outlineError,
    stop: stopOutline,
  } = useObject({
    api: `/dashboard/${organization.slug}/courses/outline`,
    schema: outlineSchema,
    onFinish: () => setScreen('outline'),
    onError: () => {
      setGenerateError('Failed to generate outline. Please try again.')
      setScreen('preview')
    },
  })

  const handleClose = () => {
    stopOutline()
    router.push(`/dashboard/${organization.slug}/products`)
  }

  const startGeneration = async () => {
    setGenerateError(null)

    // Upload thumbnail before generation if needed
    let thumbnailUrl: string | null = null
    if (media.thumbFile) {
      thumbnailUrl = await uploadCourseThumbnail(organization, media.thumbFile)
    }
    form.setValue('name', draft.courseTitle || course.title)
    form.setValue('description', draft.desc || course.desc)

    setScreen('generating')
    submitOutline({
      title: draft.courseTitle || course.title,
      description: draft.desc || course.desc || '',
      targetAudience: '',
    })
    // Stash thumbnail URL via state for finalize
    setUploadedThumbnailUrl(thumbnailUrl)
  }

  const [uploadedThumbnailUrl, setUploadedThumbnailUrl] = useState<
    string | null
  >(null)

  const finalizeCourse = async () => {
    const outline = partialOutline as PartialOutline | undefined
    if (!outline?.modules?.length) return
    setScreen('creating')

    try {
      const formValues = form.getValues()
      const { full_medias, metadata, ...rest } = formValues
      const mediaIds = full_medias.map((m) => m.id)

      const productResult = await createProduct.mutateAsync({
        ...rest,
        name: draft.courseTitle || course.title || 'Untitled Course',
        description: draft.desc || course.desc || null,
        medias: mediaIds,
        metadata: metadata.reduce(
          (acc, { key, value }) => ({ ...acc, [key]: value }),
          {},
        ),
      } as schemas['ProductCreate'])

      if (productResult.error || !productResult.data) {
        console.error('[CourseWizard] product creation error:', JSON.stringify(productResult.error))
        throw new Error(`Product creation failed: ${JSON.stringify(productResult.error)}`)
      }

      const created = await createCourse.mutateAsync({
        product_id: productResult.data.id,
        organization_id: organization.id,
        title: draft.courseTitle || course.title || 'Untitled Course',
        course_type: 'evergreen',
        paywall_enabled: false,
        ai_generated: true,
        description: draft.desc || course.desc || null,
        thumbnail_url: uploadedThumbnailUrl,
        instructor_name: draft.name || instructor.name || null,
        instructor_bio: instructor.bio || null,
        instructor_name_italic: draft.nameItalic,
        instructor_name_bold: draft.nameBold,
        instructor_name_uppercase: draft.nameUppercase,
        modules: outline.modules
          .filter(
            (
              m,
            ): m is {
              title: string
              description?: string
              lessons?: { title?: string; content_type?: 'text' | 'video' }[]
            } => Boolean(m?.title),
          )
          .map((mod, i) => ({
            title: mod.title!,
            description: mod.description ?? null,
            position: i,
            lessons: (mod.lessons ?? [])
              .filter(
                (l): l is { title: string; content_type: 'text' | 'video' } =>
                  Boolean(l?.title && l?.content_type),
              )
              .map((lesson, j) => ({
                title: lesson.title,
                content_type: lesson.content_type,
                position: j,
              })),
          })),
      })

      toast({
        title: 'Course Created',
        description: `"${draft.courseTitle || course.title}" is ready to edit`,
      })
      router.replace(`/dashboard/${organization.slug}/courses/${created.id}`)
    } catch (err) {
      console.error('[CourseWizard] create error:', err)
      toast({
        title: 'Something went wrong',
        description: 'Could not create the course. Please try again.',
      })
      setScreen('outline')
    }
  }

  const goPreview = () => {
    setDraft((d) => ({
      ...d,
      name: d.name || instructor.name,
      courseTitle: d.courseTitle || course.title,
      desc: d.desc || course.desc || instructor.bio,
    }))
    setScreen('preview')
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => e.preventDefault()}
        className="spaire-onboarding"
        style={{ minHeight: '100vh' }}
      >
        <SpaireOnboardingStyles />
        <div className="spaire-shell">
          {screen === 'intro' && (
            <Intro
              onNext={() => setScreen('instructor')}
              onClose={handleClose}
            />
          )}
          {screen === 'instructor' && (
            <StepInstructor
              data={instructor}
              onChange={setInstructor}
              onNext={() => setScreen('course')}
              onBack={() => setScreen('intro')}
              onClose={handleClose}
            />
          )}
          {screen === 'course' && (
            <StepCourse
              data={course}
              onChange={setCourse}
              onNext={() => setScreen('media')}
              onBack={() => setScreen('instructor')}
              onClose={handleClose}
            />
          )}
          {screen === 'media' && (
            <StepMedia
              data={media}
              onChange={setMedia}
              onNext={goPreview}
              onBack={() => setScreen('course')}
              onClose={handleClose}
            />
          )}
          {screen === 'preview' && (
            <LandingPreview
              instructor={instructor}
              course={course}
              media={media}
              draft={draft}
              setDraft={setDraft}
              editOpen={editOpen}
              setEditOpen={setEditOpen}
              onGenerate={startGeneration}
              onBack={() => setScreen('media')}
              onClose={handleClose}
              error={generateError}
            />
          )}
          {screen === 'generating' && (
            <GeneratingScreen
              title={draft.courseTitle || course.title}
              modulesCount={
                (partialOutline as PartialOutline)?.modules?.length ?? 0
              }
              lessonsCount={
                (partialOutline as PartialOutline)?.modules?.reduce(
                  (acc, m) => acc + (m?.lessons?.length ?? 0),
                  0,
                ) ?? 0
              }
              onClose={handleClose}
            />
          )}
          {screen === 'outline' && (
            <OutlineScreen
              title={draft.courseTitle || course.title}
              partialOutline={
                (partialOutline as PartialOutline) ?? { modules: [] }
              }
              isStreaming={isOutlineStreaming}
              error={outlineError ? 'Failed to generate outline.' : null}
              onRegenerate={() => {
                stopOutline()
                setScreen('preview')
              }}
              onCreate={finalizeCourse}
              onClose={handleClose}
            />
          )}
          {screen === 'creating' && <CreatingScreen onClose={handleClose} />}
        </div>
      </form>
    </Form>
  )
}
