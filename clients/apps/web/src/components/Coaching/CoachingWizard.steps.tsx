'use client'

import React from 'react'
import {
  DropZone,
  Field,
  Label,
  Reveal,
  Segmented,
  SelectCard,
  StepHeader,
  TextArea,
  TextInput,
  Toggle,
} from './CoachingWizard.primitives'
import type { WizardState } from './CoachingWizard'

type StepProps = {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
}

// ─── Step 1 — Coach ─────────────────────────────────────────────────────────
export function StepCoach({
  state,
  update,
  onUploadPhoto,
}: StepProps & { onUploadPhoto: (file: File) => Promise<string | null> }) {
  return (
    <div className="fade-up">
      <StepHeader step={1} total={5} headline="Tell clients who you are." />

      <Field label="Your name">
        <TextInput
          value={state.coachName}
          onChange={(v) => update({ coachName: v })}
          placeholder="e.g. Alex Rivera"
          autoFocus
        />
      </Field>

      <Field label="Short bio">
        <TextArea
          value={state.coachBio}
          onChange={(v) => update({ coachBio: v })}
          placeholder="e.g. Designer & coach helping creators ship products in 30 days."
          rows={2}
        />
      </Field>

      <Field label="Credentials" optional>
        <TextInput
          value={state.coachCreds}
          onChange={(v) => update({ coachCreds: v })}
          placeholder="e.g. Certified ICF Coach"
        />
      </Field>

      <Field label="Profile photo" optional>
        <div style={{ width: 120 }}>
          <DropZone
            shape="circle"
            label="Add photo"
            imageUrl={state.coachPhotoUrl}
            onUpload={async (file) => {
              const url = await onUploadPhoto(file)
              return url
            }}
          />
        </div>
      </Field>
    </div>
  )
}

// ─── Step 2 — Program ───────────────────────────────────────────────────────
export function StepProgram({ state, update }: StepProps) {
  const showDates = state.format === 'cohort' || state.format === 'hybrid'

  return (
    <div className="fade-up">
      <StepHeader step={2} total={5} headline="What's the program?" />

      <Field label="Program title">
        <TextInput
          value={state.programTitle}
          onChange={(v) => update({ programTitle: v })}
          placeholder="e.g. Ship in 30 Days"
          autoFocus
        />
      </Field>

      <Field
        label="One‑sentence promise"
        hint="What does the buyer walk away with?"
      >
        <TextArea
          value={state.promise}
          onChange={(v) => update({ promise: v })}
          placeholder="e.g. Launch your first paid product in six weeks, with weekly feedback."
          rows={2}
        />
      </Field>

      <Field label="Format">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 10,
          }}
        >
          <SelectCard
            layout="row"
            selected={state.format === 'self'}
            onClick={() => update({ format: 'self' })}
            title="Self‑paced"
            body="Content + resources + messaging, no live calls."
          />
          <SelectCard
            layout="row"
            selected={state.format === 'cohort'}
            onClick={() => update({ format: 'cohort' })}
            title="Cohort"
            body="Runs on fixed dates with a group."
          />
          <SelectCard
            layout="row"
            selected={state.format === 'hybrid'}
            onClick={() => update({ format: 'hybrid' })}
            title="Hybrid"
            body="Self‑paced content plus scheduled group calls."
          />
        </div>
      </Field>

      <Reveal open={showDates}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginBottom: 22,
          }}
        >
          <div>
            <Label>Start date</Label>
            <TextInput
              type="date"
              value={state.startDate}
              onChange={(v) => update({ startDate: v })}
            />
          </div>
          <div>
            <Label>End date</Label>
            <TextInput
              type="date"
              value={state.endDate}
              onChange={(v) => update({ endDate: v })}
            />
          </div>
        </div>
      </Reveal>

      <Field label="Program length">
        <div style={{ width: 200 }}>
          <TextInput
            type="number"
            value={state.weeks}
            onChange={(v) => update({ weeks: v })}
            placeholder="6"
            suffix="weeks"
          />
        </div>
      </Field>
    </div>
  )
}

// ─── Step 3 — Hero media ────────────────────────────────────────────────────
// Trailer is OUT OF SCOPE for this PR — it's a no-op visual + "Coming soon"
// pill (we kept the card; removing it would leave a single column that looks
// awkward against step 1's wide center column).
export function StepMedia({
  state,
  update,
  onUploadThumbnail,
}: StepProps & { onUploadThumbnail: (file: File) => Promise<string | null> }) {
  return (
    <div className="fade-up">
      <StepHeader
        step={3}
        total={5}
        headline="Make it irresistible."
        helper="A thumbnail and short trailer make the landing page sell harder. You can change them later."
        recommended
      />

      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
      >
        <div>
          <Label>Thumbnail image</Label>
          <DropZone
            label="Drop image or click to upload"
            helper="JPG or PNG · 16:9 recommended"
            imageUrl={state.thumbnailUrl}
            onUpload={onUploadThumbnail}
            accept="image/*"
          />
        </div>

        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <Label optional>Trailer video</Label>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: '3px 8px',
                borderRadius: 999,
                background: '#F2F2F4',
                color: 'var(--muted)',
                letterSpacing: '0.02em',
              }}
            >
              Coming soon
            </span>
          </div>
          <DropZone
            filled={false}
            onClick={() => {
              // No-op: trailer pipeline is deferred. Leaving the visual so
              // the layout is balanced.
            }}
            label="Drop video or click to upload"
            helper="MP4 · up to 90 seconds"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Step 4 — Pricing & access ──────────────────────────────────────────────
export function StepPricing({ state, update }: StepProps) {
  const isCohort = state.format === 'cohort' || state.format === 'hybrid'
  const planDisabled = true // Payment plan deferred to a future PR.

  return (
    <div className="fade-up">
      <StepHeader step={4} total={5} headline="How will you sell it?" />

      <Field label="Pricing model">
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}
        >
          <SelectCard
            layout="row"
            selected={state.pricingModel === 'onetime'}
            onClick={() => update({ pricingModel: 'onetime' })}
            title="One‑time"
            body="Pay once, keep access."
          />
          <SelectCard
            layout="row"
            selected={state.pricingModel === 'subscription'}
            onClick={() => update({ pricingModel: 'subscription' })}
            title="Subscription"
            body="Recurring monthly or yearly billing."
          />
          <div style={{ position: 'relative', opacity: planDisabled ? 0.55 : 1 }}>
            <SelectCard
              layout="row"
              selected={state.pricingModel === 'plan'}
              onClick={() => {
                if (planDisabled) return
                update({ pricingModel: 'plan' })
              }}
              title="Payment plan"
              body="Split into N installments."
            />
            {planDisabled && (
              <span
                style={{
                  position: 'absolute',
                  top: 14,
                  right: 48,
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: '#F2F2F4',
                  color: 'var(--muted)',
                  letterSpacing: '0.02em',
                }}
              >
                Coming soon
              </span>
            )}
          </div>
        </div>
      </Field>

      <Field label="Price">
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ width: 200 }}>
            <TextInput
              prefix="$"
              type="number"
              value={state.price}
              onChange={(v) => update({ price: v })}
              placeholder="0.00"
            />
          </div>

          <Reveal open={state.pricingModel === 'subscription'}>
            <Segmented
              options={['Monthly', 'Yearly']}
              value={state.interval}
              onChange={(v) => update({ interval: v as 'Monthly' | 'Yearly' })}
            />
          </Reveal>
        </div>
      </Field>

      <Field label="Access duration">
        <Segmented
          options={[
            { value: 'lifetime', label: 'Lifetime' },
            { value: '3m', label: '3 months' },
            { value: '6m', label: '6 months' },
            { value: '12m', label: '12 months' },
            { value: 'cohort', label: 'Until cohort ends' },
          ]}
          value={state.access}
          onChange={(v) => update({ access: v })}
          disabled={{ cohort: !isCohort }}
        />
        {!isCohort && (
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--muted-2)',
              marginTop: 8,
            }}
          >
            "Until cohort ends" is available when format is Cohort or Hybrid.
          </div>
        )}
      </Field>

      <Field label="Free preview">
        <Toggle
          checked={state.freePreview}
          onChange={(v) => update({ freePreview: v })}
          label="Let non‑buyers preview the first lesson"
          description="Helps the landing page convert. Drives sign‑ups."
        />
      </Field>
    </div>
  )
}
