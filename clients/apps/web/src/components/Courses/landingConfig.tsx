'use client'

// Landing-page customization config.
//
// The dashboard CustomizeTab edits a draft of this and saves it to
// `course.landing_config` (JSONB). Both the wizard preview and the public
// CourseLandingView read it and apply theme + section visibility + text/media
// overrides on top of the AI-generated content.

import { createContext, useContext, useMemo } from 'react'
import type {
  LandingConfig,
  LandingMedia,
  LandingSectionId,
  LandingTheme,
} from '@/hooks/queries/courses'

export type {
  LandingConfig,
  LandingMedia,
  LandingSectionId,
  LandingTheme,
} from '@/hooks/queries/courses'

export const FONT_PAIRS: {
  id: string
  label: string
  family: string
  google?: string
}[] = [
  {
    id: 'poppins',
    label: 'Poppins',
    family: "'Poppins', sans-serif",
    google: 'Poppins:wght@300;400;500;600;700;800',
  },
  {
    id: 'inter-tight',
    label: 'Inter Tight',
    family: "'Inter Tight', sans-serif",
    google: 'Inter+Tight:wght@300;400;500;600;700',
  },
  {
    id: 'fraunces',
    label: 'Fraunces (serif)',
    family: "'Fraunces', serif",
    google:
      'Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700',
  },
  {
    id: 'space-grotesk',
    label: 'Space Grotesk',
    family: "'Space Grotesk', sans-serif",
    google: 'Space+Grotesk:wght@300;400;500;600;700',
  },
  {
    id: 'dm-sans',
    label: 'DM Sans',
    family: "'DM Sans', sans-serif",
    google:
      'DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700',
  },
  {
    id: 'instrument-serif',
    label: 'Instrument Serif',
    family: "'Instrument Serif', serif",
    google: 'Instrument+Serif:ital@0;1',
  },
]

export const ACCENT_PRESETS: {
  id: string
  label: string
  accent: string
  accent2: string
}[] = [
  {
    id: 'indigo',
    label: 'Indigo',
    accent: 'oklch(0.55 0.20 265)',
    accent2: 'oklch(0.62 0.16 285)',
  },
  {
    id: 'amber',
    label: 'Amber',
    accent: 'oklch(0.70 0.18 65)',
    accent2: 'oklch(0.78 0.14 85)',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    accent: 'oklch(0.58 0.16 155)',
    accent2: 'oklch(0.66 0.13 175)',
  },
  {
    id: 'rose',
    label: 'Rose',
    accent: 'oklch(0.62 0.21 15)',
    accent2: 'oklch(0.70 0.17 35)',
  },
  {
    id: 'plum',
    label: 'Plum',
    accent: 'oklch(0.50 0.18 320)',
    accent2: 'oklch(0.60 0.14 295)',
  },
  {
    id: 'graphite',
    label: 'Graphite',
    accent: 'oklch(0.30 0.01 280)',
    accent2: 'oklch(0.42 0.01 280)',
  },
]

export const SURFACE_MODES: {
  id: string
  label: string
  bg0: string
  fg0: string
}[] = [
  {
    id: 'light',
    label: 'Light',
    bg0: '#ffffff',
    fg0: 'oklch(0.18 0.008 280)',
  },
  {
    id: 'cream',
    label: 'Cream',
    bg0: 'oklch(0.985 0.012 75)',
    fg0: 'oklch(0.20 0.012 60)',
  },
  {
    id: 'paper',
    label: 'Paper',
    bg0: 'oklch(0.97 0.005 100)',
    fg0: 'oklch(0.20 0.01 80)',
  },
  {
    id: 'dark',
    label: 'Dark',
    bg0: 'oklch(0.16 0.008 280)',
    fg0: 'oklch(0.96 0.005 280)',
  },
]

export const SECTIONS: {
  id: LandingSectionId
  label: string
  hint: string
}[] = [
  { id: 'hero', label: 'Hero', hint: 'Cinematic header' },
  { id: 'value', label: "What's included", hint: '4-column value strip' },
  { id: 'trailer', label: 'Trailer', hint: 'Video block' },
  { id: 'curriculum', label: 'Curriculum', hint: 'Chapter cards' },
  { id: 'lessons', label: 'All lessons', hint: 'Accordion + paywall' },
  { id: 'instructor', label: 'Instructor', hint: 'Bio + pull quote' },
  { id: 'reviews', label: 'Reviews', hint: 'Student quotes' },
  { id: 'finalCta', label: 'Final CTA', hint: 'Closing block' },
]

export const DEFAULT_THEME: Required<LandingTheme> = {
  fontHeading: 'poppins',
  fontBody: 'poppins',
  accentId: 'indigo',
  surfaceId: 'light',
  typeScale: 1,
  headingWeight: 700,
  bodyWeight: 400,
  headingItalic: false,
  headingAlign: 'left',
  headingTracking: 0,
  headingLeading: 1,
  density: 'comfortable',
  cornerStyle: 'rounded',
}

export function mergeTheme(t: LandingTheme | null | undefined): Required<LandingTheme> {
  return { ...DEFAULT_THEME, ...(t ?? {}) }
}

// Returns the inline-style object that maps the theme to CSS custom properties.
// Apply this to the wrapper div around the landing — the CSS vars cascade and
// `headings` defined inside the landing pick them up via existing rules.
export function themeStyle(
  config: LandingConfig | null | undefined,
): React.CSSProperties {
  const t = mergeTheme(config?.theme)
  const accent = ACCENT_PRESETS.find((a) => a.id === t.accentId) ?? ACCENT_PRESETS[0]
  const surface = SURFACE_MODES.find((s) => s.id === t.surfaceId) ?? SURFACE_MODES[0]
  const fontH = FONT_PAIRS.find((f) => f.id === t.fontHeading) ?? FONT_PAIRS[0]
  const fontB = FONT_PAIRS.find((f) => f.id === t.fontBody) ?? FONT_PAIRS[0]
  const radMul = { sharp: 0.25, rounded: 1, pill: 1.6 }[t.cornerStyle]
  const dens = { compact: 0.8, comfortable: 1, spacious: 1.2 }[t.density]

  return {
    // colour & font tokens consumed by the landing page styles
    ['--accent' as string]: accent.accent,
    ['--accent-2' as string]: accent.accent2,
    ['--accent-soft' as string]: accent.accent.replace(')', ' / 0.10)'),
    ['--bg-0' as string]: surface.bg0,
    ['--fg-0' as string]: surface.fg0,
    ['--font-heading' as string]: fontH.family,
    ['--font-body' as string]: fontB.family,
    // typography knobs
    ['--type-scale' as string]: String(t.typeScale),
    ['--h-weight' as string]: String(t.headingWeight),
    ['--b-weight' as string]: String(t.bodyWeight),
    ['--h-italic' as string]: t.headingItalic ? 'italic' : 'normal',
    ['--h-align' as string]: t.headingAlign,
    ['--h-tracking' as string]: `${t.headingTracking}em`,
    ['--h-leading' as string]: String(t.headingLeading),
    ['--radius-mul' as string]: String(radMul),
    ['--density' as string]: String(dens),
    background: surface.bg0,
    color: surface.fg0,
    fontFamily: fontB.family,
    fontWeight: t.bodyWeight,
  }
}

// Loads heading + body Google Fonts on demand. Idempotent — duplicates are
// skipped via a stable id on the <link> element.
export function ensureGoogleFonts(config: LandingConfig | null | undefined) {
  if (typeof document === 'undefined') return
  const t = mergeTheme(config?.theme)
  const ids = new Set([t.fontHeading, t.fontBody])
  ids.forEach((id) => {
    const f = FONT_PAIRS.find((p) => p.id === id)
    if (!f?.google) return
    const linkId = 'gfont-' + f.id
    if (document.getElementById(linkId)) return
    const l = document.createElement('link')
    l.id = linkId
    l.rel = 'stylesheet'
    l.href = `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`
    document.head.appendChild(l)
  })
}

// Read text override or fall back to default
export function textValue(
  config: LandingConfig | null | undefined,
  path: string,
  fallback: string,
): string {
  return config?.text?.[path] ?? fallback
}

export function mediaValue(
  config: LandingConfig | null | undefined,
  id: string,
): LandingMedia {
  return config?.media?.[id] ?? null
}

export function isSectionVisible(
  config: LandingConfig | null | undefined,
  id: LandingSectionId,
): boolean {
  return config?.visible?.[id] !== false
}

// ── Mutators (return a new config; never mutate) ─────────────────────────

export function setText(
  config: LandingConfig | null | undefined,
  path: string,
  value: string | null,
): LandingConfig {
  const text = { ...(config?.text ?? {}) }
  if (value == null || value === '') delete text[path]
  else text[path] = value
  return { ...(config ?? {}), text }
}

export function setMedia(
  config: LandingConfig | null | undefined,
  id: string,
  value: LandingMedia,
): LandingConfig {
  const media = { ...(config?.media ?? {}) }
  if (value == null) delete media[id]
  else media[id] = value
  return { ...(config ?? {}), media }
}

export function setTheme(
  config: LandingConfig | null | undefined,
  patch: LandingTheme,
): LandingConfig {
  return {
    ...(config ?? {}),
    theme: { ...(config?.theme ?? {}), ...patch },
  }
}

export function setVisible(
  config: LandingConfig | null | undefined,
  id: LandingSectionId,
  value: boolean,
): LandingConfig {
  return {
    ...(config ?? {}),
    visible: { ...(config?.visible ?? {}), [id]: value },
  }
}

// ── Context for live editing inside the landing canvas ───────────────────

export type LandingEditorContextValue = {
  config: LandingConfig
  mode: 'edit' | 'preview'
  setText: (path: string, value: string | null) => void
  setMedia: (id: string, value: LandingMedia) => void
  setTheme: (patch: LandingTheme) => void
  setVisible: (id: LandingSectionId, value: boolean) => void
}

const LandingEditorContext = createContext<LandingEditorContextValue | null>(
  null,
)

export const LandingEditorProvider = LandingEditorContext.Provider

export function useLandingEditor(): LandingEditorContextValue | null {
  return useContext(LandingEditorContext)
}

// Default empty config used as a stable identity in callers
export const EMPTY_LANDING_CONFIG: LandingConfig = {}

export function useThemeStyle(
  config: LandingConfig | null | undefined,
): React.CSSProperties {
  return useMemo(() => themeStyle(config), [config])
}
