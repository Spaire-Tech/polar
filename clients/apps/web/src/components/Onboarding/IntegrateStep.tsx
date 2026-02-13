import { useOnboardingTracking } from '@/hooks'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import slugify from 'slugify'
import { twMerge } from 'tailwind-merge'
import LogoIcon from '../Brand/LogoIcon'
import { OnboardingStepper } from './OnboardingStepper'
import BetterAuthIcon from '../Icons/frameworks/better-auth'
import LovableIcon from '../Icons/frameworks/lovable'
import NextJsIcon from '../Icons/frameworks/nextjs'
import NodeJsIcon from '../Icons/frameworks/nodejs'
import PythonIcon from '../Icons/frameworks/python'
import OrganizationAccessTokensSettings from '../Settings/OrganizationAccessTokensSettings'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '../SyntaxHighlighterShiki/SyntaxHighlighterClient'

const packageManagers = ['pnpm', 'npm', 'yarn', 'bun'] as const
type PackageManager = (typeof packageManagers)[number]

const getInstallCommand = (
  packages: string,
  packageManager: PackageManager,
): string => {
  switch (packageManager) {
    case 'pnpm':
      return `pnpm add ${packages}`
    case 'npm':
      return `npm install ${packages}`
    case 'yarn':
      return `yarn add ${packages}`
    case 'bun':
      return `bun add ${packages}`
  }
}

const frameworks = (products: schemas['Product'][]) =>
  [
    {
      slug: 'nextjs',
      name: 'Next.js',
      link: 'https://docs.spairehq.com/integrate/sdk/adapters/nextjs',
      icon: <NextJsIcon size={24} />,
      packages: '@spaire/nextjs',
      code: `import { Checkout } from "@spaire/nextjs";

export const GET = Checkout({
  accessToken: process.env.SPAIRE_ACCESS_TOKEN,
  successUrl: process.env.SPAIRE_SUCCESS_URL
});`,
    },
    {
      slug: 'better-auth',
      name: 'BetterAuth',
      link: 'https://docs.spairehq.com/integrate/sdk/adapters/better-auth',
      icon: <BetterAuthIcon size={24} />,
      packages: 'better-auth @spaire/better-auth @spaire/sdk',
      code: `import { betterAuth } from "better-auth";
import { spaire, checkout, portal, usage, webhooks } from "@spaire/better-auth";
import { Spaire } from "@spaire/sdk";

const spaireClient = new Spaire({
    accessToken: process.env.SPAIRE_ACCESS_TOKEN
});

const auth = betterAuth({
    // ... Better Auth config
    plugins: [
        spaire({
            client: spaireClient,
            createCustomerOnSignUp: true,
            use: [
                checkout({
                    products: [
${products
  .map(
    (p) => `                        {
                            productId: "${p.id}",
                            slug: "${slugify(p.name)}" // Custom slug for easy reference in Checkout URL, e.g. /checkout/${slugify(p.name)}
                        }`,
  )
  .join(',\n')}
                    ],
                    successUrl: process.env.SPAIRE_SUCCESS_URL,
                    authenticatedUsersOnly: true
                })
            ],
        })
    ]
});`,
    },
    {
      slug: 'nodejs',
      name: 'Node.js',
      link: 'https://docs.spairehq.com/integrate/sdk/typescript',
      icon: <NodeJsIcon size={24} />,
      packages: '@spaire/sdk',
      code: `import { Spaire } from "@spaire/sdk";

const spaire = new Spaire({
  accessToken: process.env.SPAIRE_ACCESS_TOKEN,
});

const checkout = await spaire.checkouts.create({
  products: [
${products.map((p) => `    "${p.id}"`).join(',\n')}
  ],
  successUrl: process.env.SPAIRE_SUCCESS_URL
});

redirect(checkout.url)`,
    },
    {
      slug: 'python',
      name: 'Python',
      link: 'https://docs.spairehq.com/integrate/sdk/python',
      icon: <PythonIcon size={24} />,
      pythonInstall: 'pip install spaire-sdk',
      code: `import os
from spaire_sdk import Spaire

with Spaire(
    access_token=os.environ.get("SPAIRE_ACCESS_TOKEN"),
) as spaire:

    res = spaire.checkouts.create(request={
        "products": [
${products.map((p) => `            "${p.id}"`).join(',\n')}
        ],
        "success_url": os.environ.get("SPAIRE_SUCCESS_URL")
    })

    # Handle response
    redirect(res.url)`,
    },
  ] as const

const getLovablePrompt = (
  products: schemas['Product'][],
  token: string | null,
) => {
  const productList = products
    .map((p) => `- "${p.name}" (ID: ${p.id})`)
    .join('\n')

  return `Add Spaire billing to my app. Here's what I need:

1. Install the @spaire/checkout package.

2. Add these environment variables to .env:
   SPAIRE_ACCESS_TOKEN=${token ?? '<your-token>'}
   SPAIRE_SUCCESS_URL=/success?checkout_id={CHECKOUT_ID}

3. Create a pricing page that uses Spaire's embedded checkout. Use the following product(s):
${productList}

4. For each product, add a checkout button that opens Spaire checkout. Use this pattern:
   import { SpaireEmbedCheckout } from "@spaire/checkout";

   // Open checkout for a product
   const checkout = new SpaireEmbedCheckout();
   checkout.open({ productId: "<product-id>" });

5. Create a /success page that shows a confirmation message after purchase.

6. Style everything to match the existing app design.`
}

export interface IntegrateStepProps {
  products: schemas['Product'][]
}

export const IntegrateStep = ({ products }: IntegrateStepProps) => {
  const [selectedFramework, setSelectedFramework] = useState<string | null>(
    'lovable',
  )
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [packageManager, setPackageManager] = useState<PackageManager>('pnpm')
  const [promptCopied, setPromptCopied] = useState(false)

  const { organization } = useContext(OrganizationContext)
  const router = useRouter()
  const { trackStepStarted, trackStepCompleted, trackCompleted, getSession } =
    useOnboardingTracking()

  useEffect(() => {
    const session = getSession()
    if (session) {
      trackStepStarted('integrate', organization.id)
    }
  }, [organization.id, getSession, trackStepStarted])

  const handleGoToDashboard = async () => {
    const session = getSession()
    if (session) {
      await trackStepCompleted('integrate', organization.id)
      await trackCompleted(organization.id)
    }
    router.push(`/dashboard/${organization.slug}`)
  }

  const parsedFrameworks = useMemo(() => frameworks(products), [products])

  const currentFramework = useMemo(
    () =>
      parsedFrameworks.find(
        (framework) => framework.slug === selectedFramework,
      ),
    [parsedFrameworks, selectedFramework],
  )

  const installCommand = useMemo(() => {
    if (!currentFramework) return ''
    if ('pythonInstall' in currentFramework && currentFramework.pythonInstall) {
      return currentFramework.pythonInstall
    }
    if ('packages' in currentFramework && currentFramework.packages) {
      return getInstallCommand(currentFramework.packages, packageManager)
    }
    return ''
  }, [currentFramework, packageManager])

  const isPython = currentFramework?.slug === 'python'
  const isLovable = selectedFramework === 'lovable'

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
    <div className="flex h-full flex-row">
      {/* Stepper Sidebar - desktop only */}
      <OnboardingStepper currentStep={2} />

      {/* Left panel: framework selection & actions */}
      <div className="dark:bg-polar-900 flex h-full min-h-0 w-full flex-col gap-8 overflow-y-auto p-12 md:max-w-md">
        <div className="flex flex-col gap-y-4">
          <div className="md:hidden mb-4">
            <LogoIcon size={40} />
          </div>
          <h1 className="text-2xl font-medium md:text-3xl">
            Connect your app
          </h1>
          <p className="dark:text-polar-400 text-gray-500">
            Pick your stack and add a checkout in minutes.
          </p>
        </div>

        <div className="hidden flex-col gap-y-8 md:flex">
          {/* Lovable featured card */}
          <div
            className={twMerge(
              'dark:border-polar-700 relative flex cursor-pointer flex-row items-center gap-x-4 rounded-xl border p-4 transition-all',
              isLovable
                ? 'shadow-3xl border-gray-100 bg-black text-white dark:bg-white dark:text-black'
                : 'dark:bg-polar-800 border-transparent bg-gray-100 hover:opacity-70',
            )}
            role="button"
            onClick={() => setSelectedFramework('lovable')}
          >
            <LovableIcon size={28} />
            <div className="flex flex-1 flex-col gap-y-0.5">
              <div className="flex flex-row items-center gap-x-2">
                <h2 className="text-lg">Lovable</h2>
                <span
                  className={twMerge(
                    'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                    isLovable
                      ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black'
                      : 'dark:bg-polar-700 dark:text-polar-300 bg-gray-200 text-gray-600',
                  )}
                >
                  1-click
                </span>
              </div>
              <p
                className={twMerge(
                  'text-xs',
                  isLovable
                    ? 'text-white/60 dark:text-black/60'
                    : 'dark:text-polar-400 text-gray-500',
                )}
              >
                Paste one prompt, billing just works
              </p>
            </div>
          </div>

          {/* Separator */}
          <div className="flex flex-row items-center gap-x-3">
            <div className="dark:bg-polar-700 h-px flex-1 bg-gray-200" />
            <span className="dark:text-polar-500 text-xs text-gray-400">
              or pick your framework
            </span>
            <div className="dark:bg-polar-700 h-px flex-1 bg-gray-200" />
          </div>

          {/* Other frameworks grid */}
          <div className="grid grid-cols-2 gap-3">
            {parsedFrameworks.map((framework) => (
              <FrameworkCard
                key={framework.slug}
                {...framework}
                active={selectedFramework === framework.slug}
                onClick={() => setSelectedFramework(framework.slug)}
              />
            ))}
          </div>

          <div className="flex flex-col gap-y-3">
            <Link
              href={`https://docs.spairehq.com/integrate/sdk/adapters/nextjs`}
              target="_blank"
              className="w-full"
            >
              <Button size="lg" fullWidth variant="secondary">
                <span>Browse All Integrations</span>
                <ArrowOutwardOutlined className="ml-2" fontSize="small" />
              </Button>
            </Link>
            <Button size="lg" fullWidth onClick={handleGoToDashboard}>
              Launch Dashboard
            </Button>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <SyntaxHighlighterProvider>
        <div className="dark:bg-polar-950 hidden flex-1 grow flex-col items-center gap-12 overflow-y-auto bg-gray-100 p-16 md:flex">
          {isLovable ? (
            <LovablePanel
              organization={organization}
              createdToken={createdToken}
              onTokenCreated={setCreatedToken}
              lovablePrompt={lovablePrompt}
              promptCopied={promptCopied}
              onCopyPrompt={handleCopyPrompt}
            />
          ) : (
            <div className="dark:bg-polar-900 flex w-full max-w-3xl flex-col gap-y-12 rounded-3xl bg-white p-12">
              <div className="flex flex-col gap-y-6">
                <div className="flex flex-row items-center justify-between">
                  <h2 className="text-lg">1. Install Dependencies</h2>
                  {!isPython && (
                    <Tabs
                      value={packageManager}
                      onValueChange={(v) =>
                        setPackageManager(v as PackageManager)
                      }
                    >
                      <TabsList className="dark:bg-polar-800 rounded-sm bg-gray-100 p-0.5">
                        {packageManagers.map((pm) => (
                          <TabsTrigger
                            key={pm}
                            value={pm}
                            className="dark:data-[state=active]:bg-polar-700 !rounded-sm px-2.5 py-1 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm"
                          >
                            {pm}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  )}
                </div>
                <CodeWrapper>
                  <SyntaxHighlighterClient lang="bash" code={installCommand} />
                </CodeWrapper>
              </div>

              <div className="flex flex-col gap-y-6">
                <h2 className="text-lg">2. Configure Environment</h2>
                <OrganizationAccessTokensSettings
                  organization={organization}
                  singleTokenMode
                  minimal
                  onTokenCreated={setCreatedToken}
                />
                <CodeWrapper>
                  <SyntaxHighlighterClient
                    lang="bash"
                    code={`SPAIRE_ACCESS_TOKEN=${createdToken ?? 'XXX'}
SPAIRE_SUCCESS_URL=https://example.com/success?checkout_id={CHECKOUT_ID}`}
                  />
                </CodeWrapper>
              </div>

              <div className="flex flex-col gap-y-6">
                <h2 className="text-lg">3. Add Checkout Code</h2>
                <CodeWrapper>
                  <SyntaxHighlighterClient
                    lang={
                      currentFramework?.slug === 'python'
                        ? 'python'
                        : 'typescript'
                    }
                    code={currentFramework?.code ?? ''}
                  />
                </CodeWrapper>
                <Link href={currentFramework?.link ?? ''} target="_blank">
                  <Button size="lg" variant="secondary" fullWidth>
                    <span>Read the Docs</span>
                    <ArrowOutwardOutlined className="ml-2" fontSize="small" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </SyntaxHighlighterProvider>
    </div>
  )
}

interface LovablePanelProps {
  organization: schemas['Organization']
  createdToken: string | null
  onTokenCreated: (token: string) => void
  lovablePrompt: string
  promptCopied: boolean
  onCopyPrompt: () => void
}

const LovablePanel = ({
  organization,
  createdToken,
  onTokenCreated,
  lovablePrompt,
  promptCopied,
  onCopyPrompt,
}: LovablePanelProps) => {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-y-8">
      {/* Hero */}
      <div className="dark:bg-polar-900 flex flex-col items-center gap-y-4 rounded-3xl bg-white p-10 text-center">
        <div className="flex flex-row items-center gap-x-3">
          <LovableIcon size={36} />
          <span className="dark:text-polar-500 text-2xl font-light text-gray-300">
            +
          </span>
          <LogoIcon size={36} />
        </div>
        <h2 className="text-xl font-medium">
          Billing for your Lovable app
        </h2>
        <p className="dark:text-polar-400 max-w-md text-sm text-gray-500">
          Generate your API token, copy the prompt below, and paste it into
          Lovable. Your app gets a full checkout flow instantly.
        </p>
      </div>

      {/* Step 1: Generate Token */}
      <div className="dark:bg-polar-900 flex flex-col gap-y-6 rounded-3xl bg-white p-10">
        <div className="flex flex-row items-center gap-x-3">
          <StepNumber number={1} completed={!!createdToken} />
          <h2 className="text-lg font-medium">Generate API Token</h2>
        </div>
        <OrganizationAccessTokensSettings
          organization={organization}
          singleTokenMode
          minimal
          onTokenCreated={onTokenCreated}
        />
        {createdToken && (
          <p className="dark:text-polar-400 text-xs text-gray-500">
            Your token is automatically included in the prompt below.
          </p>
        )}
      </div>

      {/* Step 2: Copy Prompt */}
      <div className="dark:bg-polar-900 flex flex-col gap-y-6 rounded-3xl bg-white p-10">
        <div className="flex flex-row items-center gap-x-3">
          <StepNumber number={2} completed={promptCopied} />
          <h2 className="text-lg font-medium">Copy Lovable Prompt</h2>
        </div>
        <div className="dark:border-polar-700 dark:bg-polar-800 relative rounded-xl border border-gray-100 bg-gray-50">
          <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap p-4 text-xs leading-relaxed">
            {lovablePrompt}
          </pre>
          <div className="dark:border-polar-700 absolute right-3 top-3">
            <button
              onClick={onCopyPrompt}
              className={twMerge(
                'dark:bg-polar-700 dark:hover:bg-polar-600 flex items-center gap-x-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium shadow-sm transition-all',
                promptCopied
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'dark:text-polar-200 text-gray-700 hover:bg-gray-50',
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
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Step 3: Paste in Lovable */}
      <div className="dark:bg-polar-900 flex flex-col gap-y-6 rounded-3xl bg-white p-10">
        <div className="flex flex-row items-center gap-x-3">
          <StepNumber number={3} />
          <h2 className="text-lg font-medium">Paste in Lovable</h2>
        </div>
        <p className="dark:text-polar-400 text-sm leading-relaxed text-gray-500">
          Open your Lovable project, paste the prompt into the chat, and
          Lovable will set up your checkout page, environment variables, and
          payment flow automatically.
        </p>
        <Link
          href="https://lovable.dev"
          target="_blank"
        >
          <Button size="lg" variant="secondary" fullWidth>
            <span>Open Lovable</span>
            <ArrowOutwardOutlined className="ml-2" fontSize="small" />
          </Button>
        </Link>
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
      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium',
      completed
        ? 'bg-emerald-500 text-white'
        : 'dark:bg-polar-700 dark:text-polar-300 bg-gray-200 text-gray-600',
    )}
  >
    {completed ? <CheckOutlined sx={{ fontSize: 14 }} /> : number}
  </div>
)

const CodeWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="dark:border-polar-700 dark:bg-polar-800 w-full rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm">
      {children}
    </div>
  )
}

export interface FrameworkCardProps {
  slug: string
  name: string
  icon?: React.ReactNode
  active: boolean
  onClick: (framework: string) => void
}

const FrameworkCard = ({
  name,
  slug,
  icon,
  active,
  onClick,
}: FrameworkCardProps) => {
  return (
    <div
      className={twMerge(
        'dark:bg-polar-800 dark:border-polar-700 flex cursor-pointer flex-col gap-y-4 rounded-xl border border-transparent bg-gray-100 p-4',
        active
          ? 'shadow-3xl border-gray-100 bg-black text-white dark:bg-white dark:text-black'
          : 'transition-opacity hover:opacity-70',
      )}
      role="button"
      onClick={() => onClick(slug)}
    >
      {icon ?? (
        <div className="dark:bg-polar-900 h-8 w-8 rounded-full bg-gray-200" />
      )}
      <h2 className="text-lg">{name}</h2>
    </div>
  )
}
