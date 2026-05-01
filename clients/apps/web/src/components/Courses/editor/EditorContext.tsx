'use client'

// Editor state — shared by the dashboard CustomizeTab and the onboarding
// wizard preview. Holds:
//   • text overrides (path → string)
//   • media overrides (slot id → { kind, url })
//   • visibility (block id → bool)
//   • theme (fonts, weights, scale, etc. — applied via CSS vars)
//   • mode (edit | preview), device, panel selection
//   • undo/redo history (50 frames)
//
// The shape mirrors landing_overrides on the course; persisting is the host's
// responsibility — it subscribes via onChange.

import type { LandingMedia, LandingOverrides, LandingTheme } from '@/hooks/queries/courses'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

export type EditorMode = 'edit' | 'preview'
export type EditorDevice = 'desktop' | 'tablet' | 'mobile'
export type EditorPanel = 'design' | 'content' | 'media' | 'sections' | 'ai'

// ── Theme presets (mirror editor-context.jsx) ───────────────────────────────

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
    id: 'sohne',
    label: 'Inter Tight',
    family: "'Inter Tight', sans-serif",
    google: 'Inter+Tight:wght@300;400;500;600;700',
  },
  {
    id: 'fraunces',
    label: 'Fraunces',
    family: "'Fraunces', serif",
    google:
      'Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700',
  },
  {
    id: 'space',
    label: 'Space Grotesk',
    family: "'Space Grotesk', sans-serif",
    google: 'Space+Grotesk:wght@300;400;500;600;700',
  },
  {
    id: 'dm',
    label: 'DM Sans',
    family: "'DM Sans', sans-serif",
    google:
      'DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700',
  },
  {
    id: 'instrument',
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
  { id: 'light', label: 'Light', bg0: '#ffffff', fg0: 'oklch(0.18 0.008 280)' },
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

export const DEFAULT_THEME: LandingTheme = {
  fontHeading: 'poppins',
  fontBody: 'poppins',
  accentId: 'indigo',
  surfaceId: 'light',
  typeScale: 1.0,
  headingWeight: 700,
  bodyWeight: 400,
  headingItalic: false,
  headingAlign: 'left',
  headingTracking: 0,
  headingLeading: 1.0,
  density: 'comfortable',
  cornerStyle: 'rounded',
}

export const DEFAULT_OVERRIDES: Required<LandingOverrides> = {
  text: {},
  media: {},
  visible: {
    hero: true,
    value: true,
    trailer: true,
    curriculum: true,
    lessons: true,
    instructor: true,
    reviews: true,
    finalCta: true,
  },
  theme: { ...DEFAULT_THEME },
}

export function mergeOverrides(
  ov: LandingOverrides | null | undefined,
): Required<LandingOverrides> {
  return {
    text: { ...DEFAULT_OVERRIDES.text, ...(ov?.text ?? {}) },
    media: { ...DEFAULT_OVERRIDES.media, ...(ov?.media ?? {}) },
    visible: { ...DEFAULT_OVERRIDES.visible, ...(ov?.visible ?? {}) },
    theme: { ...DEFAULT_THEME, ...(ov?.theme ?? {}) } as LandingTheme,
  }
}

// ── Context ─────────────────────────────────────────────────────────────────

type Uploader = (file: File) => Promise<LandingMedia>

type EditorContextValue = {
  mode: EditorMode
  setMode: (m: EditorMode) => void
  device: EditorDevice
  setDevice: (d: EditorDevice) => void
  panel: EditorPanel
  setPanel: (p: EditorPanel) => void
  overrides: Required<LandingOverrides>
  t: (path: string, fallback: string) => string
  setText: (path: string, value: string) => void
  m: (id: string) => LandingMedia | null
  setMedia: (id: string, value: LandingMedia | null) => void
  isVisible: (id: string) => boolean
  setVisible: (id: string, visible: boolean) => void
  setTheme: (patch: Partial<LandingTheme>) => void
  uploadMedia: Uploader
  /** Per-slot override (lets host map specific slots to different endpoints). */
  uploaderForSlot?: (slotId: string) => Uploader
  reset: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  isUploading: boolean
}

const EditorContext = createContext<EditorContextValue | null>(null)

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor must be used inside EditorProvider')
  return ctx
}

// ── Provider ────────────────────────────────────────────────────────────────

export function EditorProvider({
  initialOverrides,
  onChange,
  uploadMedia,
  uploaderForSlot,
  isUploading = false,
  initialMode = 'edit',
  children,
}: {
  initialOverrides: LandingOverrides | null | undefined
  onChange: (next: Required<LandingOverrides>) => void
  uploadMedia: Uploader
  uploaderForSlot?: (slotId: string) => Uploader
  isUploading?: boolean
  initialMode?: EditorMode
  children: React.ReactNode
}) {
  const [mode, setMode] = useState<EditorMode>(initialMode)
  const [device, setDevice] = useState<EditorDevice>('desktop')
  const [panel, setPanel] = useState<EditorPanel>('design')

  // Stable seed: only re-seed when course changes (we don't want to clobber
  // local edits because of an unrelated re-render).
  const [overrides, setOverridesState] = useState<Required<LandingOverrides>>(
    () => mergeOverrides(initialOverrides),
  )

  // Re-seed when host swaps in a new initial blob (e.g. course refresh after
  // saving). We compare by JSON identity — cheap enough at this size.
  const seededRef = useRef(JSON.stringify(initialOverrides ?? null))
  useEffect(() => {
    const next = JSON.stringify(initialOverrides ?? null)
    if (next !== seededRef.current) {
      seededRef.current = next
      setOverridesState(mergeOverrides(initialOverrides))
    }
  }, [initialOverrides])

  // Undo/redo history
  const history = useRef<{ stack: string[]; idx: number }>({
    stack: [JSON.stringify(overrides)],
    idx: 0,
  })

  const apply = useCallback(
    (next: Required<LandingOverrides>) => {
      const h = history.current
      h.stack = h.stack.slice(0, h.idx + 1)
      h.stack.push(JSON.stringify(next))
      if (h.stack.length > 50) {
        h.stack.shift()
      } else {
        h.idx += 1
      }
      setOverridesState(next)
      onChange(next)
    },
    [onChange],
  )

  const t = useCallback(
    (path: string, fallback: string) => overrides.text[path] ?? fallback,
    [overrides.text],
  )

  const setText = useCallback(
    (path: string, value: string) => {
      apply({
        ...overrides,
        text: { ...overrides.text, [path]: value },
      })
    },
    [apply, overrides],
  )

  const m = useCallback(
    (id: string) => overrides.media[id] ?? null,
    [overrides.media],
  )

  const setMedia = useCallback(
    (id: string, value: LandingMedia | null) => {
      const nextMedia = { ...overrides.media }
      if (value === null) {
        delete nextMedia[id]
      } else {
        nextMedia[id] = value
      }
      apply({ ...overrides, media: nextMedia })
    },
    [apply, overrides],
  )

  const isVisible = useCallback(
    (id: string) => overrides.visible[id] !== false,
    [overrides.visible],
  )

  const setVisible = useCallback(
    (id: string, visible: boolean) => {
      apply({
        ...overrides,
        visible: { ...overrides.visible, [id]: visible },
      })
    },
    [apply, overrides],
  )

  const setTheme = useCallback(
    (patch: Partial<LandingTheme>) => {
      apply({
        ...overrides,
        theme: { ...overrides.theme, ...patch },
      })
    },
    [apply, overrides],
  )

  const reset = useCallback(() => {
    apply({ ...DEFAULT_OVERRIDES })
  }, [apply])

  const undo = useCallback(() => {
    const h = history.current
    if (h.idx <= 0) return
    h.idx -= 1
    const next = JSON.parse(h.stack[h.idx]) as Required<LandingOverrides>
    setOverridesState(next)
    onChange(next)
  }, [onChange])

  const redo = useCallback(() => {
    const h = history.current
    if (h.idx >= h.stack.length - 1) return
    h.idx += 1
    const next = JSON.parse(h.stack[h.idx]) as Required<LandingOverrides>
    setOverridesState(next)
    onChange(next)
  }, [onChange])

  // Apply theme to CSS vars on the document root. The vars are scoped to a
  // single editor canvas via [data-spaire-editor] so multiple editors can
  // coexist (dashboard + wizard).
  useEffect(() => {
    const acc =
      ACCENT_PRESETS.find((a) => a.id === overrides.theme.accentId) ??
      ACCENT_PRESETS[0]
    const surf =
      SURFACE_MODES.find((s) => s.id === overrides.theme.surfaceId) ??
      SURFACE_MODES[0]
    const fontH =
      FONT_PAIRS.find((f) => f.id === overrides.theme.fontHeading) ??
      FONT_PAIRS[0]
    const fontB =
      FONT_PAIRS.find((f) => f.id === overrides.theme.fontBody) ?? FONT_PAIRS[0]

    const t = overrides.theme

    const radMul: Record<NonNullable<LandingTheme['cornerStyle']>, number> = {
      sharp: 0.25,
      rounded: 1,
      pill: 1.6,
    }
    const dens: Record<NonNullable<LandingTheme['density']>, number> = {
      compact: 0.8,
      comfortable: 1,
      spacious: 1.2,
    }
    const cornerKey = t.cornerStyle ?? 'rounded'
    const densityKey = t.density ?? 'comfortable'

    const styleId = 'spaire-editor-theme-vars'
    let style = document.getElementById(styleId) as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = styleId
      document.head.appendChild(style)
    }
    style.textContent = `
      [data-spaire-editor] {
        --accent: ${acc.accent};
        --accent-2: ${acc.accent2};
        --bg-0: ${surf.bg0};
        --fg-0: ${surf.fg0};
        --font-heading: ${fontH.family};
        --font-body: ${fontB.family};
        --type-scale: ${t.typeScale};
        --h-weight: ${t.headingWeight};
        --b-weight: ${t.bodyWeight};
        --h-italic: ${t.headingItalic ? 'italic' : 'normal'};
        --h-align: ${t.headingAlign};
        --h-tracking: ${t.headingTracking}em;
        --h-leading: ${t.headingLeading};
        --radius-mul: ${radMul[cornerKey]};
        --density: ${dens[densityKey]};
      }
      [data-spaire-editor] [data-spaire-h] {
        font-family: var(--font-heading) !important;
        font-weight: var(--h-weight) !important;
        font-style: var(--h-italic) !important;
        text-align: var(--h-align) !important;
        letter-spacing: var(--h-tracking) !important;
        line-height: calc(var(--h-leading) * 1.05) !important;
      }
      [data-spaire-editor] [data-spaire-h-scale] {
        font-size: calc(var(--_h-base, 1em) * var(--type-scale)) !important;
      }
      [data-spaire-editor] {
        font-family: var(--font-body);
        font-weight: var(--b-weight);
        background: var(--bg-0);
        color: var(--fg-0);
      }
    `

    // Lazy-load Google Fonts
    ;[fontH, fontB].forEach((f) => {
      if (!f.google) return
      const id = `gfont-${f.id}`
      if (document.getElementById(id)) return
      const l = document.createElement('link')
      l.id = id
      l.rel = 'stylesheet'
      l.href = `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`
      document.head.appendChild(l)
    })
  }, [overrides.theme])

  // device class for responsive overrides
  useEffect(() => {
    document.body.classList.remove('spaire-device-desktop', 'spaire-device-tablet', 'spaire-device-mobile')
    document.body.classList.add(`spaire-device-${device}`)
    return () => {
      document.body.classList.remove(`spaire-device-${device}`)
    }
  }, [device])

  const value = useMemo<EditorContextValue>(
    () => ({
      mode,
      setMode,
      device,
      setDevice,
      panel,
      setPanel,
      overrides,
      t,
      setText,
      m,
      setMedia,
      isVisible,
      setVisible,
      setTheme,
      uploadMedia,
      uploaderForSlot,
      reset,
      undo,
      redo,
      canUndo: history.current.idx > 0,
      canRedo: history.current.idx < history.current.stack.length - 1,
      isUploading,
    }),
    [
      mode,
      device,
      panel,
      overrides,
      t,
      setText,
      m,
      setMedia,
      isVisible,
      setVisible,
      setTheme,
      uploadMedia,
      uploaderForSlot,
      reset,
      undo,
      redo,
      isUploading,
    ],
  )

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}
