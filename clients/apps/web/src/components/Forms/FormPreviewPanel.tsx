'use client'

import { useCustomFields } from '@/hooks/queries'
import { schemas } from '@spaire/client'
import type { FormBuilderValues } from './FormBuilder'

const FieldLabel = ({
  children,
  required,
}: {
  children: React.ReactNode
  required?: boolean
}) => (
  <label className="text-sm font-medium text-gray-700">
    {children}
    {required ? <span className="text-red-500"> *</span> : null}
  </label>
)

const previewInputClass =
  'pointer-events-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400'

const PreviewCustomField = ({
  customField,
  required,
}: {
  customField: schemas['CustomField']
  required: boolean
}) => {
  const label = customField.name
  if (customField.type === 'select') {
    const options = customField.properties.options ?? []
    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel required={required}>{label}</FieldLabel>
        <div className={previewInputClass}>
          {options[0]?.label ?? 'Choose an option'}
        </div>
      </div>
    )
  }
  if (customField.type === 'checkbox') {
    return (
      <div className="flex flex-row items-center gap-2">
        <div className="pointer-events-none h-4 w-4 rounded border border-gray-300 bg-gray-50" />
        <FieldLabel required={required}>{label}</FieldLabel>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className={previewInputClass}>
        {customField.type === 'number'
          ? '0'
          : customField.type === 'date'
            ? 'YYYY-MM-DD'
            : 'Your answer'}
      </div>
    </div>
  )
}

export interface FormPreviewPanelProps {
  organization: schemas['Organization']
  values: Partial<FormBuilderValues>
}

export const FormPreviewPanel = ({
  organization,
  values,
}: FormPreviewPanelProps) => {
  const { data: customFields } = useCustomFields(organization.id)
  const attached = values.attached_custom_fields ?? []
  const resolve = (id: string) =>
    customFields?.items.find((field) => field.id === id)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
        <p className="mt-1 text-sm text-gray-500">
          This is what visitors see — it updates as you edit.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">
            {values.title || 'Your headline goes here'}
          </h3>
          {values.subtitle ? (
            <p className="mt-2 text-sm text-gray-500">{values.subtitle}</p>
          ) : null}
        </div>

        {values.lead_magnet_name ? (
          <div className="flex flex-row items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-600">
            📎 {values.lead_magnet_name}
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Name</FieldLabel>
            <div className={previewInputClass}>Jane Doe</div>
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Email</FieldLabel>
            <div className={previewInputClass}>jane@example.com</div>
          </div>

          {attached.map((field, index) => {
            const customField = field?.custom_field_id
              ? resolve(field.custom_field_id)
              : undefined
            if (!customField) return null
            return (
              <PreviewCustomField
                key={index}
                customField={customField}
                required={!!field?.required}
              />
            )
          })}

          <button
            type="button"
            className="pointer-events-none mt-2 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white"
          >
            {values.button_label || 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}
