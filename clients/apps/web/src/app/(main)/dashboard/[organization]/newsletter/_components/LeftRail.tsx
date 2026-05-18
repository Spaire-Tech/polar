'use client'

import {
  NewsletterPostRow,
  useNewsletterPosts,
} from '@/hooks/queries/newsletters'
import Link from 'next/link'
import { useMemo } from 'react'
import { Icon } from '../../email-marketing/_components/Icon'
import { Block, ContentDoc } from '../../email-marketing/_components/blockEditor/types'

// Left rail surfaced next to the editor. Three sections:
//   - Pages: every post in the same newsletter (links to its editor).
//   - Outline: every heading-level block in the current document.
//   - Insights: word count, read time, readability tone.

const READING_WPM = 220

export function LeftRail({
  organizationSlug,
  currentPostId,
  newsletterId,
  doc,
  wordCount,
}: {
  organizationSlug: string
  currentPostId: string
  newsletterId: string | null | undefined
  doc: ContentDoc
  wordCount: number
}) {
  const { data: posts = [] } = useNewsletterPosts(newsletterId)
  const headings = useMemo(() => extractHeadings(doc.blocks), [doc.blocks])
  const readTime = Math.max(1, Math.round(wordCount / READING_WPM))
  const readability = scoreReadability(doc.blocks)

  return (
    <aside
      style={{
        width: 220,
        borderRight: '1px solid #e5e5ea',
        background: '#fafafa',
        padding: '20px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        overflowY: 'auto',
      }}
    >
      <Section title="Pages">
        {posts.length === 0 ? (
          <Empty>No other posts yet</Empty>
        ) : (
          posts.map((p) => (
            <PageItem
              key={p.id}
              organizationSlug={organizationSlug}
              post={p}
              current={p.id === currentPostId}
            />
          ))
        )}
      </Section>

      <Section title="Outline">
        {headings.length === 0 ? (
          <Empty>Add a heading to see the outline</Empty>
        ) : (
          headings.map((h, i) => (
            <OutlineItem
              key={`${h.id}-${i}`}
              level={h.level}
              text={h.text || '(untitled)'}
            />
          ))
        )}
      </Section>

      <Section title="Insights">
        <Stat label="Words" value={wordCount.toLocaleString()} />
        <Stat
          label="Read time"
          value={`${readTime} min`}
        />
        <Stat
          label="Readability"
          value={readability.label}
          tone={readability.tone}
        />
      </Section>
    </aside>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div
        style={{
          padding: '0 10px 8px',
          fontSize: 10.5,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 600,
          color: '#86868b',
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {children}
      </div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '6px 10px',
        fontSize: 11.5,
        color: '#86868b',
      }}
    >
      {children}
    </div>
  )
}

function PageItem({
  organizationSlug,
  post,
  current,
}: {
  organizationSlug: string
  post: NewsletterPostRow
  current: boolean
}) {
  return (
    <Link
      href={`/dashboard/${organizationSlug}/newsletter/${post.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 7,
        background: current ? '#fff' : 'transparent',
        color: current ? '#1d1d1f' : '#3a3a3c',
        textDecoration: 'none',
        fontSize: 12.5,
        fontWeight: current ? 500 : 400,
        boxShadow: current ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
      }}
    >
      <Icon name="text" size={11} />
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {post.title || 'Untitled'}
      </span>
      {post.status !== 'draft' && (
        <span
          style={{
            fontSize: 9.5,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#86868b',
            border: '1px solid #e5e5ea',
            borderRadius: 4,
            padding: '0 4px',
          }}
        >
          {post.status === 'published' ? 'Live' : post.status.slice(0, 4)}
        </span>
      )}
    </Link>
  )
}

function OutlineItem({ level, text }: { level: 1 | 2 | 3; text: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        padding: '4px 10px',
        paddingLeft: 10 + (level - 1) * 10,
        fontSize: 12,
        color: level === 1 ? '#1d1d1f' : level === 2 ? '#3a3a3c' : '#86868b',
        lineHeight: 1.35,
      }}
    >
      <span
        style={{
          width: 2,
          height: 12,
          marginTop: 3,
          background: level === 1 ? '#1d1d1f' : '#c5c5c8',
          borderRadius: 1,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'ok' | 'warn'
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '4px 10px',
        fontSize: 12,
      }}
    >
      <span style={{ color: '#86868b' }}>{label}</span>
      <span
        style={{
          color:
            tone === 'ok'
              ? '#1a7a3e'
              : tone === 'warn'
                ? '#9a7400'
                : '#1d1d1f',
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ── Doc analysis helpers ─────────────────────────────────────────────

function extractHeadings(
  blocks: Block[],
): { id: string; level: 1 | 2 | 3; text: string }[] {
  const out: { id: string; level: 1 | 2 | 3; text: string }[] = []
  for (const b of blocks) {
    if (b.type === 'heading') {
      out.push({ id: b.id, level: b.level, text: b.text || '' })
    } else if (b.type === 'subheading') {
      out.push({ id: b.id, level: 3, text: b.text || '' })
    }
  }
  return out
}

// Quick heuristic readability score — counts the average sentence
// length across paragraph blocks. Easy = <20 words/sentence, Mid =
// 20–28, Hard = >28. Stand-in for a real Flesch-Kincaid pass which
// can ship in a follow-up.
function scoreReadability(
  blocks: Block[],
): { label: string; tone?: 'ok' | 'warn' } {
  const paragraphs = blocks.filter(
    (b): b is Block & { text: string } =>
      b.type === 'paragraph' && typeof (b as { text?: unknown }).text === 'string',
  )
  if (paragraphs.length === 0) return { label: '—' }
  let sentences = 0
  let words = 0
  for (const p of paragraphs) {
    const parts = p.text.split(/[.!?]+\s+/).filter(Boolean)
    sentences += parts.length
    words += p.text.trim().split(/\s+/).filter(Boolean).length
  }
  if (sentences === 0) return { label: '—' }
  const avg = words / sentences
  if (avg < 20) return { label: 'Easy', tone: 'ok' }
  if (avg < 28) return { label: 'Medium' }
  return { label: 'Dense', tone: 'warn' }
}
