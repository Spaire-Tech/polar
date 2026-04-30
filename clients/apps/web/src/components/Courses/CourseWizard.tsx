'use client'

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
  PricingState,
  SpaireOnboardingStyles,
  StepCourse,
  StepInstructor,
  StepPricing,
} from './CourseWizard.steps'
import { outlineSchema } from './schemas'

type WizardStep =
  | 'intro'
  | 'instructor'
  | 'course'
  | 'pricing'
  | 'preview'
  | 'generating'
  | 'outline'
  | 'creating'

type InstructorState = { name: string; bio: string }
type CourseState = { title: string; desc: string }
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
  const [pricing, setPricing] = useState<PricingState>({ isFree: true, amount: 0 })
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
          amount_type: 'free',
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

    // Set product prices based on pricing step
    if (pricing.isFree) {
      form.setValue('prices', [{ amount_type: 'free' }])
    } else {
      form.setValue('prices', [
        {
          amount_type: 'fixed',
          price_amount: Math.round(pricing.amount * 100),
          price_currency: 'usd',
        } as any,
      ])
    }

    form.setValue('name', draft.courseTitle || course.title)
    form.setValue('description', draft.desc || course.desc)

    setScreen('generating')
    submitOutline({
      title: draft.courseTitle || course.title,
      description: draft.desc || course.desc || '',
      targetAudience: '',
    })
  }

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
        paywall_enabled: !pricing.isFree,
        ai_generated: true,
        description: draft.desc || course.desc || null,
        thumbnail_url: null,
        thumbnail_object_position: null,
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
              onNext={() => setScreen('pricing')}
              onBack={() => setScreen('instructor')}
              onClose={handleClose}
            />
          )}
          {screen === 'pricing' && (
            <StepPricing
              data={pricing}
              onChange={setPricing}
              onNext={goPreview}
              onBack={() => setScreen('course')}
              onClose={handleClose}
            />
          )}
          {screen === 'preview' && (
            <LandingPreview
              instructor={instructor}
              course={course}
              pricing={pricing}
              draft={draft}
              setDraft={setDraft}
              editOpen={editOpen}
              setEditOpen={setEditOpen}
              onGenerate={startGeneration}
              onBack={() => setScreen('pricing')}
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
