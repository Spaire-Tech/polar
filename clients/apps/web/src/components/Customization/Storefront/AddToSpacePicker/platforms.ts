import {
  AppleMusicLogo,
  InstagramLogo,
  SoundCloudLogo,
  SpotifyLogo,
  SubstackLogo,
  TikTokLogo,
  VimeoLogo,
  XLogo,
  YouTubeLogo,
} from './PlatformLogos'

// Platforms shown in the Embed tab of the Add-to-Space picker. Mirrors
// the design hand-off (8 tiles). Some embed inline (canEmbed: true);
// the rest fall back to a stylized link card.

export type EmbedPlatformId =
  | 'youtube'
  | 'spotify'
  | 'soundcloud'
  | 'vimeo'
  | 'apple_music'
  | 'tiktok'
  | 'substack'
  | 'instagram'
  | 'x'

export type EmbedPlatform = {
  id: EmbedPlatformId
  label: string
  sub: string
  Icon: React.ComponentType<{
    className?: string
    style?: React.CSSProperties
  }>
  bg: string
  // True if the renderer plays this platform inline. False = falls back
  // to a stylized link card.
  canEmbed: boolean
  hosts: string[]
}

export const EMBED_PLATFORMS: ReadonlyArray<EmbedPlatform> = [
  {
    id: 'youtube',
    label: 'YouTube',
    sub: 'Videos & shorts',
    Icon: YouTubeLogo,
    bg: '#FF0000',
    canEmbed: true,
    hosts: ['youtube.com', 'youtu.be', 'm.youtube.com', 'music.youtube.com'],
  },
  {
    id: 'spotify',
    label: 'Spotify',
    sub: 'Tracks, episodes, playlists',
    Icon: SpotifyLogo,
    bg: '#1ED760',
    canEmbed: true,
    hosts: ['open.spotify.com', 'spotify.com'],
  },
  {
    id: 'soundcloud',
    label: 'SoundCloud',
    sub: 'Tracks & sets',
    Icon: SoundCloudLogo,
    bg: '#FF5500',
    canEmbed: true,
    hosts: ['soundcloud.com', 'm.soundcloud.com', 'on.soundcloud.com'],
  },
  {
    id: 'vimeo',
    label: 'Vimeo',
    sub: 'Videos',
    Icon: VimeoLogo,
    bg: '#1AB7EA',
    canEmbed: true,
    hosts: ['vimeo.com', 'player.vimeo.com'],
  },
  {
    id: 'apple_music',
    label: 'Apple Music',
    sub: 'Tracks & playlists',
    Icon: AppleMusicLogo,
    bg: '#FA243C',
    canEmbed: true,
    hosts: ['music.apple.com', 'embed.music.apple.com'],
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    sub: 'Videos',
    Icon: TikTokLogo,
    bg: '#000000',
    canEmbed: true,
    hosts: ['tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
  },
  {
    id: 'substack',
    label: 'Substack',
    sub: 'Newsletter posts',
    Icon: SubstackLogo,
    bg: '#FF6719',
    canEmbed: false,
    hosts: ['substack.com'],
  },
  {
    id: 'instagram',
    label: 'Instagram',
    sub: 'Posts & reels',
    Icon: InstagramLogo,
    bg: 'linear-gradient(135deg, #E4405F, #FCAF45)',
    canEmbed: false,
    hosts: ['instagram.com'],
  },
  {
    id: 'x',
    label: 'X',
    sub: 'Posts & threads',
    Icon: XLogo,
    bg: '#000000',
    canEmbed: false,
    hosts: ['x.com', 'twitter.com'],
  },
]

export function detectEmbedPlatform(url: string): EmbedPlatform | null {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
  for (const p of EMBED_PLATFORMS) {
    for (const allowed of p.hosts) {
      if (host === allowed || host.endsWith(`.${allowed}`)) {
        return p
      }
    }
  }
  return null
}
