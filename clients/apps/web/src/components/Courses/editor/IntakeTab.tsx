'use client'

import {
  CoachingIntakeFormRead,
  IntakeField,
  IntakeFieldType,
  IntakeSchema,
  useCoachingIntakeForm,
  useCoachingIntakeResponses,
  useDeleteCoachingIntakeForm,
  useUpsertCoachingIntakeForm,
} from '@/hooks/queries/coaching'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DragHandleOutlined from '@mui/icons-material/DragHandleOutlined'
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined'
import { useEffect, useState } from 'react'
import { toast } from '../../Toast/use-toast'

const FIELD_TYPES: { id: IntakeFieldType; label: string }[] = [
  { id: 'short_text', label: 'Short text' },
  { id: 'long_text', label: 'Long text' },
  { id: 'email', label: 'Email' },
  { id: 'select', label: 'Single select' },
  { id: 'multiselect', label: 'Multi-select' },
]

type DraftField = IntakeField & { _key: string }

const newFieldId = (): string =>
  `f_${Math.random().toString(36).slice(2, 10)}`

const blankField = (): DraftField => ({
  _key: Math.random().toString(36).slice(2),
  id: newFieldId(),
  type: 'short_text',
  label: '',
  placeholder: '',
  required: false,
  options: null,
})

function fromForm(form: CoachingIntakeFormRead | null) {
  if (!form) {
    return {
      title: 'Intake form',
      description: '',
      requiredForAccess: false,
      fields: [blankField()],
    }
  }
  return {
    title: form.title ?? 'Intake form',
    description: form.description ?? '',
    requiredForAccess: form.required_for_access,
    fields: (form.schema_json?.fields ?? []).map((f) => ({
      ...f,
      _key: f.id,
    })),
  }
}

export function IntakeTab({ courseId }: { courseId: string }) {
  const { data: form, isLoading } = useCoachingIntakeForm(courseId)
  const { data: responses = [] } = useCoachingIntakeResponses(courseId)
  const upsert = useUpsertCoachingIntakeForm(courseId)
  const remove = useDeleteCoachingIntakeForm(courseId)

  const [state, setState] = useState(() => fromForm(form ?? null))

  // Re-seed when the server form arrives or changes form id.
  useEffect(() => {
    if (form !== undefined) setState(fromForm(form ?? null))
  }, [form?.id])

  const handleAddField = () =>
    setState((s) => ({ ...s, fields: [...s.fields, blankField()] }))

  const handleRemoveField = (key: string) =>
    setState((s) => ({ ...s, fields: s.fields.filter((f) => f._key !== key) }))

  const handleFieldChange = (key: string, patch: Partial<DraftField>) =>
    setState((s) => ({
      ...s,
      fields: s.fields.map((f) =>
        f._key === key ? { ...f, ...patch } : f,
      ),
    }))

  const handleSave = async () => {
    if (state.fields.some((f) => !f.label.trim())) {
      toast({ title: 'Every field needs a label.' })
      return
    }
    const schema_json: IntakeSchema = {
      fields: state.fields.map(({ _key, ...rest }) => ({
        ...rest,
        options: rest.type === 'select' || rest.type === 'multiselect'
          ? (rest.options ?? []).filter((o) => o.trim().length > 0)
          : null,
      })),
    }
    try {
      await upsert.mutateAsync({
        course_id: courseId,
        title: state.title || null,
        description: state.description || null,
        required_for_access: state.requiredForAccess,
        schema_json,
      })
      toast({ title: 'Intake form saved.' })
    } catch (e) {
      toast({
        title: 'Could not save form',
        description: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  }

  const handleDelete = async () => {
    if (!form) return
    if (
      !confirm(
        'Delete the intake form? Existing responses will be deleted too.',
      )
    )
      return
    try {
      await remove.mutateAsync(form.id)
      setState(fromForm(null))
    } catch (e) {
      toast({
        title: 'Could not delete form',
        description: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">
            Intake form
          </h1>
          <p className="mt-1 max-w-xl text-sm text-gray-500">
            Optional questionnaire customers fill out after enrolling. Useful
            for context-gathering before the first call. Submission is
            soft-gated only — purchases always grant access immediately.
          </p>
        </div>
        {form && (
          <button
            onClick={handleDelete}
            className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Delete form
          </button>
        )}
      </header>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wider text-gray-500 uppercase">
                Form title
              </label>
              <input
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={state.title}
                onChange={(e) =>
                  setState((s) => ({ ...s, title: e.target.value }))
                }
                placeholder="Intake form"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wider text-gray-500 uppercase">
                Description
              </label>
              <textarea
                rows={3}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={state.description}
                onChange={(e) =>
                  setState((s) => ({ ...s, description: e.target.value }))
                }
                placeholder="A short note explaining what you'll do with the answers."
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.requiredForAccess}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    requiredForAccess: e.target.checked,
                  }))
                }
              />
              <span>Show a banner prompting customers to fill it out</span>
              <span className="text-[11px] text-gray-400">
                (never blocks access)
              </span>
            </label>
          </div>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-wider text-gray-400 uppercase">
                Fields
              </h2>
              <button
                onClick={handleAddField}
                className="flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:brightness-110"
              >
                <AddOutlined sx={{ fontSize: 14 }} /> Add field
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {state.fields.map((field) => (
                <FieldEditor
                  key={field._key}
                  field={field}
                  onChange={(patch) => handleFieldChange(field._key, patch)}
                  onRemove={() => handleRemoveField(field._key)}
                />
              ))}
              {state.fields.length === 0 && (
                <p className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500">
                  No fields yet. Add one above.
                </p>
              )}
            </div>
          </section>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={upsert.isPending}
              className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {upsert.isPending ? 'Saving…' : form ? 'Save changes' : 'Create form'}
            </button>
          </div>

          {form && (
            <section className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold tracking-wider text-gray-400 uppercase">
                Responses ({responses.length})
              </h2>
              {responses.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500">
                  No responses yet.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {responses.map((r) => (
                    <details
                      key={r.id}
                      className="rounded-xl border border-gray-200 bg-white"
                    >
                      <summary className="flex cursor-pointer items-center justify-between p-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {r.customer_name || r.customer_email || r.customer_id.slice(0, 8)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {r.customer_email ?? '—'} · submitted{' '}
                            {new Date(r.submitted_at).toLocaleString()}
                          </span>
                        </div>
                      </summary>
                      <dl className="grid grid-cols-1 gap-3 border-t border-gray-100 p-4 text-sm md:grid-cols-2">
                        {form.schema_json.fields.map((f) => {
                          const value = (r.answers as Record<string, unknown>)[
                            f.id
                          ]
                          const display = Array.isArray(value)
                            ? value.join(', ')
                            : value == null
                              ? '—'
                              : String(value)
                          return (
                            <div key={f.id} className="flex flex-col gap-1">
                              <dt className="text-[11px] font-medium tracking-wider text-gray-400 uppercase">
                                {f.label}
                              </dt>
                              <dd className="text-sm text-gray-800 whitespace-pre-wrap">
                                {display}
                              </dd>
                            </div>
                          )
                        })}
                      </dl>
                    </details>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function FieldEditor({
  field,
  onChange,
  onRemove,
}: {
  field: DraftField
  onChange: (patch: Partial<DraftField>) => void
  onRemove: () => void
}) {
  const supportsOptions = field.type === 'select' || field.type === 'multiselect'
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <DragHandleOutlined sx={{ fontSize: 18, color: '#9ca3af' }} />
        <input
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Field label"
        />
        <select
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          value={field.type}
          onChange={(e) =>
            onChange({
              type: e.target.value as IntakeFieldType,
              options:
                e.target.value === 'select' || e.target.value === 'multiselect'
                  ? field.options ?? []
                  : null,
            })
          }
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onChange({ required: e.target.checked })}
          />
          Required
        </label>
        <button
          onClick={onRemove}
          className="rounded-full p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
          aria-label="Remove field"
        >
          <DeleteOutlineOutlined sx={{ fontSize: 18 }} />
        </button>
      </div>
      {field.type !== 'long_text' && (
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 focus:border-blue-500 focus:outline-none"
          value={field.placeholder ?? ''}
          onChange={(e) => onChange({ placeholder: e.target.value })}
          placeholder="Placeholder (optional)"
        />
      )}
      {supportsOptions && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium tracking-wider text-gray-400 uppercase">
            Options (one per line)
          </label>
          <textarea
            rows={3}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={(field.options ?? []).join('\n')}
            onChange={(e) =>
              onChange({
                options: e.target.value
                  .split('\n')
                  .map((line) => line.trim())
                  .filter((line) => line.length > 0),
              })
            }
            placeholder={'Beginner\nIntermediate\nAdvanced'}
          />
        </div>
      )}
    </div>
  )
}
