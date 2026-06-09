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

import type {
  LandingMedia,
  LandingOverrides,
  LandingTextFormat,
  LandingTheme,
} from '@/hooks/queries/courses'
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
  // The base canvas for the Spaire Originals course landing. Warm off-white
  // (#F2F1EE) with near-black ink (#1D1D1F) — mirrors the Apple TV / Fitness+
  // product-page design. This is the default surface, so every course that
  // hasn't explicitly picked another theme renders on it.
  { id: 'light', label: 'Light', bg0: '#F2F1EE', fg0: '#1D1D1F' },
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
  // 'subtle' fade+rise on viewport entry — light enough that nothing feels
  // gimmicky, present enough that the page doesn't feel static.
  motion: 'subtle',
}

export const SECTION_ORDER_DEFAULT = [
  'hero',
  'createdBy',
  'learn',
  'sample',
  'sections',
  'value',
  'trailer',
  'curriculum',
  'lessons',
  'instructor',
  'reviews',
  'faq',
  'finalCta',
] as const

// Labels for every section id the editor knows about. The hover pill on the
// canvas, the hidden-sections popover, the add-section catalog, and the
// undo-toast all read from here so labels stay in sync. If a new section is
// added to the landing render, add its id + label here.
export const SECTION_LABELS: Record<string, string> = {
  hero: 'Hero',
  sample: 'Episode sample',
  sections: 'Sections',
  lessons: 'Free preview',
  createdBy: 'Created by',
  learn: "What you'll learn",
  instructor: 'Instructor',
  reviews: 'Reviews',
  faq: 'FAQ',
  finalCta: 'Final CTA',
  // Legacy ids still present in DEFAULT_OVERRIDES.visible but no longer
  // rendered by the canvas. Labelled defensively for old saved states.
  value: "What's included",
  trailer: 'Trailer',
  curriculum: 'Curriculum',
}

// Sections that can be re-inserted from the add-section catalog. Excludes
// the legacy ids above so the catalog doesn't surface dead options.
export const ADDABLE_SECTION_IDS: readonly string[] = [
  'hero',
  'sample',
  'sections',
  'lessons',
  'createdBy',
  'learn',
  'instructor',
  'reviews',
  'faq',
  'finalCta',
]

export type ResolvedOverrides = {
  text: Record<string, string>
  media: Record<string, NonNullable<LandingOverrides['media']>[string]>
  visible: Record<string, boolean>
  order: string[]
  theme: LandingTheme
  textFormat: Record<string, LandingTextFormat>
  spacingBefore: Record<string, number>
}

export const DEFAULT_OVERRIDES: ResolvedOverrides = {
  text: {},
  media: {},
  visible: {
    hero: true,
    value: true,
    trailer: true,
    curriculum: true,
    sections: true,
    lessons: true,
    createdBy: true,
    learn: true,
    instructor: true,
    reviews: true,
    faq: true,
    finalCta: true,
  },
  order: [...SECTION_ORDER_DEFAULT],
  theme: { ...DEFAULT_THEME },
  textFormat: {},
  spacingBefore: {},
}

export function mergeOverrides(
  ov: LandingOverrides | null | undefined,
): ResolvedOverrides {
  // Sanitize the saved order: keep only known section ids, drop dupes, and
  // splice any missing ones into the slot they occupy in SECTION_ORDER_DEFAULT
  // (rather than dumping them at the end). That way new sections we add later
  // — like `sections`, which sits right after `hero` — show up in the right
  // position for users with an existing saved order.
  const knownIds = new Set<string>(SECTION_ORDER_DEFAULT)
  const seen = new Set<string>()
  const cleaned: string[] = []
  for (const id of ov?.order ?? []) {
    if (knownIds.has(id) && !seen.has(id)) {
      cleaned.push(id)
      seen.add(id)
    }
  }
  for (let i = 0; i < SECTION_ORDER_DEFAULT.length; i++) {
    const id = SECTION_ORDER_DEFAULT[i]
    if (seen.has(id)) continue
    // Find the nearest preceding default id that is already in `cleaned`,
    // and insert this id right after it. If none, prepend.
    let insertAt = 0
    for (let j = i - 1; j >= 0; j--) {
      const idx = cleaned.indexOf(SECTION_ORDER_DEFAULT[j])
      if (idx !== -1) {
        insertAt = idx + 1
        break
      }
    }
    cleaned.splice(insertAt, 0, id)
    seen.add(id)
  }
  return {
    text: { ...DEFAULT_OVERRIDES.text, ...(ov?.text ?? {}) },
    media: { ...DEFAULT_OVERRIDES.media, ...(ov?.media ?? {}) },
    visible: { ...DEFAULT_OVERRIDES.visible, ...(ov?.visible ?? {}) },
    order: cleaned,
    theme: { ...DEFAULT_THEME, ...(ov?.theme ?? {}) },
    textFormat: { ...DEFAULT_OVERRIDES.textFormat, ...(ov?.textFormat ?? {}) },
    spacingBefore: {
      ...DEFAULT_OVERRIDES.spacingBefore,
      ...(ov?.spacingBefore ?? {}),
    },
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
  overrides: ResolvedOverrides
  t: (path: string, fallback: string) => string
  setText: (path: string, value: string) => void
  m: (id: string) => LandingMedia | null
  setMedia: (id: string, value: LandingMedia | null) => void
  isVisible: (id: string) => boolean
  setVisible: (id: string, visible: boolean) => void
  setOrder: (order: string[]) => void
  // Per-text-element formatting. Patch-style: pass only the fields you want
  // to change. Pass `null` for the entire format to clear all overrides for
  // that path (the toolbar Reset button uses this).
  setTextFormat: (
    path: string,
    patch: Partial<LandingTextFormat> | null,
  ) => void
  // Per-section "extra gap before" in pixels. Pass `null` to clear.
  setSpacingBefore: (id: string, value: number | null) => void
  /**
   * Remove a section so it stops rendering entirely. We drop the id from
   * `order` AND set `visible[id]=false` defensively so a stale `visible=true`
   * doesn't make the section re-appear if the id ever lands back in `order`.
   * Single history frame — `undo()` restores both fields together.
   */
  deleteSection: (id: string) => void
  /**
   * Add a section back into `order`. Inserts at `atIndex` (default: append)
   * and flips `visible[id]=true` so the user actually sees it. Single history
   * frame.
   */
  insertSection: (id: string, atIndex?: number) => void
  setTheme: (patch: Partial<LandingTheme>) => void
  uploadMedia: Uploader
  /** Per-slot override (lets host map specific slots to different endpoints). */
  uploaderForSlot?: (slotId: string) => Uploader
  reset: () => void
  /**
   * Replace the entire overrides blob in a single history frame. Used by
   * "Discard changes" to restore the snapshot the editor was seeded with,
   * without exploding the undo stack into one frame per field.
   */
  restore: (target: ResolvedOverrides) => void
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
  onChange: (next: ResolvedOverrides) => void
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
  const [overrides, setOverridesState] = useState<ResolvedOverrides>(() =>
    mergeOverrides(initialOverrides),
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
    (next: ResolvedOverrides) => {
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

  const setOrder = useCallback(
    (order: string[]) => {
      apply({ ...overrides, order })
    },
    [apply, overrides],
  )

  const deleteSection = useCallback(
    (id: string) => {
      const nextOrder = overrides.order.filter((x) => x !== id)
      if (
        nextOrder.length === overrides.order.length &&
        overrides.visible[id] === false
      ) {
        // Already absent and already hidden — nothing to do.
        return
      }
      apply({
        ...overrides,
        order: nextOrder,
        visible: { ...overrides.visible, [id]: false },
      })
    },
    [apply, overrides],
  )

  const insertSection = useCallback(
    (id: string, atIndex?: number) => {
      // Strip any existing occurrence first so we never end up with the same
      // id twice in `order` (which would break dnd-kit's SortableContext key
      // uniqueness and cause React key warnings).
      const without = overrides.order.filter((x) => x !== id)
      const idx =
        atIndex == null
          ? without.length
          : Math.max(0, Math.min(without.length, atIndex))
      const nextOrder = [...without.slice(0, idx), id, ...without.slice(idx)]
      apply({
        ...overrides,
        order: nextOrder,
        visible: { ...overrides.visible, [id]: true },
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

  const setTextFormat = useCallback(
    (path: string, patch: Partial<LandingTextFormat> | null) => {
      const nextMap = { ...overrides.textFormat }
      if (patch === null) {
        delete nextMap[path]
      } else {
        const current = overrides.textFormat[path] ?? {}
        const merged: LandingTextFormat = { ...current, ...patch }
        // Strip undefined-valued keys so cleared toggles don't linger in the
        // saved payload — keeps landing_overrides small and behaviour
        // explicit ("absent === inherit from template").
        const cleaned: LandingTextFormat = {}
        for (const [k, v] of Object.entries(merged)) {
          if (v !== undefined) (cleaned as Record<string, unknown>)[k] = v
        }
        if (Object.keys(cleaned).length === 0) {
          delete nextMap[path]
        } else {
          nextMap[path] = cleaned
        }
      }
      apply({ ...overrides, textFormat: nextMap })
    },
    [apply, overrides],
  )

  const setSpacingBefore = useCallback(
    (id: string, value: number | null) => {
      const nextMap = { ...overrides.spacingBefore }
      if (value === null || value === 0) {
        delete nextMap[id]
      } else {
        nextMap[id] = value
      }
      apply({ ...overrides, spacingBefore: nextMap })
    },
    [apply, overrides],
  )

  const reset = useCallback(() => {
    apply({ ...DEFAULT_OVERRIDES })
  }, [apply])

  const restore = useCallback(
    (target: ResolvedOverrides) => {
      // Deep-clone so callers can't accidentally mutate the snapshot through
      // their own reference once it's in the history stack.
      apply(JSON.parse(JSON.stringify(target)) as ResolvedOverrides)
    },
    [apply],
  )

  const undo = useCallback(() => {
    const h = history.current
    if (h.idx <= 0) return
    h.idx -= 1
    const next = JSON.parse(h.stack[h.idx]) as ResolvedOverrides
    setOverridesState(next)
    onChange(next)
  }, [onChange])

  const redo = useCallback(() => {
    const h = history.current
    if (h.idx >= h.stack.length - 1) return
    h.idx += 1
    const next = JSON.parse(h.stack[h.idx]) as ResolvedOverrides
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

    // Site CSP blocks fonts.gstatic.com — fall back to system fonts and the
    // app-bundled families. Designers can still pick a family in the panel;
    // the browser substitutes when it isn't available.
  }, [overrides.theme])

  // device class for responsive overrides
  useEffect(() => {
    document.body.classList.remove(
      'spaire-device-desktop',
      'spaire-device-tablet',
      'spaire-device-mobile',
    )
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
      setOrder,
      deleteSection,
      insertSection,
      setTheme,
      setTextFormat,
      setSpacingBefore,
      uploadMedia,
      uploaderForSlot,
      reset,
      restore,
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
      setOrder,
      deleteSection,
      insertSection,
      setTheme,
      setTextFormat,
      setSpacingBefore,
      uploadMedia,
      uploaderForSlot,
      reset,
      restore,
      undo,
      redo,
      isUploading,
    ],
  )

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  )
}
