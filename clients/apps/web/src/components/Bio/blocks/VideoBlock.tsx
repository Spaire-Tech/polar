import PlayArrow from '@mui/icons-material/PlayArrow'

interface VideoBlockSettings {
  heading?: string | null
  url?: string | null
  thumbnail_url?: string | null
  provider?: 'youtube' | 'vimeo' | 'other'
}

const toEmbedUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = parsed.searchParams.get('v')
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1)
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (host === 'vimeo.com') {
      const id = parsed.pathname.slice(1)
      return id ? `https://player.vimeo.com/video/${id}` : null
    }
    return null
  } catch {
    return null
  }
}

export const VideoBlock = ({ settings }: { settings: VideoBlockSettings }) => {
  if (!settings.url) return null
  const embed = toEmbedUrl(settings.url)

  return (
    <section className="flex flex-col gap-3">
      {settings.heading && (
        <h2 className="text-sm font-semibold text-gray-900">
          {settings.heading}
        </h2>
      )}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
        {embed ? (
          <iframe
            src={embed}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <a
            href={settings.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex h-full w-full items-center justify-center"
          >
            {settings.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.thumbnail_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : null}
            <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
              <PlayArrow className="h-12 w-12 text-white" />
            </span>
          </a>
        )}
      </div>
    </section>
  )
}
