'use client'

import { useMemo, useState } from 'react'
import { Icon } from '../../email-marketing/_components/Icon'
import {
  renderBlocksToHtml,
  resolveTheme,
  Theme,
} from '../../email-marketing/_components/blockEditor/render'
import { ContentDoc } from '../../email-marketing/_components/blockEditor/types'
import { PostMeta } from './PostEditor'
import { isWebfont, useGoogleFonts } from './useGoogleFonts'

// V2 of the Style view. Three things the previous version got wrong
// (per the design audit):
//
//   1. Fonts didn't visibly change the preview because Google Fonts
//      were never loaded — the CSS stack cascaded to the system
//      fallback. The useGoogleFonts hook fixes the live preview;
//      sent emails keep their existing fallback stack since clients
//      can't load webfonts anyway.
//
//   2. Scope was hidden. You were always editing post-level
//      overrides, never the newsletter brand, with no way to tell
//      which was which. The Scope toggle at the top of the panel
//      makes this explicit — and routes edits to the right state on
//      the host side via the new `mode` prop.
//
//   3. Colours had no usage hints, the Advanced grid was 8 dead
//      tiles, and the preview was too small to read. Each of those
//      is fixed inline below.
//
// Architecture: the host (NewsletterPostScreen) owns two theme
// values — brand (newsletter.theme) and override
// (post.theme_overrides) — and a `mode` that says which one the
// Style panel is currently editing. The PREVIEW always renders
// against the resolved merge of both, so the user sees the actual
// final output regardless of which scope they're tweaking.

export type Device = 'desktop' | 'mobile'
export type StyleScope = 'post' | 'brand'

const FONT_OPTIONS: { name: string; webfont: boolean }[] = [
  { name: 'default', webfont: false },
  { name: 'Inter', webfont: true },
  { name: 'Newsreader', webfont: true },
  { name: 'Anton', webfont: true },
  { name: 'SF Pro Display', webfont: false },
  { name: 'Georgia', webfont: false },
  { name: 'New York', webfont: false },
  { name: 'Charter', webfont: false },
]

const PRESETS: {
  name: string
  description: string
  theme: Theme
  preview: { bg: string; ink: string; accent: string; serif: boolean }
}[] = [
  {
    name: 'Editorial',
    description: 'Newsreader serif, generous spacing, black & white.',
    preview: { bg: '#ffffff', ink: '#0a0a0c', accent: '#0a0a0c', serif: true },
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
    name: 'Modern',
    description: 'Inter throughout, tight, indigo accents.',
    preview: { bg: '#ffffff', ink: '#0a0a0c', accent: '#4f46e5', serif: false },
    theme: {
      colors: {
        outsideBg: '#fafafa',
        postBg: '#ffffff',
        textBg: '#0a0a0c',
        textSubtle: '#3a3a3c',
        primary: '#4f46e5',
        textPrimary: '#ffffff',
        secondary: '#86868b',
        links: '#4f46e5',
        hairline: '#e8e8ed',
      },
      typography: {
        headingFont: 'Inter',
        bodyFont: 'Inter',
        baseSize: 15,
        lineHeight: 1.65,
        headerSize: 28,
      },
      spacing: { sectionPadding: 32, blockGap: 16, borderRadius: 10 },
    },
  },
  {
    name: 'Mocha',
    description: 'Warm browns, Newsreader heading + Charter body.',
    preview: { bg: '#f5efe6', ink: '#3d2e1f', accent: '#7a4e2b', serif: true },
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
    description: 'Dark mode, Inter, sharp.',
    preview: { bg: '#1a1a1d', ink: '#f6f4ef', accent: '#f6f4ef', serif: false },
    theme: {
      colors: {
        outsideBg: '#0d0d10',
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
]

// Colour tokens with usage hints — the rebuild's biggest UX win is
// telling the user WHERE each colour shows up. Order matches reading
// order in the rendered email (outside → in → details).
const COLOR_FIELDS: {
  key: keyof NonNullable<Theme['colors']>
  label: string
  hint: string
}[] = [
  {
    key: 'outsideBg',
    label: 'Page background',
    hint: 'Behind the email content. What the inbox client renders around your message.',
  },
  {
    key: 'postBg',
    label: 'Email background',
    hint: 'The card itself. Sets the canvas your text and images sit on.',
  },
  {
    key: 'textBg',
    label: 'Body text',
    hint: 'Headings and paragraphs. The main reading colour.',
  },
  {
    key: 'primary',
    label: 'Primary accent',
    hint: 'Buttons, quote bars, masthead colour, paywall CTA.',
  },
  {
    key: 'textPrimary',
    label: 'Text on primary',
    hint: 'Sits inside buttons and on the primary colour. Keep contrast high.',
  },
  {
    key: 'secondary',
    label: 'Muted text',
    hint: 'Captions, dates, bylines, the "Read online" link.',
  },
  {
    key: 'links',
    label: 'Links',
    hint: 'Inline anchors in the body text.',
  },
]

export function StyleView({
  meta,
  doc,
  brandTheme,
  postOverrides,
  mode,
  setMode,
  setBrandTheme,
  setPostOverrides,
  onSendTest,
  brandSaveStatus,
}: {
  meta: PostMeta
  doc: ContentDoc
  brandTheme: Theme
  postOverrides: Theme
  mode: StyleScope
  setMode: (m: StyleScope) => void
  setBrandTheme: (t: Theme) => void
  setPostOverrides: (t: Theme) => void
  onSendTest?: () => void
  // Status pill mirroring autosave for brand-theme edits. Post-level
  // edits already surface through the editor's top-bar status pill.
  brandSaveStatus?: 'idle' | 'saving' | 'saved' | 'error'
}) {
  const [device, setDevice] = useState<Device>('desktop')

  // The preview always renders against the resolved theme, regardless
  // of which scope is being edited. The user always sees the real
  // final output.
  const resolved = useMemo(
    () => resolveTheme(brandTheme, postOverrides),
    [brandTheme, postOverrides],
  )

  // Load Google Fonts for the resolved typography so the preview
  // actually shows the picked typeface. Without this hook the
  // <font-family> stack falls through to the system fallback and the
  // dropdown feels inert (audit point #1).
  useGoogleFonts(
    resolved.typography?.headingFont,
    resolved.typography?.bodyFont,
  )

  const active = mode === 'brand' ? brandTheme : postOverrides
  const setActive = mode === 'brand' ? setBrandTheme : setPostOverrides

  const patchColors = (delta: Partial<NonNullable<Theme['colors']>>) =>
    setActive({ ...active, colors: { ...(active.colors ?? {}), ...delta } })
  const patchTypography = (
    delta: Partial<NonNullable<Theme['typography']>>,
  ) =>
    setActive({
      ...active,
      typography: { ...(active.typography ?? {}), ...delta },
    })
  const patchSpacing = (delta: Partial<NonNullable<Theme['spacing']>>) =>
    setActive({ ...active, spacing: { ...(active.spacing ?? {}), ...delta } })

  // Presets always overwrite the active scope wholesale. Cleaner than
  // trying to merge — the user picked a preset because they wanted
  // the whole look, not bits of it.
  const onPickPreset = (t: Theme) => setActive(t)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: 0,
        minHeight: 'calc(100vh - 56px)',
        background: '#fafafa',
      }}
    >
      <PreviewPane
        meta={meta}
        doc={doc}
        theme={resolved}
        device={device}
        setDevice={setDevice}
        onSendTest={onSendTest}
      />
      <SidePanel
        mode={mode}
        setMode={setMode}
        brandSaveStatus={brandSaveStatus}
        active={active}
        resolved={resolved}
        patchColors={patchColors}
        patchTypography={patchTypography}
        patchSpacing={patchSpacing}
        onPickPreset={onPickPreset}
        onReset={() => setActive({})}
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
  const hairline = theme.colors?.hairline ?? '#e8e8ed'
  const headerSize = theme.typography?.headerSize ?? 28
  const padding = theme.spacing?.sectionPadding ?? 32
  const radius = theme.spacing?.borderRadius ?? 8
  const headingFont = resolveFontFamily(theme.typography?.headingFont)
  const bodyFont = resolveFontFamily(theme.typography?.bodyFont)

  const frameWidth = device === 'mobile' ? 380 : 760

  return (
    <div
      style={{
        padding: '20px 24px 80px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <InboxFrame outsideBg={outsideBg} hairline={hairline}>
        <div
          style={{
            width: '100%',
            maxWidth: frameWidth,
            margin: '0 auto',
            transition: 'max-width 0.25s ease',
          }}
        >
          {/* Inbox row — the From / Subject preview a recipient sees
              first in their inbox before opening. */}
          <InboxRow
            from={meta.title ? meta.title : 'Your newsletter'}
            subject={meta.title || 'A title goes here'}
            preview={meta.subtitle || ''}
            hairline={hairline}
          />

          {/* Email body */}
          <div
            style={{
              padding: `${padding}px`,
              background: postBg,
              color: textBg,
              fontFamily: bodyFont,
              borderRadius: `${radius}px`,
              border: `1px solid ${hairline}`,
              marginTop: 12,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                fontSize: headerSize,
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: theme.colors?.secondary ?? textBg,
                textAlign: 'center',
                textTransform: 'uppercase',
                margin: '0 0 22px',
                fontFamily: headingFont,
              }}
            >
              {meta.title ? abbreviate(meta.title, 18) : 'YOUR NEWSLETTER'}
            </div>

            {meta.cover_url && meta.cover_visible && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={meta.cover_url}
                alt=""
                style={{
                  display: 'block',
                  width: '100%',
                  borderRadius: radius,
                  marginBottom: 20,
                }}
              />
            )}

            {meta.title && (
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.15,
                  marginBottom: 6,
                  fontFamily: headingFont,
                }}
              >
                {meta.title}
              </div>
            )}
            {meta.subtitle && (
              <div
                style={{
                  fontSize: 16,
                  color: muted,
                  marginBottom: 14,
                  fontFamily: bodyFont,
                }}
              >
                {meta.subtitle}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
              }}
            >
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
                background: hairline,
                margin: '0 0 20px',
              }}
            />
            <div
              dangerouslySetInnerHTML={{ __html: html }}
              style={{ fontFamily: bodyFont }}
            />
          </div>

          <div
            style={{
              padding: '14px 28px',
              marginTop: 12,
              fontSize: 11,
              color: muted,
              textAlign: 'center',
              fontFamily: bodyFont,
            }}
          >
            You&apos;re getting this because you subscribed.{' '}
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              style={{ color: muted }}
            >
              Unsubscribe
            </a>{' '}
            ·{' '}
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              style={{ color: muted }}
            >
              Manage preferences
            </a>
          </div>
        </div>
      </InboxFrame>

      <DeviceSwitcher
        device={device}
        setDevice={setDevice}
        onSendTest={onSendTest}
      />
    </div>
  )
}

function InboxFrame({
  outsideBg,
  hairline,
  children,
}: {
  outsideBg: string
  hairline: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 920,
        background: '#fff',
        borderRadius: 14,
        border: '1px solid #e5e5ea',
        boxShadow: '0 20px 60px rgba(20,20,30,0.08)',
        overflow: 'hidden',
      }}
    >
      <MacChrome />
      <div
        style={{
          background: outsideBg,
          padding: '20px 0 28px',
          borderBottom: `1px solid ${hairline}`,
          transition: 'background 0.2s ease',
        }}
      >
        {children}
      </div>
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
        Inbox · preview
      </span>
      <span style={{ flex: 1 }} />
      <Icon name="mail" size={12} />
    </div>
  )
}

function InboxRow({
  from,
  subject,
  preview,
  hairline,
}: {
  from: string
  subject: string
  preview: string
  hairline: string
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${hairline}`,
        borderRadius: 12,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#f0f0f3',
          color: '#3a3a3c',
          display: 'grid',
          placeItems: 'center',
          fontSize: 13,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {(from || '?').slice(0, 1).toUpperCase()}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: '#1d1d1f',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {from}
        </div>
        <div
          style={{
            fontSize: 13,
            color: '#1d1d1f',
            marginTop: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {subject}
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#86868b',
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {preview}
        </div>
      </div>
      <span style={{ fontSize: 11, color: '#86868b' }}>now</span>
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
    border: 'none' as const,
    background: active ? '#fff' : 'transparent',
    color: active ? '#1d1d1f' : '#86868b',
    fontSize: 12.5,
    fontWeight: (active ? 500 : 400) as 400 | 500,
    borderRadius: 7,
    cursor: 'pointer' as const,
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
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
      <button
        type="button"
        style={item(device === 'desktop')}
        onClick={() => setDevice('desktop')}
      >
        <Icon name="monitor" size={12} /> Desktop
      </button>
      <button
        type="button"
        style={item(device === 'mobile')}
        onClick={() => setDevice('mobile')}
      >
        <Icon name="phone" size={12} /> Mobile
      </button>
      {onSendTest && (
        <button type="button" style={item(false)} onClick={onSendTest}>
          <Icon name="flask" size={12} /> Send test
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

function resolveFontFamily(name: string | undefined): string {
  switch (name) {
    case 'Inter':
      return '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    case 'Newsreader':
      return '"Newsreader", Georgia, "New York", serif'
    case 'Anton':
      return '"Anton", Helvetica, Arial, sans-serif'
    case 'SF Pro Display':
      return '-apple-system, "SF Pro Display", BlinkMacSystemFont, sans-serif'
    case 'Georgia':
      return 'Georgia, "Times New Roman", serif'
    case 'New York':
      return '"New York", Georgia, serif'
    case 'Charter':
      return 'Charter, Georgia, serif'
    default:
      return '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  }
}

// ── Side panel ───────────────────────────────────────────────────────

const DEFAULT_COLOR_DISPLAY: Record<keyof NonNullable<Theme['colors']>, string> = {
  outsideBg: '#ffffff',
  postBg: '#ffffff',
  textBg: '#1d1d1f',
  textSubtle: '#424245',
  primary: '#1d1d1f',
  textPrimary: '#ffffff',
  secondary: '#86868b',
  links: '#1d1d1f',
  hairline: '#e8e8ed',
}

function hasAnyOverride(t: Theme): boolean {
  return Boolean(
    Object.keys(t.colors ?? {}).length ||
      Object.keys(t.typography ?? {}).length ||
      Object.keys(t.spacing ?? {}).length,
  )
}

function SidePanel({
  mode,
  setMode,
  brandSaveStatus,
  active,
  resolved,
  patchColors,
  patchTypography,
  patchSpacing,
  onPickPreset,
  onReset,
}: {
  mode: StyleScope
  setMode: (m: StyleScope) => void
  brandSaveStatus?: 'idle' | 'saving' | 'saved' | 'error'
  active: Theme
  resolved: Theme
  patchColors: (delta: Partial<NonNullable<Theme['colors']>>) => void
  patchTypography: (delta: Partial<NonNullable<Theme['typography']>>) => void
  patchSpacing: (delta: Partial<NonNullable<Theme['spacing']>>) => void
  onPickPreset: (t: Theme) => void
  onReset: () => void
}) {
  return (
    <aside
      style={{
        borderLeft: '1px solid #e5e5ea',
        background: '#fff',
        padding: '18px 18px 60px',
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 56px)',
      }}
    >
      <ScopeBanner
        mode={mode}
        setMode={setMode}
        brandSaveStatus={brandSaveStatus}
        hasOverride={hasAnyOverride(active)}
      />

      <Presets onPick={onPickPreset} />

      <Section title="Colours" defaultOpen>
        {COLOR_FIELDS.map((f) => (
          <ColorRow
            key={f.key}
            label={f.label}
            hint={f.hint}
            value={
              resolved.colors?.[f.key] ??
              DEFAULT_COLOR_DISPLAY[f.key] ??
              '#000000'
            }
            isOverride={active.colors?.[f.key] !== undefined}
            onChange={(v) =>
              patchColors({ [f.key]: v } as Partial<
                NonNullable<Theme['colors']>
              >)
            }
          />
        ))}
      </Section>

      <Section title="Typography" defaultOpen>
        <FontPicker
          label="Heading font"
          value={resolved.typography?.headingFont ?? 'default'}
          onChange={(v) => patchTypography({ headingFont: v })}
          sample="Long-form, in your voice."
          weight={700}
        />
        <FontPicker
          label="Body font"
          value={resolved.typography?.bodyFont ?? 'default'}
          onChange={(v) => patchTypography({ bodyFont: v })}
          sample="The body sets the rhythm. Pick a face that reads at length."
          weight={400}
        />
        <NumberRow
          label="Base size"
          value={resolved.typography?.baseSize ?? 14}
          suffix="px"
          onChange={(v) => patchTypography({ baseSize: v })}
          min={12}
          max={20}
        />
        <NumberRow
          label="Line height"
          value={resolved.typography?.lineHeight ?? 1.65}
          step={0.05}
          onChange={(v) => patchTypography({ lineHeight: v })}
          min={1.3}
          max={2}
        />
        <NumberRow
          label="Masthead size"
          value={resolved.typography?.headerSize ?? 28}
          suffix="px"
          onChange={(v) => patchTypography({ headerSize: v })}
          min={18}
          max={56}
        />
      </Section>

      <Section title="Spacing">
        <NumberRow
          label="Section padding"
          value={resolved.spacing?.sectionPadding ?? 32}
          suffix="px"
          onChange={(v) => patchSpacing({ sectionPadding: v })}
          min={12}
          max={64}
        />
        <NumberRow
          label="Block gap"
          value={resolved.spacing?.blockGap ?? 16}
          suffix="px"
          onChange={(v) => patchSpacing({ blockGap: v })}
          min={6}
          max={36}
        />
        <NumberRow
          label="Corner radius"
          value={resolved.spacing?.borderRadius ?? 8}
          suffix="px"
          onChange={(v) => patchSpacing({ borderRadius: v })}
          min={0}
          max={24}
        />
      </Section>

      {hasAnyOverride(active) && (
        <button
          type="button"
          onClick={onReset}
          style={{
            marginTop: 16,
            width: '100%',
            padding: '9px 12px',
            border: '1px solid #e5e5ea',
            borderRadius: 8,
            background: '#fff',
            fontSize: 12.5,
            color: '#1d1d1f',
            cursor: 'pointer',
          }}
        >
          Reset {mode === 'brand' ? 'newsletter brand' : 'this post'} to
          defaults
        </button>
      )}
    </aside>
  )
}

function ScopeBanner({
  mode,
  setMode,
  brandSaveStatus,
  hasOverride,
}: {
  mode: StyleScope
  setMode: (m: StyleScope) => void
  brandSaveStatus?: 'idle' | 'saving' | 'saved' | 'error'
  hasOverride: boolean
}) {
  return (
    <div
      style={{
        background: mode === 'brand' ? '#fef9ec' : '#f4f4f7',
        border: `1px solid ${mode === 'brand' ? '#f6dcb4' : '#e5e5ea'}`,
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 600,
          color: mode === 'brand' ? '#9a7400' : '#3a3a3c',
          marginBottom: 6,
        }}
      >
        Editing
      </div>
      <div
        style={{
          display: 'inline-flex',
          padding: 3,
          border: '1px solid #e5e5ea',
          borderRadius: 9,
          background: '#fff',
          marginBottom: 10,
          width: '100%',
        }}
      >
        {(['post', 'brand'] as const).map((m) => {
          const on = mode === m
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: '6px 10px',
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
              {m === 'post' ? 'This post' : 'Newsletter brand'}
            </button>
          )
        })}
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: '#6e6e73',
          lineHeight: 1.5,
        }}
      >
        {mode === 'post'
          ? hasOverride
            ? 'These changes apply only to this post. Reset to fall back to your newsletter brand.'
            : "No overrides yet — this post inherits everything from your newsletter brand. Switch to 'Newsletter brand' to change the look of every issue."
          : 'Changes here apply to every post in this newsletter. Saved automatically.'}
      </div>
      {mode === 'brand' && brandSaveStatus && brandSaveStatus !== 'idle' && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11.5,
            color:
              brandSaveStatus === 'error'
                ? '#c33'
                : brandSaveStatus === 'saving'
                  ? '#86868b'
                  : '#1a7a3e',
          }}
        >
          {brandSaveStatus === 'saving'
            ? 'Saving brand…'
            : brandSaveStatus === 'saved'
              ? 'Brand saved'
              : 'Brand save failed'}
        </div>
      )}
    </div>
  )
}

function Presets({ onPick }: { onPick: (theme: Theme) => void }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          fontWeight: 600,
          color: '#86868b',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        <Icon name="sparkles" size={11} />
        Looks
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => onPick(p.theme)}
            style={{
              padding: 0,
              border: '1px solid #e5e5ea',
              borderRadius: 10,
              background: '#fff',
              cursor: 'pointer',
              overflow: 'hidden',
              textAlign: 'left',
            }}
          >
            <div
              style={{
                background: p.preview.bg,
                color: p.preview.ink,
                padding: '14px 12px 10px',
                fontFamily: p.preview.serif
                  ? '"Newsreader", Georgia, serif'
                  : '"Inter", system-ui, sans-serif',
              }}
            >
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  letterSpacing: '-0.015em',
                  lineHeight: 1.05,
                }}
              >
                {p.name}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  marginTop: 4,
                  opacity: 0.7,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    background: p.preview.accent,
                    display: 'inline-block',
                  }}
                />
                {p.preview.serif ? 'Serif' : 'Sans'} · sample
              </div>
            </div>
            <div
              style={{
                padding: '8px 12px',
                fontSize: 11,
                color: '#86868b',
                lineHeight: 1.4,
              }}
            >
              {p.description}
            </div>
          </button>
        ))}
      </div>
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
        marginBottom: 10,
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
  hint,
  value,
  isOverride,
  onChange,
}: {
  label: string
  hint: string
  value: string
  isOverride: boolean
  onChange: (next: string) => void
}) {
  return (
    <div
      style={{
        padding: '8px 0',
        borderBottom: '1px solid #f4f4f7',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            flex: 1,
            fontSize: 12.5,
            color: '#1d1d1f',
            fontWeight: 500,
          }}
        >
          {label}
          {isOverride && (
            <span
              title="Overridden at this scope"
              style={{
                marginLeft: 6,
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: '#4f46e5',
                display: 'inline-block',
                verticalAlign: 'middle',
              }}
            />
          )}
        </span>
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
      <div
        style={{
          fontSize: 11,
          color: '#86868b',
          marginTop: 3,
          lineHeight: 1.4,
        }}
      >
        {hint}
      </div>
    </div>
  )
}

function normalizeHex(v: string): string {
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
  sample,
  weight,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  sample: string
  weight: 400 | 500 | 600 | 700
}) {
  const family = resolveFontFamily(value)
  return (
    <div
      style={{
        padding: '8px 0',
        borderBottom: '1px solid #f4f4f7',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            flex: 1,
            fontSize: 12.5,
            color: '#1d1d1f',
            fontWeight: 500,
          }}
        >
          {label}
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            padding: '5px 8px',
            border: '1px solid #e5e5ea',
            borderRadius: 7,
            fontSize: 12,
            background: '#fafafa',
            color: '#1d1d1f',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        >
          {FONT_OPTIONS.map((opt) => (
            <option key={opt.name} value={opt.name}>
              {opt.name === 'default' ? 'System default' : opt.name}
              {opt.name !== 'default' && !opt.webfont
                ? ' (system only)'
                : ''}
            </option>
          ))}
        </select>
      </div>
      <div
        style={{
          marginTop: 8,
          padding: '12px 14px',
          background: '#fafafa',
          borderRadius: 8,
          fontFamily: family,
          fontSize: 14,
          fontWeight: weight,
          color: '#1d1d1f',
          lineHeight: 1.4,
        }}
      >
        {sample}
        {!isWebfont(value) && value !== 'default' && (
          <div
            style={{
              marginTop: 6,
              fontSize: 10.5,
              fontWeight: 400,
              color: '#9a7400',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            System-only font — only renders on devices that have it
            installed. Subscribers without it see the next fallback.
          </div>
        )}
      </div>
    </div>
  )
}

function NumberRow({
  label,
  value,
  suffix,
  step,
  onChange,
  min,
  max,
}: {
  label: string
  value: number
  suffix?: string
  step?: number
  onChange: (next: number) => void
  min?: number
  max?: number
}) {
  return (
    <div
      style={{
        padding: '8px 0',
        borderBottom: '1px solid #f4f4f7',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span
        style={{
          flex: 1,
          fontSize: 12.5,
          color: '#1d1d1f',
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: 120,
          accentColor: '#1d1d1f',
        }}
      />
      <span
        style={{
          minWidth: 44,
          textAlign: 'right',
          fontSize: 11.5,
          color: '#3a3a3c',
          fontVariantNumeric: 'tabular-nums',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        {step && step < 1 ? value.toFixed(2) : Math.round(value)}
        {suffix ? suffix : ''}
      </span>
    </div>
  )
}
