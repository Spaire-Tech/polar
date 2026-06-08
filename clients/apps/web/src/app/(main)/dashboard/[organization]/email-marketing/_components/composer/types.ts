// Block / draft types shared across composer files.

export type BlockType =
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'quote'
  | 'bullet'
  | 'numbered'
  | 'image'
  | 'button'
  | 'divider'

export type Align = 'left' | 'center' | 'right' | 'full'
/** Subset valid as a CSS `text-align` value (no 'full'). */
export type TextAlign = 'left' | 'center' | 'right'
export type Crop = 'orig' | 'square' | 'wide' | 'classic'

export type Block =
  | { id: string; type: 'text' | 'h1' | 'h2' | 'h3' | 'quote'; html: string; talign?: TextAlign }
  | { id: string; type: 'bullet' | 'numbered'; items: string[]; talign?: TextAlign }
  | {
      id: string
      type: 'image'
      src: string
      caption: string
      alt: string
      link: string
      align: Exclude<Align, 'right'>
      crop: Crop
      linkEdit?: boolean
    }
  | {
      id: string
      type: 'button'
      text: string
      link: string
      align: TextAlign
    }
  | { id: string; type: 'divider' }

export type Attachment = { name: string; size: string; url?: string }

export type SendOptionsState = {
  replyTo: 'self' | 'support' | 'noreply'
  schedule: boolean
  date: string
  time: string
  tracking: boolean
  webVersion: boolean
  labels: string[]
  customTags: string[]
}

export const TEXTLIKE: BlockType[] = [
  'text',
  'h1',
  'h2',
  'h3',
  'quote',
  'bullet',
  'numbered',
]
export const CROP_AR: Record<Crop, string | null> = {
  orig: null,
  square: '1 / 1',
  wide: '16 / 9',
  classic: '4 / 3',
}
export const CROP_SEQ: Crop[] = ['orig', 'square', 'wide', 'classic']
export const CROP_LABEL: Record<Crop, string> = {
  orig: 'Original',
  square: 'Square',
  wide: '16:9',
  classic: '4:3',
}

let _mid = 200
export const muid = () => 'm' + ++_mid

export const defaultBlock = (type: BlockType): Block => {
  switch (type) {
    case 'text':
    case 'h1':
    case 'h2':
    case 'h3':
    case 'quote':
      return { id: muid(), type, html: '' }
    case 'bullet':
    case 'numbered':
      return { id: muid(), type, items: [''] }
    case 'image':
      return {
        id: muid(),
        type: 'image',
        src: '',
        caption: '',
        alt: '',
        link: '',
        align: 'center',
        crop: 'orig',
      }
    case 'button':
      return {
        id: muid(),
        type: 'button',
        text: 'View the doc',
        link: '',
        align: 'left',
      }
    case 'divider':
      return { id: muid(), type: 'divider' }
  }
}

export const INITIAL_BLOCKS: Block[] = [
  { id: 'm1', type: 'text', html: 'Hey everyone,' },
  {
    id: 'm2',
    type: 'text',
    html: "Big month at the studio. A brand-new course just went live, and I'm running a short sale to celebrate — here's everything that's new and how to grab it.",
  },
  { id: 'm3', type: 'h3', html: 'The Gelato Masterclass is live' },
  {
    id: 'm4',
    type: 'text',
    html: 'Three hours of step-by-step lessons, from base recipes to plating. It’s the workshop I get asked about most — now yours to keep, watch any time.',
  },
  {
    id: 'm5',
    type: 'button',
    text: 'Watch the first lesson',
    link: '',
    align: 'left',
  },
  { id: 'm6', type: 'h3', html: 'Flash sale — 30% off, this week only' },
  {
    id: 'm7',
    type: 'bullet',
    items: [
      '<strong>Everything in the shop</strong>&nbsp;is discounted through Sunday.',
      '<strong>Paid members</strong>&nbsp;get an extra month free on annual plans.',
      '<strong>New here?</strong>&nbsp;Your welcome code still works at checkout.',
    ],
  },
  {
    id: 'm8',
    type: 'text',
    html: 'Thanks for being here — it genuinely means a lot.',
  },
]

export const readFileAsDataURL = (file: File, cb: (url: string) => void) => {
  const r = new FileReader()
  r.onload = () => cb(r.result as string)
  r.readAsDataURL(file)
}
