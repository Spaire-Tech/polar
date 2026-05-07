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
import { ProductEditOrCreateForm } from '@/utils/product'
import { experimental_useObject as useObject } from '@ai-sdk/react'
import { schemas } from '@spaire/client'
import { Form } from '@spaire/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
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
    setScreen('creating')
    // Commit 4 will wire this to product + course + events + cohort. For
    // now the wizard ends here so the AI flow can be exercised end-to-end
    // against the new endpoints.
    toast({
      title: 'Curriculum drafted',
      description:
        'AI streams are wired. Saving the program is in the next commit.',
    })
    setTimeout(() => {
      router.push(`/dashboard/${organization.slug}/products`)
    }, 1200)
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
