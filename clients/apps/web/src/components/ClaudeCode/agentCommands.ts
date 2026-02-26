export interface AgentCommand {
  slug: string
  name: string
  tagline: string
  description: string
  label: string
  command: string
  howItWorks: { title: string; description: string }[]
  whatTheAgentDoes: string[]
  docsLink: string
}

export const CHECKOUT_COMMAND: AgentCommand = {
  slug: 'setup-checkout',
  name: 'Checkouts',
  tagline: 'Add checkout to your app automatically.',
  description:
    'The agent reads your codebase, finds where to add buy buttons, and wires up Spaire checkout — overlay, programmatic, or server-side — directly in your project.',
  label: 'Checkouts',
  command: '/setup-checkout',
  howItWorks: [
    {
      title: 'Run the agent',
      description:
        'Open Claude Code in your project and type /setup-checkout',
    },
    {
      title: 'Pick your approach',
      description:
        'Overlay (zero backend), programmatic (EmbedCheckout.create), or server-side (SDK)',
    },
    {
      title: 'Agent writes the code',
      description:
        'Adds the embed script, checkout buttons, and success page — directly in your files',
    },
  ],
  whatTheAgentDoes: [
    'Detects your framework (Next.js, React, Vue, vanilla HTML, etc.)',
    'Asks if you have products created in Spaire yet — walks you through it if not',
    'Asks which checkout approach: overlay (simplest), programmatic (EmbedCheckout.create), or server-side (SDK)',
    'Scans your codebase for pricing pages, product pages, or CTA sections',
    'Adds the Spaire embed script tag to your layout',
    'Writes checkout buttons or links directly into your components',
    'Creates a /checkout/success confirmation page',
    'Optionally wires up customer portal link and webhook handler',
  ],
  docsLink: 'https://docs.spairehq.com/checkout',
}

export const USAGE_BILLING_COMMAND: AgentCommand = {
  slug: 'setup-usage-billing',
  name: 'Usage Billing',
  tagline: 'Set up metered billing automatically.',
  description:
    'The agent detects your stack, installs the Spaire SDK, creates meters, writes ingestion code, and wires up metered pricing — all interactively, right in your codebase.',
  label: 'Usage Billing',
  command: '/setup-usage-billing',
  howItWorks: [
    {
      title: 'Run the agent',
      description:
        'Open Claude Code in your project and type /setup-usage-billing',
    },
    {
      title: 'Answer a few questions',
      description:
        'The agent asks what you want to meter (tokens, API calls, storage, etc.)',
    },
    {
      title: 'Agent writes the code',
      description:
        'It generates SDK setup, event ingestion, and metered pricing — directly in your project',
    },
  ],
  whatTheAgentDoes: [
    'Detects your framework (Next.js, Express, FastAPI, Laravel, etc.)',
    'Asks what you want to meter (LLM tokens, API calls, storage, compute time, or custom)',
    'Asks your pricing model (per-unit, credits-based, or both)',
    'Checks prerequisites (SDK installed, access token set)',
    'Tells you exactly what meter to create in the dashboard',
    'Writes ingestion code directly into your project using the right SDK strategy (@spaire/ingestion for LLM/S3/Stream/DeltaTime, or @spaire/sdk for simple counting)',
    'Walks you through metered pricing setup on your product',
    'Optionally sets up credits with balance-checking utilities',
    'Generates webhook handlers for billing events',
  ],
  docsLink:
    'https://docs.spairehq.com/features/usage-based-billing/introduction',
}

export const ALL_AGENT_COMMANDS: AgentCommand[] = [
  CHECKOUT_COMMAND,
  USAGE_BILLING_COMMAND,
]

export const getAgentCommandBySlug = (
  slug: string,
): AgentCommand | undefined => {
  return ALL_AGENT_COMMANDS.find((c) => c.slug === slug)
}
