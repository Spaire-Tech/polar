'use client'

// EditorShell — the toolbar + left rail + canvas + right inspector layout.
// Hosted by both the dashboard CustomizeTab and the onboarding wizard preview.
// All state lives on the EditorProvider above; this component is pure chrome.

import {
  ACCENT_PRESETS,
  FONT_PAIRS,
  SURFACE_MODES,
  useEditor,
  type EditorPanel,
} from './EditorContext'
import type { LandingMedia } from '@/hooks/queries/courses'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRef, useState, type ReactNode } from 'react'

const RAIL_ITEMS: { id: EditorPanel; label: string; icon: string }[] = [
  { id: 'design', label: 'Design', icon: '✨' },
  { id: 'content', label: 'Content', icon: '✎' },
  { id: 'media', label: 'Media', icon: '🖼' },
  { id: 'sections', label: 'Sections', icon: '☰' },
  { id: 'ai', label: 'AI', icon: '✦' },
]

export function EditorShell({
  brandLabel,
  breadcrumb,
  organizationSlug,
  onSave,
  onPublish,
  onReset,
  saving,
  dirty,
  canPublish = true,
  saveLabel,
  publishLabel,
  hideSave = false,
  children,
}: {
  brandLabel?: string
  breadcrumb: { course: string }
  organizationSlug?: string
  onSave: () => void
  onPublish?: () => void
  onReset?: () => void
  saving?: boolean
  dirty?: boolean
  canPublish?: boolean
  saveLabel?: string
  publishLabel?: string
  hideSave?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex h-full flex-col bg-[oklch(0.96_0.005_280)]">
      <Toolbar
        brandLabel={brandLabel}
        breadcrumb={breadcrumb}
        onSave={onSave}
        onPublish={onPublish}
        onReset={onReset}
        saving={saving}
        dirty={dirty}
        canPublish={canPublish}
        saveLabel={saveLabel}
        publishLabel={publishLabel}
        hideSave={hideSave}
      />
      <div className="flex flex-1 overflow-hidden">
        <LeftRail />
        <Canvas>{children}</Canvas>
        <Inspector organizationSlug={organizationSlug} />
      </div>
    </div>
  )
}

// ── Toolbar ────────────────────────────────────────────────────────────────

function Toolbar({
  brandLabel,
  breadcrumb,
  onSave,
  onPublish,
  onReset,
  saving,
  dirty,
  canPublish,
  saveLabel = 'Save draft',
  publishLabel = 'Publish',
  hideSave = false,
}: {
  brandLabel?: string
  breadcrumb: { course: string }
  onSave: () => void
  onPublish?: () => void
  onReset?: () => void
  saving?: boolean
  dirty?: boolean
  canPublish?: boolean
  saveLabel?: string
  publishLabel?: string
  hideSave?: boolean
}) {
  const ed = useEditor()
  return (
    <div className="flex h-14 flex-shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] bg-[oklch(0.18_0.01_280)] px-4 text-white">
      {/* Brand + breadcrumb */}
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-[oklch(0.78_0.16_285)]" aria-hidden>
          ◐
        </span>
        <span className="text-[14px] font-semibold tracking-tight">
          {brandLabel ?? 'Spaire Studio'}
        </span>
        <span className="mx-1 h-[18px] w-px bg-white/10" />
        <span className="text-[12px] text-white/55">Course landing</span>
        <span className="mx-1 text-[13px] text-white/40">›</span>
        <span className="truncate text-[12px] font-medium text-white">
          {breadcrumb.course}
        </span>
      </div>

      {/* Mode + device + undo/redo */}
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5 rounded-full bg-white/[0.06] p-[3px]">
          {(['edit', 'preview'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => ed.setMode(m)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[12px] font-medium transition-colors ${
                ed.mode === m
                  ? 'bg-white text-[oklch(0.18_0.01_280)]'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              {m === 'edit' ? '✎' : '👁'} {m === 'edit' ? 'Edit' : 'Preview'}
            </button>
          ))}
        </div>

        <span className="h-[18px] w-px bg-white/10" />

        <div className="flex gap-0.5">
          {(['desktop', 'tablet', 'mobile'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => ed.setDevice(d)}
              title={d}
              className={`flex h-7 w-8 items-center justify-center rounded-md text-[13px] transition-colors ${
                ed.device === d
                  ? 'bg-white/10 text-white'
                  : 'text-white/55 hover:text-white'
              }`}
            >
              {d === 'desktop' ? '🖥' : d === 'tablet' ? '⊟' : '▯'}
            </button>
          ))}
        </div>

        <span className="h-[18px] w-px bg-white/10" />

        <button
          type="button"
          onClick={ed.undo}
          disabled={!ed.canUndo}
          title="Undo"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[14px] text-white/70 hover:text-white disabled:opacity-30"
        >
          ↶
        </button>
        <button
          type="button"
          onClick={ed.redo}
          disabled={!ed.canRedo}
          title="Redo"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[14px] text-white/70 hover:text-white disabled:opacity-30"
        >
          ↷
        </button>
      </div>

      {/* Reset / Save / Publish */}
      <div className="flex items-center gap-1.5">
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="rounded-md px-3 py-[7px] text-[12px] font-medium text-white/70 transition-colors hover:text-white"
          >
            Reset
          </button>
        )}
        {!hideSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !dirty}
            className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-[7px] text-[12px] font-medium text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? '…' : '⤓'} {saving ? 'Saving' : saveLabel}
          </button>
        )}
        {onPublish && (
          <button
            type="button"
            onClick={onPublish}
            disabled={!canPublish || saving}
            className="flex items-center gap-1.5 rounded-md bg-[oklch(0.78_0.16_285)] px-3.5 py-[7px] text-[12px] font-semibold text-[oklch(0.18_0.01_280)] transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {publishLabel} →
          </button>
        )}
      </div>
    </div>
  )
}

// ── Left rail ──────────────────────────────────────────────────────────────

function LeftRail() {
  const ed = useEditor()
  return (
    <div className="flex w-16 flex-shrink-0 flex-col items-center gap-1 border-r border-gray-200 bg-white py-3">
      {RAIL_ITEMS.map((it) => {
        const on = ed.panel === it.id
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => ed.setPanel(it.id)}
            className={`flex w-13 flex-col items-center gap-1 rounded-md px-2 py-2.5 transition-colors ${
              on
                ? 'bg-[oklch(0.96_0.012_265)] text-[oklch(0.45_0.18_265)]'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span className="text-[16px]">{it.icon}</span>
            <span className="text-[10px] font-medium tracking-tight">
              {it.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Canvas ─────────────────────────────────────────────────────────────────

function Canvas({ children }: { children: ReactNode }) {
  const ed = useEditor()
  const widths = { desktop: '100%', tablet: 900, mobile: 420 }
  const isFramed = ed.device !== 'desktop'
  return (
    <div className="flex-1 overflow-y-auto bg-[oklch(0.96_0.005_280)]">
      <div
        style={{
          width: widths[ed.device],
          maxWidth: '100%',
          margin: isFramed ? '24px auto' : 0,
          border: isFramed ? '1px solid oklch(0.92 0.003 280)' : 'none',
          borderRadius: isFramed ? 16 : 0,
          boxShadow: isFramed ? '0 12px 40px rgba(0,0,0,0.08)' : 'none',
          overflow: isFramed ? 'hidden' : 'visible',
          background: 'var(--bg-0, white)',
          transition: 'all 250ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

// ── Inspector ──────────────────────────────────────────────────────────────

function Inspector({ organizationSlug }: { organizationSlug?: string }) {
  const ed = useEditor()
  const titles: Record<EditorPanel, string> = {
    design: 'Design',
    content: 'Content',
    media: 'Media',
    sections: 'Sections',
    ai: 'AI assist',
  }
  return (
    <div className="flex w-[320px] flex-shrink-0 flex-col border-l border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3.5">
        <span className="text-[13px] font-semibold tracking-tight text-gray-900">
          {titles[ed.panel]}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-3.5">
        {ed.panel === 'design' && <DesignPanel />}
        {ed.panel === 'content' && <ContentPanel />}
        {ed.panel === 'media' && <MediaPanel />}
        {ed.panel === 'sections' && <SectionsPanel />}
        {ed.panel === 'ai' && <AIPanel organizationSlug={organizationSlug} />}
      </div>
    </div>
  )
}

// ── Design panel ───────────────────────────────────────────────────────────

function DesignPanel() {
  const ed = useEditor()
  const t = ed.overrides.theme
  return (
    <div>
      <PanelGroup title="Type families">
        <Field label="Heading font">
          <select
            value={t.fontHeading}
            onChange={(e) => ed.setTheme({ fontHeading: e.target.value })}
            className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-[12.5px] focus:border-blue-500 focus:outline-none"
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
            onChange={(e) => ed.setTheme({ fontBody: e.target.value })}
            className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-[12.5px] focus:border-blue-500 focus:outline-none"
          >
            {FONT_PAIRS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
      </PanelGroup>

      <PanelGroup title="Heading style">
        <Field label="Weight">
          <SegControl
            value={t.headingWeight}
            options={[
              { v: 300, label: 'Light' },
              { v: 400, label: 'Reg' },
              { v: 600, label: 'Semi' },
              { v: 700, label: 'Bold' },
              { v: 800, label: 'Black' },
            ]}
            onChange={(v) => ed.setTheme({ headingWeight: v as number })}
          />
        </Field>
        <Field label="Style">
          <div className="flex gap-1.5">
            <ToggleBtn
              on={!t.headingItalic}
              onClick={() => ed.setTheme({ headingItalic: false })}
              title="Roman"
            >
              <span className="font-semibold">Aa</span>
            </ToggleBtn>
            <ToggleBtn
              on={t.headingItalic}
              onClick={() => ed.setTheme({ headingItalic: true })}
              title="Italic"
            >
              <span className="italic font-semibold">Aa</span>
            </ToggleBtn>
          </div>
        </Field>
        <Field label="Alignment">
          <div className="flex gap-1.5">
            {(['left', 'center', 'right'] as const).map((a) => (
              <ToggleBtn
                key={a}
                on={t.headingAlign === a}
                onClick={() => ed.setTheme({ headingAlign: a })}
                title={a}
              >
                <AlignIcon dir={a} />
              </ToggleBtn>
            ))}
          </div>
        </Field>
        <SliderField
          label="Size scale"
          value={t.typeScale}
          min={0.85}
          max={1.25}
          step={0.05}
          suffix="×"
          onChange={(v) => ed.setTheme({ typeScale: v })}
        />
        <SliderField
          label="Letter spacing"
          value={t.headingTracking}
          min={-0.06}
          max={0.06}
          step={0.005}
          suffix="em"
          precise
          onChange={(v) => ed.setTheme({ headingTracking: v })}
        />
        <SliderField
          label="Line height"
          value={t.headingLeading}
          min={0.85}
          max={1.4}
          step={0.02}
          suffix="×"
          onChange={(v) => ed.setTheme({ headingLeading: v })}
        />
      </PanelGroup>

      <PanelGroup title="Body style">
        <Field label="Weight">
          <SegControl
            value={t.bodyWeight}
            options={[
              { v: 300, label: 'Light' },
              { v: 400, label: 'Reg' },
              { v: 500, label: 'Med' },
              { v: 600, label: 'Semi' },
            ]}
            onChange={(v) => ed.setTheme({ bodyWeight: v as number })}
          />
        </Field>
      </PanelGroup>

      <PanelGroup title="Layout">
        <Field label="Density">
          <SegControl
            value={t.density}
            options={[
              { v: 'compact', label: 'Compact' },
              { v: 'comfortable', label: 'Comfy' },
              { v: 'spacious', label: 'Spacious' },
            ]}
            onChange={(v) =>
              ed.setTheme({ density: v as typeof t.density })
            }
          />
        </Field>
        <Field label="Corners">
          <SegControl
            value={t.cornerStyle}
            options={[
              { v: 'sharp', label: 'Sharp' },
              { v: 'rounded', label: 'Rounded' },
              { v: 'pill', label: 'Pill' },
            ]}
            onChange={(v) =>
              ed.setTheme({ cornerStyle: v as typeof t.cornerStyle })
            }
          />
        </Field>
      </PanelGroup>

      <PanelGroup title="Surface">
        <Field label="Background">
          <div className="flex flex-wrap gap-1.5">
            {SURFACE_MODES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => ed.setTheme({ surfaceId: s.id })}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11.5px] font-medium tracking-tight transition-colors ${
                  t.surfaceId === s.id
                    ? 'border-[oklch(0.55_0.20_265)] bg-[oklch(0.96_0.012_265)] text-[oklch(0.40_0.18_265)]'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span
                  className="h-3 w-3 rounded-sm border border-black/10"
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
                key={a.id}
                type="button"
                title={a.label}
                onClick={() => ed.setTheme({ accentId: a.id })}
                className="h-7 w-7 rounded-full border-0 transition-shadow"
                style={{
                  background: `linear-gradient(135deg, ${a.accent}, ${a.accent2})`,
                  outline:
                    t.accentId === a.id
                      ? '2px solid oklch(0.62 0.18 265)'
                      : '2px solid transparent',
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
        </Field>
      </PanelGroup>
    </div>
  )
}

function SegControl<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { v: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-0.5 rounded-md bg-gray-100 p-[3px]">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          className={`flex-1 rounded-[6px] px-2 py-[6px] text-[11.5px] font-medium transition-colors ${
            value === o.v
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ToggleBtn({
  on,
  onClick,
  children,
  title,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-8 w-9 items-center justify-center rounded-md border text-[12px] transition-colors ${
        on
          ? 'border-gray-900 bg-gray-900 text-white'
          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}

function AlignIcon({ dir }: { dir: 'left' | 'center' | 'right' }) {
  const widths = [14, 10, 12]
  const align =
    dir === 'center' ? 'center' : dir === 'right' ? 'flex-end' : 'flex-start'
  return (
    <span
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        alignItems: align,
      }}
    >
      {widths.map((w, i) => (
        <span
          key={i}
          style={{
            width: w,
            height: 2,
            background: 'currentColor',
            borderRadius: 1,
          }}
        />
      ))}
    </span>
  )
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  precise,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  precise?: boolean
  onChange: (v: number) => void
}) {
  const display = precise ? value.toFixed(3) : value.toFixed(2)
  return (
    <Field
      label={
        <span className="flex justify-between">
          <span>{label}</span>
          <span className="font-mono text-gray-400 tabular-nums">
            {display}
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
        onChange={(e) => onChange(+e.target.value)}
        className="w-full"
      />
    </Field>
  )
}

// ── Content panel ──────────────────────────────────────────────────────────

function ContentPanel() {
  return (
    <div>
      <PanelGroup title="Hero">
        <TextField label="Eyebrow" path="hero.eyebrow" defaultValue="SPAIRE ORIGINAL" />
        <TextField label="Series pill" path="hero.series_label" defaultValue="NEW SERIES" />
        <TextField label="Title" path="hero.title" defaultValue="" multiline />
        <TextField label="Tagline" path="hero.tagline" defaultValue="" multiline />
        <TextField label="Level" path="hero.level" defaultValue="All levels" />
        <TextField label="Rating" path="hero.rating" defaultValue="4.9" />
        <TextField label="Rating count" path="hero.rating_count" defaultValue="2,814" />
        <TextField label="Students" path="hero.students" defaultValue="38,200 enrolled" />
      </PanelGroup>
      <PanelGroup title="Curriculum">
        <TextField path="curriculum.heading" label="Heading" defaultValue="" multiline />
        <TextField path="curriculum.subheading" label="Subheading" defaultValue="" multiline />
      </PanelGroup>
      <PanelGroup title="Lesson list">
        <TextField path="lessons.heading" label="Heading" defaultValue="" />
        <TextField path="lessons.subheading" label="Subheading" defaultValue="" multiline />
      </PanelGroup>
      <PanelGroup title="Instructor">
        <TextField path="instructor.quote" label="Pull quote" defaultValue="" multiline />
        <TextField path="instructor.bio" label="Bio" defaultValue="" multiline />
      </PanelGroup>
      <PanelGroup title="Final CTA">
        <TextField path="finalCta.label" label="Eyebrow" defaultValue="READY WHEN YOU ARE" />
        <TextField path="finalCta.title" label="Headline" defaultValue="" multiline />
        <TextField path="finalCta.subtitle" label="Subhead" defaultValue="" multiline />
        <TextField path="finalCta.primary" label="Primary CTA" defaultValue="Enroll" />
        <TextField path="finalCta.secondary" label="Secondary CTA" defaultValue="Watch trailer" />
      </PanelGroup>
      <div className="px-4 pt-2 pb-4 text-[11.5px] leading-relaxed text-gray-500">
        Tip — click any text on the canvas to edit it directly. The fields here
        are mirrors of those on-canvas writes.
      </div>
    </div>
  )
}

// ── Media panel ────────────────────────────────────────────────────────────

const MEDIA_SLOTS: { id: string; label: string; hint?: string }[] = [
  { id: 'hero.backdrop', label: 'Hero backdrop', hint: 'Image or video for the top of the page' },
  { id: 'trailer.video', label: 'Trailer video', hint: 'mp4 / webm / mov' },
  { id: 'instructor.portrait', label: 'Instructor portrait', hint: '4:5 portrait' },
  { id: 'finalCta.backdrop', label: 'Final CTA backdrop' },
  { id: 'curriculum.1', label: 'Chapter 01 cover' },
  { id: 'curriculum.2', label: 'Chapter 02 cover' },
  { id: 'curriculum.3', label: 'Chapter 03 cover' },
  { id: 'curriculum.4', label: 'Chapter 04 cover' },
  { id: 'curriculum.5', label: 'Chapter 05 cover' },
  { id: 'curriculum.6', label: 'Chapter 06 cover' },
]

function MediaPanel() {
  return (
    <div>
      <div className="px-4 pb-3 text-[12px] leading-relaxed text-gray-500">
        Upload media for any slot. Hero backdrop and trailer write directly to
        the course so they show up on the storefront. Other slots are stored
        with the landing.
      </div>
      <div className="px-2.5">
        {MEDIA_SLOTS.map((s) => (
          <MediaSlotRow key={s.id} {...s} />
        ))}
      </div>
    </div>
  )
}

function MediaSlotRow({
  id,
  label,
  hint,
}: {
  id: string
  label: string
  hint?: string
}) {
  const ed = useEditor()
  const m = ed.m(id)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (file: File) => {
    const upload = ed.uploaderForSlot?.(id) ?? ed.uploadMedia
    const next = await upload(file)
    ed.setMedia(id, { ...next, name: file.name })
  }

  return (
    <div className="flex items-center gap-2.5 rounded-lg px-1 py-2 hover:bg-gray-50">
      <Thumb m={m} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-medium tracking-tight text-gray-900">
          {label}
        </div>
        <div className="truncate text-[11px] text-gray-500">
          {m?.name ?? hint ?? 'Empty'}
        </div>
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-700 transition-colors hover:bg-gray-200"
          title="Upload"
        >
          ↑
        </button>
        {m && (
          <button
            type="button"
            onClick={() => ed.setMedia(id, null)}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-700 transition-colors hover:bg-gray-200"
            title="Remove"
          >
            ✕
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

function Thumb({ m }: { m: LandingMedia | null }) {
  return (
    <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
      {m?.kind === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={m.url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : m?.kind === 'video' ? (
        <video
          src={m.url}
          muted
          loop
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-gray-300">
          🖼
        </span>
      )}
    </div>
  )
}

// ── Sections panel ─────────────────────────────────────────────────────────

const SECTIONS_PANEL: { id: string; label: string; hint: string }[] = [
  { id: 'hero', label: 'Hero', hint: 'Cinematic header' },
  { id: 'value', label: "What's included", hint: '4-column value strip' },
  { id: 'trailer', label: 'Trailer', hint: 'Video block' },
  { id: 'curriculum', label: 'Curriculum', hint: 'Chapter cards' },
  { id: 'lessons', label: 'All lessons', hint: 'Accordion + paywall' },
  { id: 'instructor', label: 'Instructor', hint: 'Bio + pull quote' },
  { id: 'reviews', label: 'Reviews', hint: 'Student quotes' },
  { id: 'finalCta', label: 'Final CTA', hint: 'Closing block' },
]

function SectionsPanel() {
  const ed = useEditor()
  const meta = new Map(SECTIONS_PANEL.map((s) => [s.id, s]))
  const ids = ed.overrides.order.filter((id) => meta.has(id))
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    ed.setOrder(arrayMove(ids, from, to))
  }

  return (
    <div className="px-2.5">
      <div className="px-1 pb-3 text-[12px] text-gray-500">
        Drag to reorder · toggle to hide a section.
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((id) => {
            const s = meta.get(id)
            if (!s) return null
            return <SectionRow key={id} id={id} label={s.label} hint={s.hint} />
          })}
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SectionRow({
  id,
  label,
  hint,
}: {
  id: string
  label: string
  hint: string
}) {
  const ed = useEditor()
  const visible = ed.isVisible(id)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2.5 rounded-lg px-2 py-2.5 hover:bg-gray-50"
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="cursor-grab select-none text-[14px] text-gray-300 hover:text-gray-500 active:cursor-grabbing"
        title="Drag to reorder"
        aria-label="Drag to reorder"
      >
        ⋮⋮
      </button>
      <div className="flex-1">
        <div className="text-[12.5px] font-medium text-gray-900">{label}</div>
        <div className="mt-0.5 text-[11px] text-gray-500">{hint}</div>
      </div>
      <button
        type="button"
        onClick={() => ed.setVisible(id, !visible)}
        className={`relative h-[18px] w-[34px] rounded-full transition-colors ${
          visible ? 'bg-[oklch(0.55_0.20_265)]' : 'bg-gray-200'
        }`}
        aria-label={visible ? 'Hide section' : 'Show section'}
      >
        <span
          className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform"
          style={{
            transform: visible ? 'translateX(18px)' : 'translateX(2px)',
          }}
        />
      </button>
    </div>
  )
}

// ── AI panel ───────────────────────────────────────────────────────────────

const AI_TARGETS: { path: string; label: string }[] = [
  { path: 'hero.title', label: 'Hero title' },
  { path: 'hero.tagline', label: 'Hero tagline' },
  { path: 'hero.eyebrow', label: 'Hero eyebrow' },
  { path: 'curriculum.heading', label: 'Curriculum heading' },
  { path: 'curriculum.subheading', label: 'Curriculum subheading' },
  { path: 'lessons.heading', label: 'Lesson list heading' },
  { path: 'instructor.quote', label: 'Instructor pull quote' },
  { path: 'finalCta.title', label: 'Final CTA headline' },
  { path: 'finalCta.subtitle', label: 'Final CTA subhead' },
]

function AIPanel({ organizationSlug }: { organizationSlug?: string }) {
  const ed = useEditor()
  const [target, setTarget] = useState<string>(AI_TARGETS[1].path)
  const [intent, setIntent] = useState('Make it punchier — 5-9 words.')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const targetMeta = AI_TARGETS.find((t) => t.path === target)
  const current = ed.t(target, '')

  const run = async () => {
    if (!organizationSlug) {
      setError(
        'AI rewrites need an organization context — open the dashboard customize tab.',
      )
      return
    }
    if (!current) {
      setError('Nothing to rewrite — set a value on the canvas first.')
      return
    }
    setBusy(true)
    setError(null)
    setResult('')
    try {
      const res = await fetch(
        `/dashboard/${organizationSlug}/courses/landing-rewrite`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intent,
            current,
            hint: targetMeta?.label,
          }),
        },
      )
      if (!res.ok || !res.body) {
        setError(`Generation failed (${res.status}).`)
        setBusy(false)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setResult(acc)
      }
    } catch (e) {
      setError((e as Error).message ?? 'Generation failed.')
    } finally {
      setBusy(false)
    }
  }

  const apply = () => {
    if (!result) return
    ed.setText(target, result.trim().replace(/^["']|["']$/g, ''))
    setResult(null)
  }

  return (
    <div className="px-4">
      <div
        style={{
          padding: 14,
          borderRadius: 12,
          background:
            'linear-gradient(135deg, oklch(0.96 0.04 280), oklch(0.95 0.05 320))',
          border: '1px solid oklch(0.90 0.04 280)',
          marginBottom: 14,
        }}
      >
        <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[oklch(0.35_0.18_280)]">
          ✦ Rewrite with AI
        </div>

        <Field label="Field">
          <select
            value={target}
            onChange={(e) => {
              setTarget(e.target.value)
              setResult(null)
            }}
            className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-[12.5px] focus:border-blue-500 focus:outline-none"
          >
            {AI_TARGETS.map((t) => (
              <option key={t.path} value={t.path}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="mt-2 rounded-md border border-gray-200 bg-white px-2.5 py-2 text-[11.5px] leading-relaxed text-gray-600">
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
            Current
          </div>
          {current ? current : <span className="text-gray-400">(empty)</span>}
        </div>

        <div className="mt-3">
          <Field label="What should the AI do?">
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-md border border-gray-200 bg-white px-2.5 py-2 text-[12.5px] tracking-tight text-gray-900 transition-colors focus:border-blue-500 focus:outline-none"
              placeholder="Make it punchier, add urgency, etc."
            />
          </Field>
        </div>

        <button
          type="button"
          onClick={run}
          disabled={busy || !current}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[oklch(0.45_0.20_280)] px-3 py-2 text-[12px] font-semibold text-white transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Thinking…' : '✦ Generate'}
        </button>

        {error && (
          <div className="mt-3 rounded-md bg-red-50 px-2.5 py-2 text-[11.5px] text-red-600">
            {error}
          </div>
        )}
      </div>

      {result !== null && (
        <div className="rounded-xl border border-gray-200 bg-white p-3.5">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
            Suggestion
          </div>
          <div className="mb-3 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-900">
            {result || (busy ? '…' : '(no output)')}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={apply}
              disabled={!result || busy}
              className="flex-1 rounded-md bg-gray-900 px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Form primitives ────────────────────────────────────────────────────────

function PanelGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4 border-b border-gray-100 pb-4 last:border-b-0">
      <div className="mb-2.5 px-4 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-gray-500">
        {title}
      </div>
      <div className="flex flex-col gap-2.5 px-4">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}

function TextField({
  label,
  path,
  defaultValue,
  multiline,
}: {
  label: string
  path: string
  defaultValue: string
  multiline?: boolean
}) {
  const ed = useEditor()
  const v = ed.t(path, defaultValue)
  return (
    <Field label={label}>
      {multiline ? (
        <textarea
          value={v}
          rows={3}
          onChange={(e) => ed.setText(path, e.target.value)}
          className="w-full resize-none rounded-md border border-gray-200 bg-white px-2.5 py-2 text-[12.5px] tracking-tight text-gray-900 transition-colors focus:border-blue-500 focus:outline-none"
        />
      ) : (
        <input
          value={v}
          onChange={(e) => ed.setText(path, e.target.value)}
          className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-[12.5px] tracking-tight text-gray-900 transition-colors focus:border-blue-500 focus:outline-none"
        />
      )}
    </Field>
  )
}
