'use client'

import { Upload } from '@/components/FileUpload/Upload'
import { useCreateCourse, useUpdateCourse } from '@/hooks/queries/courses'
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
  StepMedia,
  StepPricing,
  type PricingState,
} from './CourseWizard.steps'
import { joinLanding } from './landingStorage'
import { landingSchema, outlineSchema } from './schemas'

type WizardStep =
  | 'intro'
  | 'instructor'
  | 'course'
  | 'media'
  | 'pricing'
  | 'generating-outline'
  | 'outline'
  | 'generating-landing'
  | 'preview'
  | 'creating'

type InstructorState = { name: string; bio: string }
type CourseState = { title: string; desc: string }
type DraftState = {
  name: string
  courseTitle: string
  desc: string
  // Italic is permanently off — kept on the type for the create payload only.
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
  const updateCourse = useUpdateCourse()

  const [screen, setScreen] = useState<WizardStep>('intro')
  const [instructor, setInstructor] = useState<InstructorState>({
    name: '',
    bio: '',
  })
  const [course, setCourse] = useState<CourseState>({ title: '', desc: '' })
  const [pricing, setPricing] = useState<PricingState>({
    billing: 'one-time',
    model: 'fixed',
    amount: '',
    interval: 'month',
    intervalCount: 1,
    paywallOn: false,
    paywallPos: 0,
    totalLessons: 20,
  })
  const [pricing, setPricing] = useState<PricingState>({
    paywallEnabled: false,
    billingType: 'one_time',
    recurringInterval: 'month',
    currency: 'usd',
    priceCents: 0,
    freePreviewLessons: 3,
  })
  const [draft, setDraft] = useState<DraftState>({
    name: '',
    courseTitle: '',
    desc: '',
    // Italics removed from the design entirely.
    nameItalic: false,
    nameBold: true,
    nameUppercase: true,
  })
  const [editOpen, setEditOpen] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [thumbPosition, setThumbPosition] = useState<string | null>(null)
  const [uploadedThumbnailUrl, setUploadedThumbnailUrl] = useState<
    string | null
  >(null)

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

  // ── Outline streaming ─────────────────────────────────────────────────────
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
      setScreen('pricing')
    },
  })

  // ── Landing-page streaming ────────────────────────────────────────────────
  const {
    object: partialLanding,
    submit: submitLanding,
    isLoading: isLandingStreaming,
    error: landingError,
    stop: stopLanding,
  } = useObject({
    api: `/dashboard/${organization.slug}/courses/landing`,
    schema: landingSchema,
    onFinish: () => setScreen('preview'),
    onError: () => {
      // Non-fatal — drop the user into the preview anyway with placeholders.
      setScreen('preview')
    },
  })

  const handleClose = () => {
    stopOutline()
    stopLanding()
    router.push(`/dashboard/${organization.slug}/products`)
  }

  // Outline submission — happens after pricing step.
  const startOutlineGeneration = async () => {
    setGenerateError(null)

    // Upload thumbnail in the background while the outline streams.
    if (media.thumbFile) {
      uploadCourseThumbnail(organization, media.thumbFile).then((url) => {
        if (url) setUploadedThumbnailUrl(url)
      })
    }

    form.setValue('name', draft.courseTitle || course.title)
    form.setValue('description', draft.desc || course.desc)

    setScreen('generating-outline')
    submitOutline({
      title: draft.courseTitle || course.title,
      description: draft.desc || course.desc || '',
      targetAudience: '',
      instructorName: instructor.name || null,
      instructorBio: instructor.bio || null,
      paywallEnabled: pricing.paywallEnabled,
      freePreviewLessons: pricing.paywallEnabled
        ? pricing.freePreviewLessons
        : null,
    })
  }

  // Landing submission — kicked off from the outline screen.
  const startLandingGeneration = () => {
    const outline = partialOutline as PartialOutline | undefined
    const lessonCount =
      outline?.modules?.reduce(
        (acc, m) => acc + (m?.lessons?.length ?? 0),
        0,
      ) ?? 0
    setScreen('generating-landing')
    submitLanding({
      title: draft.courseTitle || course.title,
      description: draft.desc || course.desc || '',
      instructorName: instructor.name || null,
      instructorBio: instructor.bio || null,
      moduleCount: outline?.modules?.length ?? 0,
      lessonCount,
      paywallEnabled: pricing.paywallEnabled,
      freePreviewLessons: pricing.paywallEnabled
        ? pricing.freePreviewLessons
        : null,
      billingType: pricing.paywallEnabled ? pricing.billingType : null,
      recurringInterval:
        pricing.paywallEnabled && pricing.billingType === 'subscription'
          ? pricing.recurringInterval
          : null,
    })
  }

  const finalizeCourse = async () => {
    const outline = partialOutline as PartialOutline | undefined
    if (!outline?.modules?.length) return
    setScreen('creating')

    try {
      // If the thumbnail wasn't uploaded yet (small image, but slow link),
      // wait on it now.
      let thumbnailUrl = uploadedThumbnailUrl
      if (!thumbnailUrl && media.thumbFile) {
        thumbnailUrl = await uploadCourseThumbnail(
          organization,
          media.thumbFile,
        )
      }

      // Wire pricing into the product before creation.
      if (pricing.paywallEnabled && pricing.priceCents > 0) {
        form.setValue('prices', [
          {
            amount_type: 'fixed',
            price_amount: pricing.priceCents,
            price_currency: pricing.currency,
          } as schemas['ProductCreate']['prices'][number],
        ])
        form.setValue(
          'recurring_interval',
          pricing.billingType === 'subscription'
            ? pricing.recurringInterval
            : null,
        )
      } else {
        form.setValue('prices', [
          { amount_type: 'free', price_currency: pricing.currency },
        ] as schemas['ProductCreate']['prices'])
        form.setValue('recurring_interval', null)
      }

      const formValues = form.getValues()
      const { full_medias, metadata, ...rest } = formValues
      const mediaIds = full_medias.map((m) => m.id)

      // The AI-generated landing payload is persisted onto the COURSE's
      // description field via a sentinel marker (see `joinLanding` below).
      // Product metadata can't carry it because each metadata value is capped
      // at 500 chars by the backend.
      const landingForStorage = {
        ...(partialLanding as object | null | undefined),
        // Snapshot the editable surface bits the user might have changed in
        // the preview (instructor name, course title, description) so the
        // saved landing matches what they saw.
        editable: {
          instructorName: draft.name || instructor.name || null,
          courseTitle: draft.courseTitle || course.title || null,
          description: draft.desc || course.desc || null,
        },
      }

      const productResult = await createProduct.mutateAsync({
        ...rest,
        name: draft.courseTitle || course.title || 'Untitled Course',
        description: draft.desc || course.desc || null,
        medias: mediaIds,
        metadata: metadata.reduce<Record<string, string | number | boolean>>(
          (acc, { key, value }) => ({ ...acc, [key]: value }),
          {},
        ),
      } as schemas['ProductCreate'])

      if (productResult.error || !productResult.data) {
        console.error(
          '[CourseWizard] product creation error:',
          JSON.stringify(productResult.error),
        )
        throw new Error(
          `Product creation failed: ${JSON.stringify(productResult.error)}`,
        )
      }

      const totalLessons =
        outline.modules?.reduce(
          (acc, m) => acc + (m?.lessons?.length ?? 0),
          0,
        ) ?? 0
      const paywallPosition = pricing.paywallEnabled
        ? Math.max(0, Math.min(totalLessons, pricing.freePreviewLessons))
        : null

      const humanDescription = draft.desc || course.desc || null
      const courseDescriptionWithLanding = joinLanding(
        humanDescription,
        landingForStorage,
      )

      const created = await createCourse.mutateAsync({
        product_id: productResult.data.id,
        organization_id: organization.id,
        title: draft.courseTitle || course.title || 'Untitled Course',
        course_type: 'evergreen',
        paywall_enabled: pricing.paywallEnabled,
        ai_generated: true,
        description: courseDescriptionWithLanding,
        thumbnail_url: thumbnailUrl,
        thumbnail_object_position: thumbPosition,
        instructor_name: draft.name || instructor.name || null,
        instructor_bio: instructor.bio || null,
        instructor_name_italic: false,
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

      // The create endpoint doesn't accept paywall_position; patch it in
      // immediately after if the wizard collected one.
      if (pricing.paywallEnabled && paywallPosition !== null) {
        try {
          await updateCourse.mutateAsync({
            courseId: created.id,
            body: { paywall_position: paywallPosition },
          })
        } catch (e) {
          console.warn('[CourseWizard] paywall_position patch failed:', e)
        }
      }

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
      setScreen('preview')
    }
  }

  const goPricing = () => {
    setDraft((d) => ({
      ...d,
      name: d.name || instructor.name,
      courseTitle: d.courseTitle || course.title,
      desc: d.desc || course.desc || instructor.bio,
    }))
    setScreen('pricing')
  }

  const partialOutlineSafe = (partialOutline as PartialOutline) ?? {
    modules: [],
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
          {screen === 'media' && (
            <StepMedia
              data={media}
              onChange={setMedia}
              onNext={goPricing}
              onBack={() => setScreen('course')}
              onClose={handleClose}
            />
          )}
          {screen === 'pricing' && (
            <StepPricing
              data={pricing}
              onChange={setPricing}
              onNext={startOutlineGeneration}
              onBack={() => setScreen('media')}
              onClose={handleClose}
            />
          )}
          {screen === 'generating-outline' && (
            <GeneratingScreen
              title={draft.courseTitle || course.title}
              modulesCount={partialOutlineSafe.modules?.length ?? 0}
              lessonsCount={
                partialOutlineSafe.modules?.reduce(
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
              partialOutline={partialOutlineSafe}
              isStreaming={isOutlineStreaming}
              error={outlineError ? 'Failed to generate outline.' : null}
              onRegenerate={() => {
                stopOutline()
                setScreen('pricing')
              }}
              onCreate={startLandingGeneration}
              onClose={handleClose}
            />
          )}
          {screen === 'generating-landing' && (
            <GeneratingScreen
              title={draft.courseTitle || course.title}
              modulesCount={partialOutlineSafe.modules?.length ?? 0}
              lessonsCount={
                partialOutlineSafe.modules?.reduce(
                  (acc, m) => acc + (m?.lessons?.length ?? 0),
                  0,
                ) ?? 0
              }
              onClose={handleClose}
              phase="landing"
            />
          )}
          {screen === 'preview' && (
            <LandingPreview
              instructor={instructor}
              course={course}
              media={media}
              draft={draft}
              setDraft={setDraft}
              pricing={pricing}
              thumbPosition={thumbPosition}
              onThumbPositionChange={setThumbPosition}
              onMediaChange={setMedia}
              outline={partialOutlineSafe}
              landing={(partialLanding as Record<string, unknown>) ?? {}}
              isLandingStreaming={isLandingStreaming}
              totalDurationSeconds={0}
              editOpen={editOpen}
              setEditOpen={setEditOpen}
              onCreate={finalizeCourse}
              onBack={() => setScreen('outline')}
              onClose={handleClose}
              error={
                generateError ??
                (landingError ? 'Landing generation failed.' : null)
              }
            />
          )}
          {screen === 'creating' && <CreatingScreen onClose={handleClose} />}
        </div>
      </form>
    </Form>
  )
}
