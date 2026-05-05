// Block schema for the broadcast composer.
//
// Mirrors `server/polar/email_broadcast/render.py`. The backend regenerates
// content_html from this JSON on save, but the editor renders it locally too
// so the live preview stays current without round-tripping the API.

export type BlockId = string

export type HeadingBlock = {
  id: BlockId
  type: 'heading'
  level: 1 | 2 | 3
  text: string
}

export type ParagraphBlock = {
  id: BlockId
  type: 'paragraph'
  text: string
}

export type ImageBlock = {
  id: BlockId
  type: 'image'
  src: string
  alt: string
  href?: string
}

export type ButtonBlock = {
  id: BlockId
  type: 'button'
  text: string
  url: string
}

export type DividerBlock = {
  id: BlockId
  type: 'divider'
}

export type VideoBlock = {
  id: BlockId
  type: 'video'
  thumbnail: string
  url: string
}

export type Block =
  | HeadingBlock
  | ParagraphBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | VideoBlock

export type BlockType = Block['type']

export type ContentDoc = {
  version: 1
  blocks: Block[]
}

export const newId = (): BlockId =>
  // Tiny id helper — collisions across a single document are essentially zero.
  // Using crypto.randomUUID when available, falling back to a timestamp +
  // random suffix for older browsers / SSR.
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

export const blankBlock = (type: BlockType): Block => {
  switch (type) {
    case 'heading':
      return { id: newId(), type: 'heading', level: 2, text: 'Heading' }
    case 'paragraph':
      return {
        id: newId(),
        type: 'paragraph',
        text: 'Write your paragraph here…',
      }
    case 'image':
      return { id: newId(), type: 'image', src: '', alt: '' }
    case 'button':
      return {
        id: newId(),
        type: 'button',
        text: 'Read more',
        url: '',
      }
    case 'divider':
      return { id: newId(), type: 'divider' }
    case 'video':
      return { id: newId(), type: 'video', thumbnail: '', url: '' }
  }
}

export const blockLibrary: { type: BlockType; label: string; icon: string }[] =
  [
    { type: 'heading', label: 'Heading', icon: 'heading' },
    { type: 'paragraph', label: 'Paragraph', icon: 'text' },
    { type: 'image', label: 'Image', icon: 'image' },
    { type: 'button', label: 'Button', icon: 'button-icon' },
    { type: 'divider', label: 'Divider', icon: 'divider' },
    { type: 'video', label: 'Video', icon: 'video' },
  ]

export const isContentDoc = (value: unknown): value is ContentDoc => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { version?: unknown; blocks?: unknown }
  return (
    v.version === 1 &&
    Array.isArray(v.blocks) &&
    v.blocks.every(
      (b) => typeof b === 'object' && b !== null && 'type' in b && 'id' in b,
    )
  )
}
