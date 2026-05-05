// Frontend renderer for content blocks.
//
// Mirrors `server/polar/email_broadcast/render.py`. The composer keeps both in
// sync by writing the rendered HTML back to the API on save, but we still
// render locally so the preview is instant.

import { Block, ContentDoc } from './types'

const HEADING_STYLES: Record<1 | 2 | 3, string> = {
  1: 'font-size:28px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;color:#1d1d1f;margin:0 0 16px',
  2: 'font-size:22px;font-weight:600;letter-spacing:-0.015em;line-height:1.25;color:#1d1d1f;margin:0 0 14px',
  3: 'font-size:17px;font-weight:600;letter-spacing:-0.01em;line-height:1.3;color:#1d1d1f;margin:0 0 12px',
}

const PARAGRAPH_STYLE =
  'font-size:14px;line-height:1.65;color:#424245;margin:0 0 16px'
const BUTTON_WRAPPER_STYLE = 'margin:24px 0'
const BUTTON_STYLE =
  'display:inline-block;background:#1d1d1f;color:#ffffff;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:500;text-decoration:none'
const IMAGE_STYLE = 'max-width:100%;height:auto;display:block;border-radius:8px'
const DIVIDER_STYLE = 'border:none;border-top:1px solid #e8e8ed;margin:28px 0'
const VIDEO_THUMB_STYLE =
  'max-width:100%;height:auto;display:block;border-radius:10px;border:1px solid #e8e8ed'

const escape = (raw: string): string =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const safeUrl = (url: string | undefined): string | null => {
  if (!url) return null
  const trimmed = url.trim()
  const lower = trimmed.toLowerCase()
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:')
  ) {
    return trimmed
  }
  return null
}

const paragraphText = (text: string): string =>
  (text || '').split('\n').map(escape).join('<br>')

const renderBlock = (block: Block): string => {
  switch (block.type) {
    case 'heading': {
      const level = ([1, 2, 3] as const).includes(block.level) ? block.level : 2
      return `<h${level} style="${HEADING_STYLES[level]}">${escape(block.text || '')}</h${level}>`
    }
    case 'paragraph':
      return `<p style="${PARAGRAPH_STYLE}">${paragraphText(block.text || '')}</p>`
    case 'image': {
      const src = safeUrl(block.src)
      if (!src) return ''
      const alt = escape(block.alt || '')
      const img = `<img src="${escape(src)}" alt="${alt}" style="${IMAGE_STYLE}">`
      const href = safeUrl(block.href)
      const inner = href
        ? `<a href="${escape(href)}" target="_blank" rel="noreferrer">${img}</a>`
        : img
      return `<div style="margin:20px 0">${inner}</div>`
    }
    case 'button': {
      const url = safeUrl(block.url)
      const text = escape(block.text || 'Learn more')
      if (!url)
        return `<div style="${BUTTON_WRAPPER_STYLE}"><span style="${BUTTON_STYLE}">${text}</span></div>`
      return `<div style="${BUTTON_WRAPPER_STYLE}"><a href="${escape(url)}" target="_blank" rel="noreferrer" style="${BUTTON_STYLE}">${text}</a></div>`
    }
    case 'divider':
      return `<hr style="${DIVIDER_STYLE}">`
    case 'video': {
      const thumb = safeUrl(block.thumbnail)
      const url = safeUrl(block.url)
      if (!thumb || !url) return ''
      return `<div style="margin:24px 0"><a href="${escape(url)}" target="_blank" rel="noreferrer"><img src="${escape(thumb)}" alt="Watch video" style="${VIDEO_THUMB_STYLE}"></a></div>`
    }
  }
}

export const renderBlocksToHtml = (
  doc: ContentDoc | null | undefined,
): string => {
  if (!doc || !doc.blocks?.length) return ''
  return doc.blocks.map(renderBlock).filter(Boolean).join('\n')
}
