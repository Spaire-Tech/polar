// Email design templates for the broadcast composer.
//
// Each template defines its accent color + an array of blocks the composer
// drops into the canvas. Picking a template clears the existing draft and
// replaces it with this content.

import {
  Block,
  ChecklistBlock,
  ColumnsBlock,
  ContentDoc,
  DigestItemBlock,
  EventCardBlock,
  ReceiptBlock,
  newId,
} from '../blockEditor/types'

// A template ships block specs without ids — we mint ids on apply. We
// expand the union manually because `Omit<Block, 'id'>` collapses the
// discriminated union and TS won't let us write block-specific fields.
export type TemplateBlock =
  | Omit<Extract<Block, { type: 'eyebrow' }>, 'id'>
  | Omit<Extract<Block, { type: 'heading' }>, 'id'>
  | Omit<Extract<Block, { type: 'subheading' }>, 'id'>
  | Omit<Extract<Block, { type: 'paragraph' }>, 'id'>
  | Omit<Extract<Block, { type: 'badge' }>, 'id'>
  | Omit<Extract<Block, { type: 'image' }>, 'id'>
  | Omit<Extract<Block, { type: 'button' }>, 'id'>
  | Omit<Extract<Block, { type: 'divider' }>, 'id'>
  | Omit<Extract<Block, { type: 'video' }>, 'id'>
  | Omit<Extract<Block, { type: 'list' }>, 'id'>
  | Omit<Extract<Block, { type: 'quote' }>, 'id'>
  | Omit<Extract<Block, { type: 'columns' }>, 'id'>
  | Omit<Extract<Block, { type: 'checklist' }>, 'id'>
  | Omit<Extract<Block, { type: 'event-card' }>, 'id'>
  | Omit<Extract<Block, { type: 'receipt' }>, 'id'>
  | Omit<Extract<Block, { type: 'digest-item' }>, 'id'>

export type EmailTemplate = {
  id: string
  name: string
  category: string
  description: string
  accent: string
  blocks: TemplateBlock[]
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'tpl-blank',
    name: 'Blank canvas',
    category: 'Basic',
    description:
      'Start from nothing. Just you, a subject line, and a blinking cursor.',
    accent: '#1d1d1f',
    blocks: [
      { type: 'heading', level: 2, text: 'A heading goes here' },
      { type: 'paragraph', text: 'Start writing…' },
    ],
  },
  {
    id: 'tpl-newsletter',
    name: 'Personal newsletter',
    category: 'Newsletter',
    description:
      'A warm, written-by-a-human format. One big idea, three quick links, sign-off.',
    accent: '#4f46e5',
    blocks: [
      { type: 'eyebrow', text: 'ISSUE №38 · MAY 6' },
      { type: 'heading', level: 2, text: 'On the patience of slow systems' },
      {
        type: 'paragraph',
        text: "Hi friends — three things I've been thinking about this week, plus the usual links and a small request at the bottom.",
      },
      {
        type: 'image',
        src: '',
        alt: '',
        tone: 'warm',
        placeholder: "this week's photo · 1200×600",
      },
      {
        type: 'paragraph',
        text: 'I keep coming back to the same observation: the systems I trust most are the ones that move slowly enough for me to course-correct…',
      },
      { type: 'divider' },
      { type: 'subheading', text: 'Three good things' },
      {
        type: 'list',
        items: [
          'A short essay on naming things, by Robin Sloan',
          'The new Patreon dashboard — surprisingly clean',
          'A reminder to back up your phone',
        ],
      },
      { type: 'divider' },
      {
        type: 'paragraph',
        text: "Reply if you've got something to share. — R",
      },
    ],
  },
  {
    id: 'tpl-launch',
    name: 'Product launch',
    category: 'Sales',
    description:
      'Hero, three-column features, social proof, big CTA. Built for revenue days.',
    accent: '#0066CC',
    blocks: [
      { type: 'eyebrow', text: 'NOW AVAILABLE' },
      { type: 'heading', level: 2, text: 'Brand Foundations 2.0' },
      {
        type: 'paragraph',
        text: 'Forty-two new lessons, a refreshed workbook, and a private cohort that starts next week. Members get 30% off through Friday.',
      },
      {
        type: 'image',
        src: '',
        alt: '',
        tone: 'cool',
        placeholder: 'product hero · 1600×900',
      },
      {
        type: 'columns',
        cols: [
          {
            icon: 'book',
            title: '42 lessons',
            body: 'Five new modules covering systems, naming, and rollout strategy.',
          },
          {
            icon: 'users',
            title: 'Live cohort',
            body: 'Two weeks of crit, working sessions, and feedback from peers.',
          },
          {
            icon: 'sparkles',
            title: 'Workbook',
            body: 'A 60-page printable workbook to use alongside the videos.',
          },
        ],
      } satisfies Omit<ColumnsBlock, 'id'>,
      {
        type: 'button',
        text: 'Buy Foundations 2.0 — $189',
        url: '#',
        size: 'lg',
      },
      {
        type: 'quote',
        text: "The clearest brand course I've taken. Worth ten times the price.",
        cite: 'Mei Chen, founder · Bramble',
      },
      {
        type: 'paragraph',
        text: 'Questions? Reply to this email. I read every one.',
      },
    ],
  },
  {
    id: 'tpl-announcement',
    name: 'Announcement',
    category: 'Updates',
    description:
      'Single big idea, supporting paragraph, one CTA. The cleanest format.',
    accent: '#1A7A3E',
    blocks: [
      { type: 'badge', text: '✦ Big news' },
      {
        type: 'heading',
        level: 2,
        huge: true,
        text: 'We just shipped Sequences',
      },
      {
        type: 'paragraph',
        text: 'Automated email series that respond to what your subscribers do. New course buyers, list joiners, podcast subscribers — each one can get a paced, personal welcome.',
      },
      { type: 'button', text: 'Try it now', url: '#', size: 'lg' },
      {
        type: 'paragraph',
        text: 'Available on every plan, free included. Documentation and a starter template are in your dashboard.',
      },
    ],
  },
  {
    id: 'tpl-digest',
    name: 'Curated digest',
    category: 'Newsletter',
    description:
      'A list of stories with thumbnails, titles, and one-line summaries.',
    accent: '#7B5BFF',
    blocks: [
      { type: 'eyebrow', text: 'THIS WEEK · 6 STORIES · 11 MIN' },
      { type: 'heading', level: 2, text: 'The slow web is back' },
      {
        type: 'paragraph',
        text: 'Six stories worth your time this week — plus one I keep re-reading.',
      },
      { type: 'divider' },
      {
        type: 'digest-item',
        num: '01',
        title: 'A quiet new social network from the Are.na team',
        meta: '4 min · The Verge',
        body: "It looks a lot like Are.na. That's the point.",
      } satisfies Omit<DigestItemBlock, 'id'>,
      {
        type: 'digest-item',
        num: '02',
        title: 'Why software design feels stuck',
        meta: '7 min · Increment',
        body: 'Frank Chimero on the strange flatness of modern apps.',
      } satisfies Omit<DigestItemBlock, 'id'>,
      {
        type: 'digest-item',
        num: '03',
        title: 'The case against personal brands',
        meta: '5 min · Kyle Chayka',
        body: 'A sharp critique of the influencer-ification of work.',
      } satisfies Omit<DigestItemBlock, 'id'>,
      { type: 'divider' },
      {
        type: 'paragraph',
        text: "Forwarded this? Subscribe — it's free. Sent every Sunday morning.",
      },
    ],
  },
  {
    id: 'tpl-welcome',
    name: 'Welcome / onboarding',
    category: 'Onboarding',
    description:
      'A friendly first hello with a clear "what to do next" checklist.',
    accent: '#FF6B35',
    blocks: [
      {
        type: 'image',
        src: '',
        alt: '',
        tone: 'warm',
        short: true,
        placeholder: 'welcome cover · 1200×400',
      },
      { type: 'heading', level: 2, text: 'Welcome to Spaire 👋' },
      {
        type: 'paragraph',
        text: "I'm so glad you're here. This first email is short on purpose — three things to do in your first week.",
      },
      {
        type: 'checklist',
        items: [
          {
            title: 'Set up your sender name',
            body: "Takes 30 seconds. We can't send anything without it.",
          },
          {
            title: 'Write your welcome sequence',
            body: "New subscribers get this automatically. Steal a template if you're stuck.",
          },
          {
            title: 'Join the creator community',
            body: 'A private Discord with 1,800 other creators using Spaire.',
          },
        ],
      } satisfies Omit<ChecklistBlock, 'id'>,
      { type: 'button', text: 'Open my dashboard', url: '#', size: 'lg' },
      {
        type: 'paragraph',
        text: 'Stuck? Hit reply. A real human (me) reads everything.',
      },
    ],
  },
  {
    id: 'tpl-event',
    name: 'Event invite',
    category: 'Events',
    description:
      'Date, place, ticket button. For workshops, launches, and live sessions.',
    accent: '#D6336C',
    blocks: [
      {
        type: 'event-card',
        date: 'MAY 22',
        day: 'THU',
        title: 'Live workshop · Designing under constraint',
        meta: '6:00–7:30 PM PT · Zoom · 80 seats',
      } satisfies Omit<EventCardBlock, 'id'>,
      {
        type: 'paragraph',
        text: 'Ninety minutes on the design choices that come from less budget, less time, and less stuff. Examples from real client work, then live Q&A.',
      },
      {
        type: 'columns',
        cols: [
          { label: 'When', value: 'Thu, May 22 · 6:00 PM PT' },
          { label: 'Where', value: 'Zoom (link on signup)' },
          { label: 'Cost', value: 'Free for members · $20 otherwise' },
        ],
      } satisfies Omit<ColumnsBlock, 'id'>,
      { type: 'button', text: 'Reserve a seat', url: '#', size: 'lg' },
      {
        type: 'paragraph',
        text: "Replays go to attendees only. Can't make it live? Reply and I'll save you a copy.",
      },
    ],
  },
  {
    id: 'tpl-receipt',
    name: 'Order confirmation',
    category: 'Transactional',
    description:
      'A clean receipt with item list, total, and next-steps section.',
    accent: '#1d1d1f',
    blocks: [
      { type: 'badge', text: '✓ Order confirmed' },
      {
        type: 'heading',
        level: 2,
        text: 'Thanks, friend — your order is in',
      },
      {
        type: 'paragraph',
        text: 'Order #SP-4827 · placed today.',
      },
      {
        type: 'receipt',
        items: [
          {
            name: 'Brand Foundations 2.0',
            sub: 'Lifetime access · digital',
            price: '$189.00',
          },
          {
            name: 'Workbook (printable PDF)',
            sub: 'Included with course',
            price: '$0.00',
          },
        ],
        total: '$189.00',
      } satisfies Omit<ReceiptBlock, 'id'>,
      { type: 'subheading', text: 'What happens next' },
      {
        type: 'list',
        ordered: true,
        items: [
          "You'll get a separate email with your course login within 5 minutes.",
          'The first lesson is unlocked immediately — start any time.',
          "Cohort starts next Monday. We'll send a reminder Sunday night.",
        ],
      },
      {
        type: 'paragraph',
        text: 'Need help? Reply to this email or visit help.spaire.co.',
      },
    ],
  },
]

// Apply a template to a doc — replaces blocks + accent. Caller should also
// reset selection state.
export const applyTemplate = (template: EmailTemplate): ContentDoc => ({
  version: 1,
  accent: template.accent,
  blocks: template.blocks.map(
    (b) => ({ ...(b as object), id: newId() }) as Block,
  ),
})

// Tags retained so unused-import warnings don't bite when tree-shaking.
export type _Unused =
  | ChecklistBlock
  | ColumnsBlock
  | DigestItemBlock
  | EventCardBlock
  | ReceiptBlock
