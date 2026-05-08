'use client'

// Intake tab — ported from intake.jsx in the design handoff.
// Wires to /v1/coaching/intake-forms and /v1/coaching/intake-responses.

import {
  useCoachingIntakeForm,
  useCoachingIntakeResponses,
  useDeleteCoachingIntakeForm,
  useUpsertCoachingIntakeForm,
  type CoachingIntakeResponseRead,
  type IntakeField,
  type IntakeFieldType,
  type IntakeSchema as IntakeSchemaType,
} from '@/hooks/queries/coaching'
import type { CourseRead } from '@/hooks/queries/courses'
import { useEffect, useMemo, useState } from 'react'
import { toast } from '../../../Toast/use-toast'
import { Ic } from '../icons'
import { Avatar, Btn, Modal, SectionHead, Toggle } from '../ui'

// Backend field types and their display labels. Labels match the design's
// short / long / single / multi / email naming.
const TYPE_LABEL: Record<IntakeFieldType, string> = {
  short_text: 'Short text',
  long_text: 'Long text',
  select: 'Single select',
  multiselect: 'Multi-select',
  email: 'Email',
}

type DraftField = IntakeField & { _key: string }

const newId = (): string => `f_${Math.random().toString(36).slice(2, 10)}`

const blankField = (type: IntakeFieldType = 'short_text'): DraftField => ({
  _key: Math.random().toString(36).slice(2),
  id: newId(),
  type,
  label: 'New question',
  placeholder: '',
  required: false,
  options: type === 'select' || type === 'multiselect' ? ['Option 1', 'Option 2'] : null,
})

export function IntakeTab({ course }: { course: CourseRead }) {
  const courseId = course.id
  const { data: form } = useCoachingIntakeForm(courseId)
  const { data: responses = [] } = useCoachingIntakeResponses(courseId)
  const upsert = useUpsertCoachingIntakeForm(courseId)
  const remove = useDeleteCoachingIntakeForm(courseId)

  const [enabled, setEnabled] = useState<boolean>(!!form)
  const [fields, setFields] = useState<DraftField[]>([])
  const [formTitle, setFormTitle] = useState<string>('Intake form')
  const [formDescription, setFormDescription] = useState<string>('')
  const [requiredForAccess, setRequiredForAccess] = useState<boolean>(false)
  const [showFormEditor, setShowFormEditor] = useState(false)
  const [showAddType, setShowAddType] = useState(false)
  const [selectedSub, setSelectedSub] = useState<
    CoachingIntakeResponseRead | null
  >(null)

  // Re-seed from server form
  useEffect(() => {
    if (form !== undefined) {
      setEnabled(!!form)
      setFields(
        (form?.schema_json?.fields ?? []).map((f) => ({
          ...f,
          _key: f.id,
        })),
      )
      setFormTitle(form?.title ?? 'Intake form')
      setFormDescription(form?.description ?? '')
      setRequiredForAccess(form?.required_for_access ?? false)
    }
  }, [form?.id])

  useEffect(() => {
    if (responses.length > 0 && !selectedSub) setSelectedSub(responses[0]!)
  }, [responses, selectedSub])

  const totalFields = fields.length

  const handleSave = async () => {
    if (fields.some((f) => !f.label.trim())) {
      toast({ title: 'Every field needs a label.' })
      return
    }
    const schema_json: IntakeSchemaType = {
      fields: fields.map(({ _key: _ignored, ...rest }) => ({
        ...rest,
        options:
          rest.type === 'select' || rest.type === 'multiselect'
            ? (rest.options ?? []).filter((o) => o.trim().length > 0)
            : null,
      })),
    }
    try {
      await upsert.mutateAsync({
        course_id: courseId,
        title: formTitle.trim() || 'Intake form',
        description: formDescription.trim() || null,
        required_for_access: requiredForAccess,
        schema_json,
      })
      setShowFormEditor(false)
      toast({ title: 'Intake form saved.' })
    } catch (e) {
      toast({
        title: 'Could not save form',
        description: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  }

  const handleToggle = async (next: boolean) => {
    setEnabled(next)
    if (!next && form) {
      if (
        confirm(
          'Disable intake? Existing responses are preserved but members no longer see the form.',
        )
      ) {
        try {
          await remove.mutateAsync(form.id)
        } catch (e) {
          toast({
            title: 'Could not disable',
            description: e instanceof Error ? e.message : 'Unknown error',
          })
          setEnabled(true)
        }
      } else {
        setEnabled(true)
      }
    } else if (next && !form) {
      // Create an empty form so the editor has something to write to.
      try {
        await upsert.mutateAsync({
          course_id: courseId,
          title: 'Intake form',
          description: null,
          required_for_access: false,
          schema_json: { fields: [] },
        })
      } catch (e) {
        toast({
          title: 'Could not enable',
          description: e instanceof Error ? e.message : 'Unknown error',
        })
        setEnabled(false)
      }
    }
  }

  const formattedAnswers = useMemo(() => {
    if (!selectedSub) return []
    return fields.map((f) => {
      const value = (selectedSub.answers as Record<string, unknown>)[f.id]
      return { field: f, value }
    })
  }, [selectedSub, fields])

  return (
    <>
      <SectionHead
        title="Intake"
        subtitle="A short questionnaire your members fill out after they buy."
        actions={
          <>
            <span
              className="ce-row"
              style={{ gap: 10, color: 'var(--ink-3)', fontSize: 13 }}
            >
              {enabled ? 'Intake enabled' : 'Intake disabled'}
              <Toggle on={enabled} onChange={handleToggle} />
            </span>
            {enabled && (
              <Btn
                icon={<Ic.Edit size={14} />}
                onClick={() => setShowFormEditor(true)}
              >
                Edit form
              </Btn>
            )}
          </>
        }
      />

      {!enabled ? (
        <div
          className="ce-card ce-card-pad"
          style={{ background: 'var(--bg-muted)', color: 'var(--ink-3)' }}
        >
          Intake is disabled. Toggle it on to ask your cohort questions before
          the first call.
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              gap: 18,
              marginBottom: 18,
              color: 'var(--ink-3)',
              fontSize: 13,
            }}
          >
            <span>
              <strong style={{ color: 'var(--ink)' }}>{responses.length}</strong>{' '}
              {responses.length === 1 ? 'response' : 'responses'}
            </span>
            <span style={{ color: 'var(--ink-5)' }}>·</span>
            <span>
              {totalFields} question{totalFields === 1 ? '' : 's'}
            </span>
          </div>

          <div className="ce-card">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '260px 1fr',
                minHeight: 520,
              }}
            >
              <div
                style={{
                  borderRight: '1px solid var(--line)',
                  maxHeight: 620,
                  overflow: 'auto',
                }}
              >
                {responses.length === 0 ? (
                  <div
                    style={{
                      padding: 32,
                      color: 'var(--ink-4)',
                      fontSize: 13,
                    }}
                  >
                    No responses yet.
                  </div>
                ) : (
                  responses.map((s) => (
                    <div
                      key={s.id}
                      className={
                        'ce-submission' +
                        (selectedSub?.id === s.id ? ' selected' : '')
                      }
                      onClick={() => setSelectedSub(s)}
                    >
                      <div className="ce-row" style={{ gap: 12 }}>
                        <Avatar
                          name={
                            s.customer_name || s.customer_email || s.customer_id
                          }
                          size={28}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="who">
                            {s.customer_name || s.customer_email || 'Member'}
                          </div>
                          <div
                            className="preview"
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {previewAnswer(s, fields)}
                          </div>
                        </div>
                        <div
                          className="ce-mini"
                          style={{ flexShrink: 0 }}
                        >
                          {fmtRelative(s.submitted_at)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div style={{ padding: '32px 36px' }}>
                {selectedSub ? (
                  <>
                    <div className="ce-row" style={{ gap: 14 }}>
                      <Avatar
                        name={
                          selectedSub.customer_name ||
                          selectedSub.customer_email ||
                          'Member'
                        }
                        size={40}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: 15 }}>
                          {selectedSub.customer_name ||
                            selectedSub.customer_email ||
                            'Member'}
                        </div>
                        <div className="ce-mini" style={{ marginTop: 2 }}>
                          Submitted{' '}
                          {new Date(
                            selectedSub.submitted_at,
                          ).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <hr className="ce-divider" />
                    <div className="ce-stack-24">
                      {formattedAnswers.map(({ field, value }, i) => (
                        <div key={field.id}>
                          <div
                            className="ce-mini"
                            style={{
                              marginBottom: 6,
                              textTransform: 'uppercase',
                              letterSpacing: '.06em',
                              fontWeight: 500,
                            }}
                          >
                            Q{i + 1} · {field.label}
                          </div>
                          <div
                            style={{
                              fontSize: 14,
                              color: 'var(--ink)',
                              lineHeight: 1.6,
                            }}
                          >
                            {renderAnswer(field, value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      color: 'var(--ink-4)',
                      padding: 32,
                      fontSize: 13,
                    }}
                  >
                    Select a response on the left to see the answers.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <Modal
        open={showFormEditor}
        onClose={() => setShowFormEditor(false)}
        title="Edit intake form"
        subtitle="Members fill this out the first time they open their portal."
        footer={
          <>
            <Btn variant="ghost" onClick={() => setShowFormEditor(false)}>
              Cancel
            </Btn>
            <Btn
              variant="primary"
              onClick={handleSave}
              disabled={upsert.isPending}
            >
              {upsert.isPending ? 'Saving…' : 'Save form'}
            </Btn>
          </>
        }
      >
        <div>
          <div className="ce-stack-16" style={{ marginBottom: 24 }}>
            <div>
              <label className="ce-label">Form title</label>
              <input
                className="ce-input"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Intake form"
              />
            </div>
            <div>
              <label className="ce-label">Description</label>
              <textarea
                className="ce-textarea"
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="A short note explaining what you'll do with the answers."
              />
            </div>
            <label
              className="ce-row"
              style={{ gap: 8, fontSize: 13, color: 'var(--ink-2)' }}
            >
              <input
                type="checkbox"
                checked={requiredForAccess}
                onChange={(e) => setRequiredForAccess(e.target.checked)}
              />
              Show a banner prompting members to fill it out
              <span className="ce-mini" style={{ marginLeft: 4 }}>
                (never blocks access)
              </span>
            </label>
          </div>
          <hr className="ce-divider" style={{ margin: '0 0 16px' }} />
          <div className="ce-label" style={{ marginBottom: 12 }}>
            Fields
          </div>
          {fields.map((f, idx) => (
            <FieldBlock
              key={f._key}
              field={f}
              canMoveUp={idx > 0}
              canMoveDown={idx < fields.length - 1}
              onMove={(dir) => {
                const j = dir === 'up' ? idx - 1 : idx + 1
                if (j < 0 || j >= fields.length) return
                const next = fields.slice()
                next.splice(idx, 1)
                next.splice(j, 0, f)
                setFields(next)
              }}
              onUpdate={(u) =>
                setFields(
                  fields.map((x) => (x._key === f._key ? { ...u, _key: x._key } : x)),
                )
              }
              onDelete={() =>
                setFields(fields.filter((x) => x._key !== f._key))
              }
            />
          ))}
          <div style={{ position: 'relative' }}>
            <button
              className="ce-btn"
              onClick={() => setShowAddType(!showAddType)}
              style={{
                width: '100%',
                padding: 14,
                justifyContent: 'center',
                borderStyle: 'dashed',
                color: 'var(--ink-3)',
                marginTop: 8,
              }}
            >
              <Ic.Plus size={13} /> Add field
            </button>
            {showAddType && (
              <div
                className="ce-menu"
                style={{ left: 0, right: 0, top: '100%', marginTop: 4 }}
              >
                {(
                  [
                    { id: 'short_text', label: 'Short text', glyph: '—' },
                    { id: 'long_text', label: 'Long text', glyph: '¶' },
                    { id: 'select', label: 'Single select', glyph: '◉' },
                    { id: 'multiselect', label: 'Multi-select', glyph: '☑' },
                    { id: 'email', label: 'Email', glyph: '@' },
                  ] as { id: IntakeFieldType; label: string; glyph: string }[]
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setFields([...fields, blankField(t.id)])
                      setShowAddType(false)
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        display: 'grid',
                        placeItems: 'center',
                        background: 'var(--bg-muted)',
                        borderRadius: 4,
                        fontSize: 12,
                        color: 'var(--ink-3)',
                        fontFamily: 'ui-monospace, monospace',
                      }}
                    >
                      {t.glyph}
                    </span>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}

function FieldBlock({
  field,
  canMoveUp,
  canMoveDown,
  onMove,
  onUpdate,
  onDelete,
}: {
  field: IntakeField
  canMoveUp: boolean
  canMoveDown: boolean
  onMove: (dir: 'up' | 'down') => void
  onUpdate: (next: IntakeField) => void
  onDelete: () => void
}) {
  const supportsOptions =
    field.type === 'select' || field.type === 'multiselect'
  return (
    <div className="ce-field-block">
      <div
        className="ce-field-handle"
        style={{ flexDirection: 'column', gap: 0 }}
      >
        <button
          type="button"
          aria-label="Move up"
          onClick={() => onMove('up')}
          disabled={!canMoveUp}
          style={{
            background: 'transparent',
            border: 0,
            color: canMoveUp ? 'var(--ink-3)' : 'var(--ink-5)',
            cursor: canMoveUp ? 'pointer' : 'not-allowed',
            padding: 0,
            lineHeight: 1,
          }}
        >
          <Ic.ChevronDown size={14} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <button
          type="button"
          aria-label="Move down"
          onClick={() => onMove('down')}
          disabled={!canMoveDown}
          style={{
            background: 'transparent',
            border: 0,
            color: canMoveDown ? 'var(--ink-3)' : 'var(--ink-5)',
            cursor: canMoveDown ? 'pointer' : 'not-allowed',
            padding: 0,
            lineHeight: 1,
          }}
        >
          <Ic.ChevronDown size={14} />
        </button>
      </div>
      <div style={{ flex: 1 }}>
        <div className="ce-row" style={{ gap: 8, marginBottom: 8 }}>
          <span className="ce-field-type-pill">
            {TYPE_LABEL[field.type] ?? field.type}
          </span>
          {field.required && (
            <span
              className="ce-field-type-pill"
              style={{ background: 'var(--bg)', color: 'var(--ink-3)' }}
            >
              Required
            </span>
          )}
          <label
            className="ce-row ce-mini"
            style={{ gap: 4, marginLeft: 'auto', cursor: 'pointer' }}
          >
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) =>
                onUpdate({ ...field, required: e.target.checked })
              }
            />
            Required
          </label>
        </div>
        <input
          className="ce-input"
          style={{
            fontWeight: 500,
            border: 0,
            padding: '2px 0',
            background: 'transparent',
          }}
          value={field.label}
          onChange={(e) => onUpdate({ ...field, label: e.target.value })}
        />
        {supportsOptions && (
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {(field.options ?? []).map((o, i) => (
              <div key={i} className="ce-row" style={{ gap: 8 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    border: '1.5px solid var(--ink-5)',
                    borderRadius: field.type === 'select' ? 99 : 3,
                  }}
                />
                <input
                  className="ce-input"
                  style={{
                    border: 0,
                    padding: '2px 0',
                    background: 'transparent',
                    fontSize: 13,
                  }}
                  value={o}
                  onChange={(e) =>
                    onUpdate({
                      ...field,
                      options: (field.options ?? []).map((x, j) =>
                        j === i ? e.target.value : x,
                      ),
                    })
                  }
                />
              </div>
            ))}
            <button
              className="ce-btn ce-btn-ghost ce-btn-sm"
              style={{ alignSelf: 'flex-start', padding: '2px 0' }}
              onClick={() =>
                onUpdate({
                  ...field,
                  options: [...(field.options ?? []), 'New option'],
                })
              }
            >
              <Ic.Plus size={11} /> Add option
            </button>
          </div>
        )}
      </div>
      <Btn variant="ghost" size="icon" onClick={onDelete}>
        <Ic.Trash size={14} />
      </Btn>
    </div>
  )
}

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function previewAnswer(
  sub: CoachingIntakeResponseRead,
  fields: IntakeField[],
): string {
  for (const f of fields) {
    const v = (sub.answers as Record<string, unknown>)[f.id]
    if (typeof v === 'string' && v.trim()) return v
    if (Array.isArray(v) && v.length) return (v as string[]).join(', ')
  }
  return '—'
}

function renderAnswer(field: IntakeField, value: unknown) {
  if (value == null || value === '') {
    return <span style={{ color: 'var(--ink-4)' }}>—</span>
  }
  if (Array.isArray(value)) {
    return (
      <div className="ce-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {(value as string[]).map((v) => (
          <span key={v} className="ce-chip">
            {v}
          </span>
        ))}
      </div>
    )
  }
  if (field.type === 'select') {
    return <span className="ce-chip">{String(value)}</span>
  }
  return <>{String(value)}</>
}
