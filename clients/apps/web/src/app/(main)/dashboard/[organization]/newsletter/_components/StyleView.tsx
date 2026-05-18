'use client'

import { useMemo, useState } from 'react'
import { Icon } from '../../email-marketing/_components/Icon'
import {
  renderBlocksToHtml,
  Theme,
} from '../../email-marketing/_components/blockEditor/render'
import { ContentDoc } from '../../email-marketing/_components/blockEditor/types'
import { PostMeta } from './PostEditor'

// V1 of the Style view. Live email preview on the left (macOS-chromed),
// the design's Basic / Advanced panel on the right, four theme presets
// underneath. The Advanced per-element grid is rendered but not yet
// editable — that ships in 4b alongside the theme.elements shape.

export type Device = 'desktop' | 'mobile'

const FONT_OPTIONS = [
  'default',
  'Inter',
  'SF Pro Display',
  'Newsreader',
  'Georgia',
  'Anton',
  'Charter',
  'New York',
] as const

// Each preset is a full theme. Picking one wholly replaces theme;
// shapes match the server's THEME_PRESETS in newsletter/theme.py.
const PRESETS: { name: string; theme: Theme; swatch: { bg: string; fg: string } }[] = [
  {
    name: 'Editorial',
    swatch: { bg: '#ffffff', fg: '#0a0a0c' },
    theme: {
      colors: {
        outsideBg: '#ffffff',
        postBg: '#ffffff',
        textBg: '#0a0a0c',
        textSubtle: '#3a3a3c',
        primary: '#0a0a0c',
        textPrimary: '#ffffff',
        secondary: '#86868b',
        links: '#0a0a0c',
        hairline: '#e8e8ed',
      },
      typography: {
        headingFont: 'Newsreader',
        bodyFont: 'Newsreader',
        baseSize: 17,
        lineHeight: 1.7,
        headerSize: 32,
      },
      spacing: { sectionPadding: 36, blockGap: 18, borderRadius: 4 },
    },
  },
  {
    name: 'Mocha',
    swatch: { bg: '#f5efe6', fg: '#3d2e1f' },
    theme: {
      colors: {
        outsideBg: '#f5efe6',
        postBg: '#f5efe6',
        textBg: '#3d2e1f',
        textSubtle: '#5b4632',
        primary: '#7a4e2b',
        textPrimary: '#fff8ef',
        secondary: '#9a7a55',
        links: '#7a4e2b',
        hairline: '#e0d4c0',
      },
      typography: {
        headingFont: 'Newsreader',
        bodyFont: 'Charter',
        baseSize: 16,
        lineHeight: 1.65,
        headerSize: 30,
      },
      spacing: { sectionPadding: 32, blockGap: 16, borderRadius: 10 },
    },
  },
  {
    name: 'Night',
    swatch: { bg: '#1a1a1d', fg: '#f6f4ef' },
    theme: {
      colors: {
        outsideBg: '#1a1a1d',
        postBg: '#1a1a1d',
        textBg: '#f6f4ef',
        textSubtle: '#c8c8cc',
        primary: '#f6f4ef',
        textPrimary: '#1a1a1d',
        secondary: '#8e8e93',
        links: '#f6f4ef',
        hairline: '#2f2f33',
      },
      typography: {
        headingFont: 'Inter',
        bodyFont: 'Inter',
        baseSize: 15,
        lineHeight: 1.65,
        headerSize: 30,
      },
      spacing: { sectionPadding: 32, blockGap: 18, borderRadius: 12 },
    },
  },
  {
    name: 'Sage',
    swatch: { bg: '#eef0e8', fg: '#2f3a2a' },
    theme: {
      colors: {
        outsideBg: '#eef0e8',
        postBg: '#eef0e8',
        textBg: '#2f3a2a',
        textSubtle: '#4a5644',
        primary: '#4a6041',
        textPrimary: '#f6f6f0',
        secondary: '#7e8a72',
        links: '#4a6041',
        hairline: '#d6dccb',
      },
      typography: {
        headingFont: 'Newsreader',
        bodyFont: 'Charter',
        baseSize: 16,
        lineHeight: 1.7,
        headerSize: 30,
      },
      spacing: { sectionPadding: 32, blockGap: 16, borderRadius: 10 },
    },
  },
]

export function StyleView({
  meta,
  doc,
  theme,
  setTheme,
  onSendTest,
}: {
  meta: PostMeta
  doc: ContentDoc
  theme: Theme
  setTheme: (next: Theme) => void
  onSendTest?: () => void
}) {
  const [device, setDevice] = useState<Device>('desktop')
  const [tab, setTab] = useState<'basic' | 'advanced'>('basic')

  // Shallow-merge helpers so the Basic panel can patch a single
  // colour / typography / spacing key without overwriting the rest of
  // the scope.
  const patchColors = (delta: Partial<NonNullable<Theme['colors']>>) =>
    setTheme({ ...theme, colors: { ...(theme.colors ?? {}), ...delta } })
  const patchTypography = (
    delta: Partial<NonNullable<Theme['typography']>>,
  ) =>
    setTheme({ ...theme, typography: { ...(theme.typography ?? {}), ...delta } })
  const patchSpacing = (delta: Partial<NonNullable<Theme['spacing']>>) =>
    setTheme({ ...theme, spacing: { ...(theme.spacing ?? {}), ...delta } })

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 360px',
        gap: 0,
        minHeight: 'calc(100vh - 56px)',
        background: '#fafafa',
      }}
    >
      <PreviewPane
        meta={meta}
        doc={doc}
        theme={theme}
        device={device}
        setDevice={setDevice}
        onSendTest={onSendTest}
      />
      <SidePanel
        tab={tab}
        setTab={setTab}
        theme={theme}
        onPickPreset={(t) => setTheme(t)}
        patchColors={patchColors}
        patchTypography={patchTypography}
        patchSpacing={patchSpacing}
      />
    </div>
  )
}

// ── Preview pane ─────────────────────────────────────────────────────

function PreviewPane({
  meta,
  doc,
  theme,
  device,
  setDevice,
  onSendTest,
}: {
  meta: PostMeta
  doc: ContentDoc
  theme: Theme
  device: Device
  setDevice: (d: Device) => void
  onSendTest?: () => void
}) {
  const html = useMemo(() => renderBlocksToHtml(doc, theme), [doc, theme])
  const outsideBg = theme.colors?.outsideBg ?? '#ffffff'
  const postBg = theme.colors?.postBg ?? '#ffffff'
  const textBg = theme.colors?.textBg ?? '#1d1d1f'
  const muted = theme.colors?.secondary ?? '#86868b'
  const links = theme.colors?.links ?? textBg
  const headerSize = theme.typography?.headerSize ?? 28
  const padding = theme.spacing?.sectionPadding ?? 32

  const frameWidth = device === 'mobile' ? 380 : 720

  return (
    <div
      style={{
        padding: '24px 32px 80px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: frameWidth,
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #e5e5ea',
          boxShadow: '0 20px 60px rgba(20,20,30,0.08)',
          overflow: 'hidden',
        }}
      >
        <MacChrome />
        {/* Outer canvas (page background outside the email content). */}
        <div style={{ background: outsideBg, padding: '24px 0' }}>
          {/* Email content container. */}
          <div
            style={{
              maxWidth: 600,
              margin: '0 auto',
              padding: `${padding}px`,
              background: postBg,
              color: textBg,
            }}
          >
            {meta.title && (
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                  marginBottom: 6,
                }}
              >
                {meta.title}
              </div>
            )}
            {meta.subtitle && (
              <div
                style={{
                  fontSize: 15,
                  color: muted,
                  marginBottom: 14,
                }}
              >
                {meta.subtitle}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  background: muted,
                  opacity: 0.4,
                }}
              />
              <span style={{ fontSize: 12, color: muted }}>By the author</span>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                style={{
                  marginLeft: 'auto',
                  fontSize: 12,
                  color: links,
                  textDecoration: 'underline',
                }}
              >
                Read online
              </a>
            </div>
            <div
              style={{
                height: 1,
                background: theme.colors?.hairline ?? '#e8e8ed',
                margin: '0 0 22px',
              }}
            />
            <div
              style={{
                fontSize: headerSize,
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: theme.colors?.secondary ?? textBg,
                textAlign: 'center',
                margin: '6px 0 18px',
                textTransform: 'uppercase',
              }}
            >
              {/* Masthead — derived from the post title for V1. The
                  newsletter-level masthead lands in Phase 6's
                  newsletter settings screen. */}
              {meta.title ? abbreviate(meta.title, 18) : 'Your Newsletter'}
            </div>
            {meta.cover_url && meta.cover_visible && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={meta.cover_url}
                alt=""
                style={{
                  width: '100%',
                  display: 'block',
                  borderRadius: theme.spacing?.borderRadius ?? 8,
                  marginBottom: 20,
                }}
              />
            )}
            <div
              dangerouslySetInnerHTML={{ __html: html }}
              style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              }}
            />
          </div>
        </div>
        <div
          style={{
            padding: '14px 28px',
            borderTop: '1px solid #e8e8ed',
            background: outsideBg,
            fontSize: 11,
            color: muted,
            textAlign: 'center',
          }}
        >
          You&apos;re getting this because you subscribed.{' '}
          <a href="#" onClick={(e) => e.preventDefault()} style={{ color: muted }}>
            Unsubscribe
          </a>
        </div>
      </div>

      <DeviceSwitcher
        device={device}
        setDevice={setDevice}
        onSendTest={onSendTest}
      />
    </div>
  )
}

function MacChrome() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        borderBottom: '1px solid #e5e5ea',
        background: '#f4f4f7',
      }}
    >
      <span style={{ width: 11, height: 11, borderRadius: 6, background: '#ff5f57' }} />
      <span style={{ width: 11, height: 11, borderRadius: 6, background: '#febc2e' }} />
      <span style={{ width: 11, height: 11, borderRadius: 6, background: '#28c840' }} />
      <span style={{ marginLeft: 'auto', fontSize: 11, color: '#86868b' }}>
        Email Style Preview
      </span>
      <span style={{ flex: 1 }} />
      <Icon name="info" size={12} />
    </div>
  )
}

function DeviceSwitcher({
  device,
  setDevice,
  onSendTest,
}: {
  device: Device
  setDevice: (d: Device) => void
  onSendTest?: () => void
}) {
  const item = (active: boolean) => ({
    padding: '6px 12px',
    border: 'none',
    background: active ? '#fff' : 'transparent',
    color: active ? '#1d1d1f' : '#86868b',
    fontSize: 12.5,
    fontWeight: active ? 500 : 400,
    borderRadius: 7,
    cursor: 'pointer',
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
  })
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 3,
        border: '1px solid #e5e5ea',
        borderRadius: 9,
        background: '#fafafa',
        gap: 2,
      }}
    >
      <button type="button" style={item(device === 'desktop')} onClick={() => setDevice('desktop')}>
        <Icon name="monitor" size={12} /> Desktop
      </button>
      <button type="button" style={item(device === 'mobile')} onClick={() => setDevice('mobile')}>
        <Icon name="phone" size={12} /> Mobile
      </button>
      {onSendTest && (
        <button type="button" style={item(false)} onClick={onSendTest}>
          <Icon name="flask" size={12} /> Test send
        </button>
      )}
    </div>
  )
}

function abbreviate(s: string, n: number) {
  const trimmed = s.trim()
  if (trimmed.length <= n) return trimmed
  return trimmed.slice(0, n).trim() + '…'
}

// ── Side panel ───────────────────────────────────────────────────────

function SidePanel({
  tab,
  setTab,
  theme,
  onPickPreset,
  patchColors,
  patchTypography,
  patchSpacing,
}: {
  tab: 'basic' | 'advanced'
  setTab: (t: 'basic' | 'advanced') => void
  theme: Theme
  onPickPreset: (t: Theme) => void
  patchColors: (delta: Partial<NonNullable<Theme['colors']>>) => void
  patchTypography: (delta: Partial<NonNullable<Theme['typography']>>) => void
  patchSpacing: (delta: Partial<NonNullable<Theme['spacing']>>) => void
}) {
  return (
    <aside
      style={{
        borderLeft: '1px solid #e5e5ea',
        background: '#fff',
        padding: '20px 18px',
        overflowY: 'auto',
      }}
    >
      <Tabs tab={tab} setTab={setTab} />
      {tab === 'basic' ? (
        <>
          <Section title="Colors" defaultOpen>
            <ColorRow
              label="Outside Background"
              value={theme.colors?.outsideBg ?? '#ffffff'}
              onChange={(v) => patchColors({ outsideBg: v })}
            />
            <ColorRow
              label="Post Background"
              value={theme.colors?.postBg ?? '#ffffff'}
              onChange={(v) => patchColors({ postBg: v })}
            />
            <ColorRow
              label="Text On Background"
              value={theme.colors?.textBg ?? '#1d1d1f'}
              onChange={(v) => patchColors({ textBg: v })}
            />
            <ColorRow
              label="Primary"
              value={theme.colors?.primary ?? '#1d1d1f'}
              onChange={(v) => patchColors({ primary: v })}
            />
            <ColorRow
              label="Text on Primary"
              value={theme.colors?.textPrimary ?? '#ffffff'}
              onChange={(v) => patchColors({ textPrimary: v })}
            />
            <ColorRow
              label="Secondary"
              value={theme.colors?.secondary ?? '#86868b'}
              onChange={(v) => patchColors({ secondary: v })}
            />
            <ColorRow
              label="Links"
              value={theme.colors?.links ?? '#1d1d1f'}
              onChange={(v) => patchColors({ links: v })}
            />
          </Section>

          <Section title="Typography" defaultOpen>
            <FontPicker
              label="Heading font"
              value={theme.typography?.headingFont ?? 'default'}
              onChange={(v) => patchTypography({ headingFont: v })}
            />
            <FontPicker
              label="Body font"
              value={theme.typography?.bodyFont ?? 'default'}
              onChange={(v) => patchTypography({ bodyFont: v })}
            />
            <NumberRow
              label="Base size"
              value={theme.typography?.baseSize ?? 14}
              suffix="px"
              onChange={(v) => patchTypography({ baseSize: v })}
            />
            <NumberRow
              label="Line height"
              value={theme.typography?.lineHeight ?? 1.65}
              step={0.05}
              onChange={(v) => patchTypography({ lineHeight: v })}
            />
            <NumberRow
              label="Masthead size"
              value={theme.typography?.headerSize ?? 28}
              suffix="px"
              onChange={(v) => patchTypography({ headerSize: v })}
            />
          </Section>

          <Section title="Spacing">
            <NumberRow
              label="Section padding"
              value={theme.spacing?.sectionPadding ?? 32}
              suffix="px"
              onChange={(v) => patchSpacing({ sectionPadding: v })}
            />
            <NumberRow
              label="Block gap"
              value={theme.spacing?.blockGap ?? 16}
              suffix="px"
              onChange={(v) => patchSpacing({ blockGap: v })}
            />
            <NumberRow
              label="Border radius"
              value={theme.spacing?.borderRadius ?? 8}
              suffix="px"
              onChange={(v) => patchSpacing({ borderRadius: v })}
            />
          </Section>
        </>
      ) : (
        <AdvancedTab />
      )}

      <Presets onPick={onPickPreset} />
    </aside>
  )
}

function Tabs({
  tab,
  setTab,
}: {
  tab: 'basic' | 'advanced'
  setTab: (t: 'basic' | 'advanced') => void
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 3,
        border: '1px solid #e5e5ea',
        borderRadius: 8,
        background: '#fafafa',
        marginBottom: 18,
        width: '100%',
      }}
    >
      {(['basic', 'advanced'] as const).map((t) => {
        const on = t === tab
        return (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '6px 12px',
              border: 'none',
              background: on ? '#fff' : 'transparent',
              color: on ? '#1d1d1f' : '#86868b',
              fontSize: 12.5,
              fontWeight: on ? 500 : 400,
              borderRadius: 6,
              cursor: 'pointer',
              boxShadow: on ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              textTransform: 'capitalize',
            }}
          >
            {t}
          </button>
        )
      })}
    </div>
  )
}

function Section({
  title,
  defaultOpen,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div
      style={{
        border: '1px solid #e5e5ea',
        borderRadius: 10,
        marginBottom: 12,
        background: '#fff',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '12px 14px',
          border: 'none',
          background: 'transparent',
          fontSize: 13,
          fontWeight: 600,
          color: '#1d1d1f',
          cursor: 'pointer',
        }}
      >
        {title}
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={13} />
      </button>
      {open && <div style={{ padding: '0 14px 12px' }}>{children}</div>}
    </div>
  )
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 0',
        fontSize: 12.5,
      }}
    >
      <span style={{ flex: 1, color: '#3a3a3c' }}>{label}</span>
      <label
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 8px',
          border: '1px solid #e5e5ea',
          borderRadius: 7,
          background: '#fafafa',
          cursor: 'pointer',
        }}
      >
        <input
          type="color"
          value={normalizeHex(value)}
          onChange={(e) => onChange(e.target.value)}
          style={{
            position: 'absolute',
            opacity: 0,
            inset: 0,
            cursor: 'pointer',
          }}
          aria-label={label}
        />
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 4,
            background: value,
            border: '1px solid rgba(0,0,0,0.08)',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: 11,
            color: '#1d1d1f',
            textTransform: 'uppercase',
          }}
        >
          {value}
        </span>
      </label>
    </div>
  )
}

function normalizeHex(v: string): string {
  // <input type="color"> only accepts 7-char hex; coerce 3-char or
  // bogus values to a safe default so the swatch never blanks.
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return (
      '#' +
      v
        .slice(1)
        .split('')
        .map((c) => c + c)
        .join('')
    )
  }
  return '#000000'
}

function FontPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 0',
        fontSize: 12.5,
      }}
    >
      <span style={{ flex: 1, color: '#3a3a3c' }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '4px 8px',
          border: '1px solid #e5e5ea',
          borderRadius: 7,
          fontSize: 12,
          background: '#fafafa',
          color: '#1d1d1f',
          outline: 'none',
        }}
      >
        {FONT_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt === 'default' ? 'System default' : opt}
          </option>
        ))}
      </select>
    </div>
  )
}

function NumberRow({
  label,
  value,
  suffix,
  step,
  onChange,
}: {
  label: string
  value: number
  suffix?: string
  step?: number
  onChange: (next: number) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 0',
        fontSize: 12.5,
      }}
    >
      <span style={{ flex: 1, color: '#3a3a3c' }}>{label}</span>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 6px',
          border: '1px solid #e5e5ea',
          borderRadius: 7,
          background: '#fafafa',
        }}
      >
        <input
          type="number"
          value={value}
          step={step ?? 1}
          onChange={(e) => {
            const n = parseFloat(e.target.value)
            if (!Number.isNaN(n)) onChange(n)
          }}
          style={{
            width: 50,
            padding: '2px 4px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 12,
            color: '#1d1d1f',
            fontFamily: 'ui-monospace, monospace',
          }}
        />
        {suffix && (
          <span style={{ fontSize: 11, color: '#86868b' }}>{suffix}</span>
        )}
      </div>
    </div>
  )
}

function AdvancedTab() {
  // V1: show the element grid the design specifies so the surface is
  // familiar, but mark it as coming-soon. The per-element overrides
  // schema is planned for 4b.
  const elements: [string, string, string][] = [
    ['title', 'heading', 'Title'],
    ['subtitle', 'text', 'Subtitle'],
    ['image', 'image', 'Image'],
    ['byline', 'user', 'Byline'],
    ['topline', 'divider', 'Topline'],
    ['alignment', 'list', 'Alignment'],
    ['padding', 'grid', 'Padding'],
    ['code', 'edit', 'Code'],
  ]
  return (
    <div
      style={{
        border: '1px solid #e5e5ea',
        borderRadius: 10,
        padding: 14,
        background: '#fff',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#86868b',
          fontWeight: 600,
          marginBottom: 10,
        }}
      >
        Email header — per element
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
        }}
      >
        {elements.map(([key, icon, label]) => (
          <button
            key={key}
            type="button"
            disabled
            style={{
              padding: '12px 6px',
              border: '1px solid #e5e5ea',
              borderRadius: 8,
              background: '#fafafa',
              color: '#86868b',
              fontSize: 11,
              cursor: 'not-allowed',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Icon name={icon} size={16} />
            {label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: 11.5, color: '#86868b', lineHeight: 1.5 }}>
        Per-element font / weight / size / colour overrides land in
        the next iteration. Until then, the Basic tab globally
        controls the look.
      </div>
    </div>
  )
}

function Presets({ onPick }: { onPick: (theme: Theme) => void }) {
  return (
    <div
      style={{
        marginTop: 18,
        padding: '12px 14px',
        border: '1px dashed #d1d1d6',
        borderRadius: 10,
        background: '#fafafa',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 500,
          color: '#3a3a3c',
          marginBottom: 10,
        }}
      >
        <Icon name="sparkles" size={13} />
        Theme presets
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 6,
        }}
      >
        {PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            title={p.name}
            onClick={() => onPick(p.theme)}
            style={{
              height: 40,
              border: '1px solid #e5e5ea',
              borderRadius: 8,
              background: p.swatch.bg,
              color: p.swatch.fg,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Aa
          </button>
        ))}
      </div>
    </div>
  )
}
