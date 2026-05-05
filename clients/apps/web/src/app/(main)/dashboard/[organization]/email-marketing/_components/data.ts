// Realistic creator-business mock data for Spaire Email Marketing.
// Mirrors the design prototype data so the UI matches the spec.

// SUBSCRIBERS / BROADCASTS used to live here as mocks. Both screens now
// pull from the real API; this file only holds mocks for screens whose backing
// data does not exist yet (sequences, analytics charts, templates).

export type Sequence = {
  id: number
  name: string
  trigger: string
  steps: number
  active: boolean
  enrolled: number
  completion: number
  openRate: number
  description: string
}

export const SEQUENCES: Sequence[] = [
  {
    id: 1,
    name: 'Brand Foundations — Welcome',
    trigger: 'On purchase',
    steps: 5,
    active: true,
    enrolled: 1284,
    completion: 78,
    openRate: 64.2,
    description: 'Onboards new students to the flagship course over 7 days.',
  },
  {
    id: 2,
    name: 'Friday Letter — Nurture',
    trigger: 'On subscribe',
    steps: 3,
    active: true,
    enrolled: 4287,
    completion: 91,
    openRate: 58.7,
    description: 'Three-email welcome for newsletter signups.',
  },
  {
    id: 3,
    name: 'Podcast — New listener funnel',
    trigger: 'On subscribe',
    steps: 4,
    active: true,
    enrolled: 612,
    completion: 67,
    openRate: 52.1,
    description: 'Introduces top episodes and the Patreon offer.',
  },
  {
    id: 4,
    name: 'Indie Launch — Cart abandonment',
    trigger: 'Manual',
    steps: 3,
    active: false,
    enrolled: 89,
    completion: 44,
    openRate: 41.8,
    description: 'Recovers checkouts started but not completed.',
  },
]

export type Template = {
  id: string
  name: string
  icon: string
  emails: number
  days: number
  audience: string
  description: string
  color: string
}

export const TEMPLATES: Template[] = [
  {
    id: 't1',
    name: 'Course welcome series',
    icon: 'book',
    emails: 5,
    days: 7,
    audience: 'New students',
    description:
      'Onboard new students with a paced 7-day intro that ends in their first win.',
    color: '#1d1d1f',
  },
  {
    id: 't2',
    name: 'Digital product launch',
    icon: 'package',
    emails: 6,
    days: 10,
    audience: 'Wait-list',
    description:
      'Tease, teach, prove, launch — the classic launch arc with social proof and urgency.',
    color: '#0066CC',
  },
  {
    id: 't3',
    name: 'Podcast subscriber nurture',
    icon: 'mic',
    emails: 4,
    days: 14,
    audience: 'New listeners',
    description:
      'Surface your best episodes and turn casual listeners into superfans.',
    color: '#7B5BFF',
  },
  {
    id: 't4',
    name: 'Abandoned cart recovery',
    icon: 'shopping-cart',
    emails: 3,
    days: 3,
    audience: 'Cart abandoners',
    description:
      'Three-touch recovery with a soft nudge, social proof, and a final discount.',
    color: '#FF6B35',
  },
  {
    id: 't5',
    name: 'Post-purchase onboarding',
    icon: 'gift',
    emails: 4,
    days: 5,
    audience: 'Buyers',
    description:
      'Reduce refunds and drive reviews with a thoughtful first-week experience.',
    color: '#1A7A3E',
  },
  {
    id: 't6',
    name: 'Re-engagement / win-back',
    icon: 'rotate',
    emails: 3,
    days: 14,
    audience: 'Inactive 60+ days',
    description:
      'Bring dormant subscribers back with curiosity and a single clear CTA.',
    color: '#D6336C',
  },
  {
    id: 't7',
    name: 'Subscription cancellation save',
    icon: 'x-circle',
    emails: 2,
    days: 2,
    audience: 'Cancelers',
    description:
      'Address top cancel reasons and offer a pause or downgrade before they leave.',
    color: '#B3261E',
  },
  {
    id: 't8',
    name: 'Free trial → paid conversion',
    icon: 'sparkles',
    emails: 5,
    days: 14,
    audience: 'Trial users',
    description:
      'Paced value drops timed to the trial window, ending in a personal close.',
    color: '#5856D6',
  },
]
