'use client'

import {
  NewsletterPostRow,
  useNewsletterPost,
  usePublishNewsletterPost,
  useTestSendNewsletterPost,
  useUpdateNewsletterPost,
} from '@/hooks/queries/newsletters'
import { schemas } from '@spaire/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '../../email-marketing/_components/Icon'

// One-page Publish composer. Replaces the multi-step wizard pattern
// used for broadcasts — newsletters are long-form editorial work and
// the publish review is meant to read top-to-bottom.
//
// Every input writes to local state and debounces a PATCH back to the
// post. The "Publish now" / "Schedule" CTA in the sticky footer hits
// /publish.

type Channel = NewsletterPostRow['channel']
type SendMode = NewsletterPostRow['send_mode']
type AudienceTier = NewsletterPostRow['audience_tier']

type Snapshot = {
  channel: Channel
  audience_tier: AudienceTier
  audience_segment_id: string | null
  subject_override: string | null
  preview_text_override: string | null
  show_socials: boolean
  show_likes_comments: boolean
  send_mode: SendMode
  scheduled_at: string | null
  audio_enabled: boolean
  audio_url: string | null
  seo_meta_title: string | null
  seo_meta_description: string | null
  custom_read_online_url: string | null
  web_thumbnail_url: string | null
  web_thumbnail_on_top: boolean
}

const fromPost = (p: NewsletterPostRow): Snapshot => ({
  channel: p.channel,
  audience_tier: p.audience_tier,
  audience_segment_id: p.audience_segment_id,
  subject_override: p.subject_override,
  preview_text_override: p.preview_text_override,
  show_socials: p.show_socials,
  show_likes_comments: p.show_likes_comments,
  send_mode: p.send_mode,
  scheduled_at: p.scheduled_at,
  audio_enabled: p.audio_enabled,
  audio_url: p.audio_url,
  seo_meta_title: p.seo_meta_title,
  seo_meta_description: p.seo_meta_description,
  custom_read_online_url: p.custom_read_online_url,
  web_thumbnail_url: p.web_thumbnail_url,
  web_thumbnail_on_top: p.web_thumbnail_on_top,
})

export function PublishPostScreen({
  organization,
  postId,
}: {
  organization: schemas['Organization']
  postId: string
}) {
  const router = useRouter()
  const { data: post, isLoading, error } = useNewsletterPost(postId)
  const updateMutation = useUpdateNewsletterPost()
  const publishMutation = usePublishNewsletterPost()
  const testSendMutation = useTestSendNewsletterPost()

  const [hydrated, setHydrated] = useState(false)
  const [snap, setSnap] = useState<Snapshot | null>(null)

  // Hydrate once on first fetch, mirroring NewsletterPostScreen's
  // pattern — the screen takes ownership of an async-loaded post so
  // subsequent edits are instant against local state and the autosave
  // debounces a PATCH back.
  useEffect(() => {
    if (hydrated || !post) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSnap(fromPost(post))
    setHydrated(true)
  }, [post, hydrated])

  const patch = useCallback(
    async (delta: Partial<Snapshot>) => {
      if (!post || !snap) return
      const next = { ...snap, ...delta }
      setSnap(next)
      try {
        await updateMutation.mutateAsync({ postId: post.id, body: delta })
      } catch {
        // Roll back optimistic update on failure so the UI matches the
        // server. Toast-on-error UX wiring is Phase 6 polish.
        setSnap(snap)
      }
    },
    [post, snap, updateMutation],
  )

  const onPublish = useCallback(() => {
    if (!post) return
    publishMutation.mutate(
      { postId: post.id },
      {
        onSuccess: () => {
          router.push(
            `/dashboard/${organization.slug}/newsletter/${post.id}`,
          )
        },
      },
    )
  }, [post, publishMutation, router, organization.slug])

  const onTestSend = useCallback(
    async (email: string) => {
      if (!post) return
      await testSendMutation.mutateAsync({ postId: post.id, email })
    },
    [post, testSendMutation],
  )

  if (isLoading) return <Shell>Loading…</Shell>
  if (error || !post || !snap)
    return (
      <Shell>
        {error instanceof Error ? error.message : 'Post not found'}
      </Shell>
    )

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '24px 24px 120px',
        }}
      >
        <BackLink
          href={`/dashboard/${organization.slug}/newsletter/${post.id}`}
        />

        <h1
          style={{
            margin: '8px 0 6px',
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#1d1d1f',
          }}
        >
          Publish
        </h1>
        <p style={{ margin: '0 0 26px', fontSize: 14.5, color: '#86868b' }}>
          Review where this goes, polish the details, and send it out into
          the world.
        </p>

        <ChannelCard
          channel={snap.channel}
          onChange={(channel) => patch({ channel })}
        />

        {snap.channel !== 'web_only' && (
          <EmailAudienceCard
            audienceTier={snap.audience_tier}
            onChange={(audience_tier) => patch({ audience_tier })}
          />
        )}

        {snap.channel !== 'web_only' && (
          <SendingDetailsCard
            post={post}
            subjectOverride={snap.subject_override}
            previewTextOverride={snap.preview_text_override}
            onChangeSubject={(v) => patch({ subject_override: v })}
            onChangePreview={(v) => patch({ preview_text_override: v })}
          />
        )}

        {snap.channel !== 'web_only' && (
          <EmailHeaderButtonsCard
            showSocials={snap.show_socials}
            showLikesComments={snap.show_likes_comments}
            onChange={patch}
          />
        )}

        {snap.channel !== 'web_only' && (
          <ScheduleCard
            sendMode={snap.send_mode}
            scheduledAt={snap.scheduled_at}
            onChange={patch}
          />
        )}

        <AudioCard
          enabled={snap.audio_enabled}
          url={snap.audio_url}
          onChange={patch}
        />

        {snap.channel !== 'email_only' && (
          <WebPostCard
            customReadOnlineUrl={snap.custom_read_online_url}
            thumbnailUrl={snap.web_thumbnail_url}
            thumbnailOnTop={snap.web_thumbnail_on_top}
            onChange={patch}
          />
        )}

        {snap.channel !== 'email_only' && (
          <SeoCard
            metaTitle={snap.seo_meta_title}
            metaDescription={snap.seo_meta_description}
            onChange={patch}
          />
        )}

        <PreflightCard post={post} snapshot={snap} />
      </div>

      <PublishFooter
        snapshot={snap}
        post={post}
        publishing={publishMutation.isPending}
        onPublish={onPublish}
        onTestSend={onTestSend}
        testSending={testSendMutation.isPending}
      />
    </div>
  )
}

// ── Layout primitives ────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#fafafa',
        color: '#86868b',
        fontSize: 13,
      }}
    >
      {children}
    </div>
  )
}

function BackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        marginBottom: 16,
        color: '#86868b',
        fontSize: 13,
        textDecoration: 'none',
      }}
    >
      <Icon name="arrow-left" size={13} />
      Back to editor
    </Link>
  )
}

function Card({
  children,
  tone = 'default',
}: {
  children: React.ReactNode
  tone?: 'default' | 'gray' | 'glow'
}) {
  const bg = tone === 'gray' ? '#f4f4f7' : '#fff'
  return (
    <section
      style={{
        background: bg,
        border: '1px solid #e5e5ea',
        borderRadius: 14,
        padding: '20px 24px',
        marginBottom: 16,
        boxShadow:
          tone === 'glow' ? '0 1px 2px rgba(20,20,30,0.04)' : 'none',
      }}
    >
      {children}
    </section>
  )
}

function CardHeader({
  title,
  right,
}: {
  title: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 14,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 15,
          fontWeight: 600,
          color: '#1d1d1f',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h3>
      {right}
    </div>
  )
}

function FieldLabel({
  children,
  hint,
}: {
  children: React.ReactNode
  hint?: React.ReactNode
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12.5,
        color: '#3a3a3c',
        marginBottom: 6,
        fontWeight: 500,
      }}
    >
      <span>{children}</span>
      {hint && (
        <span style={{ marginLeft: 'auto', color: '#86868b', fontWeight: 400, fontSize: 11.5 }}>
          {hint}
        </span>
      )}
    </label>
  )
}

function TextField({
  value,
  onChange,
  placeholder,
  maxLength,
  multiline,
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  maxLength?: number
  multiline?: boolean
}) {
  const baseStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e5e5ea',
    borderRadius: 8,
    fontSize: 13.5,
    background: '#fff',
    outline: 'none',
    color: '#1d1d1f',
    fontFamily: 'inherit',
  }
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={3}
        style={{ ...baseStyle, resize: 'vertical' }}
      />
    )
  }
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      style={baseStyle}
    />
  )
}

function Toggle({
  on,
  onClick,
  danger,
}: {
  on: boolean
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      style={{
        width: 34,
        height: 20,
        borderRadius: 999,
        border: 'none',
        background: on ? (danger ? '#c33' : '#1a7a3e') : '#d1d1d6',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 16 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.15s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.16)',
        }}
      />
    </button>
  )
}

function RowToggle({
  label,
  description,
  on,
  onClick,
  disabled,
}: {
  label: React.ReactNode
  description?: React.ReactNode
  on: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 0',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, color: '#1d1d1f', fontWeight: 500 }}>
          {label}
        </div>
        {description && (
          <div style={{ fontSize: 12, color: '#86868b', marginTop: 3 }}>
            {description}
          </div>
        )}
      </div>
      <Toggle on={on} onClick={disabled ? () => {} : onClick} />
    </div>
  )
}

// ── Channel ──────────────────────────────────────────────────────────

function ChannelCard({
  channel,
  onChange,
}: {
  channel: Channel
  onChange: (next: Channel) => void
}) {
  const options: { id: Channel; label: string; disabled?: boolean; hint?: string }[] = [
    { id: 'email_and_web', label: 'Email and web' },
    { id: 'email_only', label: 'Email only' },
    // Web archive renders in Phase 5; the choice persists today so the
    // post can be queued for once the archive route ships.
    { id: 'web_only', label: 'Web only', hint: 'web archive launches in Phase 5' },
  ]
  return (
    <Card>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 500, color: '#1d1d1f' }}>
          Publish your post to
        </div>
        <div
          style={{
            display: 'inline-flex',
            padding: 3,
            border: '1px solid #e5e5ea',
            borderRadius: 9,
            background: '#fafafa',
          }}
        >
          {options.map((o) => {
            const on = channel === o.id
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onChange(o.id)}
                title={o.hint}
                style={{
                  padding: '6px 14px',
                  border: 'none',
                  background: on ? '#fff' : 'transparent',
                  color: on ? '#1d1d1f' : '#86868b',
                  fontSize: 12.5,
                  fontWeight: on ? 500 : 400,
                  borderRadius: 7,
                  cursor: 'pointer',
                  boxShadow: on ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

// ── Email audience ───────────────────────────────────────────────────

function EmailAudienceCard({
  audienceTier,
  onChange,
}: {
  audienceTier: AudienceTier
  onChange: (next: AudienceTier) => void
}) {
  return (
    <Card tone="gray">
      <CardHeader title="Email audience" />
      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e5ea',
          borderRadius: 10,
          padding: '16px 20px',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: '#1d1d1f' }}>
          Tiers
        </div>
        <CheckRow
          on={audienceTier === 'all'}
          onClick={() => onChange('all')}
          label="All subscribers"
        />
        <CheckRow
          on={audienceTier === 'paid'}
          onClick={() => onChange('paid')}
          label="Paid only"
        />
      </div>
    </Card>
  )
}

function CheckRow({
  on,
  onClick,
  label,
}: {
  on: boolean
  onClick: () => void
  label: string
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 0',
        cursor: 'pointer',
      }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-checked={on}
        role="radio"
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          border: `1px solid ${on ? '#4f46e5' : '#d1d1d6'}`,
          background: on ? '#4f46e5' : '#fff',
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
          cursor: 'pointer',
        }}
      >
        {on && <Icon name="check" size={12} />}
      </button>
      <span style={{ fontSize: 13.5, color: '#1d1d1f' }}>{label}</span>
    </label>
  )
}

// ── Sending details ──────────────────────────────────────────────────

function SendingDetailsCard({
  post,
  subjectOverride,
  previewTextOverride,
  onChangeSubject,
  onChangePreview,
}: {
  post: NewsletterPostRow
  subjectOverride: string | null
  previewTextOverride: string | null
  onChangeSubject: (next: string | null) => void
  onChangePreview: (next: string | null) => void
}) {
  const [subject, setSubject] = useState(subjectOverride ?? post.title ?? '')
  const [preview, setPreview] = useState(
    previewTextOverride ?? post.subtitle ?? '',
  )

  return (
    <Card>
      <CardHeader title="Sending details" />
      <div style={{ marginBottom: 18 }}>
        <FieldLabel hint={`${subject.length}/200`}>
          Subject line<span style={{ color: '#c33' }}>*</span>
        </FieldLabel>
        <TextField
          value={subject}
          onChange={(v) => {
            setSubject(v)
            onChangeSubject(v || null)
          }}
          maxLength={200}
          placeholder="Subject line"
        />
        <div style={{ fontSize: 11.5, color: '#86868b', marginTop: 5 }}>
          Same as the post title unless modified.
        </div>
      </div>
      <div>
        <FieldLabel hint={`${preview.length}/200`}>Preview text</FieldLabel>
        <TextField
          value={preview}
          onChange={(v) => {
            setPreview(v)
            onChangePreview(v || null)
          }}
          maxLength={200}
          placeholder="Preview text"
        />
        <div style={{ fontSize: 11.5, color: '#86868b', marginTop: 5 }}>
          Same as the post subtitle unless modified.
        </div>
      </div>
    </Card>
  )
}

// ── Email header buttons ─────────────────────────────────────────────

function EmailHeaderButtonsCard({
  showSocials,
  showLikesComments,
  onChange,
}: {
  showSocials: boolean
  showLikesComments: boolean
  onChange: (delta: Partial<Snapshot>) => void
}) {
  return (
    <Card>
      <CardHeader title="Email header buttons" />
      <div style={{ fontSize: 12.5, color: '#86868b', marginBottom: 6 }}>
        Lets readers share, like, and comment on this post directly from
        the email.
      </div>
      <RowToggle
        label="Socials"
        on={showSocials}
        onClick={() => onChange({ show_socials: !showSocials })}
      />
      <RowToggle
        label="Likes & Comments"
        on={showLikesComments}
        onClick={() => onChange({ show_likes_comments: !showLikesComments })}
      />
    </Card>
  )
}

// ── Schedule ─────────────────────────────────────────────────────────

function ScheduleCard({
  sendMode,
  scheduledAt,
  onChange,
}: {
  sendMode: SendMode
  scheduledAt: string | null
  onChange: (delta: Partial<Snapshot>) => void
}) {
  return (
    <Card>
      <CardHeader
        title="Schedule"
        right={
          <span style={{ fontSize: 12, color: '#86868b' }}>
            Local time · {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </span>
        }
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}
      >
        <ScheduleOption
          on={sendMode === 'send_now'}
          icon="send"
          label="Send now"
          desc="Goes out the moment you publish."
          onClick={() => onChange({ send_mode: 'send_now' })}
        />
        <ScheduleOption
          on={sendMode === 'smart_time'}
          icon="zap"
          label="Smart-time"
          desc="Each subscriber gets it at their most-likely-to-open hour."
          accent
          onClick={() => onChange({ send_mode: 'smart_time' })}
        />
        <ScheduleOption
          on={sendMode === 'scheduled'}
          icon="calendar"
          label="Schedule"
          desc="Pick a date and time."
          onClick={() => onChange({ send_mode: 'scheduled' })}
        />
        <ScheduleOption
          on={sendMode === 'drip_tz'}
          icon="clock"
          label="Drip by timezone"
          desc="Everyone gets it at the same local time, wherever they are."
          onClick={() => onChange({ send_mode: 'drip_tz' })}
        />
      </div>
      {sendMode === 'scheduled' && (
        <div style={{ marginTop: 16 }}>
          <FieldLabel>When</FieldLabel>
          <input
            type="datetime-local"
            value={toLocalInput(scheduledAt)}
            onChange={(e) =>
              onChange({
                scheduled_at: fromLocalInput(e.target.value),
              })
            }
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #e5e5ea',
              borderRadius: 8,
              fontSize: 13.5,
              outline: 'none',
              background: '#fff',
              fontFamily: 'inherit',
            }}
          />
        </div>
      )}
    </Card>
  )
}

function ScheduleOption({
  on,
  icon,
  label,
  desc,
  accent,
  onClick,
}: {
  on: boolean
  icon: string
  label: string
  desc: string
  accent?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '14px 16px',
        textAlign: 'left',
        border: `1px solid ${on ? '#4f46e5' : '#e5e5ea'}`,
        borderRadius: 10,
        background: on ? '#f3f1ff' : '#fff',
        cursor: 'pointer',
        boxShadow: on ? '0 0 0 3px rgba(79,70,229,0.14)' : 'none',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13.5,
          fontWeight: 600,
          color: '#1d1d1f',
        }}
      >
        <Icon name={icon} size={14} />
        {label}
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: '#86868b', lineHeight: 1.45 }}>
        {desc}
      </div>
      {accent && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11.5,
            fontWeight: 500,
            color: '#4f46e5',
          }}
        >
          +18% open rate on average
        </div>
      )}
    </button>
  )
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  // Convert UTC to local for the datetime-local input.
  const off = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}

function fromLocalInput(local: string): string | null {
  if (!local) return null
  // datetime-local has no timezone — interpret as local then back to UTC.
  return new Date(local).toISOString()
}

// ── Audio ────────────────────────────────────────────────────────────

function AudioCard({
  enabled,
  url,
  onChange,
}: {
  enabled: boolean
  url: string | null
  onChange: (delta: Partial<Snapshot>) => void
}) {
  return (
    <Card>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: '#f4f4f7',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="play" size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#1d1d1f' }}>
            Audio newsletter
          </div>
          <div style={{ fontSize: 12, color: '#86868b', marginTop: 3, lineHeight: 1.5 }}>
            Readers see a &ldquo;listen online&rdquo; link in the email
            header that opens the audio at the top of the published web post.
          </div>
        </div>
        <Toggle
          on={enabled}
          onClick={() => onChange({ audio_enabled: !enabled })}
        />
      </div>
      {enabled && (
        <div style={{ marginTop: 14 }}>
          <FieldLabel>Audio URL</FieldLabel>
          <TextField
            value={url ?? ''}
            onChange={(v) => onChange({ audio_url: v || null })}
            placeholder="https://… (mp3 / wav) or a podcast platform link"
          />
        </div>
      )}
    </Card>
  )
}

// ── Web post settings ────────────────────────────────────────────────

function WebPostCard({
  customReadOnlineUrl,
  thumbnailUrl,
  thumbnailOnTop,
  onChange,
}: {
  customReadOnlineUrl: string | null
  thumbnailUrl: string | null
  thumbnailOnTop: boolean
  onChange: (delta: Partial<Snapshot>) => void
}) {
  return (
    <Card>
      <CardHeader title="Web post settings" />
      <div style={{ marginBottom: 18 }}>
        <FieldLabel>Custom Read Online URL (optional)</FieldLabel>
        <TextField
          value={customReadOnlineUrl ?? ''}
          onChange={(v) => onChange({ custom_read_online_url: v || null })}
          placeholder="https://your-domain.com/issues/…"
        />
        <div style={{ fontSize: 11.5, color: '#86868b', marginTop: 5 }}>
          Overrides the default archive URL the &ldquo;Read online&rdquo;
          link in email opens.
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <FieldLabel>Web thumbnail URL</FieldLabel>
        <TextField
          value={thumbnailUrl ?? ''}
          onChange={(v) => onChange({ web_thumbnail_url: v || null })}
          placeholder="Cover image used in feed / SEO (1200×630 recommended)"
        />
      </div>
      <RowToggle
        label="Show thumbnail at top of web post"
        on={thumbnailOnTop}
        onClick={() => onChange({ web_thumbnail_on_top: !thumbnailOnTop })}
      />
    </Card>
  )
}

// ── SEO ──────────────────────────────────────────────────────────────

function SeoCard({
  metaTitle,
  metaDescription,
  onChange,
}: {
  metaTitle: string | null
  metaDescription: string | null
  onChange: (delta: Partial<Snapshot>) => void
}) {
  const titleLen = (metaTitle ?? '').length
  return (
    <Card>
      <CardHeader title="SEO settings" />
      <div style={{ marginBottom: 18 }}>
        <FieldLabel hint={`${titleLen}/200`}>Meta title</FieldLabel>
        <TextField
          value={metaTitle ?? ''}
          onChange={(v) => onChange({ seo_meta_title: v || null })}
          placeholder="Title used in search results and social previews"
          maxLength={200}
        />
      </div>
      <div>
        <FieldLabel>Meta description</FieldLabel>
        <TextField
          multiline
          value={metaDescription ?? ''}
          onChange={(v) => onChange({ seo_meta_description: v || null })}
          placeholder="One-sentence summary for search and social previews"
          maxLength={500}
        />
      </div>
    </Card>
  )
}

// ── Pre-flight ───────────────────────────────────────────────────────

type PreflightCheck = {
  label: string
  ok: boolean
  detail?: string
}

function runPreflight(
  post: NewsletterPostRow,
  snap: Snapshot,
): PreflightCheck[] {
  const subject = snap.subject_override || post.title || ''
  const preview = snap.preview_text_override || post.subtitle || ''
  const blocks = ((post.content_json as { blocks?: unknown[] } | null)?.blocks ?? []) as { type?: unknown }[]
  const hasBody = blocks.length > 0

  return [
    {
      label: 'Subject line set',
      ok: subject.trim().length > 0,
      detail: subject ? `${subject.length} chars` : 'Add a subject',
    },
    {
      label: 'Subject under 60 chars',
      ok: subject.length <= 60,
      detail: subject.length > 60 ? `${subject.length} chars (may truncate)` : undefined,
    },
    {
      label: 'Preview text fills inbox row',
      ok: preview.trim().length >= 40,
      detail:
        preview.length < 40
          ? `${preview.length} chars (45+ recommended)`
          : undefined,
    },
    {
      label: 'Body has at least one block',
      ok: hasBody,
    },
    {
      label: 'Cover image set',
      ok: !!post.cover_url,
    },
    snap.send_mode === 'scheduled'
      ? {
          label: 'Scheduled time in the future',
          ok: !!(
            snap.scheduled_at && new Date(snap.scheduled_at).getTime() > Date.now()
          ),
        }
      : { label: 'Schedule mode chosen', ok: true },
  ]
}

function PreflightCard({
  post,
  snapshot,
}: {
  post: NewsletterPostRow
  snapshot: Snapshot
}) {
  const checks = runPreflight(post, snapshot)
  const allOk = checks.every((c) => c.ok)
  return (
    <Card tone="glow">
      <CardHeader
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Icon name="zap" size={15} /> Pre-flight check
          </span>
        }
        right={
          <span
            style={{
              fontSize: 12.5,
              color: allOk ? '#1a7a3e' : '#9a7400',
              fontWeight: 500,
            }}
          >
            {allOk ? 'All clear' : `${checks.filter((c) => !c.ok).length} to fix`}
          </span>
        }
      />
      <div style={{ display: 'grid', gap: 8 }}>
        {checks.map((c) => (
          <div
            key={c.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: c.ok ? 'rgba(26,122,62,0.12)' : 'rgba(204,140,0,0.18)',
                color: c.ok ? '#1a7a3e' : '#9a7400',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name={c.ok ? 'check' : 'x'} size={11} />
            </span>
            <span style={{ color: c.ok ? '#1d1d1f' : '#3a3a3c' }}>{c.label}</span>
            {c.detail && (
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#86868b' }}>
                {c.detail}
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Sticky publish footer ────────────────────────────────────────────

function PublishFooter({
  snapshot,
  post,
  publishing,
  onPublish,
  onTestSend,
  testSending,
}: {
  snapshot: Snapshot
  post: NewsletterPostRow
  publishing: boolean
  onPublish: () => void
  onTestSend: (email: string) => Promise<void>
  testSending: boolean
}) {
  const [testOpen, setTestOpen] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testStatus, setTestStatus] = useState<null | 'sending' | 'sent' | 'error'>(null)

  const checks = useMemo(() => runPreflight(post, snapshot), [post, snapshot])
  const allOk = checks.every((c) => c.ok)
  const channelLabel =
    snapshot.channel === 'email_only'
      ? 'Email only'
      : snapshot.channel === 'web_only'
        ? 'Web only'
        : 'Email + Web'

  const submit = async () => {
    if (!testEmail) return
    setTestStatus('sending')
    try {
      await onTestSend(testEmail)
      setTestStatus('sent')
      window.setTimeout(() => setTestStatus(null), 2000)
    } catch {
      setTestStatus('error')
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'saturate(180%) blur(12px)',
        borderTop: '1px solid #e5e5ea',
        padding: '12px 24px',
        zIndex: 30,
      }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontSize: 12.5,
          color: '#3a3a3c',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              background: allOk ? '#1a7a3e' : '#9a7400',
            }}
          />
          {allOk ? 'Ready to send' : 'Pre-flight has open items'}
        </span>
        <span style={{ width: 1, height: 18, background: '#e5e5ea' }} />
        <span>{channelLabel}</span>

        <div style={{ flex: 1 }} />

        {testOpen ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <input
              autoFocus
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
                if (e.key === 'Escape') setTestOpen(false)
              }}
              style={{
                padding: '6px 10px',
                border: '1px solid #e5e5ea',
                borderRadius: 7,
                fontSize: 12.5,
                outline: 'none',
                width: 220,
              }}
            />
            <button
              type="button"
              onClick={submit}
              disabled={testSending || !testEmail}
              style={{
                padding: '6px 12px',
                border: '1px solid #e5e5ea',
                borderRadius: 7,
                background: '#fff',
                fontSize: 12.5,
                cursor: testSending || !testEmail ? 'default' : 'pointer',
                color: testSending || !testEmail ? '#c5c5c8' : '#1d1d1f',
              }}
            >
              Send
            </button>
            {testStatus === 'sent' && (
              <span style={{ color: '#1a7a3e' }}>Sent</span>
            )}
            {testStatus === 'error' && (
              <span style={{ color: '#c33' }}>Failed</span>
            )}
            <button
              type="button"
              onClick={() => setTestOpen(false)}
              aria-label="Cancel"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#86868b',
              }}
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setTestOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 7,
              border: '1px solid #e5e5ea',
              background: '#fff',
              fontSize: 12.5,
              color: '#1d1d1f',
              cursor: 'pointer',
            }}
          >
            <Icon name="flask" size={13} /> Send test
          </button>
        )}

        <button
          type="button"
          onClick={onPublish}
          disabled={publishing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 32,
            padding: '0 16px',
            borderRadius: 8,
            border: 'none',
            background: publishing ? '#86868b' : '#4f46e5',
            color: '#fff',
            fontSize: 13,
            fontWeight: 500,
            cursor: publishing ? 'default' : 'pointer',
          }}
        >
          {snapshot.send_mode === 'scheduled' ? (
            <>
              <Icon name="calendar" size={13} /> Schedule
            </>
          ) : (
            <>
              <Icon name="send" size={13} /> Publish now
            </>
          )}
        </button>
      </div>
    </div>
  )
}
