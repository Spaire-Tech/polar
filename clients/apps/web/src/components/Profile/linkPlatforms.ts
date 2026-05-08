// Platform detection for storefront links. Both the editor panel
// (StorefrontLinksPanel) and the public renderer (StorefrontLinks)
// import from here so a fix in one place applies to both.

const PLATFORM_HOSTS: ReadonlyArray<readonly [string, ReadonlyArray<string>]> =
  [
    [
      'youtube',
      [
        'youtube.com',
        'youtu.be',
        'm.youtube.com',
        'music.youtube.com',
        'youtube-nocookie.com',
      ],
    ],
    ['spotify', ['open.spotify.com', 'spotify.com']],
    [
      'soundcloud',
      ['soundcloud.com', 'm.soundcloud.com', 'on.soundcloud.com'],
    ],
    ['tiktok', ['tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com']],
    ['instagram', ['instagram.com']],
  ]

const EMBEDDABLE = new Set(['youtube', 'spotify', 'soundcloud'])

/**
 * Returns the canonical platform name for a URL, or null if it isn't a
 * known platform. Matches by hostname suffix so mobile/locale subdomains
 * like m.tiktok.com or music.youtube.com are detected correctly.
 */
export function detectPlatform(url: string): string | null {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
  for (const [platform, hosts] of PLATFORM_HOSTS) {
    for (const allowed of hosts) {
      if (host === allowed || host.endsWith(`.${allowed}`)) {
        return platform
      }
    }
  }
  return null
}

export function isEmbeddablePlatform(platform: string | null): boolean {
  return platform !== null && EMBEDDABLE.has(platform)
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
