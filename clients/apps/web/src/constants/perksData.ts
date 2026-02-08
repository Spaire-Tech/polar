export interface Perk {
  name: string
  logo: string
  incentive: string
  description: string
  advice: string
  url: string
}

export const PERKS: Perk[] = [
  {
    name: 'Mercury',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/mercurylogo.png',
    incentive: '$500 Signup Bonus',
    description:
      'The banking stack built for startups. Mercury offers FDIC-insured checking and savings, treasury management, and venture debt — all from one dashboard. It is the default choice for serious founders who want institutional-grade financial infrastructure from day one.',
    advice:
      'Apply through the partner link to unlock the bonus. You must deposit $10K within 90 days of account opening to qualify.',
    url: 'https://mercury.com',
  },
  {
    name: 'AWS',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/amazon_web_services_logo.jpeg',
    incentive: '$5,000 in Credits',
    description:
      'Amazon Web Services is the backbone of modern cloud infrastructure. From compute and storage to machine learning and serverless, AWS gives you the scale and reliability that enterprise customers demand — and the flexibility to start small.',
    advice:
      'Apply through AWS Activate for Startups. You need to be under 10 years old, previously unfunded on Activate, and have a functional website.',
    url: 'https://aws.amazon.com/activate/',
  },
  {
    name: 'Notion',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/notionhq_logo.jpeg',
    incentive: '6 Months Free + AI',
    description:
      'Notion consolidates your docs, wikis, project management, and knowledge base into one tool. It eliminates the sprawl of disconnected apps that slows early teams down and becomes the single source of truth for your entire organization.',
    advice:
      'Claim via the startup program page. You must have fewer than 50 employees and be on the free plan or not yet a Notion customer.',
    url: 'https://www.notion.so/startups',
  },
  {
    name: 'Stripe Atlas',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/stripe_logo.jpeg',
    incentive: '$500 in Processing Credits',
    description:
      'Stripe Atlas incorporates your Delaware C-Corp, sets up your bank account, and gives you the legal templates to get funded — in days, not weeks. It is the fastest path from idea to a properly structured, investor-ready company.',
    advice:
      'If you have not incorporated yet, use Atlas directly. If you are already a Stripe user, ask your account manager about retroactive Atlas credit eligibility.',
    url: 'https://stripe.com/atlas',
  },
  {
    name: 'HubSpot',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/hubspot_logo.jpeg',
    incentive: '90% Off Year One',
    description:
      'HubSpot gives you CRM, email marketing, sales pipelines, and customer support in one platform. For startups, it replaces the patchwork of Mailchimp, Pipedrive, and Zendesk with a single system that scales from your first customer to your thousandth.',
    advice:
      'Apply through HubSpot for Startups. You must be associated with an approved accelerator, incubator, or VC partner. Check the partner list before applying.',
    url: 'https://www.hubspot.com/startups',
  },
  {
    name: 'PostHog',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/posthog_logo.jpeg',
    incentive: '$50K in Credits',
    description:
      'PostHog is the open-source product analytics suite that replaces Amplitude, LaunchDarkly, and Hotjar in one self-serve tool. You get event tracking, feature flags, session recording, and A/B testing without sending your data to a third party.',
    advice:
      'Apply through the PostHog startup program. You must be under 2 years old and have raised less than $5M. Credits are valid for 12 months.',
    url: 'https://posthog.com/startups',
  },
  {
    name: 'Linear',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/linear.jpeg',
    incentive: '12 Months Free',
    description:
      'Linear is the issue tracker that engineering teams actually want to use. It is fast, opinionated, and designed for the workflows that modern development teams run — sprints, cycles, and triage — without the bloat of legacy project management tools.',
    advice:
      'Apply through the Linear startup program. Your company must be under 2 years old with fewer than 50 employees.',
    url: 'https://linear.app/startups',
  },
  {
    name: 'Intercom',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/intercom_logo.jpeg',
    incentive: '95% Off for Year One',
    description:
      'Intercom is the customer messaging platform that handles live chat, help center, bots, and product tours from one interface. It lets a small team deliver enterprise-level support and onboarding without hiring a large support org.',
    advice:
      'Apply via the Early Stage program. You must be under 2 years old, have fewer than 25 employees, and have raised less than $5M in funding.',
    url: 'https://www.intercom.com/early-stage',
  },
  {
    name: 'Vercel',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/vercel_logo.jpeg',
    incentive: '$3,000 in Credits',
    description:
      'Vercel is the deployment platform built for frontend teams. It gives you instant global deploys, edge functions, and built-in analytics — purpose-built for Next.js but compatible with any framework. It makes shipping fast the default, not the exception.',
    advice:
      'Apply through the Vercel startup program. You need to be a funded startup with fewer than 50 employees and not already on a paid Vercel plan.',
    url: 'https://vercel.com/startups',
  },
  {
    name: 'OpenAI',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/open+ai+-+logo.jpg',
    incentive: '$2,500 in API Credits',
    description:
      'OpenAI provides the foundational AI models that power the next generation of software products. Whether you are building AI-native features or augmenting existing workflows, access to GPT-4 and beyond is a competitive requirement, not an option.',
    advice:
      'Apply via the OpenAI Startup Program. Priority is given to companies building AI-first products. Have a clear use case ready in your application.',
    url: 'https://openai.com/startups',
  },
  {
    name: 'Airtable',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/airtable-logo.jpeg',
    incentive: '$2,000 in Credits',
    description:
      'Airtable is the programmable spreadsheet that ops teams use to build internal tools without engineering resources. From CRM to content calendars to inventory tracking, it lets non-technical team members move fast without waiting on dev cycles.',
    advice:
      'Apply through the Airtable startup program. Your company must be under 3 years old, have fewer than 50 employees, and not be an existing paying customer.',
    url: 'https://www.airtable.com/startups',
  },
  {
    name: 'Mixpanel',
    logo: 'https://spaire-production-files-public.s3.us-east-1.amazonaws.com/mixpanel_inc__logo.jpeg',
    incentive: '$50K in Credits',
    description:
      'Mixpanel is the event-based analytics platform that tells you what users actually do in your product, not just how many visited a page. It gives you funnels, retention analysis, and cohort breakdowns that drive real product decisions.',
    advice:
      'Apply via the Mixpanel startup program. You must be under 5 years old with less than $8M in funding. Credits are valid for one year.',
    url: 'https://mixpanel.com/startups',
  },
]
