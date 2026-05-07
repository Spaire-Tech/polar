'use client'

import { experimental_useObject as useObject } from '@ai-sdk/react'
import React, { useEffect, useMemo, useState } from 'react'
import {
  Field,
  PrimaryButton,
  Reveal,
  StepHeader,
  TextArea,
} from './CoachingWizard.primitives'
import type { WizardState } from './CoachingWizard'
import { coachingOutlineSchema } from './schemas'

// ─── Sample fallback data — used if streaming errors out, or while no
// streamed data has arrived yet so the skeleton has a known cardinality.
export const SAMPLE_MODULES: ModuleSpec[] = [
  {
    title: 'Foundations: pick a problem worth shipping',
    lessons: [
      { type: 'doc', title: 'Why most side projects stall' },
      { type: 'video', title: 'The 30‑minute idea filter (workshop)' },
      { type: 'doc', title: 'Your one‑sentence promise' },
    ],
  },
  {
    title: 'Validate before you build',
    lessons: [
      { type: 'doc', title: 'Five conversations that change everything' },
      { type: 'video', title: 'Live demo: a landing page in 20 minutes' },
      { type: 'doc', title: 'Reading the signal vs. the noise' },
    ],
  },
  {
    title: 'Build the smallest sellable thing',
    lessons: [
      { type: 'video', title: 'Scope cuts: what to leave out' },
      { type: 'doc', title: 'Pricing your first version' },
    ],
  },
  {
    title: 'Launch & learn in public',
    lessons: [
      { type: 'doc', title: 'A launch week that actually works' },
      { type: 'video', title: 'Handling the first wave of feedback' },
      { type: 'doc', title: 'Deciding what to build next' },
    ],
  },
]

export const SAMPLE_LANDING: LandingSpec = {
  hero: {
    titleParts: [
      { text: 'Launch your first' },
      { text: 'paid product', italic: true },
      { text: 'in 30 days.' },
    ],
    subtitle:
      'A focused program for makers who keep starting and never finishing. Weekly live coaching, async feedback, and a community that ships.',
    ctaPrimary: 'See programs',
    ctaSecondary: 'Learn more',
    clientsPillText: '+ 300 makers shipped',
  },
  coreEvolution: {
    heading: 'Ship What Matters',
    description:
      'Move from idea to paid product through a focused, accountable system. Weekly coaching keeps you on track; async reviews keep momentum.',
    resultsHeading: 'Expected Results',
    stats: [
      { label: 'Validation conversations', value: '+5/wk', barPercent: 70 },
      { label: 'Weekly shipping cadence', value: '+80%', barPercent: 80 },
      { label: 'Time to first sale', value: '4 weeks', barPercent: 65 },
      { label: 'Confidence in scope', value: '+50%', barPercent: 60 },
    ],
    cta: 'Join now',
    caption: 'Your launch, built one week at a time.',
  },
  atlas: {
    eyebrow: 'Build with rhythm.',
    title: 'Atlas Program',
    meta: [
      { label: 'Duration', value: '4 weeks' },
      { label: 'Format', value: 'Self-paced' },
      { label: 'Follow-up', value: 'Async feedback' },
    ],
    orderCta: 'Order — $99',
    sections: [
      {
        label: 'Ideal for',
        body: 'Makers with a few hours a week who want a structured, accountable path to a paid launch.',
      },
      {
        label: 'Money-back guarantee',
        body: '30-day refund if it isn’t the right fit.',
      },
      {
        label: 'Delivery & access',
        body: 'Instant access to the dashboard, weekly drops, and direct coach feedback.',
      },
    ],
    testimonial: {
      quote: 'Atlas got me from idea to paying customer in under a month.',
      author: 'Mara. K',
      authorSub: 'Atlas Program',
    },
  },
  faqs: [
    {
      q: 'Who is this for?',
      a: 'Makers who can carve out 4–6 hours a week and want to ship something paid.',
    },
    {
      q: 'Do I need a product idea?',
      a: 'No. Week one is dedicated to picking a problem worth your time.',
    },
    {
      q: 'What if I fall behind?',
      a: 'You keep access for a full year and can rejoin a future cohort at no cost.',
    },
  ],
}

export const SAMPLE_QUESTIONS: string[] = [
  'What are you trying to ship in the next 30 days?',
  'What has stopped you from finishing previous projects?',
  'How many hours a week can you realistically commit?',
  'What kind of feedback do you find most helpful?',
]

export const SAMPLE_SESSIONS: string[] = [
  'Kickoff & idea filtering workshop',
  'Validation conversations: live role‑play',
  'Scope review and feedback round',
  'Launch week walkthrough',
  'Retro & what to build next',
]

// ─── Types for streamed/partial outline ─────────────────────────────────────
export type LessonSpec = { type: 'doc' | 'video'; title: string }
export type ModuleSpec = { title: string; lessons: LessonSpec[] }
export type FaqSpec = { q: string; a: string }

export type TitlePartSpec = { text: string; italic?: boolean }
export type StatSpec = { label: string; value: string; barPercent: number }
export type MetaSpec = { label: string; value: string }
export type SectionSpec = { label: string; body: string }
export type TestimonialSpec = {
  quote: string
  author: string
  authorSub: string
}

export type HeroSpec = {
  titleParts: TitlePartSpec[]
  subtitle: string
  ctaPrimary: string
  ctaSecondary: string
  clientsPillText: string
}
export type CoreEvolutionSpec = {
  heading: string
  description: string
  resultsHeading: string
  stats: StatSpec[]
  cta: string
  caption: string
}
export type AtlasSpec = {
  eyebrow: string
  title: string
  meta: MetaSpec[]
  orderCta: string
  sections: SectionSpec[]
  testimonial: TestimonialSpec
}

export type LandingSpec = {
  hero: HeroSpec
  coreEvolution: CoreEvolutionSpec
  atlas: AtlasSpec
  faqs: FaqSpec[]
}

type PartialModule = {
  title?: string
  lessons?: { type?: 'doc' | 'video'; title?: string }[]
}
type PartialHero = {
  titleParts?: { text?: string; italic?: boolean }[]
  subtitle?: string
  ctaPrimary?: string
  ctaSecondary?: string
  clientsPillText?: string
}
type PartialCoreEvolution = {
  heading?: string
  description?: string
  resultsHeading?: string
  stats?: { label?: string; value?: string; barPercent?: number }[]
  cta?: string
  caption?: string
}
type PartialCourses = { heading?: string; lede?: string }
type PartialAtlas = {
  eyebrow?: string
  title?: string
  meta?: { label?: string; value?: string }[]
  orderCta?: string
  sections?: { label?: string; body?: string }[]
  testimonial?: { quote?: string; author?: string; authorSub?: string }
}
type PartialFaq = {
  heading?: string
  lede?: string
  cta?: string
  items?: { q?: string; a?: string }[]
}
type PartialLanding = {
  hero?: PartialHero
  coreEvolution?: PartialCoreEvolution
  courses?: PartialCourses
  atlas?: PartialAtlas
  faq?: PartialFaq
}
type PartialOutline = {
  modules?: PartialModule[]
  landing?: PartialLanding
  intakeQuestions?: string[]
  sessionIdeas?: string[]
  clarifyingQuestions?: string[]
}

// ─── StepAI ─────────────────────────────────────────────────────────────────
export type StepAIProps = {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  organization: { slug: string }
  onComplete?: () => void
  onResult?: (result: PartialOutline) => void
  programId?: string | null
  onFinalize?: (result: PartialOutline) => Promise<boolean>
}

export function StepAI({
  state,
  update,
  organization,
  onComplete,
  onResult,
  programId,
  onFinalize,
}: StepAIProps) {
  const [generating, setGenerating] = useState(state.generationDone || false)
  const [done, setDone] = useState(state.generationDone || false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const finalizedRef = React.useRef(false)
  // Map of clarifyingQuestion -> user answer.
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<string, string>>(
    {},
  )

  // Hold the latest partial outline so we can pass a stable snapshot to
  // finalize-ai once streaming finishes. `useObject` doesn't pass the final
  // object to `onFinish`, so we keep a ref synced via the result effect below.
  const latestRef = React.useRef<PartialOutline | null>(null)

  const finalize = React.useCallback(
    async (result: PartialOutline) => {
      if (!programId || !onFinalize) {
        // Still allow the user to continue even if persistence isn't wired.
        update({ generationDone: true })
        onComplete?.()
        return
      }
      if (finalizedRef.current) return
      finalizedRef.current = true
      setSavingDraft(true)
      setSaveError(null)
      const ok = await onFinalize(result)
      setSavingDraft(false)
      if (!ok) {
        finalizedRef.current = false
        setSaveError('Could not save your draft. Try regenerating.')
        return
      }
      update({ generationDone: true })
      onComplete?.()
    },
    [programId, onFinalize, update, onComplete],
  )

  // TODO: backend route — /dashboard/[slug]/coaching/outline does not yet
  // exist. A separate agent will add it. The streaming contract here mirrors
  // /dashboard/[slug]/courses/outline.
  const {
    object: partialOutlineRaw,
    submit,
    isLoading,
    error,
    stop,
  } = useObject({
    api: `/dashboard/${organization.slug}/coaching/outline`,
    schema: coachingOutlineSchema,
    onFinish: () => {
      setDone(true)
      const latest = latestRef.current ?? {}
      finalize(latest)
    },
    onError: () => {
      // Streaming failed — leave the user on the generation screen with sample
      // data so they can still continue. They can click Regenerate.
      setDone(true)
      update({ generationDone: true })
      onComplete?.()
    },
  })

  const partialOutline = (partialOutlineRaw as PartialOutline) ?? {}

  // Bubble the partial up to the parent whenever it changes — by the time
  // the user clicks "Continue to preview" the parent will have the latest
  // streamed data without us needing to inspect onFinish's event arg.
  useEffect(() => {
    if (partialOutlineRaw) {
      onResult?.(partialOutline)
      latestRef.current = partialOutline
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partialOutlineRaw])

  const start = (extraNotes?: string) => {
    if (!state.aiPrompt.trim()) return
    setGenerating(true)
    setDone(false)
    submit({
      programTitle: state.programTitle,
      promise: state.promise,
      format: state.format,
      weeks: state.weeks,
      coachName: state.coachName,
      coachBio: state.coachBio,
      freePreview: state.freePreview,
      prompt: state.aiPrompt,
      // Append any clarifying answers if present.
      clarifyingAnswers: extraNotes ?? '',
    })
  }

  const regenerate = (extraNotes?: string) => {
    stop()
    setDone(false)
    finalizedRef.current = false
    setSaveError(null)
    start(extraNotes)
  }

  const retryFinalize = () => {
    finalizedRef.current = false
    finalize(latestRef.current ?? {})
  }

  if (!generating) {
    return (
      <div className="fade-up">
        <StepHeader
          step={5}
          total={5}
          headline="Let's draft your program."
          helper="Describe it in plain words. We'll generate the outline, landing page copy, and intake questions. You can edit everything afterwards."
        />

        <Field label="Describe your program">
          <TextArea
            value={state.aiPrompt}
            onChange={(v) => update({ aiPrompt: v })}
            placeholder={
              "e.g. A 6‑week program for first‑time founders to validate and launch a side project. Three modules, weekly group calls, async Q&A."
            }
            rows={6}
            autoFocus
          />
        </Field>

        <PrimaryButton
          onClick={() => start()}
          disabled={!state.aiPrompt.trim()}
        >
          Generate
        </PrimaryButton>
      </div>
    )
  }

  return (
    <GenerationView
      isCohort={state.format === 'cohort' || state.format === 'hybrid'}
      isStreaming={isLoading}
      done={done}
      error={error ? 'Failed to generate. Showing fallback below.' : null}
      partial={partialOutline}
      clarifyAnswers={clarifyAnswers}
      onClarifyAnswer={(q, v) =>
        setClarifyAnswers((prev) => ({ ...prev, [q]: v }))
      }
      onRegenerate={() => {
        const notes = Object.entries(clarifyAnswers)
          .filter(([, v]) => v.trim().length > 0)
          .map(([q, v]) => `Q: ${q}\nA: ${v}`)
          .join('\n\n')
        regenerate(notes)
      }}
      savingDraft={savingDraft}
      saveError={saveError}
      onRetrySave={retryFinalize}
    />
  )
}

// ─── GenerationView ─────────────────────────────────────────────────────────
function GenerationView({
  isCohort,
  isStreaming,
  done,
  error,
  partial,
  clarifyAnswers,
  onClarifyAnswer,
  onRegenerate,
  savingDraft,
  saveError,
  onRetrySave,
}: {
  isCohort: boolean
  isStreaming: boolean
  done: boolean
  error: string | null
  partial: PartialOutline
  clarifyAnswers: Record<string, string>
  onClarifyAnswer: (q: string, v: string) => void
  onRegenerate: () => void
  savingDraft: boolean
  saveError: string | null
  onRetrySave: () => void
}) {
  // ── Resolve the data we render. While streaming with no data yet, we use
  // SAMPLE_* so skeleton cardinality is sensible. Once any real data has
  // arrived, we render the streamed slice.
  const modules: ModuleSpec[] = useMemo(() => {
    const streamed = (partial.modules ?? [])
      .filter(
        (m): m is { title: string; lessons?: PartialModule['lessons'] } =>
          !!m && typeof m.title === 'string' && m.title.length > 0,
      )
      .map((m) => ({
        title: m.title,
        lessons: (m.lessons ?? [])
          .filter(
            (l): l is { type: 'doc' | 'video'; title: string } =>
              !!l && !!l.type && !!l.title,
          )
          .map((l) => ({ type: l.type, title: l.title })),
      }))
    if (streamed.length > 0) return streamed
    return SAMPLE_MODULES
  }, [partial.modules])

  const landing: LandingSpec | null = useMemo(() => {
    if (!partial.landing) return null
    const l = partial.landing
    const hero: HeroSpec = {
      titleParts: (l.hero?.titleParts ?? [])
        .filter(
          (p): p is { text: string; italic?: boolean } =>
            !!p && typeof p.text === 'string' && p.text.length > 0,
        )
        .map((p) => ({ text: p.text, italic: p.italic })),
      subtitle: l.hero?.subtitle ?? '',
      ctaPrimary: l.hero?.ctaPrimary ?? '',
      ctaSecondary: l.hero?.ctaSecondary ?? '',
      clientsPillText: l.hero?.clientsPillText ?? '',
    }
    const coreEvolution: CoreEvolutionSpec = {
      heading: l.coreEvolution?.heading ?? '',
      description: l.coreEvolution?.description ?? '',
      resultsHeading: l.coreEvolution?.resultsHeading ?? '',
      stats: (l.coreEvolution?.stats ?? [])
        .filter(
          (s): s is { label: string; value: string; barPercent: number } =>
            !!s &&
            typeof s.label === 'string' &&
            typeof s.value === 'string' &&
            typeof s.barPercent === 'number',
        )
        .map((s) => ({
          label: s.label,
          value: s.value,
          barPercent: s.barPercent,
        })),
      cta: l.coreEvolution?.cta ?? '',
      caption: l.coreEvolution?.caption ?? '',
    }
    const atlas: AtlasSpec = {
      eyebrow: l.atlas?.eyebrow ?? '',
      title: l.atlas?.title ?? '',
      meta: (l.atlas?.meta ?? [])
        .filter(
          (m): m is { label: string; value: string } =>
            !!m &&
            typeof m.label === 'string' &&
            typeof m.value === 'string',
        )
        .map((m) => ({ label: m.label, value: m.value })),
      orderCta: l.atlas?.orderCta ?? '',
      sections: (l.atlas?.sections ?? [])
        .filter(
          (s): s is { label: string; body: string } =>
            !!s && typeof s.label === 'string' && typeof s.body === 'string',
        )
        .map((s) => ({ label: s.label, body: s.body })),
      testimonial: {
        quote: l.atlas?.testimonial?.quote ?? '',
        author: l.atlas?.testimonial?.author ?? '',
        authorSub: l.atlas?.testimonial?.authorSub ?? '',
      },
    }
    const faqs = (l.faq?.items ?? [])
      .filter((f): f is { q: string; a: string } => !!f?.q && !!f?.a)
      .map((f) => ({ q: f.q, a: f.a }))

    // Treat the landing as "available" once any meaningful hero piece has
    // streamed; otherwise let the caller fall back to the sample.
    const hasAny =
      hero.titleParts.length > 0 ||
      hero.subtitle.length > 0 ||
      coreEvolution.heading.length > 0 ||
      atlas.title.length > 0
    if (!hasAny) return null
    return { hero, coreEvolution, atlas, faqs }
  }, [partial.landing])
  const landingFallback: LandingSpec = SAMPLE_LANDING

  const questions: string[] = useMemo(() => {
    const streamed = (partial.intakeQuestions ?? []).filter(
      (q): q is string => typeof q === 'string' && q.length > 0,
    )
    return streamed.length > 0 ? streamed : SAMPLE_QUESTIONS
  }, [partial.intakeQuestions])

  const sessions: string[] = useMemo(() => {
    const streamed = (partial.sessionIdeas ?? []).filter(
      (s): s is string => typeof s === 'string' && s.length > 0,
    )
    return streamed.length > 0 ? streamed : SAMPLE_SESSIONS
  }, [partial.sessionIdeas])

  const clarifyingQuestions = (partial.clarifyingQuestions ?? []).filter(
    (q): q is string => typeof q === 'string' && q.length > 0,
  )

  const totalModules = modules.length

  // Per-subsection progress flags: each becomes true as soon as the AI has
  // streamed at least one meaningful entry for that subsection. We keep them
  // independent so the UI fills in progressively rather than waiting on a
  // strict ordering.
  const landingProgress = {
    hero:
      !!partial.landing?.hero &&
      ((partial.landing.hero.titleParts ?? []).length > 0 ||
        (partial.landing.hero.subtitle ?? '').length > 0),
    coreEvolution:
      !!partial.landing?.coreEvolution &&
      ((partial.landing.coreEvolution.heading ?? '').length > 0 ||
        (partial.landing.coreEvolution.stats ?? []).length > 0),
    atlas:
      !!partial.landing?.atlas &&
      ((partial.landing.atlas.title ?? '').length > 0 ||
        (partial.landing.atlas.meta ?? []).length > 0 ||
        (partial.landing.atlas.sections ?? []).length > 0),
    faq:
      !!partial.landing?.faq &&
      (partial.landing.faq.items ?? []).length > 0,
  }

  return (
    <div className="fade-up" style={{ position: 'relative' }}>
      {/* top-right controls */}
      <div
        style={{
          position: 'absolute',
          top: -4,
          right: 0,
          display: 'flex',
          gap: 6,
        }}
      >
        <IconBtn onClick={onRegenerate} title="Regenerate">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        </IconBtn>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 13,
            color: 'var(--muted)',
            marginBottom: 10,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>Step 5 of 5</span>
          {(isStreaming || !done) && <PulseDot />}
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 32,
            lineHeight: 1.1,
            fontWeight: 600,
            letterSpacing: '-0.025em',
            color: 'var(--ink)',
          }}
        >
          {done ? 'Your draft is ready.' : 'Drafting your program…'}
        </h1>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            borderRadius: 10,
            background: '#fff5f5',
            border: '1.5px solid #fecaca',
            color: '#dc2626',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {savingDraft && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'var(--indigo-tint)',
            border: '1px solid var(--indigo)',
            color: 'var(--indigo)',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <PulseDot />
          Saving your draft…
        </div>
      )}

      {saveError && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            borderRadius: 10,
            background: '#fff5f5',
            border: '1.5px solid #fecaca',
            color: '#dc2626',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span>{saveError}</span>
          <button
            type="button"
            onClick={onRetrySave}
            style={{
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12.5,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Clarifying questions panel, shown above the generation cards. */}
      {clarifyingQuestions.length > 0 && (
        <div
          className="fade-up"
          style={{
            border: '1.5px solid var(--indigo)',
            borderRadius: 'var(--radius)',
            background: 'var(--indigo-tint)',
            padding: 18,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 600,
              color: 'var(--indigo)',
              marginBottom: 4,
              letterSpacing: '-0.005em',
            }}
          >
            Quick questions before I finalize
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--muted)',
              marginBottom: 14,
            }}
          >
            Answer any that apply, then regenerate.
          </div>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            {clarifyingQuestions.map((q, i) => (
              <div key={i}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 500,
                    color: 'var(--ink)',
                    marginBottom: 6,
                  }}
                >
                  {q}
                </div>
                <TextArea
                  value={clarifyAnswers[q] ?? ''}
                  onChange={(v) => onClarifyAnswer(q, v)}
                  placeholder="Your answer…"
                  rows={2}
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <PrimaryButton onClick={onRegenerate}>
              Regenerate with answers
            </PrimaryButton>
          </div>
        </div>
      )}

      <CollapsibleCard
        title="Program outline"
        subtitle={`${modules.length} of ${totalModules} modules`}
        defaultOpen
      >
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {modules.map((m, i) => (
            <ModuleRow
              key={i}
              index={i + 1}
              title={m.title}
              lessons={m.lessons}
              streaming={
                isStreaming && i === modules.length - 1 && m.lessons.length === 0
              }
            />
          ))}
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Landing page draft" defaultOpen>
        <LandingDraft
          progress={landingProgress}
          landing={landing ?? landingFallback}
        />
      </CollapsibleCard>

      <CollapsibleCard title="Intake questions" defaultOpen>
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {questions.map((q, i) => (
            <div
              key={i}
              className="slide-in"
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                padding: '10px 0',
                borderBottom:
                  i < questions.length - 1
                    ? '1px solid var(--line-2)'
                    : 'none',
              }}
            >
              <span
                className="serif-num"
                style={{
                  fontSize: 18,
                  color: 'var(--indigo)',
                  minWidth: 18,
                }}
              >
                {i + 1}
              </span>
              <span
                style={{
                  fontSize: 14.5,
                  color: 'var(--ink)',
                  lineHeight: 1.5,
                }}
              >
                {q}
              </span>
            </div>
          ))}
          {isStreaming && questions.length > 0 && (
            <SkelLine width="80%" />
          )}
        </div>
      </CollapsibleCard>

      {isCohort && (
        <CollapsibleCard title="Live session ideas" defaultOpen>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {sessions.map((s, i) => (
              <div
                key={i}
                className="slide-in"
                style={{
                  fontSize: 14.5,
                  color: 'var(--ink)',
                  padding: '8px 0',
                  borderBottom:
                    i < sessions.length - 1
                      ? '1px solid var(--line-2)'
                      : 'none',
                }}
              >
                {s}
              </div>
            ))}
          </div>
        </CollapsibleCard>
      )}
    </div>
  )
}

// ─── IconBtn ────────────────────────────────────────────────────────────────
export function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode
  onClick?: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 30,
        height: 30,
        borderRadius: '50%',
        border: '1px solid var(--line)',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--ink)',
        cursor: 'pointer',
        transition: 'background 150ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#F5F5F7')}
      onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
    >
      {children}
    </button>
  )
}

// ─── PulseDot ───────────────────────────────────────────────────────────────
export function PulseDot() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'var(--indigo)',
        animation: 'coachingPulse 1.2s ease-in-out infinite',
      }}
    />
  )
}

// ─── CollapsibleCard ────────────────────────────────────────────────────────
export function CollapsibleCard({
  title,
  subtitle,
  children,
  defaultOpen,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div
      className="fade-up"
      style={{
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        background: '#fff',
        marginBottom: 12,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 600,
              color: 'var(--ink)',
              letterSpacing: '-0.005em',
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 12.5,
                color: 'var(--muted)',
                marginTop: 2,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--muted)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 200ms ease',
          }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <Reveal open={open}>
        <div style={{ padding: '0 18px 18px' }}>{children}</div>
      </Reveal>
    </div>
  )
}

// ─── ModuleRow ──────────────────────────────────────────────────────────────
export function ModuleRow({
  index,
  title,
  lessons,
  streaming,
}: {
  index: number
  title: string
  lessons: LessonSpec[]
  streaming: boolean
}) {
  const [open, setOpen] = useState(index === 1)
  return (
    <div
      className="slide-in"
      style={{
        border: `1px solid ${streaming ? '#C5C5CA' : 'var(--line)'}`,
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        background: '#fff',
        transition: 'border-color 200ms ease',
      }}
    >
      <button
        type="button"
        onClick={() => !streaming && setOpen(!open)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'transparent',
          border: 'none',
          cursor: streaming ? 'default' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: streaming ? '#F2F2F4' : 'var(--indigo)',
            color: streaming ? 'var(--muted)' : '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            flexShrink: 0,
            transition: 'background 200ms ease, color 200ms ease',
          }}
        >
          {index}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {streaming ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div className="sk" style={{ width: '70%', height: 10 }} />
              <div className="sk" style={{ width: '40%', height: 10 }} />
            </div>
          ) : (
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--ink)',
                letterSpacing: '-0.005em',
              }}
            >
              {title}
            </div>
          )}
        </div>
        {!streaming && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--muted)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: open ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 200ms ease',
            }}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        )}
      </button>
      <Reveal open={open && !streaming}>
        <div
          style={{
            padding: '0 14px 14px 50px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {lessons.map((l, i) => (
            <div
              key={i}
              className="slide-in"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 13.5,
                color: 'var(--ink-2)',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--muted-2)',
                  fontVariant: 'small-caps',
                  letterSpacing: '0.06em',
                  minWidth: 38,
                }}
              >
                {l.type === 'video' ? 'video' : 'doc'}
              </span>
              <span>{l.title}</span>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  )
}

// ─── SkelLine ───────────────────────────────────────────────────────────────
export function SkelLine({
  width = '60%',
  height = 12,
  style = {},
}: {
  width?: number | string
  height?: number | string
  style?: React.CSSProperties
}) {
  return (
    <div
      className="sk"
      style={{ width, height, display: 'block', ...style }}
    />
  )
}

// ─── LandingDraft ───────────────────────────────────────────────────────────
export type LandingProgress = {
  hero: boolean
  coreEvolution: boolean
  atlas: boolean
  faq: boolean
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: 'var(--muted-2)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  )
}

export function LandingDraft({
  progress,
  landing,
}: {
  progress: LandingProgress
  landing: LandingSpec
}) {
  const heroTitle = landing.hero.titleParts
    .map((p) => p.text)
    .join(' ')
    .trim()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        paddingTop: 4,
      }}
    >
      {/* HERO */}
      <div>
        <SectionLabel>Hero</SectionLabel>
        {progress.hero ? (
          <div className="slide-in">
            <div
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: 'var(--ink)',
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
                marginBottom: 8,
              }}
            >
              {heroTitle}
            </div>
            <div
              style={{
                fontSize: 14,
                color: 'var(--muted)',
                lineHeight: 1.5,
              }}
            >
              {landing.hero.subtitle}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkelLine width="85%" height={20} />
            <SkelLine width="60%" height={12} />
            <SkelLine width="50%" height={12} />
          </div>
        )}
      </div>

      {/* CORE EVOLUTION */}
      <div>
        <SectionLabel>Core Evolution</SectionLabel>
        {progress.coreEvolution ? (
          <div
            className="slide-in"
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            {landing.coreEvolution.heading && (
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  letterSpacing: '-0.01em',
                }}
              >
                {landing.coreEvolution.heading}
              </div>
            )}
            {landing.coreEvolution.description && (
              <div
                style={{
                  fontSize: 13.5,
                  color: 'var(--muted)',
                  lineHeight: 1.55,
                }}
              >
                {landing.coreEvolution.description}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                marginTop: 6,
              }}
            >
              {landing.coreEvolution.stats.map((s, i) => (
                <div key={i}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 13,
                      color: 'var(--ink-2)',
                      marginBottom: 4,
                    }}
                  >
                    <span>{s.label}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {s.value}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      borderRadius: 2,
                      background: 'var(--line-2)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.max(0, Math.min(100, s.barPercent))}%`,
                        background: 'var(--indigo)',
                        transition: 'width 300ms ease',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkelLine width="50%" height={14} />
            <SkelLine width="90%" />
            <SkelLine width="80%" />
            <SkelLine width="70%" />
          </div>
        )}
      </div>

      {/* ATLAS */}
      <div>
        <SectionLabel>Atlas</SectionLabel>
        {progress.atlas ? (
          <div
            className="slide-in"
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            {landing.atlas.title && (
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  letterSpacing: '-0.01em',
                }}
              >
                {landing.atlas.title}
              </div>
            )}
            {landing.atlas.meta.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                  fontSize: 12.5,
                  color: 'var(--muted)',
                }}
              >
                {landing.atlas.meta.map((m, i) => (
                  <div key={i}>
                    <span style={{ color: 'var(--muted-2)' }}>{m.label}</span>{' '}
                    <span style={{ color: 'var(--ink-2)' }}>{m.value}</span>
                  </div>
                ))}
              </div>
            )}
            {landing.atlas.sections.map((s, i) => (
              <div key={i}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--ink)',
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--muted)',
                    lineHeight: 1.5,
                    marginTop: 2,
                  }}
                >
                  {s.body}
                </div>
              </div>
            ))}
            {(landing.atlas.testimonial.quote ||
              landing.atlas.testimonial.author) && (
              <div
                style={{
                  marginTop: 4,
                  paddingLeft: 10,
                  borderLeft: '2px solid var(--line-2)',
                }}
              >
                {landing.atlas.testimonial.quote && (
                  <div
                    style={{
                      fontSize: 13.5,
                      fontStyle: 'italic',
                      color: 'var(--ink-2)',
                      lineHeight: 1.5,
                    }}
                  >
                    {landing.atlas.testimonial.quote}
                  </div>
                )}
                {landing.atlas.testimonial.author && (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--muted)',
                      marginTop: 4,
                    }}
                  >
                    — {landing.atlas.testimonial.author}
                    {landing.atlas.testimonial.authorSub
                      ? `, ${landing.atlas.testimonial.authorSub}`
                      : ''}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkelLine width="40%" height={14} />
            <SkelLine width="70%" />
            <SkelLine width="85%" />
            <SkelLine width="60%" />
          </div>
        )}
      </div>

      {/* FAQ */}
      <div>
        <SectionLabel>FAQ</SectionLabel>
        {progress.faq ? (
          <div
            className="slide-in"
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            {landing.faqs.map((f, i) => (
              <div key={i}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--ink)',
                  }}
                >
                  {f.q}
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    color: 'var(--muted)',
                    marginTop: 3,
                    lineHeight: 1.5,
                  }}
                >
                  {f.a}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <SkelLine width="40%" />
              <div style={{ height: 4 }} />
              <SkelLine width="80%" />
            </div>
            <div>
              <SkelLine width="50%" />
              <div style={{ height: 4 }} />
              <SkelLine width="70%" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export type { PartialOutline }
