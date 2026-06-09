'use client'

import {
  FormPublic,
  FormSubmitResult,
  useSubmitForm,
} from '@/hooks/queries/forms'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import Input from '@spaire/ui/components/atoms/Input'
import { useState } from 'react'

type FieldValue = string | number | boolean | null

const labelClass = 'text-sm font-medium text-gray-700'
const controlClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none'

const CustomFieldControl = ({
  customField,
  required,
  value,
  onChange,
}: {
  customField: schemas['CustomField']
  required: boolean
  value: FieldValue
  onChange: (value: FieldValue) => void
}) => {
  const label = (
    <label className={labelClass}>
      {customField.name}
      {required ? <span className="text-red-500"> *</span> : null}
    </label>
  )

  if (customField.type === 'checkbox') {
    return (
      <label className="flex flex-row items-center gap-2">
        <input
          type="checkbox"
          checked={Boolean(value)}
          required={required}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className={labelClass}>
          {customField.name}
          {required ? <span className="text-red-500"> *</span> : null}
        </span>
      </label>
    )
  }

  if (customField.type === 'select') {
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <select
          className={controlClass}
          required={required}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            Choose an option
          </option>
          {customField.properties.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  const inputType =
    customField.type === 'number'
      ? 'number'
      : customField.type === 'date'
        ? 'date'
        : 'text'

  return (
    <div className="flex flex-col gap-1.5">
      {label}
      <Input
        type={inputType}
        required={required}
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(e) =>
          onChange(
            customField.type === 'number'
              ? e.target.value === ''
                ? null
                : Number(e.target.value)
              : e.target.value,
          )
        }
      />
    </div>
  )
}

export const StorefrontForm = ({
  form,
  preview = false,
}: {
  form: FormPublic
  preview?: boolean
}) => {
  const submit = useSubmitForm(form.id)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [fieldValues, setFieldValues] = useState<Record<string, FieldValue>>({})
  const [result, setResult] = useState<FormSubmitResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (preview) return
    setError(null)
    try {
      const res = await submit.mutateAsync({
        email,
        name: name || null,
        custom_field_data: fieldValues,
      })
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  if (result?.success) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="text-3xl">🎉</div>
        <p className="text-base font-medium text-gray-900">
          {result.success_message || "You're in! Check your inbox."}
        </p>
        {result.download ? (
          <a href={result.download.url} target="_blank" rel="noreferrer">
            <Button>Download now</Button>
          </a>
        ) : null}
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div>
        <h3 className="text-xl font-semibold text-gray-900">{form.title}</h3>
        {form.subtitle ? (
          <p className="mt-2 text-sm text-gray-500">{form.subtitle}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>
          Email<span className="text-red-500"> *</span>
        </label>
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      {form.attached_custom_fields.map((attached) => (
        <CustomFieldControl
          key={attached.custom_field_id}
          customField={attached.custom_field}
          required={attached.required}
          value={fieldValues[attached.custom_field.slug] ?? null}
          onChange={(value) =>
            setFieldValues((prev) => ({
              ...prev,
              [attached.custom_field.slug]: value,
            }))
          }
        />
      ))}

      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <Button
        type="submit"
        loading={submit.isPending}
        disabled={preview || submit.isPending}
        className="w-full"
      >
        {form.button_label}
      </Button>
    </form>
  )
}
