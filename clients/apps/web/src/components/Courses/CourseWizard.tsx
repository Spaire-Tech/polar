'use client'

import { useCreateCourse } from '@/hooks/queries/courses'
import { useCreateProduct } from '@/hooks/queries/products'
import { experimental_useObject as useObject } from '@ai-sdk/react'
import AutorenewOutlined from '@mui/icons-material/AutorenewOutlined'
import CertificateOutlined from '@mui/icons-material/WorkspacePremiumOutlined'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import CommunityOutlined from '@mui/icons-material/PeopleOutlined'
import DownloadOutlined from '@mui/icons-material/DownloadOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import GiftOutlined from '@mui/icons-material/CardGiftcardOutlined'
import GroupOutlined from '@mui/icons-material/GroupOutlined'
import LiveOutlined from '@mui/icons-material/VideocamOutlined'
import MoneyOutlined from '@mui/icons-material/MonetizationOnOutlined'
import OndemandVideoOutlined from '@mui/icons-material/OndemandVideoOutlined'
import QuizOutlined from '@mui/icons-material/QuizOutlined'
import SelfPacedOutlined from '@mui/icons-material/PersonOutlined'
import SyncOutlined from '@mui/icons-material/SyncOutlined'
import TextSnippetOutlined from '@mui/icons-material/TextSnippetOutlined'
import { schemas } from '@spaire/client'
import { cn } from '@spaire/ui/lib/utils'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from '../Toast/use-toast'
import { outlineSchema } from './schemas'

type CourseType = 'evergreen' | 'cohort'
type PriceOption = 'free' | 'paid'

type PartialModule = {
  title?: string
  description?: string
  lessons?: { title?: string; content_type?: 'text' | 'video' }[]
}

type PartialOutline = {
  modules?: PartialModule[]
}

const EVERGREEN_FEATURES = [
  { icon: SelfPacedOutlined, label: 'Self-paced learning' },
  { icon: CommunityOutlined, label: 'Community integration' },
  { icon: LiveOutlined, label: 'Live room' },
  { icon: DownloadOutlined, label: 'Downloads' },
  { icon: OndemandVideoOutlined, label: 'Video content' },
  { icon: CertificateOutlined, label: 'Certificates' },
  { icon: QuizOutlined, label: 'Quizzes' },
]

const COHORT_FEATURES = [
  { icon: GroupOutlined, label: 'Cohort scheduling' },
  { icon: CommunityOutlined, label: 'Community integration' },
  { icon: LiveOutlined, label: 'Live sessions' },
  { icon: DownloadOutlined, label: 'Downloads' },
  { icon: OndemandVideoOutlined, label: 'Video content' },
  { icon: CertificateOutlined, label: 'Certificates' },
]

function StreamingOutline({
  outline,
  isStreaming,
}: {
  outline: PartialOutline
  isStreaming: boolean
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const toggle = (i: number) =>
    setExpanded((prev) => ({ ...prev, [i]: !prev[i] }))
  const modules = outline.modules ?? []

  return (
    <div className="flex flex-col gap-2">
      {modules.map((mod, i) => {
        const lessons = mod.lessons ?? []
        const isLastModule = i === modules.length - 1
        return (
          <div
            key={i}
            className={cn(
              'overflow-hidden rounded-xl border bg-white transition-colors',
              isStreaming && isLastModule
                ? 'border-blue-300 shadow-sm'
                : 'border-gray-200',
            )}
          >
            <button
              onClick={() => toggle(i)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-medium text-gray-900">
                {mod.title || (
                  <span className="inline-block h-4 w-48 animate-pulse rounded bg-gray-100" />
                )}
              </span>
              <span className="shrink-0 text-xs text-gray-400">
                {lessons.length} lesson{lessons.length !== 1 ? 's' : ''}
              </span>
              <ExpandMoreOutlined
                className={cn(
                  'shrink-0 text-gray-400 transition-transform',
                  expanded[i] && 'rotate-180',
                )}
                fontSize="small"
              />
            </button>
            {expanded[i] && lessons.length > 0 && (
              <div className="divide-y divide-gray-100 border-t border-gray-100">
                {lessons.map((lesson, j) => (
                  <div
                    key={j}
                    className="flex items-center gap-3 px-4 py-2.5 pl-14"
                  >
                    {lesson.content_type === 'video' ? (
                      <OndemandVideoOutlined
                        fontSize="small"
                        className="shrink-0 text-purple-500"
                      />
                    ) : (
                      <TextSnippetOutlined
                        fontSize="small"
                        className="shrink-0 text-blue-400"
                      />
                    )}
                    <span className="text-sm text-gray-700">
                      {lesson.title || (
                        <span className="inline-block h-3 w-40 animate-pulse rounded bg-gray-100" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {isStreaming && (
        <div className="flex items-center gap-2 px-4 py-3 text-xs text-gray-400">
          <span className="flex h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          Writing{modules.length > 0 ? ` module ${modules.length + 1}` : ''}…
        </div>
      )}
    </div>
  )
}

// ─── Step 1 ─────────────────────────────────────────────────────────────────

function StepType({
  courseType,
  onSelect,
  onNext,
}: {
  courseType: CourseType
  onSelect: (t: CourseType) => void
  onNext: () => void
}) {
  const features = courseType === 'evergreen' ? EVERGREEN_FEATURES : COHORT_FEATURES
  const desc =
    courseType === 'evergreen'
      ? 'A self-paced, continuously accessible educational program that provides learners with perpetual access to its content, allowing them to start and complete the course at their own convenience.'
      : 'A structured program delivered to a group of learners simultaneously. Everyone starts and progresses together, with scheduled sessions and community activities.'

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">
        What type of course
      </h1>

      <div className="mb-8 grid grid-cols-2 gap-3">
        {([['evergreen', SyncOutlined, 'Evergreen'], ['cohort', GroupOutlined, 'Cohorts']] as const).map(
          ([type, Icon, label]) => (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className={cn(
                'flex items-center justify-center gap-2.5 rounded-2xl border-2 px-6 py-7 text-base font-medium transition-all',
                courseType === type
                  ? 'border-gray-900 bg-white text-gray-900 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
              )}
            >
              <Icon fontSize="small" />
              {label}
            </button>
          ),
        )}
      </div>

      <div className="mb-6">
        <h2 className="mb-1.5 text-lg font-bold text-gray-900">
          {courseType === 'evergreen' ? 'Evergreen course' : 'Cohort course'}
        </h2>
        <p className="text-sm leading-relaxed text-gray-500">{desc}</p>
      </div>

      <div className="mb-8">
        <h3 className="mb-3 text-base font-bold text-gray-900">Features</h3>
        <div className="grid grid-cols-2 gap-y-2.5">
          {features.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-sm text-gray-700">
              <Icon fontSize="small" className="text-gray-400" />
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          className="rounded-full bg-gray-900 px-7 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}

// ─── Step 2 ─────────────────────────────────────────────────────────────────

function StepDetails({
  title,
  description,
  useAI,
  onChangeTitle,
  onChangeDescription,
  onToggleAI,
  onBack,
  onNext,
}: {
  title: string
  description: string
  useAI: boolean
  onChangeTitle: (v: string) => void
  onChangeDescription: (v: string) => void
  onToggleAI: () => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-1 text-3xl font-bold text-gray-900">Course Details</h1>
      <p className="mb-8 text-sm text-gray-500">
        We&apos;ll use your title and description to generate a sample course
        outline:
      </p>

      <div className="mb-5">
        <label className="mb-1.5 block text-sm font-bold text-gray-900">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onChangeTitle(e.target.value)}
          placeholder="Examples: Public Speaking 101, Learning piano, ..."
          className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-100"
        />
      </div>

      <div className="mb-6">
        <label className="mb-1.5 block text-sm font-bold text-gray-900">
          Brief description
        </label>
        <textarea
          value={description}
          onChange={(e) => onChangeDescription(e.target.value)}
          placeholder="Example: Learn the skills required to ..."
          rows={5}
          className="w-full resize-none rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-100"
        />
      </div>

      <div className="mb-8 flex items-start gap-3">
        <button
          onClick={onToggleAI}
          className={cn(
            'relative mt-0.5 flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
            useAI ? 'bg-blue-600' : 'bg-gray-200',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
              useAI ? 'translate-x-5' : 'translate-x-0.5',
            )}
          />
        </button>
        <div>
          <p className="text-sm font-medium text-gray-900">
            Use this info to generate content and additional resources
          </p>
          <a
            href="#"
            className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-gray-900 underline"
          >
            Learn more
          </a>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="rounded-full border border-gray-300 px-7 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!title.trim()}
          className="rounded-full bg-gray-900 px-7 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}

// ─── Step 3 ─────────────────────────────────────────────────────────────────

function StepPricing({
  priceOption,
  paywallEnabled,
  priceAmount,
  onSelectPrice,
  onTogglePaywall,
  onChangeAmount,
  onBack,
  onNext,
}: {
  priceOption: PriceOption
  paywallEnabled: boolean
  priceAmount: string
  onSelectPrice: (p: PriceOption) => void
  onTogglePaywall: () => void
  onChangeAmount: (v: string) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-1 text-3xl font-bold text-gray-900">
        Price your Course
      </h1>
      <p className="mb-8 text-sm text-gray-500">
        Choose whether this Course is paid or free. If it&apos;s paid, set its
        price and payment options. Don&apos;t worry, you can change this later!
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3">
        {([
          ['free', GiftOutlined, 'Free'],
          ['paid', MoneyOutlined, 'Paid'],
        ] as const).map(([opt, Icon, label]) => (
          <button
            key={opt}
            onClick={() => onSelectPrice(opt)}
            className={cn(
              'flex items-center justify-center gap-2.5 rounded-2xl border-2 px-6 py-7 text-base font-medium transition-all',
              priceOption === opt
                ? 'border-gray-900 bg-white text-gray-900 shadow-sm'
                : 'border-gray-200 bg-gray-100 text-gray-500 hover:border-gray-300',
            )}
          >
            <Icon fontSize="small" />
            {label}
          </button>
        ))}
      </div>

      {priceOption === 'paid' && (
        <div className="mb-5 flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500">$</span>
          <input
            type="number"
            value={priceAmount}
            onChange={(e) => onChangeAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-32 rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-100"
          />
        </div>
      )}

      <div className="mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900 underline">
              Use a paywall for this course
            </span>
            <span className="rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
              New
            </span>
          </div>
          <button
            onClick={onTogglePaywall}
            className={cn(
              'relative flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
              paywallEnabled ? 'bg-blue-600' : 'bg-gray-200',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
                paywallEnabled ? 'translate-x-5' : 'translate-x-0.5',
              )}
            />
          </button>
        </div>
        <p className="mt-1.5 text-sm text-gray-500">
          Enable limited course access to let your members experience the value
          before purchasing the full course.
        </p>
      </div>

      <div className="mb-8 mt-4 text-center">
        <button
          onClick={() => {
            if (paywallEnabled) onTogglePaywall()
            onNext()
          }}
          className="text-sm font-semibold text-gray-500 hover:text-gray-700"
        >
          Skip for now
        </button>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="rounded-full border border-gray-300 px-7 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="rounded-full bg-gray-900 px-7 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
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

  // Wizard step state
  const [wizardStep, setWizardStep] = useState<
    'type' | 'details' | 'pricing' | 'generating' | 'outline' | 'creating'
  >('type')

  // Form values
  const [courseType, setCourseType] = useState<CourseType>('evergreen')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [useAI, setUseAI] = useState(true)
  const [priceOption, setPriceOption] = useState<PriceOption>('free')
  const [priceAmount, setPriceAmount] = useState('')
  const [paywallEnabled, setPaywallEnabled] = useState(true)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const {
    object: partialOutline,
    submit: submitOutline,
    isLoading: isOutlineStreaming,
    error: outlineError,
    stop: stopOutline,
  } = useObject({
    api: `/dashboard/${organization.slug}/courses/outline`,
    schema: outlineSchema,
    onFinish: () => setWizardStep('outline'),
    onError: () => {
      setGenerateError('Failed to generate outline. Please try again.')
      setWizardStep('pricing')
    },
  })

  const startGeneration = () => {
    setGenerateError(null)
    setWizardStep('generating')
    submitOutline({ title, description, targetAudience: '' })
  }

  const regenerateOutline = () => {
    stopOutline()
    setWizardStep('pricing')
  }

  const createCourseWithProduct = async () => {
    const outline = partialOutline
    if (!outline?.modules?.length) return
    setWizardStep('creating')

    try {
      const priceAmountCents = Math.round(parseFloat(priceAmount || '0') * 100)
      const baseFields = {
        name: title,
        description: description || null,
        visibility: 'public',
        organization_id: organization.id,
      }
      const productBody =
        priceOption === 'paid'
          ? {
              ...baseFields,
              prices: [
                {
                  amount_type: 'fixed',
                  price_currency: 'usd',
                  price_amount: priceAmountCents,
                },
              ],
              recurring_interval: null,
            }
          : {
              ...baseFields,
              prices: [{ amount_type: 'free', price_currency: 'usd' }],
              recurring_interval: null,
            }

      const productResult = await createProduct.mutateAsync(productBody as never)
      if (productResult.error || !productResult.data) {
        throw new Error('Product creation failed')
      }

      const course = await createCourse.mutateAsync({
        product_id: productResult.data.id,
        organization_id: organization.id,
        title,
        course_type: courseType,
        paywall_enabled: paywallEnabled,
        ai_generated: true,
        modules: outline.modules
          .filter(
            (m): m is { title: string; description?: string; lessons?: { title?: string; content_type?: 'text' | 'video' }[] } =>
              Boolean(m?.title),
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
        description: `"${title}" is ready to edit`,
      })
      router.push(
        `/dashboard/${organization.slug}/courses/${course.id}?new=1`,
      )
    } catch (err) {
      console.error('[CourseWizard] create error:', err)
      toast({
        title: 'Something went wrong',
        description: 'Could not create the course. Please try again.',
      })
      setWizardStep('outline')
    }
  }

  const modulesCount = partialOutline?.modules?.length ?? 0
  const lessonsCount =
    partialOutline?.modules?.reduce(
      (acc, m) => acc + (m?.lessons?.length ?? 0),
      0,
    ) ?? 0

  // ── Render ────────────────────────────────────────────────────────────────

  if (wizardStep === 'type') {
    return (
      <StepType
        courseType={courseType}
        onSelect={setCourseType}
        onNext={() => setWizardStep('details')}
      />
    )
  }

  if (wizardStep === 'details') {
    return (
      <StepDetails
        title={title}
        description={description}
        useAI={useAI}
        onChangeTitle={setTitle}
        onChangeDescription={setDescription}
        onToggleAI={() => setUseAI((v) => !v)}
        onBack={() => setWizardStep('type')}
        onNext={() => setWizardStep('pricing')}
      />
    )
  }

  if (wizardStep === 'pricing') {
    return (
      <StepPricing
        priceOption={priceOption}
        paywallEnabled={paywallEnabled}
        priceAmount={priceAmount}
        onSelectPrice={setPriceOption}
        onTogglePaywall={() => setPaywallEnabled((v) => !v)}
        onChangeAmount={setPriceAmount}
        onBack={() => setWizardStep('details')}
        onNext={startGeneration}
      />
    )
  }

  if (wizardStep === 'generating' || wizardStep === 'outline') {
    const ready = wizardStep === 'outline'
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {modulesCount} modules · {lessonsCount} lessons
            {!ready && isOutlineStreaming && ' · generating…'}
          </p>
        </div>

        {(outlineError || generateError) && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            Something went wrong. Please try again.
          </div>
        )}

        <StreamingOutline
          outline={(partialOutline as PartialOutline) ?? { modules: [] }}
          isStreaming={!ready}
        />

        {ready && (
          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              onClick={regenerateOutline}
              className="flex items-center gap-2 rounded-full border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <AutorenewOutlined fontSize="small" />
              Regenerate
            </button>
            <button
              onClick={createCourseWithProduct}
              className="rounded-full bg-gray-900 px-7 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
            >
              Create Course
            </button>
          </div>
        )}
      </div>
    )
  }

  // creating state
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50">
        <CheckCircleOutlined className="text-green-500" sx={{ fontSize: 32 }} />
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-gray-900">
          Creating your course
        </p>
        <p className="mt-1 text-sm text-gray-500">Setting everything up…</p>
      </div>
    </div>
  )
}
