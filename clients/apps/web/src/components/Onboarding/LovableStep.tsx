'use client'

import { useOnboardingTracking } from '@/hooks'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { twMerge } from 'tailwind-merge'
import { FadeUp } from '../Animated/FadeUp'
import LogoIcon from '../Brand/LogoIcon'
import LovableIcon from '../Icons/frameworks/lovable'
import { OnboardingStepper } from './OnboardingStepper'
import OrganizationAccessTokensSettings from '../Settings/OrganizationAccessTokensSettings'
import { schemas } from '@polar-sh/client'

const getLovablePrompt = (
  products: schemas['Product'][],
  token: string | null,
) => {
  const productList = products
    .map((p) => `- "${p.name}" (ID: ${p.id})`)
    .join('\n')

  const productSection =
    products.length > 0
      ? `

3. Create a pricing page that uses Spaire's embedded checkout. Use the following product(s):
${productList}

4. For each product, add a checkout button that opens Spaire checkout. Use this pattern:
   import { SpaireEmbedCheckout } from "@spaire/checkout";

   // Open checkout for a product
   const checkout = new SpaireEmbedCheckout();
   checkout.open({ productId: "<product-id>" });

5. Create a /success page that shows a confirmation message after purchase.

6. Style everything to match the existing app design.`
      : `

3. Create a pricing page with a checkout button that opens Spaire checkout. Use this pattern:
   import { SpaireEmbedCheckout } from "@spaire/checkout";

   const checkout = new SpaireEmbedCheckout();
   checkout.open({ productId: "<your-product-id>" });

4. Create a /success page that shows a confirmation message after purchase.

5. Style everything to match the existing app design.`

  return `Add Spaire billing to my app. Here's what I need:

1. Install the @spaire/checkout package.

2. Add these environment variables to .env:
   SPAIRE_ACCESS_TOKEN=${token ?? '<your-token>'}
   SPAIRE_SUCCESS_URL=/success?checkout_id={CHECKOUT_ID}${productSection}`
}

export interface LovableStepProps {
  products?: schemas['Product'][]
}

export const LovableStep = ({ products = [] }: LovableStepProps) => {
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [promptCopied, setPromptCopied] = useState(false)

  const { organization } = useContext(OrganizationContext)
  const router = useRouter()
  const {
    trackStepStarted,
    trackStepCompleted,
    trackStepSkipped,
    getSession,
  } = useOnboardingTracking()

  useEffect(() => {
    const session = getSession()
    if (session) {
      trackStepStarted('lovable', organization.id)
    }
  }, [organization.id, getSession, trackStepStarted])

  const handleContinue = async () => {
    const session = getSession()
    if (session) {
      await trackStepCompleted('lovable', organization.id)
    }
    router.push(`/dashboard/${organization.slug}/onboarding/product`)
  }

  const handleSkip = async () => {
    const session = getSession()
    if (session) {
      await trackStepSkipped('lovable', organization.id)
    }
    router.push(`/dashboard/${organization.slug}/onboarding/product`)
  }

  const lovablePrompt = useMemo(
    () => getLovablePrompt(products, createdToken),
    [products, createdToken],
  )

  const handleCopyPrompt = useCallback(() => {
    navigator.clipboard.writeText(lovablePrompt)
    setPromptCopied(true)
    setTimeout(() => setPromptCopied(false), 2000)
  }, [lovablePrompt])

  return (
    <div className="dark:md:bg-polar-950 flex h-full w-full flex-row">
      <OnboardingStepper currentStep={1} />

      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex w-full flex-col items-center px-6 pt-16 pb-24 md:px-20">
          <motion.div
            initial="hidden"
            animate="visible"
            transition={{ duration: 1, staggerChildren: 0.2 }}
            className="flex w-full max-w-2xl flex-col gap-14"
          >
            {/* Header */}
            <FadeUp className="flex flex-col gap-y-3">
              <div className="md:hidden mb-8">
                <LogoIcon size={36} />
              </div>
              <div className="flex flex-row items-center gap-x-3">
                <LovableIcon size={32} />
                <span className="dark:text-polar-600 text-xl font-light text-gray-300">
                  +
                </span>
                <LogoIcon size={32} />
              </div>
              <h1 className="mt-2 text-2xl font-medium tracking-tight md:text-3xl">
                Connect Lovable
              </h1>
              <p className="dark:text-polar-400 max-w-md text-base text-gray-500">
                Set up billing in your Lovable app with a single prompt.
                Generate a token, copy the prompt, paste it in Lovable — done.
              </p>
            </FadeUp>

            {/* Step 1: Generate Token */}
            <FadeUp className="flex flex-col gap-y-6">
              <div className="flex flex-row items-center gap-x-3">
                <StepNumber number={1} completed={!!createdToken} />
                <div className="flex flex-col">
                  <h2 className="text-base font-medium">Generate API Token</h2>
                  <p className="dark:text-polar-500 text-xs text-gray-400">
                    This token connects Lovable to your Spaire account.
                  </p>
                </div>
              </div>
              <div className="dark:bg-polar-900 rounded-2xl border border-gray-200 bg-white p-6 dark:border-none">
                <OrganizationAccessTokensSettings
                  organization={organization}
                  singleTokenMode
                  minimal
                  onTokenCreated={setCreatedToken}
                />
              </div>
              {createdToken && (
                <p className="dark:text-polar-400 text-xs text-gray-500">
                  Token generated — it&apos;s included in the prompt below.
                </p>
              )}
            </FadeUp>

            {/* Step 2: Copy Prompt */}
            <FadeUp className="flex flex-col gap-y-6">
              <div className="flex flex-row items-center gap-x-3">
                <StepNumber number={2} completed={promptCopied} />
                <div className="flex flex-col">
                  <h2 className="text-base font-medium">
                    Copy the Lovable Prompt
                  </h2>
                  <p className="dark:text-polar-500 text-xs text-gray-400">
                    Paste this into Lovable&apos;s chat to wire up billing.
                  </p>
                </div>
              </div>
              <div className="dark:bg-polar-900 relative rounded-2xl border border-gray-200 bg-white dark:border-none">
                <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap p-6 text-xs leading-relaxed">
                  {lovablePrompt}
                </pre>
                <div className="absolute right-4 top-4">
                  <button
                    onClick={handleCopyPrompt}
                    className={twMerge(
                      'flex items-center gap-x-1.5 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm transition-all',
                      promptCopied
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                        : 'dark:bg-polar-800 dark:text-polar-200 dark:hover:bg-polar-700 bg-gray-100 text-gray-700 hover:bg-gray-200',
                    )}
                  >
                    {promptCopied ? (
                      <>
                        <CheckOutlined sx={{ fontSize: 14 }} />
                        Copied
                      </>
                    ) : (
                      <>
                        <ContentCopyOutlined sx={{ fontSize: 14 }} />
                        Copy Prompt
                      </>
                    )}
                  </button>
                </div>
              </div>
            </FadeUp>

            {/* Step 3: Open Lovable */}
            <FadeUp className="flex flex-col gap-y-6">
              <div className="flex flex-row items-center gap-x-3">
                <StepNumber number={3} />
                <div className="flex flex-col">
                  <h2 className="text-base font-medium">Paste in Lovable</h2>
                  <p className="dark:text-polar-500 text-xs text-gray-400">
                    Open your Lovable project and paste the prompt.
                  </p>
                </div>
              </div>
              <Link href="https://lovable.dev" target="_blank">
                <Button size="lg" variant="secondary" fullWidth>
                  <span>Open Lovable</span>
                  <ArrowOutwardOutlined className="ml-2" fontSize="small" />
                </Button>
              </Link>
            </FadeUp>

            {/* Actions */}
            <FadeUp className="flex flex-col gap-y-2 pt-4">
              <Button size="lg" fullWidth onClick={handleContinue}>
                Continue
              </Button>
              <div className="dark:text-polar-500 flex flex-row items-center justify-center pt-2 text-sm text-gray-500">
                <button
                  className="dark:hover:text-polar-400 dark:hover:bg-polar-700 cursor-pointer rounded-full px-2.5 py-1 transition-colors duration-100 hover:bg-gray-100 hover:text-gray-600"
                  onClick={handleSkip}
                >
                  Skip this step
                </button>
              </div>
            </FadeUp>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

const StepNumber = ({
  number,
  completed,
}: {
  number: number
  completed?: boolean
}) => (
  <div
    className={twMerge(
      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
      completed
        ? 'bg-emerald-500 text-white'
        : 'dark:bg-polar-800 dark:text-polar-300 bg-gray-200 text-gray-600',
    )}
  >
    {completed ? <CheckOutlined sx={{ fontSize: 14 }} /> : number}
  </div>
)
