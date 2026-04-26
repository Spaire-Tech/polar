'use client'

import { Upload } from '@/components/FileUpload/Upload'
import { useCreateCourse } from '@/hooks/queries/courses'
import { useCreateProduct } from '@/hooks/queries/products'
import { experimental_useObject as useObject } from '@ai-sdk/react'
import AddPhotoAlternateOutlined from '@mui/icons-material/AddPhotoAlternateOutlined'
import AutorenewOutlined from '@mui/icons-material/AutorenewOutlined'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import OndemandVideoOutlined from '@mui/icons-material/OndemandVideoOutlined'
import TextSnippetOutlined from '@mui/icons-material/TextSnippetOutlined'
import { schemas } from '@spaire/client'
import { cn } from '@spaire/ui/lib/utils'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { toast } from '../Toast/use-toast'
import { outlineSchema } from './schemas'

type PriceOption = 'free' | 'fixed' | 'custom' | 'seat_based'
type WizardStep = 'details' | 'pricing' | 'generating' | 'outline' | 'creating'

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'details', label: 'Course Details' },
  { id: 'pricing', label: 'Pricing & Media' },
  { id: 'outline', label: 'Course Outline' },
]

function getStepIndex(step: WizardStep): number {
  if (step === 'details') return 0
  if (step === 'pricing') return 1
  return 2 // generating, outline, creating
}

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

type PartialModule = {
  title?: string
  description?: string
  lessons?: { title?: string; content_type?: 'text' | 'video' }[]
}

type PartialOutline = {
  modules?: PartialModule[]
}

// ─── Persistent header with progress ─────────────────────────────────────────

function CourseWizardHeader({
  step,
  onClose,
}: {
  step: WizardStep
  onClose: () => void
}) {
  const totalSteps = STEPS.length
  const currentIdx = getStepIndex(step)
  const progressPct = ((currentIdx + 1) / totalSteps) * 100

  return (
    <div className="sticky top-0 z-20 border-b border-purple-200 bg-white">
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-base font-bold text-gray-900">New course</h1>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <CloseOutlined fontSize="small" />
        </button>
      </div>
      <div className="relative h-1 w-full bg-gray-100">
        <div
          className="absolute inset-y-0 left-0 bg-gray-900 transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  )
}

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

// ─── Step 1 — Course Details ────────────────────────────────────────────────

function StepDetails({
  organization,
  title,
  description,
  thumbnailUrl,
  onChangeTitle,
  onChangeDescription,
  onChangeThumbnail,
  onNext,
}: {
  organization: schemas['Organization']
  title: string
  description: string
  thumbnailUrl: string | null
  onChangeTitle: (v: string) => void
  onChangeDescription: (v: string) => void
  onChangeThumbnail: (url: string | null) => void
  onNext: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const url = await uploadCourseThumbnail(organization, file)
    if (url) onChangeThumbnail(url)
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-3xl font-bold text-gray-900">Course Details</h1>
      <p className="mb-8 text-sm text-gray-500">
        We&apos;ll use your title and description to generate a sample course
        outline.
      </p>

      <div className="flex flex-col gap-5">
        {/* Details box */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-5 px-5 py-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => onChangeTitle(e.target.value)}
                placeholder="Examples: Public Speaking 101, Learning piano, …"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Brief description
              </label>
              <textarea
                value={description}
                onChange={(e) => onChangeDescription(e.target.value)}
                placeholder="Example: Learn the skills required to …"
                rows={5}
                className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Thumbnail box */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 px-5 py-5">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-sm font-bold text-gray-900">
                Thumbnail image
              </h3>
              <p className="text-xs text-gray-500">
                This image appears in Checkouts, your Spaire Space, in emails,
                social sharing and more.
              </p>
            </div>

            <div className="flex items-start gap-4">
              <div className="relative aspect-video w-48 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                {thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbnailUrl}
                    alt="Course thumbnail preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-gray-300">
                    <AddPhotoAlternateOutlined style={{ fontSize: 28 }} />
                    <span className="mt-1 text-[11px] text-gray-400">
                      Preview
                    </span>
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => void handleFile(e)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <AddPhotoAlternateOutlined style={{ fontSize: 14 }} />
                  {thumbnailUrl ? 'Change image' : 'Select image'}
                </button>
                {thumbnailUrl && (
                  <button
                    type="button"
                    onClick={() => onChangeThumbnail(null)}
                    className="text-left text-xs text-gray-400 hover:text-gray-600"
                  >
                    Remove
                  </button>
                )}
                <p className="mt-1 text-[11px] text-gray-400">
                  Recommended dimensions of 1280x720
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-end">
        <button
          onClick={onNext}
          disabled={!title.trim()}
          className="rounded-full bg-gray-900 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}

// ─── Step 2 — Pricing & Media ───────────────────────────────────────────────

type BillingCycle = 'one_time' | 'recurring'

const PRICE_OPTIONS: {
  value: PriceOption
  title: string
  description: string
}[] = [
  { value: 'fixed', title: 'Fixed price', description: 'Charge a set amount' },
  { value: 'free', title: 'Free', description: 'No charge. Give it away.' },
  {
    value: 'custom',
    title: 'Pay what you want',
    description: 'Let buyers choose their price',
  },
  {
    value: 'seat_based',
    title: 'Per seat',
    description: 'Price scales with seats or licenses',
  },
]

function StepPricing({
  organization,
  billingCycle,
  priceOption,
  priceAmount,
  paywallEnabled,
  productMediaUrl,
  onChangeBillingCycle,
  onSelectPrice,
  onChangeAmount,
  onTogglePaywall,
  onChangeProductMedia,
  onBack,
  onNext,
}: {
  organization: schemas['Organization']
  billingCycle: BillingCycle
  priceOption: PriceOption
  priceAmount: string
  paywallEnabled: boolean
  productMediaUrl: string | null
  onChangeBillingCycle: (c: BillingCycle) => void
  onSelectPrice: (p: PriceOption) => void
  onChangeAmount: (v: string) => void
  onTogglePaywall: () => void
  onChangeProductMedia: (url: string | null) => void
  onBack: () => void
  onNext: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const url = await uploadCourseThumbnail(organization, file)
    if (url) onChangeProductMedia(url)
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-3xl font-bold text-gray-900">Pricing</h1>
      <p className="mb-8 text-sm text-gray-500">
        Set your billing cycle and pricing model
      </p>

      <div className="flex flex-col gap-5">
        {/* Billing cycle */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="grid grid-cols-2 gap-3 p-4">
            {(
              [
                ['one_time', 'One-time purchase'],
                ['recurring', 'Recurring subscription'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onChangeBillingCycle(value)}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl border p-4 text-left text-sm font-medium transition-colors',
                  billingCycle === value
                    ? 'border-gray-900 bg-gray-50 text-gray-900'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    billingCycle === value
                      ? 'border-gray-900'
                      : 'border-gray-300',
                  )}
                >
                  {billingCycle === value && (
                    <span className="h-2 w-2 rounded-full bg-gray-900" />
                  )}
                </span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Price model + amount */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 p-4">
            <div className="grid grid-cols-2 gap-3">
              {PRICE_OPTIONS.map((opt) => {
                const selected = priceOption === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onSelectPrice(opt.value)}
                    className={cn(
                      'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors',
                      selected
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 bg-white hover:border-gray-300',
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                          selected ? 'border-gray-900' : 'border-gray-300',
                        )}
                      >
                        {selected && (
                          <span className="h-2 w-2 rounded-full bg-gray-900" />
                        )}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {opt.title}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{opt.description}</p>
                  </button>
                )
              })}
            </div>

            {priceOption === 'fixed' && (
              <div className="mt-2 flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={priceAmount}
                    onChange={(e) => onChangeAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-16 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-medium text-gray-500">
                    USD
                  </span>
                </div>
                <button
                  type="button"
                  className="flex h-10 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50"
                  disabled
                >
                  USD
                </button>
                <button
                  type="button"
                  className="flex h-10 items-center gap-1.5 rounded-xl bg-transparent px-3 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50"
                  disabled
                >
                  + Add Currency
                </button>
              </div>
            )}

            {priceOption === 'custom' && (
              <p className="text-xs text-gray-500">
                Buyers choose how much to pay (with an optional minimum).
              </p>
            )}
            {priceOption === 'seat_based' && (
              <p className="text-xs text-gray-500">
                Price scales with the number of seats or licenses purchased.
              </p>
            )}
          </div>
        </div>

        {/* Product Media */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-sm font-bold text-gray-900">Product Media</h3>
              <p className="text-xs text-gray-500">
                This image appears in Checkouts, your Spaire Space, in emails,
                social sharing and more.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => void handleFile(e)}
            />

            {productMediaUrl ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={productMediaUrl}
                  alt="Product media"
                  className="h-full w-full object-cover"
                />
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg bg-white/90 px-2.5 py-1 text-[11px] font-medium text-gray-700 shadow-sm hover:bg-white"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeProductMedia(null)}
                    className="rounded-lg bg-white/90 px-2.5 py-1 text-[11px] font-medium text-gray-700 shadow-sm hover:bg-white"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 text-center text-gray-500 transition-colors hover:border-gray-300"
              >
                {uploading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
                ) : (
                  <>
                    <AddPhotoAlternateOutlined fontSize="medium" />
                    <p className="mt-2 text-xs font-medium text-gray-700">
                      Add product media
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      Up to 10MB each. 16:9 ratio recommended for optimal
                      display.
                    </p>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Paywall */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">
                  Use a paywall for this course
                </span>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-gray-600 uppercase">
                  New
                </span>
              </div>
              <button
                type="button"
                onClick={onTogglePaywall}
                aria-pressed={paywallEnabled}
                className={cn(
                  'relative flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
                  paywallEnabled ? 'bg-gray-900' : 'bg-gray-200',
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
            <p className="text-xs text-gray-500">
              Enable limited course access to let your members experience the
              value before purchasing the full course.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={onBack}
          className="rounded-full border border-gray-300 px-7 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="rounded-full bg-gray-900 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
        >
          Generate outline
        </button>
      </div>
    </div>
  )
}

// ─── Generation animation (centered, premium) ────────────────────────────────

function GeneratingScreen({
  title,
  modulesCount,
  lessonsCount,
}: {
  title: string
  modulesCount: number
  lessonsCount: number
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6">
      <div className="relative flex h-28 w-28 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-gray-900/5" />
        <span
          className="absolute inset-2 animate-ping rounded-full bg-gray-900/10"
          style={{ animationDelay: '300ms' }}
        />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-100 border-t-gray-900" />
        </div>
      </div>
      <div className="mt-8 flex flex-col items-center text-center">
        <h2 className="text-xl font-semibold text-gray-900">
          Crafting your outline
        </h2>
        <p className="mt-1.5 max-w-sm text-sm text-gray-500">
          {title ? `“${title}” — ` : ''}
          {modulesCount} module{modulesCount === 1 ? '' : 's'} · {lessonsCount}{' '}
          lesson{lessonsCount === 1 ? '' : 's'} · generating…
        </p>
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

  const [wizardStep, setWizardStep] = useState<WizardStep>('details')

  // Form values
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('one_time')
  const [priceOption, setPriceOption] = useState<PriceOption>('fixed')
  const [priceAmount, setPriceAmount] = useState('')
  const [productMediaUrl, setProductMediaUrl] = useState<string | null>(null)
  const [paywallEnabled, setPaywallEnabled] = useState(false)
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

  const handleClose = () => {
    stopOutline()
    router.push(`/dashboard/${organization.slug}/products`)
  }

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
      const recurringInterval = billingCycle === 'recurring' ? 'month' : null

      const buildPrices = () => {
        if (priceOption === 'free') {
          return [{ amount_type: 'free', price_currency: 'usd' }]
        }
        if (priceOption === 'custom') {
          return [
            {
              amount_type: 'custom',
              price_currency: 'usd',
              minimum_amount: priceAmountCents || 0,
            },
          ]
        }
        if (priceOption === 'seat_based') {
          return [
            {
              amount_type: 'seat_based',
              price_currency: 'usd',
              seat_tiers: {
                tiers: [
                  {
                    min_seats: 1,
                    max_seats: null,
                    price_per_seat: priceAmountCents || 0,
                  },
                ],
              },
            },
          ]
        }
        return [
          {
            amount_type: 'fixed',
            price_currency: 'usd',
            price_amount: priceAmountCents,
          },
        ]
      }

      const productBody = {
        ...baseFields,
        prices: buildPrices(),
        recurring_interval: recurringInterval,
      }

      const productResult = await createProduct.mutateAsync(
        productBody as never,
      )
      if (productResult.error || !productResult.data) {
        throw new Error('Product creation failed')
      }

      const course = await createCourse.mutateAsync({
        product_id: productResult.data.id,
        organization_id: organization.id,
        title,
        course_type: 'evergreen',
        paywall_enabled: paywallEnabled,
        ai_generated: true,
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
        description: `"${title}" is ready to edit`,
      })
      router.push(`/dashboard/${organization.slug}/courses/${course.id}?new=1`)
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

  const renderStep = () => {
    if (wizardStep === 'details') {
      return (
        <StepDetails
          organization={organization}
          title={title}
          description={description}
          thumbnailUrl={thumbnailUrl}
          onChangeTitle={setTitle}
          onChangeDescription={setDescription}
          onChangeThumbnail={(url) => {
            setThumbnailUrl(url)
            // Sync product media with thumbnail by default
            if (!productMediaUrl) setProductMediaUrl(url)
          }}
          onNext={() => setWizardStep('pricing')}
        />
      )
    }

    if (wizardStep === 'pricing') {
      return (
        <StepPricing
          organization={organization}
          billingCycle={billingCycle}
          priceOption={priceOption}
          priceAmount={priceAmount}
          paywallEnabled={paywallEnabled}
          productMediaUrl={productMediaUrl ?? thumbnailUrl}
          onChangeBillingCycle={setBillingCycle}
          onSelectPrice={setPriceOption}
          onChangeAmount={setPriceAmount}
          onTogglePaywall={() => setPaywallEnabled((v) => !v)}
          onChangeProductMedia={setProductMediaUrl}
          onBack={() => setWizardStep('details')}
          onNext={startGeneration}
        />
      )
    }

    if (wizardStep === 'generating') {
      return (
        <GeneratingScreen
          title={title}
          modulesCount={modulesCount}
          lessonsCount={lessonsCount}
        />
      )
    }

    if (wizardStep === 'outline') {
      return (
        <div className="mx-auto max-w-2xl px-6 py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {modulesCount} modules · {lessonsCount} lessons
              {isOutlineStreaming && ' · generating…'}
            </p>
          </div>

          {(outlineError || generateError) && (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              Something went wrong. Please try again.
            </div>
          )}

          <StreamingOutline
            outline={(partialOutline as PartialOutline) ?? { modules: [] }}
            isStreaming={false}
          />

          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500">
            This outline is just a starting point — you can edit modules,
            lessons, and content after creating the course.
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              onClick={regenerateOutline}
              className="flex items-center gap-2 rounded-full border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <AutorenewOutlined fontSize="small" />
              Regenerate
            </button>
            <button
              onClick={createCourseWithProduct}
              className="rounded-full bg-gray-900 px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
            >
              Create Course
            </button>
          </div>
        </div>
      )
    }

    // creating
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50">
          <CheckCircleOutlined
            className="text-green-500"
            sx={{ fontSize: 32 }}
          />
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

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <CourseWizardHeader step={wizardStep} onClose={handleClose} />
      <div className="flex-1">{renderStep()}</div>
    </div>
  )
}
