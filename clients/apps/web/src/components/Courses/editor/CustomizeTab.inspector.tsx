'use client'

// Right-side inspector panel for the customize editor. Hosts the five panels
// (Design / Content / Media / Sections / AI). Kept in its own file to keep
// CustomizeTab.tsx scannable.

import {
  ACCENT_PRESETS,
  FONT_PAIRS,
  SECTIONS,
  SURFACE_MODES,
  mergeTheme,
  setMedia as configSetMedia,
  setText as configSetText,
  setTheme as configSetTheme,
  setVisible as configSetVisible,
  type LandingConfig,
  type LandingMedia,
  type LandingSectionId,
} from '../landingConfig'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import { useRef, useState } from 'react'
import { ThumbnailPositioner } from './ThumbnailPositioner'

type PanelId = 'design' | 'content' | 'media' | 'sections' | 'ai'

export function Inspector(props: {
  panel: PanelId
  draft: LandingConfig
  setDraft: React.Dispatch<React.SetStateAction<LandingConfig>>
  title: string
  setTitle: (v: string) => void
  description: string
  setDescription: (v: string) => void
  instructorName: string
  setInstructorName: (v: string) => void
  instructorBio: string
  setInstructorBio: (v: string) => void
  trailerUrl: string
  setTrailerUrl: (v: string) => void
  thumbnailUrl: string | null
  thumbnailPosition: string | null
  setThumbnailPosition: (v: string | null) => void
  uploading: boolean
  onPickThumbnail: () => void
}) {
  const { panel } = props
  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-gray-200 bg-white">
      <div className="flex h-12 items-center justify-between border-b border-gray-100 px-4">
        <span className="text-sm font-semibold text-gray-900">
          {labelForPanel(panel)}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-3">
        {panel === 'design' && <DesignPanel {...props} />}
        {panel === 'content' && <ContentPanel {...props} />}
        {panel === 'media' && <MediaPanel {...props} />}
        {panel === 'sections' && <SectionsPanel {...props} />}
        {panel === 'ai' && <AIPanel {...props} />}
      </div>
    </aside>
  )
}

function labelForPanel(p: PanelId): string {
  return {
    design: 'Design',
    content: 'Content',
    media: 'Media',
    sections: 'Sections',
    ai: 'AI assist',
  }[p]
}

// ─── Design panel: typography, layout, surface ─────────────────────────────

function DesignPanel({
  draft,
  setDraft,
}: {
  draft: LandingConfig
  setDraft: React.Dispatch<React.SetStateAction<LandingConfig>>
}) {
  const t = mergeTheme(draft.theme)
  const set = (patch: Partial<typeof t>) =>
    setDraft((d) => configSetTheme(d, patch))

  return (
    <div className="flex flex-col gap-4 px-4">
      <Group title="Type families">
        <Field label="Heading font">
          <select
            value={t.fontHeading}
            onChange={(e) => set({ fontHeading: e.target.value })}
            className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900"
          >
            {FONT_PAIRS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Body font">
          <select
            value={t.fontBody}
            onChange={(e) => set({ fontBody: e.target.value })}
            className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900"
          >
            {FONT_PAIRS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
      </Group>

      <Group title="Heading style">
        <Field label="Weight">
          <Seg
            value={t.headingWeight}
            options={[
              { v: 300, label: 'Light' },
              { v: 400, label: 'Reg' },
              { v: 600, label: 'Semi' },
              { v: 700, label: 'Bold' },
              { v: 800, label: 'Black' },
            ]}
            onChange={(v) => set({ headingWeight: v })}
          />
        </Field>
        <Field label="Style">
          <div className="flex gap-2">
            <ToggleBtn
              on={!t.headingItalic}
              onClick={() => set({ headingItalic: false })}
              label="Aa"
            />
            <ToggleBtn
              on={t.headingItalic}
              onClick={() => set({ headingItalic: true })}
              label="Aa"
              italic
            />
          </div>
        </Field>
        <Field label="Alignment">
          <Seg
            value={t.headingAlign}
            options={[
              { v: 'left', label: 'Left' },
              { v: 'center', label: 'Center' },
              { v: 'right', label: 'Right' },
            ]}
            onChange={(v) => set({ headingAlign: v })}
          />
        </Field>
        <Slider
          label="Size scale"
          suffix="×"
          min={0.8}
          max={1.3}
          step={0.05}
          value={t.typeScale}
          onChange={(v) => set({ typeScale: v })}
        />
        <Slider
          label="Letter spacing"
          suffix="em"
          min={-0.06}
          max={0.06}
          step={0.005}
          value={t.headingTracking}
          onChange={(v) => set({ headingTracking: v })}
        />
        <Slider
          label="Line height"
          suffix="×"
          min={0.85}
          max={1.4}
          step={0.02}
          value={t.headingLeading}
          onChange={(v) => set({ headingLeading: v })}
        />
      </Group>

      <Group title="Body style">
        <Field label="Weight">
          <Seg
            value={t.bodyWeight}
            options={[
              { v: 300, label: 'Light' },
              { v: 400, label: 'Reg' },
              { v: 500, label: 'Med' },
              { v: 600, label: 'Semi' },
            ]}
            onChange={(v) => set({ bodyWeight: v })}
          />
        </Field>
      </Group>

      <Group title="Layout">
        <Field label="Density">
          <Seg
            value={t.density}
            options={[
              { v: 'compact', label: 'Compact' },
              { v: 'comfortable', label: 'Comfy' },
              { v: 'spacious', label: 'Spacious' },
            ]}
            onChange={(v) => set({ density: v })}
          />
        </Field>
        <Field label="Corners">
          <Seg
            value={t.cornerStyle}
            options={[
              { v: 'sharp', label: 'Sharp' },
              { v: 'rounded', label: 'Rounded' },
              { v: 'pill', label: 'Pill' },
            ]}
            onChange={(v) => set({ cornerStyle: v })}
          />
        </Field>
      </Group>

      <Group title="Surface">
        <Field label="Background">
          <div className="flex flex-wrap gap-1.5">
            {SURFACE_MODES.map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => set({ surfaceId: s.id })}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${
                  t.surfaceId === s.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <span
                  className="h-3 w-3 rounded-sm border border-gray-200"
                  style={{ background: s.bg0 }}
                />
                {s.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Accent">
          <div className="flex flex-wrap gap-2">
            {ACCENT_PRESETS.map((a) => (
              <button
                type="button"
                key={a.id}
                title={a.label}
                onClick={() => set({ accentId: a.id })}
                className="h-7 w-7 rounded-full"
                style={{
                  background: `linear-gradient(135deg, ${a.accent}, ${a.accent2})`,
                  outline:
                    t.accentId === a.id ? '2px solid rgb(37,99,235)' : 'none',
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
        </Field>
      </Group>
    </div>
  )
}

// ─── Content panel: copy that ends up in landing_config.text ──────────────

function ContentPanel({
  draft,
  setDraft,
  title,
  setTitle,
  description,
  setDescription,
  instructorName,
  setInstructorName,
  instructorBio,
  setInstructorBio,
}: {
  draft: LandingConfig
  setDraft: React.Dispatch<React.SetStateAction<LandingConfig>>
  title: string
  setTitle: (v: string) => void
  description: string
  setDescription: (v: string) => void
  instructorName: string
  setInstructorName: (v: string) => void
  instructorBio: string
  setInstructorBio: (v: string) => void
}) {
  const setT = (path: string, value: string) =>
    setDraft((d) => configSetText(d, path, value))
  const valT = (path: string, fallback: string) =>
    draft.text?.[path] ?? fallback

  return (
    <div className="flex flex-col gap-4 px-4">
      <Group title="Course basics">
        <Field label="Title">
          <Input value={title} onChange={setTitle} />
        </Field>
        <Field label="Description">
          <TextArea
            value={description}
            onChange={setDescription}
            rows={3}
          />
        </Field>
        <Field label="Instructor name">
          <Input value={instructorName} onChange={setInstructorName} />
        </Field>
        <Field label="Instructor bio">
          <TextArea value={instructorBio} onChange={setInstructorBio} rows={2} />
        </Field>
      </Group>
      <Group title="Hero copy">
        <Field label="Eyebrow">
          <Input
            value={valT('hero.eyebrow', '')}
            placeholder="SPAIRE ORIGINAL"
            onChange={(v) => setT('hero.eyebrow', v)}
          />
        </Field>
        <Field label="Series label">
          <Input
            value={valT('hero.series_label', '')}
            placeholder="NEW SERIES"
            onChange={(v) => setT('hero.series_label', v)}
          />
        </Field>
        <Field label="Tagline">
          <TextArea
            value={valT('hero.tagline', '')}
            onChange={(v) => setT('hero.tagline', v)}
            rows={2}
          />
        </Field>
        <Field label="Level">
          <Input
            value={valT('hero.level', '')}
            placeholder="All levels"
            onChange={(v) => setT('hero.level', v)}
          />
        </Field>
      </Group>
      <Group title="Trailer">
        <Field label="Section label">
          <Input
            value={valT('trailer.label', '')}
            placeholder="OFFICIAL TRAILER"
            onChange={(v) => setT('trailer.label', v)}
          />
        </Field>
        <Field label="Section heading">
          <Input
            value={valT('trailer.heading', '')}
            placeholder="Watch the trailer"
            onChange={(v) => setT('trailer.heading', v)}
          />
        </Field>
      </Group>
      <p className="px-1 text-[11px] leading-relaxed text-gray-500">
        Tip — click any text on the canvas to edit it in place. The Trailer
        section appears on the live landing as soon as a trailer media or URL
        is set.
      </p>
    </div>
  )
}

// ─── Media panel ───────────────────────────────────────────────────────────

const MEDIA_SLOTS: { id: string; label: string; hint: string }[] = [
  { id: 'hero.backdrop', label: 'Hero backdrop', hint: 'Image or video' },
  { id: 'trailer.video', label: 'Trailer video', hint: 'mp4/webm — autoplays muted' },
  { id: 'finalCta.backdrop', label: 'Final CTA backdrop', hint: 'Image or video' },
  { id: 'instructor.portrait', label: 'Instructor portrait', hint: 'Square or 4:5' },
]

function MediaPanel({
  draft,
  setDraft,
  thumbnailUrl,
  thumbnailPosition,
  setThumbnailPosition,
  uploading,
  onPickThumbnail,
}: {
  draft: LandingConfig
  setDraft: React.Dispatch<React.SetStateAction<LandingConfig>>
  thumbnailUrl: string | null
  thumbnailPosition: string | null
  setThumbnailPosition: (v: string | null) => void
  uploading: boolean
  onPickThumbnail: () => void
}) {
  const setSlot = (id: string, value: LandingMedia) =>
    setDraft((d) => configSetMedia(d, id, value))
  return (
    <div className="flex flex-col gap-4 px-4">
      <Group title="Course thumbnail">
        {thumbnailUrl ? (
          <div className="flex flex-col gap-2">
            <ThumbnailPositioner
              src={thumbnailUrl}
              value={thumbnailPosition}
              onChange={setThumbnailPosition}
            />
            <button
              type="button"
              onClick={onPickThumbnail}
              disabled={uploading}
              className="self-end rounded-full bg-gray-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Replace image'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onPickThumbnail}
            disabled={uploading}
            className="flex w-full items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-white p-3 text-left hover:border-gray-400 hover:bg-gray-50"
          >
            <div className="flex h-10 w-14 items-center justify-center rounded-md bg-gray-100">
              <ImageOutlined className="text-gray-300" sx={{ fontSize: 18 }} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-700">
                {uploading ? 'Uploading…' : 'Upload thumbnail'}
              </p>
              <p className="text-[10px] text-gray-400">JPG, PNG or WebP</p>
            </div>
          </button>
        )}
      </Group>

      <Group title="Landing media slots">
        {MEDIA_SLOTS.map((s) => (
          <MediaSlotRow
            key={s.id}
            id={s.id}
            label={s.label}
            hint={s.hint}
            value={draft.media?.[s.id] ?? null}
            onChange={(v) => setSlot(s.id, v)}
          />
        ))}
      </Group>
      <p className="px-1 text-[11px] leading-relaxed text-gray-500">
        Drop an image or video into any slot above — or hover the area on the
        canvas, the same control appears there.
      </p>
    </div>
  )
}

function MediaSlotRow({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string
  label: string
  hint: string
  value: LandingMedia
  onChange: (v: LandingMedia) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const url = URL.createObjectURL(f)
    const k: 'image' | 'video' = f.type.startsWith('video') ? 'video' : 'image'
    onChange({ kind: k, url, name: f.name })
    e.target.value = ''
  }
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
        {value?.kind === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value.url}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
        {value?.kind === 'video' && (
          <video
            src={value.url}
            muted
            loop
            autoPlay
            playsInline
            className="h-full w-full object-cover"
          />
        )}
        {!value && (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <ImageOutlined sx={{ fontSize: 14 }} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-gray-900">
          {label}
        </div>
        <div className="truncate text-[10px] text-gray-400">
          {value?.name ?? hint}
        </div>
      </div>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
        title="Upload"
      >
        <CloudUploadOutlined sx={{ fontSize: 14 }} />
      </button>
      <button
        type="button"
        onClick={() => {
          const url = window.prompt('Paste an image or video URL:')
          if (!url) return
          const isVid = /\.(mp4|webm|mov)(\?|$)/i.test(url)
          onChange({ kind: isVid ? 'video' : 'image', url, name: 'remote' })
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
        title="Paste URL"
      >
        <LinkOutlined sx={{ fontSize: 14 }} />
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-red-50 hover:text-red-600"
          title="Remove"
        >
          <DeleteOutline sx={{ fontSize: 14 }} />
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={onFile}
      />
    </div>
  )
}

// ─── Sections panel ────────────────────────────────────────────────────────

function SectionsPanel({
  draft,
  setDraft,
}: {
  draft: LandingConfig
  setDraft: React.Dispatch<React.SetStateAction<LandingConfig>>
}) {
  const setVis = (id: LandingSectionId, v: boolean) =>
    setDraft((d) => configSetVisible(d, id, v))
  return (
    <div className="flex flex-col gap-2 px-4">
      <p className="px-1 pb-1 text-[11px] leading-relaxed text-gray-500">
        Toggle which sections show on the public landing.
      </p>
      {SECTIONS.map((s) => {
        const on = draft.visible?.[s.id] !== false
        return (
          <div
            key={s.id}
            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50"
          >
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-gray-900">
                {s.label}
              </div>
              <div className="text-[10px] text-gray-500">{s.hint}</div>
            </div>
            <button
              type="button"
              onClick={() => setVis(s.id, !on)}
              className="relative h-5 w-9 rounded-full transition-colors"
              style={{ background: on ? 'oklch(0.55 0.20 265)' : '#e4e4e7' }}
            >
              <span
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow"
                style={{
                  left: on ? 18 : 2,
                  transition: 'left 150ms ease',
                }}
              />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ─── AI panel (rewrite tagline) ───────────────────────────────────────────

function AIPanel({
  draft,
  setDraft,
}: {
  draft: LandingConfig
  setDraft: React.Dispatch<React.SetStateAction<LandingConfig>>
}) {
  const [input, setInput] = useState('Make the tagline punchier')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const current = draft.text?.['hero.tagline'] ?? ''

  const run = async () => {
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/ai/landing-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current, goal: input }),
      })
      if (!res.ok) throw new Error('AI unavailable')
      const data = (await res.json()) as { text: string }
      setResult(data.text.trim().replace(/^["']|["']$/g, ''))
    } catch {
      setResult('(AI unavailable in this preview)')
    }
    setBusy(false)
  }

  const apply = () => {
    if (result) setDraft((d) => configSetText(d, 'hero.tagline', result))
    setResult(null)
  }

  return (
    <div className="flex flex-col gap-3 px-4">
      <div
        className="rounded-xl border p-3"
        style={{
          background:
            'linear-gradient(135deg, oklch(0.96 0.04 280), oklch(0.95 0.05 320))',
          borderColor: 'oklch(0.90 0.04 280)',
        }}
      >
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-violet-700">
          <AutoAwesomeOutlined sx={{ fontSize: 13 }} />
          Rewrite the tagline
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          className="mb-2 w-full rounded-md border border-violet-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none"
          placeholder="Make it punchier, add urgency, etc."
        />
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {busy ? 'Thinking…' : 'Generate'}
        </button>
      </div>
      {result && (
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Suggestion
          </div>
          <div className="mb-3 text-sm leading-relaxed text-gray-900">
            {result}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={apply}
              className="flex-1 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-gray-500">
        AI can also draft chapter blurbs or generate a theme — coming soon.
      </p>
    </div>
  )
}

// ─── Field primitives ─────────────────────────────────────────────────────

function Group({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-gray-100 pb-4 last:border-none">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">
        {title}
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-gray-500">{label}</span>
      {children}
    </label>
  )
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/8"
    />
  )
}

function TextArea({
  value,
  onChange,
  rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs leading-relaxed text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/8"
    />
  )
}

function Seg<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { v: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-0.5 rounded-md bg-gray-100 p-0.5">
      {options.map((o) => {
        const on = o.v === value
        return (
          <button
            type="button"
            key={String(o.v)}
            onClick={() => onChange(o.v)}
            className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              on
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function ToggleBtn({
  on,
  onClick,
  label,
  italic,
}: {
  on: boolean
  onClick: () => void
  label: string
  italic?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 w-9 items-center justify-center rounded-md border text-xs transition-colors ${
        on
          ? 'border-gray-900 bg-gray-900 text-white'
          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
      }`}
      style={{
        fontStyle: italic ? 'italic' : 'normal',
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  )
}

function Slider({
  label,
  suffix,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string
  suffix: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <Field
      label={
        <span className="flex justify-between">
          <span>{label}</span>
          <span className="font-mono tabular-nums text-gray-400">
            {value.toFixed(step < 0.01 ? 3 : 2)}
            {suffix}
          </span>
        </span>
      }
    >
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </Field>
  )
}
