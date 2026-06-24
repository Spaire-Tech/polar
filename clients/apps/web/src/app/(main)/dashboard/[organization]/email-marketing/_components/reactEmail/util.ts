// Shared helpers for the canonical React Email renderer.
//
// These mirror the safety rules of the legacy string renderer (render.ts)
// so output stays email-safe: only http(s)/mailto URLs, hex-validated colors,
// and — critically — video that degrades to a real poster image + link rather
// than a <video>/<iframe> (which no inbox plays) or the page URL as an <img>.

export const DEFAULT_ACCENT = '#1d1d1f'

export const safeUrl = (url: string | undefined | null): string | null => {
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
  // Explicitly reject blob:/data:/javascript: — these never resolve in an
  // inbox (blob/data are local to the author's tab; javascript: is an XSS
  // vector). The video upload path must hand us a hosted URL.
  return null
}

export const safeColor = (color: string | undefined | null): string =>
  color && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color.trim())
    ? color.trim()
    : DEFAULT_ACCENT

// Extract a YouTube/Vimeo video id so we can derive a poster thumbnail without
// an API call. Returns null for anything we can't recognize.
const YT_PATTERNS = [
  /youtube\.com\/watch\?(?:.*&)?v=([\w-]{6,})/i,
  /youtu\.be\/([\w-]{6,})/i,
  /youtube\.com\/embed\/([\w-]{6,})/i,
  /youtube\.com\/shorts\/([\w-]{6,})/i,
]

export const youtubeId = (url: string): string | null => {
  for (const re of YT_PATTERNS) {
    const m = url.match(re)
    if (m?.[1]) return m[1]
  }
  return null
}

// The watch target + best poster we can produce for a video block, or null if
// there's nothing renderable (e.g. a dropped blob: URL).
export type VideoRender = {
  target: string
  thumb: string | null
}

export const resolveVideo = (block: {
  embed_url?: string
  src?: string
  thumbnail?: string
}): VideoRender | null => {
  // Prefer an embed link; fall back to a hosted file URL. Both must pass
  // safeUrl — a blob:/data: src yields null and the block renders nothing
  // (better an omitted block than a broken one in a subscriber's inbox).
  const target = safeUrl(block.embed_url) || safeUrl(block.src)
  if (!target) return null

  // Author-supplied thumbnail wins; otherwise derive YouTube's poster.
  // NEVER fall back to the page URL as an <img src> (the legacy bug) — if we
  // have no real image, return null and the renderer shows a text "watch"
  // card instead of a broken image.
  let thumb = safeUrl(block.thumbnail)
  if (!thumb) {
    const id = youtubeId(target)
    if (id) thumb = `https://img.youtube.com/vi/${id}/hqdefault.jpg`
  }
  return { target, thumb }
}

// Split a multi-line string into lines for <br>-joined rendering.
export const lines = (text: string | undefined): string[] =>
  (text ?? '').split('\n')
