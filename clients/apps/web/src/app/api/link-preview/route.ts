import { NextRequest } from 'next/server'

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function extractMeta(html: string, prop: string): string | null {
  // Match both property= and name= variants, and both orderings of attributes
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${prop}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${prop}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return decodeHtmlEntities(m[1].trim())
  }
  return null
}

const OEMBED_ENDPOINTS: Record<string, (url: string) => string> = {
  'youtube.com': (u) =>
    `https://www.youtube.com/oembed?url=${encodeURIComponent(u)}&format=json`,
  'youtu.be': (u) =>
    `https://www.youtube.com/oembed?url=${encodeURIComponent(u)}&format=json`,
  'soundcloud.com': (u) =>
    `https://soundcloud.com/oembed?url=${encodeURIComponent(u)}&format=json`,
  'tiktok.com': (u) =>
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`,
  'open.spotify.com': (u) =>
    `https://open.spotify.com/oembed?url=${encodeURIComponent(u)}`,
  'vimeo.com': (u) =>
    `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u)}`,
  'instagram.com': (u) =>
    `https://graph.facebook.com/v14.0/instagram_oembed?url=${encodeURIComponent(u)}`,
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return Response.json({ error: 'URL required' }, { status: 400 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return Response.json({ error: 'Invalid URL' }, { status: 400 })
    }
  } catch {
    return Response.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const host = parsedUrl.hostname.replace('www.', '')
  const oEmbedBuilder = OEMBED_ENDPOINTS[host]

  // Try oEmbed first — these return clean structured data
  if (oEmbedBuilder) {
    try {
      const res = await fetch(oEmbedBuilder(url), {
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': 'SpaireLinkBot/1.0' },
      })
      if (res.ok) {
        const data = await res.json()
        return Response.json({
          title: data.title ?? null,
          description: data.author_name ?? null,
          image_url: data.thumbnail_url ?? null,
        })
      }
    } catch {}
  }

  // Fallback: scrape OG tags from the page
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; SpaireLinkBot/1.0; +https://spairehq.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(7000),
    })

    if (res.ok) {
      const html = await res.text()

      const title =
        extractMeta(html, 'og:title') ??
        html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ??
        null

      const description =
        extractMeta(html, 'og:description') ??
        extractMeta(html, 'description') ??
        null

      const image_url = extractMeta(html, 'og:image') ?? null

      return Response.json({
        title: title ? decodeHtmlEntities(title) : null,
        description: description ? decodeHtmlEntities(description) : null,
        image_url,
      })
    }
  } catch {}

  return Response.json({ title: null, description: null, image_url: null })
}
