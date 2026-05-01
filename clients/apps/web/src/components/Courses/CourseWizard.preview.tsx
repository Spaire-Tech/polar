'use client'

import { HeroPreview } from './editor/CustomizeTab'
import { PricingState } from './CourseWizard.steps'

type DraftState = {
  name: string
  courseTitle: string
  desc: string
  nameItalic: boolean
  nameBold: boolean
  nameUppercase: boolean
}

// ─── Field primitives ─────────────────────────────────────────────────────────

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
      {children}
    </label>
  )
}

function TextInput({
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
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-900/8"
    />
  )
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm leading-relaxed text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-gray-900 focus:bg-white focus:ring-2 focus:ring-gray-900/8"
    />
  )
}

function StyleToggle({
  active,
  onClick,
  label,
  italic,
  bold,
}: {
  active: boolean
  onClick: () => void
  label: string
  italic?: boolean
  bold?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border py-1.5 text-xs transition-all ${
        active
          ? 'border-gray-900 bg-gray-900 text-white'
          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
      }`}
      style={{
        fontStyle: italic ? 'italic' : 'normal',
        fontWeight: bold ? 700 : 400,
      }}
    >
      {label}
    </button>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function LandingPreview({
  instructor,
  course,
  pricing,
  draft,
  setDraft,
  onGenerate,
  onBack,
  onClose,
  error,
}: {
  instructor: { name: string; bio: string }
  course: { title: string; desc: string }
  pricing: PricingState
  draft: DraftState
  setDraft: (updater: (prev: DraftState) => DraftState) => void
  editOpen: boolean
  setEditOpen: (open: boolean) => void
  onGenerate: () => void
  onBack: () => void
  onClose: () => void
  error: string | null
}) {
  const title = draft.courseTitle || course.title
  const description = draft.desc || course.desc || instructor.bio
  const instructorName = draft.name || instructor.name

  const pricingLabel = pricing.model === 'free'
    ? 'Free'
    : pricing.amount
    ? `$${pricing.amount}`
    : 'Paid'

  const pricingSubLabel = pricing.model !== 'free' && pricing.billing === 'recurring'
    ? `Billed every ${pricing.intervalCount > 1 ? `${pricing.intervalCount} ` : ''}${pricing.interval}${pricing.intervalCount > 1 ? 's' : ''}`
    : pricing.model === 'free' ? 'Free access' : 'One-time payment'

  return (
    <div className="flex h-screen flex-col bg-gray-50" style={{ fontFamily: 'var(--font-dm-sans), system-ui, sans-serif' }}>
      {/* Top nav */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <span className="text-sm font-medium text-gray-500">Preview your landing page</span>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-xs text-red-500">{error}</span>
          )}
          <button
            type="button"
            onClick={onGenerate}
            className="flex items-center gap-2 rounded-full bg-gray-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
          >
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none">
              <path d="M3 1.5l6 4-6 4V1.5z" fill="currentColor" />
            </svg>
            Generate Course
          </button>
        </div>
      </div>

      {/* Split panel */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left: editor */}
        <div className="flex w-[380px] shrink-0 flex-col overflow-y-auto border-r border-gray-100 bg-gray-50/50">
          <div className="flex flex-col gap-4 p-6">
            {/* Course info */}
            <SectionCard
              title="Course info"
              subtitle="Title and description shown on the landing page."
            >
              <div className="flex flex-col gap-3">
                <div>
                  <FieldLabel>Title</FieldLabel>
                  <TextInput
                    value={draft.courseTitle || course.title}
                    onChange={(v) => setDraft((d) => ({ ...d, courseTitle: v }))}
                    placeholder="e.g. The YouTube Growth Blueprint"
                  />
                </div>
                <div>
                  <FieldLabel>Description</FieldLabel>
                  <TextArea
                    value={draft.desc || course.desc}
                    onChange={(v) => setDraft((d) => ({ ...d, desc: v }))}
                    placeholder="Summarize what students will learn."
                    rows={3}
                  />
                </div>
              </div>
            </SectionCard>

            {/* Instructor */}
            <SectionCard
              title="Instructor"
              subtitle="How your name appears on the course hero."
            >
              <div className="flex flex-col gap-3">
                <div>
                  <FieldLabel>Name</FieldLabel>
                  <TextInput
                    value={draft.name || instructor.name}
                    onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
                    placeholder="e.g. Alex Rivera"
                  />
                </div>
                <div>
                  <FieldLabel>Name style</FieldLabel>
                  <div className="flex gap-2">
                    <StyleToggle
                      active={draft.nameItalic}
                      onClick={() => setDraft((d) => ({ ...d, nameItalic: !d.nameItalic }))}
                      label="Italic"
                      italic
                    />
                    <StyleToggle
                      active={draft.nameBold}
                      onClick={() => setDraft((d) => ({ ...d, nameBold: !d.nameBold }))}
                      label="Bold"
                      bold
                    />
                    <StyleToggle
                      active={draft.nameUppercase}
                      onClick={() => setDraft((d) => ({ ...d, nameUppercase: !d.nameUppercase }))}
                      label="ALL CAPS"
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel>Bio</FieldLabel>
                  <TextArea
                    value={instructor.bio}
                    onChange={() => {}}
                    placeholder="Your bio from the previous step."
                    rows={2}
                  />
                  <p className="mt-1 text-xs text-gray-400">Edit bio in the Instructor step.</p>
                </div>
              </div>
            </SectionCard>

            {/* Pricing (read-only) */}
            <SectionCard
              title="Pricing"
              subtitle="Set in the previous step."
            >
              <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div>
                  <span className="text-sm text-gray-600">Price</span>
                  <div className="text-xs text-gray-400">{pricingSubLabel}</div>
                </div>
                <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white">
                  {pricingLabel}
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Go back to change pricing.
              </p>
            </SectionCard>
          </div>
        </div>

        {/* Right: live preview */}
        <div className="flex flex-1 flex-col bg-gray-950">
          <div className="flex h-10 shrink-0 items-center border-b border-white/8 px-5">
            <span className="text-xs font-medium uppercase tracking-wide text-white/40">
              Landing page preview
            </span>
          </div>
          <div className="relative flex-1 overflow-hidden">
            <HeroPreview
              title={title}
              description={description}
              instructorName={instructorName}
              instructorNameItalic={draft.nameItalic}
              instructorNameBold={draft.nameBold}
              instructorNameUppercase={draft.nameUppercase}
              thumbnailUrl={null}
              thumbnailObjectPosition={null}
              trailerUrl={null}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
