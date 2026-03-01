export type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'ordered-list'; label?: string; items: string[] }
  | { type: 'unordered-list'; label?: string; items: string[] }
  | { type: 'note'; text: string }

export interface PerkSection {
  heading: string
  blocks: ContentBlock[]
}

export interface PerkDetails {
  claimUrl: string
  sections: PerkSection[]
}

export interface Perk {
  name: string
  logo: string
  incentive: string
  description: string
  url: string
  featured?: boolean
  details?: PerkDetails
}

export const PERKS: Perk[] = [
  {
    name: 'Deel',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/deel+logo.png',
    incentive: '$1,000 in Combined Credits',
    description:
      'Spaire and Deel have partnered to give startups a combined $1,000 onboarding incentive. You get $500 in Deel billing credits for EOR, Contractor, or Global Payroll fees, plus $500 in Spaire revenue credits to offset platform fees on your global SaaS sales.',
    url: 'https://get.deel.com/t2prquaa8c6t',
    featured: true,
    details: {
      claimUrl: 'https://get.deel.com/t2prquaa8c6t',
      sections: [
        {
          heading: 'What is Deel?',
          blocks: [
            {
              type: 'paragraph',
              text: 'Deel is a global hiring and payroll platform that lets startups hire full-time employees or contractors in 150+ countries without setting up local entities.',
            },
            {
              type: 'paragraph',
              text: 'They handle employment contracts, payroll, taxes, and compliance — so you can build your team anywhere in the world without legal complexity slowing you down.',
            },
            {
              type: 'paragraph',
              text: "If you're hiring internationally, Deel removes months of setup and thousands in entity costs.",
            },
          ],
        },
        {
          heading: 'How the $1,000 Incentive Works',
          blocks: [
            {
              type: 'ordered-list',
              label: 'To qualify, you must:',
              items: [
                'Sign up for Deel using our partner link',
                'Complete a hiring milestone within 90 days, such as:',
              ],
            },
            {
              type: 'unordered-list',
              items: [
                'Hire and pay 1 full-time employee through Deel EOR',
                'Pay 1 international contractor',
                'Run your first payroll cycle through Deel',
              ],
            },
            {
              type: 'unordered-list',
              label: 'Once completed, you receive:',
              items: [
                '$500 in Deel billing credits (applied to eligible Deel fees)',
                '$500 in Spaire revenue credits (applied toward your Spaire platform fees)',
              ],
            },
          ],
        },
        {
          heading: 'Important Notes',
          blocks: [
            {
              type: 'unordered-list',
              items: [
                'Credits are applied to billing fees, not paid out as cash.',
                'The hiring milestone must be completed within 90 days of signing up through the partner link.',
                'Both incentives are unlocked once the qualifying milestone is verified.',
              ],
            },
          ],
        },
      ],
    },
  },
  {
    name: 'Notion + Notion AI',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/notionhq_logo.jpeg',
    incentive: '6 Months Free + Notion AI',
    description:
      'Notion consolidates your docs, wikis, project management, and knowledge base into one tool. With Notion AI included, your team can draft docs, summarize meetings, and move faster without switching tools.',
    url: 'https://ntn.so/spaire',
    featured: true,
    details: {
      claimUrl: 'https://ntn.so/spaire',
      sections: [
        {
          heading: 'What is Notion?',
          blocks: [
            {
              type: 'paragraph',
              text: 'Notion is the all-in-one workspace used by startups to manage docs, product specs, wikis, roadmaps, hiring pipelines, and internal knowledge.',
            },
            {
              type: 'paragraph',
              text: 'With Notion AI, your team can draft docs, summarize meetings, generate specs, and move faster without switching tools.',
            },
            {
              type: 'paragraph',
              text: 'For early-stage startups, it often becomes the operating system for the entire company.',
            },
          ],
        },
        {
          heading: 'What You Get',
          blocks: [
            {
              type: 'unordered-list',
              label: 'Eligible startups receive:',
              items: [
                '6 months free of Notion Business',
                'Notion AI included',
              ],
            },
            {
              type: 'paragraph',
              text: 'This gives your team full access to collaboration, advanced permissions, and AI-powered workflows from day one.',
            },
          ],
        },
        {
          heading: 'How to Redeem',
          blocks: [
            {
              type: 'ordered-list',
              label: 'To qualify, you must:',
              items: [
                'Apply through our unique partner link',
                'Be a new, non-paying Notion customer',
                'Have fewer than 100 employees',
              ],
            },
            {
              type: 'note',
              text: 'Applications must be submitted through the link above. Applications sent outside this link cannot be attributed and will not qualify.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'Mercury',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/mercurybank_logo.jpeg',
    incentive: '$500 Signup Bonus',
    description:
      'The banking stack built for startups. Mercury offers FDIC-insured checking and savings, treasury management, and venture debt — all from one dashboard.',
    url: 'https://mercury.com',
  },
  {
    name: 'AWS',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/amazon_web_services_logo.jpeg',
    incentive: '$5,000 in Credits',
    description:
      'Amazon Web Services is the backbone of modern cloud infrastructure. From compute and storage to machine learning and serverless, AWS gives you the scale and reliability that enterprise customers demand.',
    url: 'https://aws.amazon.com/activate/',
  },
  {
    name: 'Stripe Atlas',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/stripe_logo.jpeg',
    incentive: '$500 in Processing Credits',
    description:
      'Stripe Atlas incorporates your Delaware C-Corp, sets up your bank account, and gives you the legal templates to get funded — in days, not weeks.',
    url: 'https://stripe.com/atlas',
  },
  {
    name: 'HubSpot',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/hubspot_logo.jpeg',
    incentive: '90% Off Year One',
    description:
      'HubSpot gives you CRM, email marketing, sales pipelines, and customer support in one platform — replacing the patchwork of disconnected tools that slow early teams down.',
    url: 'https://www.hubspot.com/startups',
  },
  {
    name: 'PostHog',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/posthog_logo.jpeg',
    incentive: '$50K in Credits',
    description:
      'PostHog is the open-source product analytics suite that replaces Amplitude, LaunchDarkly, and Hotjar in one self-serve tool. Event tracking, feature flags, session recording, and A/B testing.',
    url: 'https://posthog.com/startups',
  },
  {
    name: 'Linear',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/linear.jpeg',
    incentive: '12 Months Free',
    description:
      'Linear is the issue tracker that engineering teams actually want to use. Fast, opinionated, and designed for sprints, cycles, and triage — without the bloat of legacy project management tools.',
    url: 'https://linear.app/startups',
  },
  {
    name: 'Intercom',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/intercom_logo.jpeg',
    incentive: '95% Off for Year One',
    description:
      'Intercom is the customer messaging platform that handles live chat, help center, bots, and product tours from one interface — letting a small team deliver enterprise-level support.',
    url: 'https://www.intercom.com/early-stage',
  },
  {
    name: 'Vercel',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/vercel_logo.jpeg',
    incentive: '$3,000 in Credits',
    description:
      'Vercel is the deployment platform built for frontend teams. Instant global deploys, edge functions, and built-in analytics — purpose-built for Next.js but compatible with any framework.',
    url: 'https://vercel.com/startups',
  },
  {
    name: 'OpenAI',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/open+ai+-+logo.jpg',
    incentive: '$2,500 in API Credits',
    description:
      'OpenAI provides the foundational AI models that power the next generation of software products — from GPT-4 to embeddings and fine-tuning.',
    url: 'https://openai.com/startups',
  },
  {
    name: 'Airtable',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/airtable-logo.jpeg',
    incentive: '$2,000 in Credits',
    description:
      'Airtable is the programmable spreadsheet that ops teams use to build internal tools without engineering resources — from CRM to content calendars to inventory tracking.',
    url: 'https://www.airtable.com/startups',
  },
  {
    name: 'Mixpanel',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/mixpanel_inc__logo.jpeg',
    incentive: '$50K in Credits',
    description:
      'Mixpanel is the event-based analytics platform that tells you what users actually do in your product — funnels, retention analysis, and cohort breakdowns that drive real product decisions.',
    url: 'https://mixpanel.com/startups',
  },
]

export const FEATURED_PERKS = PERKS.filter((p) => p.featured)
export const OTHER_PERKS = PERKS.filter((p) => !p.featured)
