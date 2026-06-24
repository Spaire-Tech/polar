import {
  Button,
  Column,
  Heading,
  Hr,
  Img,
  Link,
  Row,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'
import { Fragment } from 'react'
import { Block, ContentDoc } from '../blockEditor/types'
import { hasRich, renderInline } from '../richText/inline'
import { lines, resolveVideo, safeColor, safeUrl } from './util'

// Canonical email renderer, built on React Email components. ONE renderer for
// preview + send + storage, with deterministic typography (the values are the
// established Spaire email design, ported from the legacy render.ts) so fonts
// and sizes can never drift between editors or between preview and inbox.

const HEADING: Record<1 | 2 | 3, React.CSSProperties> = {
  1: { fontSize: '28px', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2, color: '#1d1d1f', margin: '0 0 16px' },
  2: { fontSize: '22px', fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.25, color: '#1d1d1f', margin: '0 0 14px' },
  3: { fontSize: '17px', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.3, color: '#1d1d1f', margin: '0 0 12px' },
}

const PARAGRAPH: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: 1.65,
  color: '#424245',
  margin: '0 0 16px',
}

const multiline = (text: string): React.ReactNode =>
  lines(text).map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line}
    </Fragment>
  ))

const buttonPadding = (size?: string): string =>
  size === 'lg' ? '13px 28px' : size === 'sm' ? '8px 16px' : '10px 20px'

export function BlockView({
  block,
  accent,
}: {
  block: Block
  accent: string
}): React.ReactElement | null {
  switch (block.type) {
    case 'eyebrow':
      return (
        <Text
          style={{
            fontSize: '11px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: accent,
            fontWeight: 600,
            margin: '0 0 8px',
          }}
        >
          {block.text || ''}
        </Text>
      )

    case 'heading': {
      const level = ([1, 2, 3] as const).includes(block.level) ? block.level : 2
      const style = block.huge
        ? { fontSize: '32px', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.15, color: '#1d1d1f', margin: '8px 0 16px' }
        : HEADING[level]
      return (
        <Heading as={`h${level}`} style={style}>
          {hasRich(block.rich)
            ? renderInline(block.rich, accent)
            : block.text || ''}
        </Heading>
      )
    }

    case 'subheading':
      return (
        <Heading
          as="h3"
          style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.3, color: '#1d1d1f', margin: '20px 0 8px' }}
        >
          {hasRich(block.rich)
            ? renderInline(block.rich, accent)
            : block.text || ''}
        </Heading>
      )

    case 'paragraph':
      return (
        <Text style={PARAGRAPH}>
          {hasRich(block.rich)
            ? renderInline(block.rich, accent)
            : multiline(block.text || '')}
        </Text>
      )

    case 'badge':
      return (
        <Text style={{ margin: '0 0 14px' }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: '12px',
              padding: '5px 11px',
              background: '#1d1d1f',
              color: '#ffffff',
              borderRadius: '999px',
              fontWeight: 500,
            }}
          >
            {block.text || ''}
          </span>
        </Text>
      )

    case 'image': {
      const src = safeUrl(block.src)
      if (!src) return null
      const img = (
        <Img
          src={src}
          alt={block.alt || ''}
          style={{ maxWidth: '100%', height: 'auto', display: 'block', borderRadius: '8px' }}
        />
      )
      const href = safeUrl(block.href)
      return (
        <Section style={{ margin: '20px 0' }}>
          {href ? (
            <Link href={href} target="_blank" rel="noreferrer">
              {img}
            </Link>
          ) : (
            img
          )}
        </Section>
      )
    }

    case 'button': {
      const url = safeUrl(block.url)
      const label = block.text || 'Learn more'
      const style: React.CSSProperties = {
        display: 'inline-block',
        background: accent,
        color: '#ffffff',
        padding: buttonPadding(block.size),
        borderRadius: '8px',
        fontSize: block.size === 'lg' ? '14px' : '13px',
        fontWeight: 500,
        textDecoration: 'none',
      }
      return (
        <Section style={{ margin: '24px 0' }}>
          {url ? (
            <Button href={url} style={style}>
              {label}
            </Button>
          ) : (
            // No URL yet — show the styled label so the layout is stable, but
            // never emit an <a> with an empty/unsafe href.
            <span style={style}>{label}</span>
          )}
        </Section>
      )
    }

    case 'divider':
      return <Hr style={{ border: 'none', borderTop: '1px solid #e8e8ed', margin: '28px 0' }} />

    case 'video': {
      const v = resolveVideo(block)
      if (!v) return null
      if (v.thumb) {
        return (
          <Section style={{ margin: '24px 0' }}>
            <Link href={v.target} target="_blank" rel="noreferrer">
              <Img
                src={v.thumb}
                alt="Watch video"
                style={{ maxWidth: '100%', height: 'auto', display: 'block', borderRadius: '10px', border: '1px solid #e8e8ed' }}
              />
            </Link>
          </Section>
        )
      }
      // No poster image available (e.g. a Vimeo/Loom link with no thumbnail) —
      // a clean "watch" card beats a broken image. Email-safe: just a link.
      return (
        <Section style={{ margin: '24px 0' }}>
          <Link
            href={v.target}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'block',
              padding: '22px 24px',
              background: '#fafafa',
              border: '1px solid #e8e8ed',
              borderRadius: '10px',
              color: accent,
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            ▶  Watch the video
          </Link>
        </Section>
      )
    }

    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul'
      return (
        <Tag style={{ margin: '0 0 14px', paddingLeft: '20px', color: '#3a3a3c', fontSize: '14px', lineHeight: 1.7 }}>
          {(block.items ?? []).map((it, i) => {
            if (typeof it === 'string') {
              return (
                <li key={i} style={{ marginBottom: '4px' }}>
                  {it}
                </li>
              )
            }
            return (
              <li key={it?.id ?? i} style={{ marginBottom: '4px' }}>
                {hasRich(it?.rich)
                  ? renderInline(it.rich, accent)
                  : (it?.text ?? '')}
              </li>
            )
          })}
        </Tag>
      )
    }

    case 'quote': {
      const barColor = safeColor(accent)
      return (
        <Section style={{ margin: '20px 0', padding: '18px 22px', background: '#fafafa', borderLeft: `3px solid ${barColor}`, borderRadius: '0 8px 8px 0' }}>
          <Text style={{ fontSize: '15px', color: '#1d1d1f', lineHeight: 1.55, fontStyle: 'italic', letterSpacing: '-0.01em', margin: 0 }}>
            “{hasRich(block.rich) ? renderInline(block.rich, accent) : block.text || ''}”
          </Text>
          {block.cite ? (
            <Text style={{ fontSize: '11.5px', color: '#86868b', marginTop: '8px', marginBottom: 0 }}>
              — {block.cite}
            </Text>
          ) : null}
        </Section>
      )
    }

    case 'columns': {
      const cols = block.cols ?? []
      if (cols.length === 0) return null
      return (
        <Section style={{ margin: '18px 0' }}>
          <Row>
            {cols.map((c) => (
              <Column key={c.id} style={{ background: '#fafafa', padding: '14px', borderRadius: '8px', border: '1px solid #efefef', verticalAlign: 'top', width: `${Math.floor(100 / cols.length)}%` }}>
                {c.label ? (
                  <Text style={{ fontSize: '10.5px', color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, margin: '0 0 4px' }}>{c.label}</Text>
                ) : null}
                {c.title ? (
                  <Text style={{ fontSize: '13px', fontWeight: 600, color: '#1d1d1f', margin: '0 0 4px', letterSpacing: '-0.005em' }}>{c.title}</Text>
                ) : null}
                {c.value ? (
                  <Text style={{ fontSize: '13px', fontWeight: 500, color: '#1d1d1f', margin: 0 }}>{c.value}</Text>
                ) : null}
                {c.body ? (
                  <Text style={{ fontSize: '11.5px', lineHeight: 1.5, color: '#6e6e73', margin: 0 }}>{c.body}</Text>
                ) : null}
              </Column>
            ))}
          </Row>
        </Section>
      )
    }

    case 'checklist': {
      const items = block.items ?? []
      if (items.length === 0) return null
      return (
        <Section style={{ margin: '16px 0', background: '#fafafa', border: '1px solid #efefef', borderRadius: '8px', padding: '14px' }}>
          {items.map((it, i) => (
            <Row key={it.id} style={i > 0 ? { marginTop: '10px' } : undefined}>
              <Column style={{ width: '34px', verticalAlign: 'top' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: accent, color: '#fff', display: 'inline-block', textAlign: 'center', lineHeight: '22px', fontSize: '11px', fontWeight: 600 }}>
                  {i + 1}
                </span>
              </Column>
              <Column style={{ paddingLeft: '12px' }}>
                <Text style={{ fontSize: '13.5px', fontWeight: 600, color: '#1d1d1f', margin: '0 0 2px' }}>{it.title || ''}</Text>
                {it.body ? (
                  <Text style={{ fontSize: '12px', color: '#6e6e73', lineHeight: 1.5, margin: 0 }}>{it.body}</Text>
                ) : null}
              </Column>
            </Row>
          ))}
        </Section>
      )
    }

    case 'event-card':
      return (
        <Section style={{ margin: '8px 0 18px', background: accent, color: '#fff', borderRadius: '10px', padding: '20px' }}>
          <Row>
            <Column style={{ width: '80px', paddingRight: '18px', verticalAlign: 'top' }}>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', letterSpacing: '0.1em', opacity: 0.8 }}>{block.day}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', marginTop: '2px' }}>{block.date}</div>
              </div>
            </Column>
            <Column>
              <div style={{ fontSize: '11px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>You&rsquo;re invited</div>
              <div style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.01em', marginBottom: '6px', lineHeight: 1.25 }}>{block.title}</div>
              <div style={{ fontSize: '12px', opacity: 0.85 }}>{block.meta}</div>
            </Column>
          </Row>
        </Section>
      )

    case 'receipt': {
      const items = block.items ?? []
      return (
        <Section style={{ margin: '16px 0', background: '#fafafa', border: '1px solid #efefef', borderRadius: '10px', padding: '20px' }}>
          {items.map((it) => (
            <Row key={it.id}>
              <Column style={{ padding: '10px 0', borderBottom: '1px solid #efefef' }}>
                <Text style={{ fontSize: '13.5px', fontWeight: 500, color: '#1d1d1f', margin: 0 }}>{it.name}</Text>
                {it.sub ? <Text style={{ fontSize: '11.5px', color: '#86868b', margin: '2px 0 0' }}>{it.sub}</Text> : null}
              </Column>
              <Column align="right" style={{ padding: '10px 0', borderBottom: '1px solid #efefef', fontSize: '13.5px', fontWeight: 600, fontFamily: 'monospace' }}>
                {it.price}
              </Column>
            </Row>
          ))}
          <Row>
            <Column style={{ paddingTop: '12px', borderTop: '2px solid #1d1d1f', fontSize: '13px', fontWeight: 600 }}>Total</Column>
            <Column align="right" style={{ paddingTop: '12px', borderTop: '2px solid #1d1d1f', fontSize: '15px', fontWeight: 700, fontFamily: 'monospace' }}>
              {block.total}
            </Column>
          </Row>
        </Section>
      )
    }

    case 'digest-item':
      return (
        <Section style={{ margin: '14px 0' }}>
          <Row>
            <Column style={{ width: '48px', fontSize: '20px', fontWeight: 700, color: accent, fontFamily: 'monospace', lineHeight: 1, verticalAlign: 'top' }}>
              {block.num}
            </Column>
            <Column style={{ paddingLeft: '14px' }}>
              <Text style={{ fontSize: '15px', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.01em', margin: '0 0 3px', lineHeight: 1.3 }}>{block.title}</Text>
              <Text style={{ fontSize: '11px', color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 5px' }}>{block.meta}</Text>
              <Text style={{ fontSize: '13px', color: '#3a3a3c', lineHeight: 1.55, margin: 0 }}>{block.body}</Text>
            </Column>
          </Row>
        </Section>
      )

    default:
      return null
  }
}

// The full document body — an ordered list of blocks. Intentionally NOT wrapped
// in <Html>/<Body>: the server's MarketingEmailWrapper provides the shell, so
// this renders just the inner content (matching the existing content_html
// contract).
export function DocBody({ doc }: { doc: ContentDoc }): React.ReactElement {
  const accent = safeColor(doc.accent)
  return (
    <>
      {doc.blocks.map((block) => (
        <BlockView key={block.id} block={block} accent={accent} />
      ))}
    </>
  )
}
