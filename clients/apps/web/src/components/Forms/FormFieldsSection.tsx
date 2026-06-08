'use client'

import CustomFieldTypeIcon from '@/components/CustomFields/CustomFieldTypeIcon'
import { useCustomFields } from '@/hooks/queries'
import ClearOutlined from '@mui/icons-material/ClearOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import { List, ListItem } from '@spaire/ui/components/atoms/List'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@spaire/ui/components/atoms/Select'
import Switch from '@spaire/ui/components/atoms/Switch'
import {
  FormControl,
  FormField,
  FormLabel,
} from '@spaire/ui/components/ui/form'
import { useMemo, useState } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import type { FormBuilderValues } from './FormBuilder'

const BasicFieldRow = ({ label }: { label: string }) => (
  <ListItem size="small">
    <div className="flex w-full items-center justify-between text-gray-500">
      <span>{label}</span>
      <LockOutlined fontSize="inherit" />
    </div>
  </ListItem>
)

export interface FormFieldsSectionProps {
  organization: schemas['Organization']
}

export const FormFieldsSection = ({ organization }: FormFieldsSectionProps) => {
  const { control } = useFormContext<FormBuilderValues>()
  const { data: customFields } = useCustomFields(organization.id)

  const {
    fields: attachedCustomFields,
    remove,
    append,
  } = useFieldArray({
    control,
    name: 'attached_custom_fields',
  })

  const attachedCustomFieldsMap = useMemo(
    () =>
      attachedCustomFields.reduce<Record<string, schemas['CustomField']>>(
        (acc, field) => {
          const customField = customFields?.items.find(
            ({ id }) => id === field.custom_field_id,
          )
          if (customField) {
            return { ...acc, [field.custom_field_id]: customField }
          }
          return acc
        },
        {},
      ),
    [attachedCustomFields, customFields],
  )

  const [selectedField, setSelectedField] = useState<string>('')
  const onAddField = () => {
    if (!selectedField) return
    append({ custom_field_id: selectedField, required: false })
    setSelectedField('')
  }

  const availableFields =
    customFields?.items.filter(({ id }) => !attachedCustomFieldsMap[id]) ?? []

  return (
    <div className="flex w-full flex-col gap-4 text-sm">
      <List size="small" className="w-full">
        {/* Basic info fields can't be edited. */}
        <BasicFieldRow label="Name" />
        <BasicFieldRow label="Email" />
        {Object.entries(attachedCustomFieldsMap).map(
          ([customFieldId, customField], index) => (
            <ListItem key={customFieldId} size="small">
              <div className="flex w-full justify-between">
                <div className="flex flex-row items-center gap-2">
                  <CustomFieldTypeIcon type={customField.type} />
                  {customField.name}
                </div>
                <div className="flex flex-row items-center gap-4">
                  <FormField
                    control={control}
                    name={`attached_custom_fields.${index}.required`}
                    render={({ field }) => (
                      <div className="flex flex-row items-center gap-4">
                        <FormLabel
                          className={twMerge(
                            'text-sm',
                            field.value ? '' : 'text-gray-500',
                          )}
                        >
                          Required
                        </FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </div>
                    )}
                  />
                  <Button
                    className="border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100"
                    size="icon"
                    variant="secondary"
                    type="button"
                    onClick={() => remove(index)}
                  >
                    <ClearOutlined fontSize="inherit" />
                  </Button>
                </div>
              </div>
            </ListItem>
          ),
        )}
      </List>

      {availableFields.length > 0 ? (
        <div className="flex flex-row gap-2">
          <Select value={selectedField} onValueChange={setSelectedField}>
            <SelectTrigger>
              <SelectValue placeholder="Collect additional customer info" />
            </SelectTrigger>
            <SelectContent>
              {availableFields.map((customField) => (
                <SelectItem
                  key={customField.id}
                  value={customField.id}
                  textValue={customField.name}
                >
                  <div className="flex flex-row items-center gap-2">
                    <CustomFieldTypeIcon type={customField.type} />
                    {customField.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="secondary" onClick={onAddField}>
            Add Field
          </Button>
        </div>
      ) : (
        <p className="text-gray-500">
          Create custom fields in your settings to collect more than a name and
          email.
        </p>
      )}
    </div>
  )
}
