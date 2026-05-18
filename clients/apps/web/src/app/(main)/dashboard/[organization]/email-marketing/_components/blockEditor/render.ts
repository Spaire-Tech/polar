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
const IMAGE_STYLE = 'max-width:100%;height:auto;display:block;border-radius:8px'
const DIVIDER_STYLE = 'border:none;border-top:1px solid #e8e8ed;margin:28px 0'
const VIDEO_THUMB_STYLE =
  'max-width:100%;height:auto;display:block;border-radius:10px;border:1px solid #e8e8ed'

const escape = (raw: unknown): string => {
  // Defensive coerce: blocks loaded from the API may be missing fields the
  // renderer assumes are present (older drafts, partial migrations, bad
  // server data). String(undefined) → "undefined" which is worse than empty,
  // so we explicitly null/undefined-coerce to "".
  const s = raw == null ? '' : typeof raw === 'string' ? raw : String(raw)
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

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

const safeColor = (color: string | undefined): string =>
  color && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : '#1d1d1f'

const paragraphText = (text: string): string =>
  (text || '').split('\n').map(escape).join('<br>')

const buttonStyle = (size: string | undefined, accent: string): string => {
  const padding =
    size === 'lg' ? '13px 28px' : size === 'sm' ? '8px 16px' : '10px 20px'
  const fontSize = size === 'lg' ? '14px' : '13px'
  return `display:inline-block;background:${accent};color:#ffffff;padding:${padding};border-radius:8px;font-size:${fontSize};font-weight:500;text-decoration:none`
}

const renderBlock = (block: Block, accent: string): string => {
  // Defensive: a malformed block from the API shouldn't crash the renderer
  // (and therefore the entire dashboard preview). Wrap each case so an
  // unexpected error in one block produces an empty render for *that*
  // block, not a thrown exception.
  try {
    return renderBlockUnsafe(block, accent)
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[email-marketing] render skipped malformed block', {
        type: (block as { type?: unknown })?.type,
        err,
      })
    }
    return ''
  }
}

const renderBlockUnsafe = (block: Block, accent: string): string => {
  switch (block.type) {
    case 'eyebrow':
      return `<div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${accent};font-weight:600;margin:0 0 8px">${escape(block.text || '')}</div>`
    case 'heading': {
      const level = ([1, 2, 3] as const).includes(block.level) ? block.level : 2
      const baseStyle = block.huge
        ? 'font-size:32px;font-weight:600;letter-spacing:-0.02em;line-height:1.15;color:#1d1d1f;margin:8px 0 16px'
        : HEADING_STYLES[level]
      return `<h${level} style="${baseStyle}">${escape(block.text || '')}</h${level}>`
    }
    case 'subheading':
      return `<h3 style="font-size:17px;font-weight:600;letter-spacing:-0.01em;line-height:1.3;color:#1d1d1f;margin:20px 0 8px">${escape(block.text || '')}</h3>`
    case 'paragraph':
      return `<p style="${PARAGRAPH_STYLE}">${paragraphText(block.text || '')}</p>`
    case 'badge':
      return `<span style="display:inline-block;font-size:12px;padding:5px 11px;background:#1d1d1f;color:#ffffff;border-radius:999px;font-weight:500;margin:0 0 14px">${escape(block.text || '')}</span>`
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
      const style = buttonStyle(block.size, accent)
      if (!url)
        return `<div style="${BUTTON_WRAPPER_STYLE}"><span style="${style}">${text}</span></div>`
      return `<div style="${BUTTON_WRAPPER_STYLE}"><a href="${escape(url)}" target="_blank" rel="noreferrer" style="${style}">${text}</a></div>`
    }
    case 'divider':
      return `<hr style="${DIVIDER_STYLE}">`
    case 'video': {
      const target = safeUrl(block.embed_url) || safeUrl(block.src)
      if (!target) return ''
      const thumb = safeUrl(block.thumbnail) || target
      return `<div style="margin:24px 0"><a href="${escape(target)}" target="_blank" rel="noreferrer"><img src="${escape(thumb)}" alt="Watch video" style="${VIDEO_THUMB_STYLE}"></a></div>`
    }
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul'
      const items = (block.items ?? [])
        .map((it) => {
          // Tolerate legacy string[] payloads still on disk pre-migration.
          const text = typeof it === 'string' ? it : (it?.text ?? '')
          return `<li style="margin-bottom:4px">${escape(text)}</li>`
        })
        .join('')
      return `<${tag} style="margin:0 0 14px;padding-left:20px;color:#3a3a3c;font-size:14px;line-height:1.7">${items}</${tag}>`
    }
    case 'quote': {
      const text = escape(block.text || '')
      const cite = block.cite
        ? `<div style="font-size:11.5px;color:#86868b;margin-top:8px">— ${escape(block.cite)}</div>`
        : ''
      return `<div style="margin:20px 0;padding:18px 22px;background:#fafafa;border-left:3px solid ${accent};border-radius:0 8px 8px 0"><div style="font-size:15px;color:#1d1d1f;line-height:1.55;font-style:italic;letter-spacing:-0.01em">"${text}"</div>${cite}</div>`
    }
    case 'columns': {
      const cols = (block.cols ?? [])
        .map((c) => {
          const parts: string[] = []
          if (c.label)
            parts.push(
              `<div style="font-size:10.5px;color:#86868b;text-transform:uppercase;letter-spacing:0.06em;font-weight:500;margin-bottom:4px">${escape(c.label)}</div>`,
            )
          if (c.title)
            parts.push(
              `<div style="font-size:13px;font-weight:600;color:#1d1d1f;margin-bottom:4px;letter-spacing:-0.005em">${escape(c.title)}</div>`,
            )
          if (c.value)
            parts.push(
              `<div style="font-size:13px;font-weight:500;color:#1d1d1f">${escape(c.value)}</div>`,
            )
          if (c.body)
            parts.push(
              `<div style="font-size:11.5px;line-height:1.5;color:#6e6e73">${escape(c.body)}</div>`,
            )
          return `<td style="background:#fafafa;padding:14px;border-radius:8px;border:1px solid #efefef;vertical-align:top;width:33%">${parts.join('')}</td>`
        })
        .join('<td width="12"></td>')
      // Use a table for the column layout — every email client respects it.
      return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:18px 0"><tr>${cols}</tr></table>`
    }
    case 'checklist': {
      const items = (block.items ?? [])
        .map((it, i) => {
          const idx = i + 1
          return `<tr><td valign="top" style="width:34px"><div style="width:22px;height:22px;border-radius:50%;background:${accent};color:#fff;display:inline-block;text-align:center;line-height:22px;font-size:11px;font-weight:600">${idx}</div></td><td style="padding-left:12px"><div style="font-size:13.5px;font-weight:600;color:#1d1d1f;margin-bottom:2px">${escape(it.title || '')}</div>${it.body ? `<div style="font-size:12px;color:#6e6e73;line-height:1.5">${escape(it.body)}</div>` : ''}</td></tr>`
        })
        .join('<tr><td colspan="2" height="10"></td></tr>')
      return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0;background:#fafafa;border:1px solid #efefef;border-radius:8px;padding:14px;width:100%">${items}</table>`
    }
    case 'event-card':
      return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 18px;width:100%;background:${accent};color:#fff;border-radius:10px"><tr><td style="padding:20px"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td valign="top" style="width:80px;padding-right:18px"><div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;letter-spacing:0.1em;opacity:0.8">${escape(block.day)}</div><div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;margin-top:2px">${escape(block.date)}</div></div></td><td><div style="font-size:11px;opacity:0.7;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">You're invited</div><div style="font-size:17px;font-weight:600;letter-spacing:-0.01em;margin-bottom:6px;line-height:1.25">${escape(block.title)}</div><div style="font-size:12px;opacity:0.85">${escape(block.meta)}</div></td></tr></table></td></tr></table>`
    case 'receipt': {
      const items = (block.items ?? [])
        .map(
          (it) =>
            `<tr><td style="padding:10px 0;border-bottom:1px solid #efefef"><div style="font-size:13.5px;font-weight:500;color:#1d1d1f">${escape(it.name)}</div>${it.sub ? `<div style="font-size:11.5px;color:#86868b;margin-top:2px">${escape(it.sub)}</div>` : ''}</td><td align="right" style="padding:10px 0;border-bottom:1px solid #efefef;font-size:13.5px;font-weight:600;font-family:monospace">${escape(it.price)}</td></tr>`,
        )
        .join('')
      return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0;background:#fafafa;border:1px solid #efefef;border-radius:10px;padding:20px;width:100%">${items}<tr><td style="padding-top:12px;border-top:2px solid #1d1d1f;font-size:13px;font-weight:600">Total</td><td align="right" style="padding-top:12px;border-top:2px solid #1d1d1f;font-size:15px;font-weight:700;font-family:monospace">${escape(block.total)}</td></tr></table>`
    }
    case 'digest-item':
      return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:14px 0;width:100%"><tr><td valign="top" style="width:48px;font-size:20px;font-weight:700;color:${accent};font-family:monospace;line-height:1">${escape(block.num)}</td><td style="padding-left:14px"><div style="font-size:15px;font-weight:600;color:#1d1d1f;letter-spacing:-0.01em;margin-bottom:3px;line-height:1.3">${escape(block.title)}</div><div style="font-size:11px;color:#86868b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:5px">${escape(block.meta)}</div><div style="font-size:13px;color:#3a3a3c;line-height:1.55">${escape(block.body)}</div></td></tr></table>`
    case 'pull':
      return `<div style="margin:36px 0;padding:0 16px;text-align:center;font-family:Georgia,'New York','Iowan Old Style',serif;font-size:24px;line-height:1.35;color:#1d1d1f;font-style:italic;letter-spacing:-0.01em">&ldquo;${escape(block.text || '')}&rdquo;</div>`
    case 'callout': {
      const body = paragraphText(block.text || '')
      const label = block.label
        ? `<div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#86868b;font-weight:600;margin-bottom:6px">${escape(block.label)}</div>`
        : ''
      return `<div style="margin:24px 0;padding:18px 22px;border:1px solid #e8e8ed;border-radius:10px;background:#fafafa">${label}<div style="font-size:15px;line-height:1.6;color:#1d1d1f">${body}</div></div>`
    }
    case 'gallery': {
      const cells = (block.images ?? [])
        .map((img) => {
          const src = safeUrl(img.src)
          if (!src) return ''
          const alt = escape(img.alt || '')
          const caption = img.caption
            ? `<div style="font-size:11.5px;color:#86868b;margin-top:6px;text-align:center;line-height:1.4">${escape(img.caption)}</div>`
            : ''
          return `<td valign="top" style="vertical-align:top;width:50%;padding:0 4px"><img src="${escape(src)}" alt="${alt}" style="max-width:100%;height:auto;display:block;border-radius:8px">${caption}</td>`
        })
        .filter(Boolean)
        .join('')
      if (!cells) return ''
      return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:20px 0"><tr>${cells}</tr></table>`
    }
    case 'embed': {
      const url = safeUrl(block.url)
      if (!url) return ''
      const caption = block.caption
        ? `<div style="font-size:12px;color:#86868b;margin-top:8px">${escape(block.caption)}</div>`
        : ''
      return `<div style="margin:22px 0;padding:18px 22px;border:1px solid #e8e8ed;border-radius:10px;background:#fafafa"><div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#86868b;font-weight:600;margin-bottom:6px">Embed</div><a href="${escape(url)}" target="_blank" rel="noreferrer" style="font-size:14px;color:#1d1d1f;word-break:break-all;text-decoration:none">${escape(url)}</a>${caption}</div>`
    }
    case 'poll': {
      const question = escape(block.question || '')
      const rows = (block.options ?? [])
        .map(
          (opt) =>
            `<tr><td style="padding:10px 14px;border:1px solid #e8e8ed;border-radius:8px;font-size:14px;color:#1d1d1f;background:#ffffff">${escape(opt.text || '')}</td></tr><tr><td height="8"></td></tr>`,
        )
        .join('')
      const body =
        rows ||
        '<tr><td style="font-size:13px;color:#86868b">(No options yet)</td></tr>'
      return `<div style="margin:24px 0;padding:20px;border:1px solid #e8e8ed;border-radius:12px;background:#fafafa"><div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${accent};font-weight:600;margin-bottom:8px">Poll</div><div style="font-size:16px;font-weight:600;color:#1d1d1f;margin-bottom:14px;letter-spacing:-0.01em">${question}</div><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%">${body}</table></div>`
    }
    case 'paywall': {
      const headline = escape(block.headline || 'Subscribe to keep reading')
      const bodyHtml = paragraphText(
        block.body || 'The rest of this post is for paying subscribers.',
      )
      const ctaText = escape(block.cta_text || 'Become a subscriber')
      const ctaUrl = safeUrl(block.cta_url)
      const cta = ctaUrl
        ? `<a href="${escape(ctaUrl)}" target="_blank" rel="noreferrer" style="display:inline-block;background:${accent};color:#fff;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:500;text-decoration:none;margin-top:14px">${ctaText}</a>`
        : `<span style="display:inline-block;background:${accent};color:#fff;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:500;margin-top:14px">${ctaText}</span>`
      return `<div style="margin:32px 0;padding:28px;border:1px solid #e8e8ed;border-radius:14px;background:#ffffff;text-align:center"><div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${accent};font-weight:700;margin-bottom:10px">✨ Members only</div><div style="font-size:20px;font-weight:600;color:#1d1d1f;letter-spacing:-0.01em;margin-bottom:8px">${headline}</div><div style="font-size:14px;line-height:1.55;color:#6e6e73">${bodyHtml}</div>${cta}</div>`
    }
    case 'audio': {
      const target = safeUrl(block.embed_url) || safeUrl(block.src)
      if (!target) return ''
      const title = escape(block.title || 'Listen to this issue')
      let meta = ''
      const dur = block.duration_seconds
      if (typeof dur === 'number' && dur > 0) {
        const minutes = Math.floor(dur / 60)
        const seconds = Math.floor(dur % 60)
        meta = `<div style="font-size:11.5px;color:#86868b;margin-top:2px">${minutes}:${seconds.toString().padStart(2, '0')}</div>`
      }
      return `<a href="${escape(target)}" target="_blank" rel="noreferrer" style="display:block;text-decoration:none;margin:22px 0"><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#fafafa;border:1px solid #e8e8ed;border-radius:12px"><tr><td style="width:54px;padding:14px 0 14px 16px"><div style="width:40px;height:40px;border-radius:50%;background:${accent};color:#fff;display:inline-block;text-align:center;line-height:40px;font-size:14px">▶</div></td><td style="padding:14px 16px"><div style="font-size:14px;font-weight:600;color:#1d1d1f;letter-spacing:-0.005em">${title}</div>${meta}</td></tr></table></a>`
    }
    default:
      return ''
  }
}

export const renderBlocksToHtml = (
  doc: ContentDoc | null | undefined,
): string => {
  if (!doc || !doc.blocks?.length) return ''
  const accent = safeColor(doc.accent)
  return doc.blocks
    .map((b) => renderBlock(b, accent))
    .filter(Boolean)
    .join('\n')
}
