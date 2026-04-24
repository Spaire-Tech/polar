'use client'

import { useCreateCourse } from '@/hooks/queries/courses'
import { useCreateProduct } from '@/hooks/queries/products'
import { experimental_useObject as useObject } from '@ai-sdk/react'
import AutoStoriesOutlined from '@mui/icons-material/AutoStoriesOutlined'
import AutorenewOutlined from '@mui/icons-material/AutorenewOutlined'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import OndemandVideoOutlined from '@mui/icons-material/OndemandVideoOutlined'
import TextSnippetOutlined from '@mui/icons-material/TextSnippetOutlined'
import { schemas } from '@spaire/client'
import { cn } from '@spaire/ui/lib/utils'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from '../Toast/use-toast'
import { outlineSchema } from './schemas'

type PriceOption = 'free' | 'onetime' | 'monthly'

type PartialModule = {
  title?: string
  description?: string
  lessons?: { title?: string; content_type?: 'text' | 'video' }[]
}

type PartialOutline = {
  modules?: PartialModule[]
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
              'rounded-xl border bg-white overflow-hidden transition-colors',
              isStreaming && isLastModule
                ? 'border-blue-300 shadow-sm'
                : 'border-gray-200',
            )}
          >
            <button
              onClick={() => toggle(i)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 shrink-0">
                {i + 1}
              </span>
              <span className="flex-1 font-medium text-gray-900 text-sm">
                {mod.title || (
                  <span className="inline-block h-4 w-48 animate-pulse rounded bg-gray-100" />
                )}
              </span>
              <span className="text-xs text-gray-400 shrink-0">
                {lessons.length} lesson{lessons.length !== 1 ? 's' : ''}
              </span>
              <ExpandMoreOutlined
                className={cn(
                  'text-gray-400 transition-transform shrink-0',
                  expanded[i] && 'rotate-180',
                )}
                fontSize="small"
              />
            </button>
            {expanded[i] && lessons.length > 0 && (
              <div className="border-t border-gray-100 divide-y divide-gray-100">
                {lessons.map((lesson, j) => (
                  <div
                    key={j}
                    className="flex items-center gap-3 px-4 py-2.5 pl-14"
                  >
                    {lesson.content_type === 'video' ? (
                      <OndemandVideoOutlined
                        fontSize="small"
                        className="text-purple-500 shrink-0"
                      />
                    ) : (
                      <TextSnippetOutlined
                        fontSize="small"
                        className="text-blue-400 shrink-0"
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

export default function CourseWizard({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const createProduct = useCreateProduct(organization)
  const createCourse = useCreateCourse()

  // Step 1 form
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [priceOption, setPriceOption] = useState<PriceOption>('free')
  const [priceAmount, setPriceAmount] = useState('')

  // Wizard state
  const [step, setStep] = useState<
    'form' | 'generating' | 'outline' | 'creating'
  >('form')
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
    onFinish: () => setStep('outline'),
    onError: () => {
      setGenerateError('Failed to generate outline. Please try again.')
      setStep('form')
    },
  })

  const generateOutline = () => {
    if (!title.trim()) return
    setGenerateError(null)
    setStep('generating')
    submitOutline({ title, description, targetAudience })
  }

  const regenerateOutline = () => {
    stopOutline()
    setStep('form')
  }

  const createCourseWithProduct = async () => {
    const outline = partialOutline
    if (!outline?.modules?.length) return
    setStep('creating')

    try {
      const priceAmountCents = Math.round(parseFloat(priceAmount || '0') * 100)

      const baseProductFields = {
        name: title,
        description: description || null,
        visibility: 'public',
        organization_id: organization.id,
      }

      const productBody =
        priceOption === 'monthly'
          ? {
              ...baseProductFields,
              prices: [
                {
                  amount_type: 'fixed',
                  price_currency: 'usd',
                  price_amount: priceAmountCents,
                },
              ],
              recurring_interval: 'month',
              recurring_interval_count: 1,
            }
          : priceOption === 'onetime'
            ? {
                ...baseProductFields,
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
                ...baseProductFields,
                prices: [{ amount_type: 'free', price_currency: 'usd' }],
                recurring_interval: null,
              }

      const productResult = await createProduct.mutateAsync(productBody as never)

      if (productResult.error || !productResult.data) {
        throw new Error('Product creation failed')
      }

      const product = productResult.data

      const course = await createCourse.mutateAsync({
        product_id: product.id,
        organization_id: organization.id,
        title,
        ai_generated: true,
        modules: outline.modules
          .filter((m): m is { title: string; description?: string; lessons?: { title?: string; content_type?: 'text' | 'video' }[] } =>
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

      router.push(`/dashboard/${organization.slug}/courses/${course.id}`)
    } catch (err) {
      console.error('[CourseWizard] create error:', err)
      toast({
        title: 'Something went wrong',
        description: 'Could not create the course. Please try again.',
      })
      setStep('outline')
    }
  }

  const modulesCount = partialOutline?.modules?.length ?? 0
  const lessonsCount =
    partialOutline?.modules?.reduce(
      (acc, m) => acc + (m?.lessons?.length ?? 0),
      0,
    ) ?? 0

  if (step === 'generating' || step === 'outline') {
    const ready = step === 'outline'
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {modulesCount} modules · {lessonsCount} lessons
            {!ready && isOutlineStreaming && ' · generating…'}
          </p>
        </div>

        {outlineError && (
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
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <AutorenewOutlined fontSize="small" />
              Regenerate
            </button>
            <button
              onClick={createCourseWithProduct}
              className="flex items-center gap-2 rounded-xl bg-blue-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition-colors"
            >
              Create Course
            </button>
          </div>
        )}
      </div>
    )
  }

  if (step === 'creating') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-24">
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

  // Step 1: form
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
          <AutoStoriesOutlined className="text-blue-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Create a Course</h1>
          <p className="text-sm text-gray-500">
            Tell us about your course and Claude will design the curriculum.
          </p>
        </div>
      </div>

      {generateError && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {generateError}
        </div>
      )}

      <div className="flex flex-col gap-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Course title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The Complete React Course"
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What will students learn? What problem does this course solve?"
            rows={3}
            className="w-full resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Target audience
          </label>
          <input
            type="text"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="e.g. Beginner web developers who know HTML/CSS"
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Pricing
          </label>
          <div className="flex gap-2">
            {(['free', 'onetime', 'monthly'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setPriceOption(opt)}
                className={cn(
                  'flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
                  priceOption === opt
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                )}
              >
                {opt === 'free' ? 'Free' : opt === 'onetime' ? 'One-time' : 'Monthly'}
              </button>
            ))}
          </div>
          {priceOption !== 'free' && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500">$</span>
              <input
                type="number"
                value={priceAmount}
                onChange={(e) => setPriceAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-32 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              {priceOption === 'monthly' && (
                <span className="text-sm text-gray-400">/ month</span>
              )}
            </div>
          )}
        </div>

        <button
          onClick={generateOutline}
          disabled={!title.trim()}
          className="mt-2 w-full rounded-xl bg-blue-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Generate Outline with AI
        </button>
      </div>
    </div>
  )
}
