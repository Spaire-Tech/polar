'use client'

import { useEffect } from 'react'

// Maps each font name shown in the picker to the Google Fonts URL
// fragment that loads it. The fragment is appended onto
// https://fonts.googleapis.com/css2?family=...&display=swap.
//
// We deliberately ship two weights per family — most editorial usage
// only needs a regular + a bold for headings — so the page doesn't
// pay for variable-font bytes it won't use. Bumping a family to italic
// is a one-character change here (`@0,400;1,400`).
//
// `default` and pure-system stacks (Georgia, New York, Iowan) are
// intentionally absent: those load nothing because they're already on
// the user's machine.
const GOOGLE_FONT_URLS: Record<string, string> = {
  Inter: 'Inter:wght@400;500;600;700',
  'SF Pro Display': '', // Apple system font; nothing to load.
  Newsreader:
    'Newsreader:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500',
  Anton: 'Anton',
  Charter: '', // Not on Google Fonts; system fallback only.
  Georgia: '',
  'New York': '',
  Iowan: '',
}

/**
 * Load the Google Font for `headingFont` + `bodyFont` so the live
 * preview actually shows the chosen typeface (instead of cascading to
 * the system fallback). Email clients can't load webfonts, so the
 * RENDERED email keeps using the inline-style stack with fallbacks
 * baked in — this hook is purely for the dashboard preview.
 *
 * The stylesheet is shared across the whole tab via a stable id, so
 * mounting / unmounting the Style view doesn't flicker. Two `<link>`
 * tags (one per family) keep updates surgical: changing just the
 * heading font doesn't re-fetch the body font.
 *
 * Usage:
 *   useGoogleFonts(theme.typography?.headingFont, theme.typography?.bodyFont)
 */
export function useGoogleFonts(
  headingFont: string | undefined,
  bodyFont: string | undefined,
): void {
  useEffect(() => {
    ensurePreconnect()
    return () => {
      // We deliberately leave the preconnect + font links in place
      // when the component unmounts. Mounting and re-mounting the
      // editor is common (mode switches) and re-fetching the font on
      // every mount would be wasteful. The browser caches the CSS so
      // subsequent loads are free.
    }
  }, [])

  useEffect(() => {
    return loadFont('newsletter-font-heading', headingFont)
  }, [headingFont])

  useEffect(() => {
    return loadFont('newsletter-font-body', bodyFont)
  }, [bodyFont])
}

function ensurePreconnect() {
  if (typeof document === 'undefined') return
  if (document.getElementById('newsletter-fonts-preconnect-gstatic')) return
  const a = document.createElement('link')
  a.id = 'newsletter-fonts-preconnect-gapis'
  a.rel = 'preconnect'
  a.href = 'https://fonts.googleapis.com'
  document.head.appendChild(a)
  const b = document.createElement('link')
  b.id = 'newsletter-fonts-preconnect-gstatic'
  b.rel = 'preconnect'
  b.href = 'https://fonts.gstatic.com'
  b.crossOrigin = 'anonymous'
  document.head.appendChild(b)
}

function loadFont(slotId: string, name: string | undefined): () => void {
  if (typeof document === 'undefined') return () => {}
  const existing = document.getElementById(slotId) as
    | HTMLLinkElement
    | null
  const url = name ? GOOGLE_FONT_URLS[name] : ''
  if (!url) {
    // Pure system font (default, Georgia, etc.) — drop any prior link.
    if (existing) existing.remove()
    return () => {}
  }
  const href = `https://fonts.googleapis.com/css2?family=${url}&display=swap`
  if (existing) {
    if (existing.href !== href) existing.href = href
  } else {
    const link = document.createElement('link')
    link.id = slotId
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)
  }
  return () => {}
}

// Whether a font name in the dropdown is a webfont we can actually
// load. The Style view uses this to dim system-only families with a
// hint, so users know which choices will visibly change the preview.
export function isWebfont(name: string | undefined | null): boolean {
  if (!name) return false
  return !!GOOGLE_FONT_URLS[name]
}
