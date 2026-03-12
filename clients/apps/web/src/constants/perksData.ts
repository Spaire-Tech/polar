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
      'Through our partnership with Deel, startups receive $1,000 in onboarding value: $500 in Deel credits for global hiring and payroll, and $500 in Spaire credits to offset revenue fees as you scale internationally.',
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
      'Spaire has partnered with Notion to give early-stage startups 6 months of Notion Business — with Notion AI included. One workspace for your docs, specs, roadmaps, and team knowledge, with AI built in from day one.',
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
    incentive: '$250 Mercury Credit + $250 Spaire Credit',
    description:
      'Open a Mercury startup bank account through Spaire and receive $250 in Mercury credits plus $250 in Spaire platform credits. Mercury provides modern banking built for startups, with powerful financial tools and integrations.',
    url: 'https://mercury.com',
    details: {
      claimUrl: 'https://mercury.com',
      sections: [
        {
          heading: 'What is Mercury?',
          blocks: [
            {
              type: 'paragraph',
              text: 'Mercury is a banking platform built specifically for startups. It provides business checking and savings accounts, payment tools, and financial infrastructure designed for fast-growing companies.',
            },
            {
              type: 'paragraph',
              text: 'Founders use Mercury to manage company finances, send and receive payments, and connect their bank account with the tools they already use to run their business. The platform is widely used by technology startups and supports companies from formation through scaling.',
            },
            {
              type: 'paragraph',
              text: 'Because Mercury is built for startups, it also includes features like team permissions, integrations with accounting tools, and APIs for building financial workflows.',
            },
          ],
        },
        {
          heading: 'How the $500 Incentive Works',
          blocks: [
            {
              type: 'ordered-list',
              label: 'To qualify, you must:',
              items: [
                'Open a new Mercury business account using the Spaire partner link',
                'Deposit $10,000 into your Mercury account within your first 90 days',
              ],
            },
            {
              type: 'unordered-list',
              label: 'Once completed, you receive:',
              items: [
                '$250 in cash from Mercury',
                '$250 in Spaire platform credits',
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
                'The $10,000 deposit must be completed within 90 days of opening your Mercury account.',
                'The $250 reward is issued directly by Mercury once the requirement is met.',
                'Spaire credits are applied to Spaire platform fees and are not paid out as cash.',
                'Mercury determines final eligibility and account approval.',
              ],
            },
          ],
        },
      ],
    },
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
  {
    name: 'Apollo',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/apollo_logo.png',
    incentive: '50% Off Annual Plan',
    description:
      'Spaire startups receive 50% off Apollo\'s sales intelligence platform for one year. Access a database of over 270M contacts and powerful outreach tools to find customers, start conversations, and grow your first revenue.',
    url: 'https://www.apollo.io',
    details: {
      claimUrl: 'https://www.apollo.io',
      sections: [
        {
          heading: 'What is Apollo?',
          blocks: [
            {
              type: 'paragraph',
              text: 'Apollo is a sales intelligence and outreach platform that helps startups find potential customers and start conversations with them.',
            },
            {
              type: 'paragraph',
              text: 'It combines a database of over 270 million contacts with tools for lead generation, email outreach, and sales automation in one platform.',
            },
            {
              type: 'paragraph',
              text: "Many early-stage startups use Apollo to identify decision makers, build prospect lists, and run outbound campaigns when they're trying to land their first customers.",
            },
          ],
        },
        {
          heading: 'What You Get Through the Spaire Startup Stack',
          blocks: [
            {
              type: 'unordered-list',
              label: 'Eligible startups receive:',
              items: ['50% off an annual Apollo plan for one year'],
            },
            {
              type: 'unordered-list',
              label: 'The discount applies to:',
              items: ['Basic plan', 'Professional plan'],
            },
            {
              type: 'paragraph',
              text: 'The offer can be used for up to 5 team seats.',
            },
          ],
        },
        {
          heading: 'Eligibility Requirements',
          blocks: [
            {
              type: 'ordered-list',
              label: 'To qualify, your company must:',
              items: [
                'Have 20 or fewer employees',
                'Be a new Apollo customer',
                'Choose an annual Basic or Professional plan',
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
                'The discount is valid for one year only.',
                'Applies to Basic or Professional annual plans.',
                'Up to 5 seats per company are eligible.',
                'Offer is for new Apollo customers only.',
              ],
            },
          ],
        },
      ],
    },
  },
  {
    name: 'DocSend',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/docsend_logo.png',
    incentive: '90% Off for the First Year',
    description:
      'Share investor decks, fundraising materials, and key documents securely with DocSend. Spaire startups receive 90% off for the first year, with analytics that show who opened your documents and how they engaged with them.',
    url: 'https://www.docsend.com',
    details: {
      claimUrl: 'https://www.docsend.com',
      sections: [
        {
          heading: 'What is DocSend?',
          blocks: [
            {
              type: 'paragraph',
              text: 'DocSend is a secure document sharing and analytics platform that helps startups share important files and track how they\'re viewed.',
            },
            {
              type: 'paragraph',
              text: 'Instead of sending attachments, founders can share a secure DocSend link and see who opened the document, when it was viewed, and how much time was spent on each page. This helps founders understand which investors or partners are most engaged and follow up at the right moment.',
            },
            {
              type: 'paragraph',
              text: 'Startups commonly use DocSend to share investor pitch decks, fundraising materials, sales proposals, and partnership documents.',
            },
          ],
        },
        {
          heading: 'What You Get Through the Spaire Startup Stack',
          blocks: [
            {
              type: 'unordered-list',
              label: 'Eligible startups receive:',
              items: ['90% off DocSend for the first year'],
            },
            {
              type: 'paragraph',
              text: "This gives founders access to secure document sharing and engagement analytics at a significantly reduced cost while they're building and fundraising.",
            },
          ],
        },
        {
          heading: 'Eligibility Requirements',
          blocks: [
            {
              type: 'ordered-list',
              label: 'To qualify for the discount, you must:',
              items: [
                'Be a new DocSend customer',
                'Activate your account through the startup partner offer',
                'Redeem the discount when selecting your plan',
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
                'The discount applies for the first year only.',
                'The offer is valid for new DocSend customers.',
                'Terms and availability are determined by DocSend and may change.',
              ],
            },
          ],
        },
      ],
    },
  },
  {
    name: 'Microsoft Azure',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/microsoft_azure_logo.png',
    incentive: 'Up to $5,000 in Cloud Credits',
    description:
      "Spaire startups can access up to $5,000 in Microsoft Azure credits to build and scale their products in the cloud. Use Azure's infrastructure to host applications, run databases, and power your startup's backend services.",
    url: 'https://azure.microsoft.com/en-us/free/startups/',
    details: {
      claimUrl: 'https://azure.microsoft.com/en-us/free/startups/',
      sections: [
        {
          heading: 'What is Microsoft Azure?',
          blocks: [
            {
              type: 'paragraph',
              text: 'Microsoft Azure is a cloud computing platform that allows startups to build, host, and scale applications without managing their own infrastructure.',
            },
            {
              type: 'paragraph',
              text: 'Founders use Azure to run backend services, databases, AI workloads, and web applications in the cloud. The platform provides a wide range of tools for developers, including compute services, storage, networking, and machine learning infrastructure.',
            },
            {
              type: 'paragraph',
              text: 'For startups building software products, Azure can handle everything from hosting APIs to powering large-scale applications as the company grows.',
            },
          ],
        },
        {
          heading: 'What You Get Through the Spaire Startup Stack',
          blocks: [
            {
              type: 'unordered-list',
              label: 'Eligible startups can access:',
              items: ['Up to $5,000 in Microsoft Azure credits'],
            },
            {
              type: 'paragraph',
              text: 'These credits can be used toward Azure infrastructure and services while building and launching your product.',
            },
          ],
        },
        {
          heading: 'Eligibility Requirements',
          blocks: [
            {
              type: 'ordered-list',
              label: 'To get started, you must:',
              items: [
                'Be a new Azure customer with no prior Azure account',
                'Sign up using a valid personal Microsoft account',
                'Be located in a country or region where the Azure offer is available',
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
                'Credits can be used for eligible Azure cloud services.',
                'The offer is subject to Microsoft eligibility requirements.',
                "Availability and terms may change based on Microsoft's program rules.",
              ],
            },
          ],
        },
      ],
    },
  },
]

export const FEATURED_PERKS = PERKS.filter((p) => p.featured)
export const OTHER_PERKS = PERKS.filter((p) => !p.featured)
