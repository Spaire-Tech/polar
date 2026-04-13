'use client'

import revalidate from '@/app/actions'
import { useAuth, useOAuthAccounts, useOnboardingTracking } from '@/hooks'
import { inferSignupMethod } from '@/hooks/onboarding'
import { usePostHog } from '@/hooks/posthog'
import { useCreateOrganization, useUpdateOrganization } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { CONFIG } from '@/utils/config'
import { FormControl } from '@mui/material'
import { schemas } from '@spaire/client'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import Button from '@spaire/ui/components/atoms/Button'
import Input from '@spaire/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@spaire/ui/components/atoms/Select'
import { Checkbox } from '@spaire/ui/components/ui/checkbox'
import {
  Form,
  FormField,
  FormItem,
  FormMessage,
} from '@spaire/ui/components/ui/form'
import { Label } from '@spaire/ui/components/ui/label'
import AddPhotoAlternateOutlined from '@mui/icons-material/AddPhotoAlternateOutlined'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import slugify from 'slugify'
import { twMerge } from 'tailwind-merge'
import { Upload } from '../FileUpload/Upload'
import { FadeUp } from '../Animated/FadeUp'
import LogoIcon from '../Brand/LogoIcon'
import { getStatusRedirect } from '../Toast/utils'
import SupportedUseCases from './components/SupportedUseCases'
import { OnboardingStepper } from './OnboardingStepper'

type PresentmentCurrency = schemas['PresentmentCurrency']

const CURRENCIES: { code: PresentmentCurrency; flag: string }[] = [
  { code: 'usd', flag: '🇺🇸' },
  { code: 'eur', flag: '🇪🇺' },
  { code: 'gbp', flag: '🇬🇧' },
  { code: 'cad', flag: '🇨🇦' },
  { code: 'aud', flag: '🇦🇺' },
  { code: 'chf', flag: '🇨🇭' },
  { code: 'jpy', flag: '🇯🇵' },
  { code: 'sek', flag: '🇸🇪' },
  { code: 'inr', flag: '🇮🇳' },
  { code: 'brl', flag: '🇧🇷' },
  { code: 'aed', flag: '🇦🇪' },
  { code: 'ars', flag: '🇦🇷' },
  { code: 'clp', flag: '🇨🇱' },
  { code: 'cny', flag: '🇨🇳' },
  { code: 'cop', flag: '🇨🇴' },
  { code: 'czk', flag: '🇨🇿' },
  { code: 'dkk', flag: '🇩🇰' },
  { code: 'hkd', flag: '🇭🇰' },
  { code: 'huf', flag: '🇭🇺' },
  { code: 'idr', flag: '🇮🇩' },
  { code: 'ils', flag: '🇮🇱' },
  { code: 'krw', flag: '🇰🇷' },
  { code: 'mxn', flag: '🇲🇽' },
  { code: 'myr', flag: '🇲🇾' },
  { code: 'nok', flag: '🇳🇴' },
  { code: 'nzd', flag: '🇳🇿' },
  { code: 'pen', flag: '🇵🇪' },
  { code: 'php', flag: '🇵🇭' },
  { code: 'pln', flag: '🇵🇱' },
  { code: 'ron', flag: '🇷🇴' },
  { code: 'sar', flag: '🇸🇦' },
  { code: 'sgd', flag: '🇸🇬' },
  { code: 'thb', flag: '🇹🇭' },
  { code: 'try', flag: '🇹🇷' },
  { code: 'twd', flag: '🇹🇼' },
  { code: 'zar', flag: '🇿🇦' },
]

const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
]

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
  const { startOnboarding, trackStepStarted, trackStepCompleted } =
    useOnboardingTracking()

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
  const updateOrganization = useUpdateOrganization()
  const [editedSlug, setEditedSlug] = useState(false)
  const [currency, setCurrency] = useState<PresentmentCurrency>('usd')
  const [accountType, setAccountType] = useState<'individual' | 'business'>('individual')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      name: data.name,
      slug: slug as string,
      terms: data.terms,
    }

    posthog.capture('dashboard:organizations:create:submit', params)

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

    // Always persist the selected currency and avatar so product defaults are correct
    if (!hasExistingOrg) {
      // Upload logo file if selected
      let uploadedAvatarUrl: string | undefined
      if (logoFile) {
        try {
          uploadedAvatarUrl = await new Promise<string>((resolve, reject) => {
            const upload = new Upload({
              service: 'organization_avatar',
              organization,
              file: logoFile,
              onFileProcessing: () => {},
              onFileCreate: () => {},
              onFileUploadProgress: () => {},
              onFileUploaded: (response) => {
                resolve((response as { public_url: string }).public_url)
              },
              onFileError: (_id, err) => reject(err),
            })
            upload.run()
          })
        } catch {
          // continue without avatar if upload fails
        }
      }

      await updateOrganization.mutateAsync({
        id: organization.id,
        body: {
          default_presentment_currency: currency,
          ...(uploadedAvatarUrl ? { avatar_url: uploadedAvatarUrl } : {}),
        },
        userId: currentUser?.id,
      })

      // Update auth context so the sidebar immediately reflects the new avatar
      if (uploadedAvatarUrl) {
        setUserOrganizations((orgs) =>
          orgs.map((o) =>
            o.id === organization.id ? { ...o, avatar_url: uploadedAvatarUrl } : o,
          ),
        )
      }

      // Explicitly revalidate so the layout re-fetches the org with the new currency
      // before the router push renders the next page
      await revalidate(`organizations:${organization.id}`)
      await revalidate(`organizations:${organization.slug}`)
    }

    if (!hasExistingOrg) {
      await trackStepCompleted('org', organization.id)
    }

    if (hasExistingOrg) {
      router.push(
        getStatusRedirect(
          `/dashboard/${organization.slug}`,
          'Organization created',
          'Welcome to your new workspace',
        ),
      )
    } else {
      router.push(`/dashboard/${organization.slug}/onboarding/product`)
    }
  }

  return (
    <div className="dark:md:bg-spaire-950 flex h-full w-full flex-row">
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
              <p className="dark:text-spaire-400 max-w-md text-base text-gray-500">
                {hasExistingOrg
                  ? 'Set up a new workspace for your team or project.'
                  : "A few quick questions to personalize your setup."}
              </p>
            </FadeUp>

            {/* Using Spaire as — Individual / Business toggle */}
            {!hasExistingOrg && (
              <FadeUp className="flex flex-col gap-y-4">
                <div className="flex flex-col gap-y-1">
                  <Label className="text-sm font-medium">Using Spaire as</Label>
                  <p className="dark:text-spaire-500 text-xs text-gray-400">
                    Choose how you&apos;ll be using the platform.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { id: 'individual' as const, label: 'Individual', description: 'Sell as a solo creator or freelancer' },
                    { id: 'business' as const, label: 'Business', description: 'Sell as a registered company or team' },
                  ]).map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setAccountType(type.id)}
                      className={twMerge(
                        'dark:bg-spaire-900 dark:border-spaire-700 flex cursor-pointer flex-col gap-y-1.5 rounded-2xl border border-gray-200 bg-white p-5 text-left transition-all',
                        accountType === type.id
                          ? 'border-blue-500 ring-1 ring-blue-500 dark:border-blue-500'
                          : 'hover:border-gray-300 dark:hover:border-spaire-600',
                      )}
                    >
                      <span className="text-sm font-medium">{type.label}</span>
                      <span className="dark:text-spaire-500 text-xs leading-relaxed text-gray-400">
                        {type.description}
                      </span>
                    </button>
                  ))}
                </div>
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
                    <p className="dark:text-spaire-500 text-sm text-gray-400">
                      This is where you&apos;ll manage your products and payments.
                    </p>
                  </div>

                  <div className="dark:bg-spaire-900 flex flex-col gap-y-5 rounded-2xl border border-gray-200 bg-white p-6 dark:border-none">
                    {/* Logo upload — optional */}
                    <div className="flex flex-col gap-y-2">
                      <Label>
                        Logo
                      </Label>
                      <p className="dark:text-spaire-500 text-xs text-gray-400">
                        Your logo appears on invoices. Use a square image for best results.
                      </p>
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-full transition-opacity hover:opacity-75"
                        >
                          <Avatar
                            avatar_url={logoPreview || ''}
                            name={name || 'Logo'}
                            className="h-14 w-14"
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity hover:opacity-100 bg-black/20 rounded-full">
                            <AddPhotoAlternateOutlined className="text-white" fontSize="small" />
                          </div>
                        </button>
                        <div className="flex flex-col gap-y-1">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="dark:border-spaire-700 cursor-pointer rounded-lg border border-gray-200 px-3 py-1.5 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-spaire-800"
                          >
                            {logoFile ? 'Change logo' : 'Upload logo'}
                          </button>
                          {logoFile && (
                            <span className="text-xs text-gray-500 truncate max-w-[160px]">{logoFile.name}</span>
                          )}
                        </div>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setLogoFile(file)
                            setLogoPreview(URL.createObjectURL(file))
                          }
                        }}
                      />
                    </div>

                    <FormField
                      control={control}
                      name="name"
                      rules={{
                        required: 'This field is required',
                      }}
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormControl className="flex w-full flex-col gap-y-2">
                            <Label htmlFor="name">
                              {accountType === 'business' ? 'Organization Name' : 'Name'}
                            </Label>
                            <Input {...field} placeholder={accountType === 'business' ? 'Acme Inc.' : 'Jane Doe'} />
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
                            <Label htmlFor="slug">
                              {accountType === 'business' ? 'Organization Slug' : 'Slug'}
                            </Label>
                            <Input
                              type="text"
                              {...field}
                              size={slug?.length || 1}
                              placeholder={accountType === 'business' ? 'acme-inc' : 'jane-doe'}
                              onFocus={() => setEditedSlug(true)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Business-only fields */}
                    {accountType === 'business' && (
                      <>
                        <div className="flex flex-col gap-y-2">
                          <Label>Registered Business Name</Label>
                          <Input placeholder="Acme Corporation Ltd." />
                        </div>
                        <div className="flex flex-col gap-y-2">
                          <Label>Business Country</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a country" />
                            </SelectTrigger>
                            <SelectContent>
                              {COUNTRIES.map((c) => (
                                <SelectItem key={c.code} value={c.code}>
                                  {c.flag} {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </div>
                </FadeUp>

                {/* Currency selector — only for new orgs */}
                {!hasExistingOrg && (
                  <FadeUp className="dark:bg-spaire-900 flex flex-col gap-y-5 rounded-2xl border border-gray-200 bg-white p-6 dark:border-none">
                    <div className="flex flex-col gap-y-1">
                      <Label className="text-sm font-medium">Default payment currency</Label>
                      <p className="dark:text-spaire-500 text-xs text-gray-400">
                        Used for your products by default. You can change this later in settings.
                      </p>
                    </div>
                    <Select value={currency} onValueChange={(v) => setCurrency(v as PresentmentCurrency)}>
                      <SelectTrigger>
                        <SelectValue>
                          {(() => {
                            const c = CURRENCIES.find((c) => c.code === currency)
                            return c ? `${c.flag} ${c.code.toUpperCase()}` : currency.toUpperCase()
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.flag} {c.code.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FadeUp>
                )}

                <FadeUp className="dark:bg-spaire-900 flex flex-col gap-y-4 rounded-2xl border border-gray-200 bg-white p-6 dark:border-none">
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
                              <ul className="dark:text-spaire-500 flex flex-col gap-y-1 text-sm text-gray-500">
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
                                    href="https://www.spairehq.com/legal/terms-of-service"
                                    className="text-blue-600 hover:underline dark:text-blue-400"
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Terms of Service
                                  </a>
                                </li>
                                <li>
                                  <a
                                    href="https://www.spairehq.com/legal/privacy-policy"
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
