// Migration: legacy composer.v3 documents -> canonical ContentDoc.
//
// The old "new broadcast" editor stored blocks with raw contentEditable HTML
// (the source of the random fonts/sizes). We convert that to clean text +
// structure, DELIBERATELY dropping the inline font/size/color styling — that
// styling was the bug. Bold/italic are also dropped here (best-effort, lossy)
// in favour of robustness; the user re-applies marks in the new editor.
//
// DOM-free on purpose so it runs identically in SSR, Node tests, and the
// browser (DOMParser would crash during SSR).

import { Block, ContentDoc, newId } from '../blockEditor/types'

// True for a stored doc authored by the old composer.
export const isComposerV3 = (raw: unknown): boolean => {
  if (!raw || typeof raw !== 'object') return false
  const o = raw as { v?: unknown; blocks?: unknown }
  if (o.v === 'composer.v3') return true
  // Fallback: recognize by the v3-only block vocabulary.
  if (Array.isArray(o.blocks)) {
    const V3_ONLY = new Set(['text', 'h1', 'h2', 'h3', 'bullet', 'numbered', 'file'])
    return o.blocks.some(
      (b) => b && typeof b === 'object' && V3_ONLY.has((b as { type?: string }).type ?? ''),
    )
  }
  return false
}

// Strip contentEditable HTML to clean plain text: keep line structure, drop
// every tag and the inline styles that caused the size drift, decode the
// common entities.
export const stripHtml = (html: string | undefined): string =>
  (html ?? '')
    .replace(/<br\s*\/?>(?!\n)/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

type V3Block = Record<string, unknown> & { id?: string; type?: string }

const migrateBlock = (b: V3Block): Block | null => {
  const type = b.type
  switch (type) {
    case 'text':
      return { id: newId(), type: 'paragraph', text: stripHtml(b.html as string) }
    case 'h1':
      return { id: newId(), type: 'heading', level: 1, text: stripHtml(b.html as string) }
    case 'h2':
      return { id: newId(), type: 'heading', level: 2, text: stripHtml(b.html as string) }
    case 'h3':
      return { id: newId(), type: 'heading', level: 3, text: stripHtml(b.html as string) }
    case 'quote':
      return { id: newId(), type: 'quote', text: stripHtml(b.html as string) }
    case 'bullet':
    case 'numbered': {
      const items = Array.isArray(b.items) ? (b.items as string[]) : []
      return {
        id: newId(),
        type: 'list',
        ordered: type === 'numbered',
        items: items.map((it) => ({ id: newId(), text: stripHtml(it) })),
      }
    }
    case 'image': {
      const src = typeof b.src === 'string' ? b.src : ''
      if (!src) return null
      const alt = (b.alt as string) || (b.caption as string) || ''
      const link = b.link as string
      return {
        id: newId(),
        type: 'image',
        src,
        alt,
        ...(link ? { href: link } : {}),
      }
    }
    case 'button':
      return {
        id: newId(),
        type: 'button',
        text: (b.text as string) || 'Learn more',
        url: (b.link as string) || '',
      }
    case 'divider':
      return { id: newId(), type: 'divider' }
    case 'file': {
      // No file block in ContentDoc — surface it as a download button when we
      // have a URL, otherwise drop it (an unlinked "Untitled file" is noise).
      const url = b.url as string
      if (!url) return null
      return {
        id: newId(),
        type: 'button',
        text: `Download ${(b.name as string) || 'file'}`,
        url,
      }
    }
    default:
      return null
  }
}

// Returns a ContentDoc for a composer.v3 doc, or null if it isn't one.
export const migrateComposerV3 = (raw: unknown): ContentDoc | null => {
  if (!isComposerV3(raw)) return null
  const o = raw as { blocks?: unknown }
  const src = Array.isArray(o.blocks) ? (o.blocks as V3Block[]) : []
  const blocks = src
    .map((b) => (b && typeof b === 'object' ? migrateBlock(b) : null))
    .filter((b): b is Block => b !== null)
  return { version: 1, blocks }
}
