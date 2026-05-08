'use client'

// Coaching wizard. AI is used ONLY for the landing page copy. The
// curriculum (week titles, talking points) is intentionally NOT generated
// by AI — the coach knows what they want to teach, and a course-style AI
// outline doesn't match how cohort coaches actually plan. The wizard
// creates N empty sessions ("Week 1 live call", "Week 2 live call", ...)
// and the coach edits them from the Events tab after publishing.
//
// Flow: intro → coach → program → schedule → pricing → review →
//        creating (kicks off AI landing + creates product + course + N
//        events sequentially, then routes to /events).

import {
  Intro,
  SpaireOnboardingStyles,
} from '@/components/Courses/CourseWizard.steps'
import { CreatingScreen } from '@/components/Courses/CourseWizard.status'
import { useCreateCourse } from '@/hooks/queries/courses'
import { useCreateProduct } from '@/hooks/queries/products'
import { ProductEditOrCreateForm } from '@/utils/product'
import { schemas } from '@spaire/client'
import { Form } from '@spaire/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import {
  computeSessionDatetimes,
  defaultScheduleState,
  StepCoach,
  StepProgram,
  StepPricingCoaching,
  StepReview,
  StepSchedule,
  type CoachState,
  type ProgramState,
  type ScheduleState,
} from './CoachingWizard.steps'

// One-shot create-event call. Direct fetch keeps the finalize loop
// simple and avoids dynamic hook construction.
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

// Best-effort AI landing fetch. If it fails or times out we keep going
// without it — coach can regenerate from the dashboard Customize tab.
async function generateLandingCopy(
  organizationSlug: string,
  body: {
    title: string
    transformation: string
    audience: string
    weeks: number
    startsAt: string | null
    sessionCadence: string
    coachName: string | null
    coachBio: string | null
    coachingFocus: string | null
    communityEnabled: boolean
    hasIntake: boolean
  },
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `/dashboard/${organizationSlug}/coaching/landing`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
    if (!res.ok || !res.body) return null
    // The route streams JSON via streamObject; once the stream finishes,
    // the body parses as a single JSON object.
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
    }
    try {
      return JSON.parse(buf)
    } catch {
      return null
    }
  } catch {
    return null
  }
}

type WizardStep =
  | 'intro'
  | 'coach'
  | 'program'
  | 'schedule'
  | 'pricing'
  | 'review'
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

  const handleClose = () =>
    router.push(`/dashboard/${organization.slug}/products`)

  const finalizeProgram = async () => {
    setScreen('creating')

    try {
      const sessions = computeSessionDatetimes(schedule, program.weeks)

      // Kick off AI landing generation in parallel with product creation
      // — AI for the public page, but never blocks publishing on it.
      const landingPromise = generateLandingCopy(organization.slug, {
        title: program.title,
        transformation: program.transformation,
        audience: program.audience,
        weeks: program.weeks,
        startsAt: sessions[0] ?? null,
        sessionCadence: `Weekly, ${schedule.durationMinutes} min`,
        coachName: coach.name || null,
        coachBio: coach.bio || null,
        coachingFocus: coach.focus || null,
        communityEnabled: true,
        hasIntake: false,
      })

      // 1) Create the product.
      const formValues = form.getValues()
      const { full_medias, metadata, ...rest } = formValues
      const mediaIds = full_medias.map((m) => m.id)
      const productResult = await createProduct.mutateAsync({
        ...rest,
        name: program.title || 'Untitled Program',
        description: program.transformation || null,
        category: 'coaching',
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

      // 2) Wait for landing if it's ready, otherwise create without it.
      const aiLanding = await Promise.race([
        landingPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 25_000)),
      ])

      // 3) Create the coaching course (program_format='coaching' triggers
      //    the default cohort + community_enabled=true server-side).
      const created = await createCourse.mutateAsync({
        product_id: productResult.data.id,
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
        modules: [],
      })

      // 4) If AI landing came back, persist it on the course.
      if (aiLanding) {
        try {
          await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/${created.id}`,
            {
              method: 'PATCH',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                landing_overrides: { ai_landing: aiLanding },
              }),
            },
          )
        } catch (e) {
          console.warn('[CoachingWizard] landing patch failed:', e)
        }
      }

      // 5) Create one CoachingEvent per scheduled session, with a
      //    placeholder title the coach edits later from the Events tab.
      for (let i = 0; i < sessions.length; i++) {
        try {
          await createCoachingEvent({
            course_id: created.id,
            title: `Week ${i + 1} live call`,
            description: null,
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
        description: `${sessions.length} live calls scheduled — edit them on the Events tab.`,
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
      setScreen('review')
    }
  }

  const sessions = computeSessionDatetimes(schedule, program.weeks)
  // The `prices` array is a discriminated union; only the `fixed` /
  // `free` variants carry price_amount/price_currency. Narrow by reading
  // through `unknown` so TS doesn't reject the property access on the
  // `custom` variant (which doesn't have these fields).
  const firstPrice = (form.watch('prices')?.[0] ?? null) as
    | { price_amount?: number | null; price_currency?: string }
    | null
  const priceCents = firstPrice?.price_amount ?? 0
  const priceCurrency = firstPrice?.price_currency ?? defaultCurrency
  const billingCycle: 'onetime' | 'recurring' =
    form.watch('recurring_interval') == null ? 'onetime' : 'recurring'

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
              onNext={() => setScreen('review')}
              onBack={() => setScreen('schedule')}
              onClose={handleClose}
            />
          )}
          {screen === 'review' && (
            <StepReview
              program={program}
              coach={coach}
              schedule={schedule}
              sessions={sessions}
              priceCents={priceCents}
              priceCurrency={priceCurrency}
              billingCycle={billingCycle}
              onPublish={finalizeProgram}
              onBack={() => setScreen('pricing')}
              onClose={handleClose}
            />
          )}
          {screen === 'creating' && <CreatingScreen onClose={handleClose} />}
        </div>
      </form>
    </Form>
  )
}
