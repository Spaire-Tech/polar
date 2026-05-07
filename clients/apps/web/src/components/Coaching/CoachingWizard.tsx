'use client'

// Coaching wizard. Forked from CourseWizard rather than threaded through
// it because the steps and AI streams diverge enough that branching every
// internal decision turns the orchestrator into spaghetti.
//
// Flow: intro → coach → program → schedule → pricing → generating-curriculum
//        → curriculum → generating-landing → preview → creating
//
// This commit (commit 3) lands the skeleton + step plumbing + curriculum
// streaming. Finalization is a stub — commit 4 wires it to product/course/
// event creation.

import {
  Intro,
  SpaireOnboardingStyles,
} from '@/components/Courses/CourseWizard.steps'
import {
  CreatingScreen,
  GeneratingScreen,
} from '@/components/Courses/CourseWizard.status'
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

// One-shot create-event call. The hooks file's useCreateCoachingEvent is
// per-courseId for cache invalidation; during the wizard we don't have a
// courseId until just before the call, and we don't need invalidation
// because the dashboard re-fetches when it opens. Direct fetch keeps the
// finalize loop simple.
async function createCoachingEvent(body: {
  course_id: string
  title: string
  description?: string | null
  starts_at: string
  duration_minutes: number
  timezone?: string | null
}): Promise<void> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/v1/coaching/events`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Create event failed (${res.status}): ${text}`)
  }
}
import {
  CurriculumScreen,
  type PartialCurriculum,
} from './CoachingWizard.curriculum'
import {
  computeSessionDatetimes,
  defaultScheduleState,
  StepCoach,
  StepProgram,
  StepPricingCoaching,
  StepSchedule,
  type CoachState,
  type ProgramState,
  type ScheduleState,
} from './CoachingWizard.steps'
import {
  coachingLandingSchema,
  curriculumSchema,
  type CoachingLanding,
} from './schemas'

type WizardStep =
  | 'intro'
  | 'coach'
  | 'program'
  | 'schedule'
  | 'pricing'
  | 'generating-curriculum'
  | 'curriculum'
  | 'generating-landing'
  | 'preview'
  | 'creating'

export default function CoachingWizard({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const createProduct = useCreateProduct(organization)
  const createCourse = useCreateCourse()
  const [screen, setScreen] = useState<WizardStep>('intro')

  const [coach, setCoach] = useState<CoachState>({
    name: organization.name ?? '',
    bio: '',
    focus: '',
  })
  const [program, setProgram] = useState<ProgramState>({
    title: '',
    transformation: '',
    audience: '',
    weeks: 8,
  })
  const [schedule, setSchedule] = useState<ScheduleState>(
    defaultScheduleState(),
  )

  const defaultCurrency = organization.default_presentment_currency ?? 'usd'
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
          price_currency: defaultCurrency,
        } as schemas['ProductCreate']['prices'][number],
      ],
      medias: [],
      full_medias: [],
      organization_id: organization.id,
      metadata: [],
    },
  })

  // ── Curriculum streaming ────────────────────────────────────────────────
  const {
    object: partialCurriculum,
    submit: submitCurriculum,
    isLoading: isCurriculumStreaming,
    error: curriculumError,
    stop: stopCurriculum,
  } = useObject({
    api: `/dashboard/${organization.slug}/coaching/curriculum`,
    schema: curriculumSchema,
    onFinish: () => setScreen('curriculum'),
    onError: () => setScreen('pricing'),
  })

  // ── Landing streaming ───────────────────────────────────────────────────
  const {
    object: partialLanding,
    submit: submitLanding,
    isLoading: isLandingStreaming,
    stop: stopLanding,
  } = useObject({
    api: `/dashboard/${organization.slug}/coaching/landing`,
    schema: coachingLandingSchema,
    onFinish: () => setScreen('preview'),
    onError: () => setScreen('preview'), // non-fatal, fall through
  })

  const handleClose = () => {
    stopCurriculum()
    stopLanding()
    router.push(`/dashboard/${organization.slug}/products`)
  }

  const startCurriculumGeneration = () => {
    form.setValue('name', program.title)
    form.setValue('description', program.transformation)
    setScreen('generating-curriculum')
    submitCurriculum({
      title: program.title,
      transformation: program.transformation,
      audience: program.audience,
      weeks: program.weeks,
      coachName: coach.name || null,
      coachBio: coach.bio || null,
      coachingFocus: coach.focus || null,
    })
  }

  const startLandingGeneration = () => {
    setScreen('generating-landing')
    const sessions = computeSessionDatetimes(schedule, program.weeks)
    submitLanding({
      title: program.title,
      transformation: program.transformation,
      audience: program.audience,
      weeks: program.weeks,
      startsAt: sessions[0] ?? null,
      sessionCadence: `Weekly, ${schedule.durationMinutes} min`,
      coachName: coach.name || null,
      coachBio: coach.bio || null,
      coachingFocus: coach.focus || null,
      // Defaults for v1: every coaching program gets community on +
      // intake form available (the IntakeTab in the dashboard lets the
      // coach configure or skip it).
      communityEnabled: true,
      hasIntake: false,
    })
  }

  const finalizeProgram = async () => {
    const curriculum = (partialCurriculum as PartialCurriculum) ?? { weeks: [] }
    if (!curriculum.weeks || curriculum.weeks.length === 0) {
      toast({
        title: 'Cannot create program yet',
        description: 'Curriculum is still empty.',
      })
      return
    }

    setScreen('creating')
    try {
      // 1) Create the product (pricing primitives live on the form).
      const formValues = form.getValues()
      const { full_medias, metadata, ...rest } = formValues
      const mediaIds = full_medias.map((m) => m.id)
      const productResult = await createProduct.mutateAsync({
        ...rest,
        name: program.title || 'Untitled Program',
        description: program.transformation || null,
        medias: mediaIds,
        metadata: metadata.reduce<Record<string, string | number | boolean>>(
          (acc, { key, value }) => ({ ...acc, [key]: value }),
          {},
        ),
      } as schemas['ProductCreate'])

      if (productResult.error || !productResult.data) {
        throw new Error(
          `Product creation failed: ${JSON.stringify(productResult.error)}`,
        )
      }
      const productId = productResult.data.id

      // 2) Flatten the AI's per-week module list into a single Modules
      //    array on the course. Pre-recorded prep is grouped by week so
      //    the merchant can find it later in the Modules tab.
      type WizardWeek = NonNullable<PartialCurriculum['weeks']>[number]
      const cleanWeeks: WizardWeek[] = (curriculum.weeks ?? []).filter(
        (w): w is WizardWeek => Boolean(w?.title),
      )
      let modulePos = 0
      const modules = cleanWeeks.flatMap((week) =>
        (week.modules ?? [])
          .filter((m): m is NonNullable<typeof m> => Boolean(m?.title))
          .map((mod) => ({
            title: `Week ${week.number ?? '?'} — ${mod.title}`,
            description: mod.description ?? null,
            position: modulePos++,
            lessons: (mod.lessons ?? [])
              .filter(
                (
                  l,
                ): l is { title: string; content_type: 'text' | 'video' } =>
                  Boolean(l?.title && l?.content_type),
              )
              .map((lesson, j) => ({
                title: lesson.title,
                content_type: lesson.content_type,
                position: j,
              })),
          })),
      )

      // 3) Create the coaching-format course. Server-side this also
      //    creates the default cohort (M2 wiring) and we get
      //    program_format='coaching' + community_enabled=true.
      const created = await createCourse.mutateAsync({
        product_id: productId,
        organization_id: organization.id,
        title: program.title || 'Untitled Program',
        course_type: 'evergreen',
        program_format: 'coaching',
        ai_generated: true,
        description: program.transformation || null,
        instructor_name: coach.name || null,
        instructor_bio: coach.bio || null,
        instructor_name_italic: false,
        instructor_name_bold: true,
        instructor_name_uppercase: true,
        modules,
      })

      // 4) Create one CoachingEvent per scheduled session. We don't
      //    block on these — if a single create fails we log and keep
      //    going so the program still lands; the merchant can recreate
      //    individual events from the Events tab.
      const sessions = computeSessionDatetimes(schedule, program.weeks)
      const sessionsByWeek = new Map<number, WizardWeek>()
      cleanWeeks.forEach((w, i) => sessionsByWeek.set(w.number ?? i + 1, w))
      for (let i = 0; i < sessions.length; i++) {
        const week = sessionsByWeek.get(i + 1)
        const session = week?.session
        const title = session?.title || `Week ${i + 1} live call`
        const talkingPoints = (session?.talking_points ?? []).filter(
          (p): p is string => typeof p === 'string',
        )
        const description = talkingPoints.length
          ? talkingPoints.map((p) => `• ${p}`).join('\n')
          : null
        try {
          await createCoachingEvent({
            course_id: created.id,
            title,
            description,
            starts_at: sessions[i]!,
            duration_minutes: schedule.durationMinutes,
            timezone: schedule.timezone,
          })
        } catch (e) {
          console.warn(
            '[CoachingWizard] event create failed (continuing):',
            i,
            e,
          )
        }
      }

      toast({
        title: 'Coaching program created',
        description: `${sessions.length} live calls scheduled.`,
      })
      router.replace(
        `/dashboard/${organization.slug}/courses/${created.id}?tab=events`,
      )
    } catch (err) {
      console.error('[CoachingWizard] create error:', err)
      toast({
        title: 'Something went wrong',
        description: 'Could not create the program. Please try again.',
      })
      setScreen('preview')
    }
  }

  const partialCurr = (partialCurriculum as PartialCurriculum) ?? {
    weeks: [],
  }
  const _partialLanding = partialLanding as Partial<CoachingLanding> | null

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
              onNext={() => setScreen('coach')}
              onClose={handleClose}
              programFormat="coaching"
            />
          )}
          {screen === 'coach' && (
            <StepCoach
              data={coach}
              onChange={setCoach}
              onNext={() => setScreen('program')}
              onBack={() => setScreen('intro')}
              onClose={handleClose}
            />
          )}
          {screen === 'program' && (
            <StepProgram
              data={program}
              onChange={setProgram}
              onNext={() => setScreen('schedule')}
              onBack={() => setScreen('coach')}
              onClose={handleClose}
            />
          )}
          {screen === 'schedule' && (
            <StepSchedule
              data={schedule}
              onChange={setSchedule}
              weeks={program.weeks}
              onNext={() => setScreen('pricing')}
              onBack={() => setScreen('program')}
              onClose={handleClose}
            />
          )}
          {screen === 'pricing' && (
            <StepPricingCoaching
              organization={organization}
              onNext={startCurriculumGeneration}
              onBack={() => setScreen('schedule')}
              onClose={handleClose}
            />
          )}
          {screen === 'generating-curriculum' && (
            <GeneratingScreen
              title={program.title}
              modulesCount={partialCurr.weeks?.length ?? 0}
              lessonsCount={
                partialCurr.weeks?.reduce(
                  (acc, w) =>
                    acc +
                    (w?.modules?.reduce(
                      (a2, m) => a2 + (m?.lessons?.length ?? 0),
                      0,
                    ) ?? 0),
                  0,
                ) ?? 0
              }
              onClose={handleClose}
            />
          )}
          {screen === 'curriculum' && (
            <CurriculumScreen
              programTitle={program.title}
              partial={partialCurr}
              isStreaming={isCurriculumStreaming}
              error={
                curriculumError ? 'Failed to draft curriculum.' : null
              }
              onRegenerate={() => {
                stopCurriculum()
                setScreen('pricing')
              }}
              onCreate={startLandingGeneration}
              onClose={handleClose}
            />
          )}
          {screen === 'generating-landing' && (
            <GeneratingScreen
              title={program.title}
              modulesCount={partialCurr.weeks?.length ?? 0}
              lessonsCount={0}
              onClose={handleClose}
              phase="landing"
            />
          )}
          {screen === 'preview' && (
            <CurriculumScreen
              programTitle={program.title}
              partial={partialCurr}
              isStreaming={isLandingStreaming}
              error={null}
              onRegenerate={() => setScreen('curriculum')}
              onCreate={finalizeProgram}
              onClose={handleClose}
            />
          )}
          {screen === 'creating' && <CreatingScreen onClose={handleClose} />}
        </div>
      </form>
    </Form>
  )
}
