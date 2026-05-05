// Realistic creator-business mock data for Spaire Email Marketing.
// Mirrors the design prototype data so the UI matches the spec.

export type Subscriber = {
  id: number
  name: string
  email: string
  subscribed: string
  source: string
  status: 'active' | 'unsub' | 'archived'
  color: string
}

export const SUBSCRIBERS: Subscriber[] = [
  {
    id: 1,
    name: 'Sofia Almeida',
    email: 'sofia.almeida@gmail.com',
    subscribed: 'May 5, 12:07 PM',
    source: 'Course: Brand Foundations',
    status: 'active',
    color: '#FF6B35',
  },
  {
    id: 2,
    name: 'Marcus Chen',
    email: 'marcus@studiovolt.co',
    subscribed: 'May 5, 09:42 AM',
    source: 'Newsletter form',
    status: 'active',
    color: '#1A7A3E',
  },
  {
    id: 3,
    name: 'Priya Raghavan',
    email: 'priya.r@protonmail.com',
    subscribed: 'May 4, 06:18 PM',
    source: 'Podcast opt-in',
    status: 'active',
    color: '#7B5BFF',
  },
  {
    id: 4,
    name: 'Jules Tremblay',
    email: 'jules.t@gmail.com',
    subscribed: 'May 4, 02:31 PM',
    source: 'Lead magnet: PDF',
    status: 'active',
    color: '#0066CC',
  },
  {
    id: 5,
    name: 'Aisha Okafor',
    email: 'aisha.okafor@hey.com',
    subscribed: 'May 3, 11:55 PM',
    source: 'Course: Indie Launch',
    status: 'active',
    color: '#D6336C',
  },
  {
    id: 6,
    name: 'Bastien Royer',
    email: 'bastien@royerstudio.fr',
    subscribed: 'May 3, 04:08 PM',
    source: 'Manual',
    status: 'active',
    color: '#FF9500',
  },
  {
    id: 7,
    name: 'Hana Watanabe',
    email: 'hana.w@icloud.com',
    subscribed: 'May 2, 10:12 AM',
    source: 'Webinar replay',
    status: 'active',
    color: '#22A39F',
  },
  {
    id: 8,
    name: 'Daniel Voss',
    email: 'd.voss@gmail.com',
    subscribed: 'May 1, 08:46 PM',
    source: 'Newsletter form',
    status: 'unsub',
    color: '#86868b',
  },
  {
    id: 9,
    name: 'Léa Bernard',
    email: 'lea.bernard@outlook.com',
    subscribed: 'Apr 30, 01:22 PM',
    source: 'Course: Brand Foundations',
    status: 'active',
    color: '#B3261E',
  },
  {
    id: 10,
    name: 'Reza Mahmoudi',
    email: 'reza.m@duck.com',
    subscribed: 'Apr 29, 05:39 PM',
    source: 'Podcast opt-in',
    status: 'active',
    color: '#5856D6',
  },
  {
    id: 11,
    name: 'Theo Martin',
    email: 'theo@craftworks.io',
    subscribed: 'Apr 28, 09:10 AM',
    source: 'Lead magnet: PDF',
    status: 'active',
    color: '#34C759',
  },
  {
    id: 12,
    name: 'Yui Nakamura',
    email: 'yui.nakamura@gmail.com',
    subscribed: 'Apr 27, 03:54 PM',
    source: 'Manual',
    status: 'archived',
    color: '#86868b',
  },
]

export type Broadcast = {
  id: number
  name: string
  status: 'sent' | 'scheduled' | 'draft'
  sentAt: string
  recipients: number
  opens: number | null
  clicks: number | null
  unsubs: number | null
}

export const BROADCASTS: Broadcast[] = [
  {
    id: 1,
    name: 'Brand Foundations — Module 4 is live',
    status: 'sent',
    sentAt: 'May 4, 09:00 AM',
    recipients: 4287,
    opens: 2098,
    clicks: 612,
    unsubs: 8,
  },
  {
    id: 2,
    name: 'Friday letter №47 — On naming things',
    status: 'sent',
    sentAt: 'May 2, 07:30 AM',
    recipients: 4271,
    opens: 2143,
    clicks: 487,
    unsubs: 5,
  },
  {
    id: 3,
    name: 'New podcast episode: building in public',
    status: 'sent',
    sentAt: 'Apr 29, 11:00 AM',
    recipients: 4255,
    opens: 1862,
    clicks: 391,
    unsubs: 11,
  },
  {
    id: 4,
    name: 'Spring sale — 30% off all courses',
    status: 'sent',
    sentAt: 'Apr 25, 02:00 PM',
    recipients: 4198,
    opens: 2517,
    clicks: 1042,
    unsubs: 19,
  },
  {
    id: 5,
    name: 'Replay: Indie Launch live workshop',
    status: 'sent',
    sentAt: 'Apr 22, 10:00 AM',
    recipients: 4156,
    opens: 1887,
    clicks: 524,
    unsubs: 7,
  },
  {
    id: 6,
    name: 'May newsletter — what we shipped',
    status: 'scheduled',
    sentAt: 'May 6, 08:00 AM',
    recipients: 4287,
    opens: null,
    clicks: null,
    unsubs: null,
  },
  {
    id: 7,
    name: 'Mid-year strategy session invite',
    status: 'draft',
    sentAt: '—',
    recipients: 0,
    opens: null,
    clicks: null,
    unsubs: null,
  },
]

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

export const SUBSCRIBER_GROWTH = [
  { d: 'Apr 22', v: 4156 },
  { d: 'Apr 23', v: 4172 },
  { d: 'Apr 24', v: 4189 },
  { d: 'Apr 25', v: 4198 },
  { d: 'Apr 26', v: 4214 },
  { d: 'Apr 27', v: 4231 },
  { d: 'Apr 28', v: 4244 },
  { d: 'Apr 29', v: 4255 },
  { d: 'Apr 30', v: 4262 },
  { d: 'May 1', v: 4268 },
  { d: 'May 2', v: 4271 },
  { d: 'May 3', v: 4276 },
  { d: 'May 4', v: 4282 },
  { d: 'May 5', v: 4287 },
]

export const ENGAGEMENT_SERIES = [
  { d: 'Apr 22', open: 45.4, click: 12.6 },
  { d: 'Apr 23', open: 47.1, click: 13.2 },
  { d: 'Apr 24', open: 44.8, click: 11.9 },
  { d: 'Apr 25', open: 60.0, click: 24.8 },
  { d: 'Apr 26', open: 51.2, click: 14.4 },
  { d: 'Apr 27', open: 48.9, click: 12.8 },
  { d: 'Apr 28', open: 49.6, click: 13.1 },
  { d: 'Apr 29', open: 43.8, click: 9.2 },
  { d: 'Apr 30', open: 46.3, click: 11.4 },
  { d: 'May 1', open: 47.8, click: 12.0 },
  { d: 'May 2', open: 50.2, click: 11.4 },
  { d: 'May 3', open: 48.6, click: 12.2 },
  { d: 'May 4', open: 48.9, click: 14.3 },
  { d: 'May 5', open: 49.2, click: 13.8 },
]

export const TOP_LINKS = [
  { url: 'spaire.co/courses/brand-foundations/m4', clicks: 412, ctr: 19.6 },
  { url: 'spaire.co/blog/naming-things', clicks: 287, ctr: 13.4 },
  { url: 'spaire.co/podcast/episode-47', clicks: 211, ctr: 11.3 },
  { url: 'twitter.com/spaire/status/...', clicks: 98, ctr: 4.6 },
  { url: 'spaire.co/community', clicks: 64, ctr: 3.0 },
]

export const DEVICES = [
  { name: 'iPhone Mail', share: 38.4 },
  { name: 'Gmail (web)', share: 24.1 },
  { name: 'Apple Mail (Mac)', share: 16.2 },
  { name: 'Gmail (Android)', share: 11.7 },
  { name: 'Outlook', share: 6.3 },
  { name: 'Other', share: 3.3 },
]
