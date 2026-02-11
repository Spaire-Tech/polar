'use client'

import revalidate from '@/app/actions'
import { useAuth, useOAuthAccounts, useOnboardingTracking } from '@/hooks'
import { inferSignupMethod } from '@/hooks/onboarding'
import { usePostHog } from '@/hooks/posthog'
import { useCreateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { CONFIG } from '@/utils/config'
import { FormControl } from '@mui/material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
import {
  Form,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { Label } from '@polar-sh/ui/components/ui/label'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import slugify from 'slugify'
import { FadeUp } from '../Animated/FadeUp'
import LogoIcon from '../Brand/LogoIcon'
import { getStatusRedirect } from '../Toast/utils'
import SupportedUseCases from './components/SupportedUseCases'
import { OnboardingStepper } from './OnboardingStepper'
import { twMerge } from 'tailwind-merge'

const businessTypes = [
  { id: 'early-stage', label: 'Early-Stage Startup', description: 'Pre-seed to seed, finding product-market fit' },
  { id: 'venture-backed', label: 'Venture-Backed', description: 'Series A+ with an established product' },
  { id: 'individual', label: 'Individual Creator', description: 'Solo founder, indie hacker, or creator' },
  { id: 'bootstrapped', label: 'Bootstrapped / Profitable', description: 'Self-funded and growing organically' },
] as const

const audienceTypes = [
  { id: 'b2b', label: 'B2B', description: 'Selling to businesses and teams' },
  { id: 'b2c', label: 'B2C', description: 'Selling to individual consumers' },
  { id: 'both', label: 'Both', description: 'A mix of business and consumer' },
] as const

const referralSources = [
  { id: 'search', label: 'Search Engine' },
  { id: 'twitter', label: 'Twitter / X' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'friend', label: 'Friend or Colleague' },
  { id: 'blog', label: 'Blog or Article' },
  { id: 'podcast', label: 'Podcast' },
  { id: 'github', label: 'GitHub' },
  { id: 'producthunt', label: 'Product Hunt' },
  { id: 'hackernews', label: 'Hacker News' },
  { id: 'community', label: 'Online Community' },
  { id: 'other', label: 'Other' },
] as const

export interface OrganizationStepProps {
  slug?: string
  validationErrors?: schemas['ValidationError'][]
  error?: string
  hasExistingOrg: boolean
}

export const OrganizationStep = ({
  slug: initialSlug,
  validationErrors,
  error,
  hasExistingOrg,
}: OrganizationStepProps) => {
  const posthog = usePostHog()
  const { currentUser, setUserOrganizations } = useAuth()
  const oauthAccounts = useOAuthAccounts()
  const {
    startOnboarding,
    trackStepStarted,
    trackStepCompleted,
    experimentVariant,
  } = useOnboardingTracking()

  const form = useForm<{
    name: string
    slug: string
    terms: boolean
  }>({
    defaultValues: {
      name: initialSlug || '',
      slug: initialSlug || '',
      terms: false,
    },
  })

  const {
    control,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    setValue,
    formState: { errors },
  } = form
  const createOrganization = useCreateOrganization()
  const [editedSlug, setEditedSlug] = useState(false)
  const [businessType, setBusinessType] = useState<string | null>(null)
  const [audienceType, setAudienceType] = useState<string | null>(null)
  const [referralSource, setReferralSource] = useState<string | null>(null)

  const router = useRouter()

  useEffect(() => {
    posthog.capture('dashboard:organizations:create:view')

    if (!hasExistingOrg) {
      const signupMethod = inferSignupMethod(oauthAccounts)
      startOnboarding(signupMethod)
      trackStepStarted('org')
    }
  }, [
    hasExistingOrg,
    oauthAccounts,
    posthog,
    startOnboarding,
    trackStepStarted,
  ])

  useEffect(() => {
    if (validationErrors) {
      setValidationErrors(validationErrors, setError)
    }
    if (error) {
      setError('root', { message: error })
    } else {
      clearErrors('root')
    }
  }, [validationErrors, error, setError, clearErrors])

  const name = watch('name')
  const slug = watch('slug')
  const terms = watch('terms')

  useEffect(() => {
    if (!editedSlug && name) {
      setValue('slug', slugify(name, { lower: true, strict: true }))
    } else if (slug) {
      setValue(
        'slug',
        slugify(slug, { lower: true, trim: false, strict: true }),
      )
    }
  }, [name, editedSlug, slug, setValue])

  const onSubmit = async (data: {
    name: string
    slug: string
    terms: boolean
  }) => {
    if (!data.terms) return

    const params = {
      ...data,
      slug: slug as string,
    }

    posthog.capture('dashboard:organizations:create:submit', {
      ...params,
      business_type: businessType,
      audience_type: audienceType,
      referral_source: referralSource,
    })

    const { data: organization, error } =
      await createOrganization.mutateAsync(params)

    if (error) {
      if (error.detail) {
        setValidationErrors(error.detail, setError)
      }
      return
    }

    await revalidate(`users:${currentUser?.id}:organizations`, {
      expire: 0,
    })
    setUserOrganizations((orgs) => [...orgs, organization])

    if (!hasExistingOrg) {
      await trackStepCompleted('org', organization.id)
    }

    let queryParams = ''
    if (hasExistingOrg) {
      queryParams = '?existing_org=true'
    }

    router.push(
      getStatusRedirect(
        `/dashboard/${organization.slug}/onboarding/product${queryParams}`,
        'Organization created',
        'You can now create your first product',
      ),
    )
  }

  return (
    <div className="dark:md:bg-polar-950 flex h-full w-full flex-row">
      {/* Stepper Sidebar - desktop only */}
      <OnboardingStepper currentStep={0} />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex w-full flex-col items-center px-6 pt-16 pb-24 md:px-20">
          <motion.div
            initial="hidden"
            animate="visible"
            transition={{ duration: 1, staggerChildren: 0.2 }}
            className="flex w-full max-w-2xl flex-col gap-16"
          >
            {/* Header */}
            <FadeUp className="flex flex-col gap-y-3">
              <div className="md:hidden mb-8">
                <LogoIcon size={36} />
              </div>
              <h1 className="text-2xl font-medium tracking-tight md:text-3xl">
                {hasExistingOrg
                  ? 'Add a new organization'
                  : 'Welcome to Spaire'}
              </h1>
              <p className="dark:text-polar-400 max-w-md text-base text-gray-500">
                {hasExistingOrg
                  ? 'Set up a new workspace for your team or project.'
                  : "A few quick questions to personalize your setup."}
              </p>
            </FadeUp>

            {/* About You Section - only show for new users */}
            {!hasExistingOrg && (
              <FadeUp className="flex flex-col gap-y-10">
                {/* Business Stage */}
                <div className="flex flex-col gap-y-4">
                  <div className="flex flex-col gap-y-1">
                    <Label className="text-sm font-medium">What best describes your business?</Label>
                    <p className="dark:text-polar-500 text-xs text-gray-400">
                      This helps us tailor your onboarding experience.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {businessTypes.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setBusinessType(type.id)}
                        className={twMerge(
                          'dark:bg-polar-900 dark:border-polar-700 flex cursor-pointer flex-col gap-y-1.5 rounded-2xl border border-gray-200 bg-white p-5 text-left transition-all',
                          businessType === type.id
                            ? 'border-blue-500 ring-1 ring-blue-500 dark:border-blue-500'
                            : 'hover:border-gray-300 dark:hover:border-polar-600',
                        )}
                      >
                        <span className="text-sm font-medium">{type.label}</span>
                        <span className="dark:text-polar-500 text-xs leading-relaxed text-gray-400">
                          {type.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Audience Type */}
                <div className="flex flex-col gap-y-4">
                  <div className="flex flex-col gap-y-1">
                    <Label className="text-sm font-medium">Who are your customers?</Label>
                    <p className="dark:text-polar-500 text-xs text-gray-400">
                      We&apos;ll optimize your checkout and billing accordingly.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {audienceTypes.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setAudienceType(type.id)}
                        className={twMerge(
                          'dark:bg-polar-900 dark:border-polar-700 flex cursor-pointer flex-col items-center gap-y-1.5 rounded-2xl border border-gray-200 bg-white p-5 text-center transition-all',
                          audienceType === type.id
                            ? 'border-blue-500 ring-1 ring-blue-500 dark:border-blue-500'
                            : 'hover:border-gray-300 dark:hover:border-polar-600',
                        )}
                      >
                        <span className="text-sm font-medium">{type.label}</span>
                        <span className="dark:text-polar-500 text-xs text-gray-400">
                          {type.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Referral Source */}
                <div className="flex flex-col gap-y-4">
                  <Label className="text-sm font-medium">How did you hear about Spaire?</Label>
                  <div className="flex flex-wrap gap-2.5">
                    {referralSources.map((source) => (
                      <button
                        key={source.id}
                        type="button"
                        onClick={() => setReferralSource(source.id)}
                        className={twMerge(
                          'dark:bg-polar-900 dark:border-polar-700 cursor-pointer rounded-full border border-gray-200 px-4 py-2 text-sm transition-all',
                          referralSource === source.id
                            ? 'border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-500 dark:bg-blue-500/10 dark:text-blue-400'
                            : 'hover:border-gray-300 dark:hover:border-polar-600',
                        )}
                      >
                        {source.label}
                      </button>
                    ))}
                  </div>
                </div>
              </FadeUp>
            )}

            {/* Divider */}
            {!hasExistingOrg && (
              <FadeUp>
                <div className="dark:border-polar-800 border-t border-gray-100" />
              </FadeUp>
            )}

            {/* Organization Form */}
            <Form {...form}>
              <form
                onSubmit={handleSubmit(onSubmit)}
                className="flex w-full flex-col gap-y-10"
              >
                <FadeUp className="flex flex-col gap-y-6">
                  <div className="flex flex-col gap-y-1">
                    <h2 className="text-base font-medium">
                      {hasExistingOrg ? 'Organization details' : 'Your workspace'}
                    </h2>
                    <p className="dark:text-polar-500 text-sm text-gray-400">
                      This is where you&apos;ll manage your products and payments.
                    </p>
                  </div>

                  <div className="dark:bg-polar-900 flex flex-col gap-y-5 rounded-2xl border border-gray-200 bg-white p-6 dark:border-none">
                    <FormField
                      control={control}
                      name="name"
                      rules={{
                        required: 'This field is required',
                      }}
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormControl className="flex w-full flex-col gap-y-2">
                            <Label htmlFor="name">Organization Name</Label>
                            <Input {...field} placeholder="Acme Inc." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name="slug"
                      rules={{
                        required: 'Slug is required',
                      }}
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormControl className="flex w-full flex-col gap-y-2">
                            <Label htmlFor="slug">URL Handle</Label>
                            <Input
                              type="text"
                              {...field}
                              size={slug?.length || 1}
                              placeholder="acme-inc"
                              onFocus={() => setEditedSlug(true)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </FadeUp>

                <FadeUp className="dark:bg-polar-900 flex flex-col gap-y-4 rounded-2xl border border-gray-200 bg-white p-6 dark:border-none">
                  <SupportedUseCases />
                </FadeUp>

                <FadeUp>
                  <FormField
                    control={control}
                    name="terms"
                    rules={{
                      required: 'You must accept the terms to continue',
                    }}
                    render={({ field }) => {
                      return (
                        <FormItem>
                          <div className="flex flex-row items-start gap-x-3">
                            <Checkbox
                              id="terms"
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                const value = checked ? true : false
                                setValue('terms', value)
                              }}
                              className="mt-1"
                            />
                            <div className="flex flex-col gap-y-2 text-sm">
                              <label
                                htmlFor="terms"
                                className="cursor-pointer leading-relaxed font-medium"
                              >
                                I acknowledge the platform guidelines and accept
                                Spaire&apos;s terms
                              </label>
                              <ul className="dark:text-polar-500 flex flex-col gap-y-1 text-sm text-gray-500">
                                <li>
                                  <a
                                    href="https://docs.spairehq.com/merchant-of-record/account-reviews"
                                    className="text-blue-600 hover:underline dark:text-blue-400"
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Account Reviews Policy
                                  </a>
                                  {' - '}I&apos;ll comply with KYC/AML
                                  requirements including website and social
                                  verification
                                </li>
                                <li>
                                  <a
                                    href="https://polar.sh/legal/terms"
                                    className="text-blue-600 hover:underline dark:text-blue-400"
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Terms of Service
                                  </a>
                                </li>
                                <li>
                                  <a
                                    href="https://polar.sh/legal/privacy"
                                    className="text-blue-600 hover:underline dark:text-blue-400"
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Privacy Policy
                                  </a>
                                </li>
                              </ul>
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )
                    }}
                  />
                </FadeUp>

                {errors.root && (
                  <p className="text-destructive-foreground text-sm">
                    {errors.root.message}
                  </p>
                )}

                <FadeUp className="flex flex-col gap-y-4 pt-2">
                  <Button
                    type="submit"
                    size="lg"
                    loading={createOrganization.isPending}
                    disabled={name.length === 0 || slug.length === 0 || !terms}
                  >
                    Continue
                  </Button>
                  {hasExistingOrg ? (
                    <Link href={`/dashboard`} className="w-full">
                      <Button variant="secondary" fullWidth size="lg">
                        Back to Dashboard
                      </Button>
                    </Link>
                  ) : (
                    <Link
                      href={`${CONFIG.BASE_URL}/v1/auth/logout`}
                      prefetch={false}
                      className="w-full"
                    >
                      <Button variant="secondary" fullWidth size="lg">
                        Sign Out
                      </Button>
                    </Link>
                  )}
                </FadeUp>
              </form>
            </Form>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
