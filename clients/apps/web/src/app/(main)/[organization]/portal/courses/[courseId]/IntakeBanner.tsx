'use client'

import {
  IntakeField,
  useCustomerIntakeForm,
  useSubmitCustomerIntakeForm,
} from '@/hooks/queries/coaching'
import { useState } from 'react'

const FONT = "'Poppins', var(--font-poppins), system-ui, sans-serif"
const C = {
  bg: '#ffffff',
  bg2: 'oklch(0.975 0.002 280)',
  line: 'oklch(0.92 0.003 280)',
  fg0: 'oklch(0.18 0.008 280)',
  fg2: 'oklch(0.52 0.008 280)',
  fg3: 'oklch(0.66 0.006 280)',
  accent: 'oklch(0.55 0.20 265)',
}

const DISMISSED_KEY = (courseId: string) => `coaching-intake-dismissed:${courseId}`

export function IntakeBanner({ courseId }: { courseId: string }) {
  const { data, isLoading } = useCustomerIntakeForm(courseId)
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(DISMISSED_KEY(courseId)) === '1'
  })

  if (isLoading || !data?.form || data.response) return null
  if (!data.form.required_for_access && dismissed) return null

  return (
    <>
      <section
        style={{
          maxWidth: 1320,
          margin: '0 auto 16px',
          padding: '0 32px',
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            background: 'oklch(0.97 0.04 265)',
            border: `1px solid oklch(0.86 0.07 265)`,
            borderRadius: 18,
            padding: '14px 18px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.fg0 }}>
              {data.form.title || 'A short intake from your coach'}
            </span>
            <span style={{ fontSize: 12, color: C.fg2 }}>
              {data.form.description ||
                'Help your coach prepare by sharing a bit about you.'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!data.form.required_for_access && (
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.localStorage.setItem(DISMISSED_KEY(courseId), '1')
                  }
                  setDismissed(true)
                }}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: C.fg2,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: `1px solid ${C.line}`,
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                Later
              </button>
            )}
            <button
              onClick={() => setOpen(true)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#fff',
                padding: '6px 14px',
                borderRadius: 999,
                background: C.accent,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Fill it out
            </button>
          </div>
        </div>
      </section>
      {open && (
        <IntakeModal
          courseId={courseId}
          form={data.form}
          existingAnswers={data.response?.answers ?? null}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function IntakeModal({
  courseId,
  form,
  existingAnswers,
  onClose,
}: {
  courseId: string
  form: NonNullable<
    ReturnType<typeof useCustomerIntakeForm>['data']
  >['form']
  existingAnswers: Record<string, unknown> | null
  onClose: () => void
}) {
  const submit = useSubmitCustomerIntakeForm(courseId)
  const [answers, setAnswers] = useState<Record<string, unknown>>(
    existingAnswers ?? {},
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!form) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const localErrors: Record<string, string> = {}
    for (const field of form.schema_json.fields) {
      const value = answers[field.id]
      const isEmpty =
        value == null ||
        (typeof value === 'string' && !value.trim()) ||
        (Array.isArray(value) && value.length === 0)
      if (field.required && isEmpty) {
        localErrors[field.id] = 'Required'
      }
      if (field.type === 'email' && typeof value === 'string' && value.trim()) {
        if (!value.includes('@')) localErrors[field.id] = 'Invalid email'
      }
    }
    setErrors(localErrors)
    if (Object.keys(localErrors).length > 0) return
    try {
      await submit.mutateAsync(answers)
      onClose()
    } catch (e) {
      // surface server-side validation if any
      const message = e instanceof Error ? e.message : 'Submit failed'
      setErrors({ _form: message })
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,18,23,0.6)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: FONT,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          background: C.bg,
          borderRadius: 20,
          padding: 24,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: C.fg0,
            margin: 0,
            marginBottom: 4,
          }}
        >
          {form.title || 'Intake form'}
        </h2>
        {form.description && (
          <p style={{ fontSize: 13, color: C.fg2, margin: 0, marginBottom: 16 }}>
            {form.description}
          </p>
        )}
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {form.schema_json.fields.map((field) => (
            <FieldRenderer
              key={field.id}
              field={field}
              value={answers[field.id]}
              error={errors[field.id]}
              onChange={(v) =>
                setAnswers((a) => ({ ...a, [field.id]: v }))
              }
            />
          ))}
          {errors._form && (
            <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>
              {errors._form}
            </p>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 8,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: C.fg2,
                padding: '8px 14px',
                borderRadius: 999,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submit.isPending}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                padding: '8px 16px',
                borderRadius: 999,
                background: C.accent,
                border: 'none',
                cursor: submit.isPending ? 'wait' : 'pointer',
                opacity: submit.isPending ? 0.6 : 1,
              }}
            >
              {submit.isPending ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FieldRenderer({
  field,
  value,
  error,
  onChange,
}: {
  field: IntakeField
  value: unknown
  error?: string
  onChange: (value: unknown) => void
}) {
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: C.fg2,
  }
  const inputStyle: React.CSSProperties = {
    fontSize: 14,
    padding: '8px 12px',
    borderRadius: 10,
    border: `1px solid ${error ? '#dc2626' : C.line}`,
    background: C.bg,
    color: C.fg0,
    outline: 'none',
    width: '100%',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={labelStyle}>
        {field.label}
        {field.required && (
          <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>
        )}
      </label>
      {field.type === 'long_text' ? (
        <textarea
          rows={4}
          style={inputStyle}
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === 'select' ? (
        <select
          style={inputStyle}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : field.type === 'multiselect' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(field.options ?? []).map((opt) => {
            const selected = Array.isArray(value) && value.includes(opt)
            return (
              <label
                key={opt}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => {
                    const current = Array.isArray(value)
                      ? (value as string[])
                      : []
                    onChange(
                      e.target.checked
                        ? [...current, opt]
                        : current.filter((v) => v !== opt),
                    )
                  }}
                />
                {opt}
              </label>
            )
          })}
        </div>
      ) : (
        <input
          type={field.type === 'email' ? 'email' : 'text'}
          style={inputStyle}
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error && (
        <span style={{ fontSize: 11, color: '#dc2626' }}>{error}</span>
      )}
    </div>
  )
}
