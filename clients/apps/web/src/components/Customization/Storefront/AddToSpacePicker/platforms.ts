import Apple from '@mui/icons-material/Apple'
import GraphicEqOutlined from '@mui/icons-material/GraphicEqOutlined'
import Instagram from '@mui/icons-material/Instagram'
import MailOutlineOutlined from '@mui/icons-material/MailOutlineOutlined'
import MusicNoteOutlined from '@mui/icons-material/MusicNoteOutlined'
import PlayArrowOutlined from '@mui/icons-material/PlayArrowOutlined'
import VideoLibraryOutlined from '@mui/icons-material/VideoLibraryOutlined'
import X from '@mui/icons-material/X'

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
  Icon: React.ComponentType<{ className?: string }>
  bg: string
  // True if the renderer plays this platform inline. False = falls back
  // to a branded link card.
  canEmbed: boolean
  hosts: string[]
}

export const EMBED_PLATFORMS: ReadonlyArray<EmbedPlatform> = [
  {
    id: 'youtube',
    label: 'YouTube',
    sub: 'Videos & shorts',
    Icon: PlayArrowOutlined,
    bg: 'linear-gradient(135deg, #1a1a22 0%, #ff0033 130%)',
    canEmbed: true,
    hosts: ['youtube.com', 'youtu.be', 'm.youtube.com', 'music.youtube.com'],
  },
  {
    id: 'spotify',
    label: 'Spotify',
    sub: 'Tracks, episodes, playlists',
    Icon: MusicNoteOutlined,
    bg: 'linear-gradient(135deg, #0c8a3e, #1ED760)',
    canEmbed: true,
    hosts: ['open.spotify.com', 'spotify.com'],
  },
  {
    id: 'soundcloud',
    label: 'SoundCloud',
    sub: 'Tracks & sets',
    Icon: GraphicEqOutlined,
    bg: 'linear-gradient(135deg, #ff5500, #ff7700)',
    canEmbed: true,
    hosts: ['soundcloud.com', 'm.soundcloud.com', 'on.soundcloud.com'],
  },
  {
    id: 'vimeo',
    label: 'Vimeo',
    sub: 'Videos',
    Icon: VideoLibraryOutlined,
    bg: 'linear-gradient(135deg, #19B7EA, #006B8A)',
    canEmbed: true,
    hosts: ['vimeo.com', 'player.vimeo.com'],
  },
  {
    id: 'apple_music',
    label: 'Apple Music',
    sub: 'Tracks & playlists',
    Icon: Apple,
    bg: 'linear-gradient(135deg, #FA243C, #BB001B)',
    canEmbed: true,
    hosts: ['music.apple.com', 'embed.music.apple.com'],
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    sub: 'Videos',
    Icon: MusicNoteOutlined,
    bg: 'linear-gradient(135deg, #000, #25F4EE)',
    canEmbed: true,
    hosts: ['tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
  },
  {
    id: 'substack',
    label: 'Substack',
    sub: 'Newsletter posts',
    Icon: MailOutlineOutlined,
    bg: 'linear-gradient(135deg, #ff6719, #ffb085)',
    canEmbed: false,
    hosts: ['substack.com'],
  },
  {
    id: 'instagram',
    label: 'Instagram',
    sub: 'Posts & reels',
    Icon: Instagram,
    bg: 'linear-gradient(135deg, #E4405F, #FCAF45)',
    canEmbed: false,
    hosts: ['instagram.com'],
  },
  {
    id: 'x',
    label: 'X',
    sub: 'Posts & threads',
    Icon: X,
    bg: 'linear-gradient(135deg, #000, #444)',
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
