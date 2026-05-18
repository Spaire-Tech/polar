import { PublicNewsletterPost } from '@/hooks/queries/newsletters'

// Server component — render the public archive view of a newsletter
// post. content_html is already server-rendered with the resolved
// theme by the backend (see newsletter/service.get_public_post), so we
// only handle the wrapper chrome here: masthead, hero, tags, body,
// audio, gated-state hint, footer.

export function ArchivePost({ post }: { post: PublicNewsletterPost }) {
  const theme = post.theme as {
    colors?: Record<string, string>
    typography?: Record<string, number | string>
    spacing?: Record<string, number>
  }
  const outsideBg = theme.colors?.outsideBg ?? '#ffffff'
  const postBg = theme.colors?.postBg ?? '#ffffff'
  const textBg = theme.colors?.textBg ?? '#1d1d1f'
  const muted = theme.colors?.secondary ?? '#86868b'
  const links = theme.colors?.links ?? textBg
  const hairline = theme.colors?.hairline ?? '#e8e8ed'
  const padding =
    (theme.spacing?.sectionPadding as number | undefined) ?? 32
  const headerSize =
    (theme.typography?.headerSize as number | undefined) ?? 28
  const radius = (theme.spacing?.borderRadius as number | undefined) ?? 8

  const showThumbnailOnTop =
    post.web_thumbnail_on_top &&
    (post.web_thumbnail_url || post.cover_url)
  const heroImage = showThumbnailOnTop
    ? post.web_thumbnail_url || post.cover_url
    : post.cover_visible
      ? post.cover_url
      : null

  return (
    <div
      style={{
        minHeight: '100vh',
        background: outsideBg,
        color: textBg,
      }}
    >
      <article
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: `${padding + 16}px 24px ${padding + 32}px`,
          background: postBg,
        }}
      >
        {post.newsletter_masthead && (
          <div
            style={{
              fontSize: headerSize,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: theme.colors?.secondary ?? textBg,
              textAlign: 'center',
              textTransform: 'uppercase',
              margin: '0 0 28px',
            }}
          >
            {post.newsletter_masthead}
          </div>
        )}

        <h1
          style={{
            margin: '0 0 8px',
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
            color: textBg,
          }}
        >
          {post.title || 'Untitled'}
        </h1>

        {post.subtitle && (
          <p
            style={{
              margin: '0 0 18px',
              fontSize: 19,
              lineHeight: 1.45,
              color: muted,
              fontWeight: 400,
            }}
          >
            {post.subtitle}
          </p>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 12.5,
            color: muted,
            marginBottom: 20,
          }}
        >
          <span>{post.newsletter_name}</span>
          {post.published_at && (
            <>
              <span style={{ opacity: 0.5 }}>·</span>
              <time dateTime={post.published_at}>
                {formatDate(post.published_at)}
              </time>
            </>
          )}
          {post.tags.length > 0 && (
            <>
              <span style={{ opacity: 0.5 }}>·</span>
              <span>{post.tags.join(' / ')}</span>
            </>
          )}
        </div>

        <div
          style={{
            height: 1,
            background: hairline,
            margin: '0 0 28px',
          }}
        />

        {heroImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImage}
            alt=""
            style={{
              display: 'block',
              width: '100%',
              borderRadius: radius,
              marginBottom: 28,
            }}
          />
        )}

        {post.audio_enabled && (post.audio_url || post.audio_url === '') && (
          <AudioBlock url={post.audio_url} title={post.title} radius={radius} />
        )}

        <div
          // The body HTML was rendered server-side through the same
          // renderer the email send uses, with the post's resolved
          // theme already baked into inline styles. Anchor colours pop
          // out of the inline-style world (the renderer doesn't restyle
          // them), so wrap the dangerouslySetInnerHTML in a wrapper that
          // sets `a { color }` via :is selector inheritance.
          dangerouslySetInnerHTML={{ __html: post.content_html }}
          style={
            {
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              ['--archive-link' as string]: links,
            } as React.CSSProperties
          }
          className="archive-body"
        />

        {post.gated && (
          <div
            style={{
              marginTop: 28,
              padding: 18,
              borderRadius: radius,
              background: '#fafafa',
              border: `1px solid ${hairline}`,
              fontSize: 13,
              color: muted,
              textAlign: 'center',
            }}
          >
            The rest of this post is for paying subscribers.
          </div>
        )}

        <footer
          style={{
            marginTop: 48,
            paddingTop: 18,
            borderTop: `1px solid ${hairline}`,
            fontSize: 12,
            color: muted,
            textAlign: 'center',
          }}
        >
          Published by{' '}
          <a
            href={`/${post.organization_slug}`}
            style={{ color: muted, textDecoration: 'underline' }}
          >
            {post.organization_name}
          </a>
        </footer>
      </article>

      {/* Apply the theme's link colour to anchors emitted by the block
          renderer. Inline-styled hrefs in the email markup don't
          declare a colour, so the natural cascade picks this up. */}
      <style>{`
        .archive-body a { color: var(--archive-link, ${links}); }
      `}</style>
    </div>
  )
}

function AudioBlock({
  url,
  title,
  radius,
}: {
  url: string | null
  title: string
  radius: number
}) {
  if (!url) return null
  return (
    <div
      style={{
        margin: '0 0 28px',
        padding: 16,
        background: '#fafafa',
        borderRadius: radius,
        border: '1px solid #e8e8ed',
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#86868b',
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        Listen
      </div>
      {title && (
        <div style={{ fontSize: 13.5, color: '#1d1d1f', marginBottom: 8 }}>
          {title}
        </div>
      )}
      <audio controls src={url} style={{ width: '100%' }} />
    </div>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}
