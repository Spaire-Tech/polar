'use client'

import {
  FormResource,
  FormStatus,
  useCreateForm,
  useUpdateForm,
} from '@/hooks/queries/forms'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import Input from '@spaire/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@spaire/ui/components/atoms/Select'
import TextArea from '@spaire/ui/components/atoms/TextArea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@spaire/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { DashboardBody } from '../Layout/DashboardLayout'
import { toast } from '../Toast/use-toast'
import { getStatusRedirect } from '../Toast/utils'
import { FormFieldsSection } from './FormFieldsSection'
import { LeadMagnetUpload } from './LeadMagnetUpload'

export type FormBuilderValues = {
  title: string
  subtitle: string
  button_label: string
  success_message: string
  status: FormStatus
  file_id: string | null
  // UI-only: the attached file's display name, stripped before submit.
  lead_magnet_name: string | null
  attached_custom_fields: { custom_field_id: string; required: boolean }[]
}

const LabeledField = ({
  label,
  count,
  max,
  children,
}: {
  label: string
  count?: number
  max?: number
  children: React.ReactNode
}) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {max !== undefined ? (
        <span className="text-xs text-gray-400">
          {count ?? 0}/{max}
        </span>
      ) : null}
    </div>
    {children}
  </div>
)

const Section = ({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) => (
  <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 p-6">
    <div>
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      ) : null}
    </div>
    {children}
  </div>
)

const toDefaults = (initialForm?: FormResource): FormBuilderValues =>
  initialForm
    ? {
        title: initialForm.title,
        subtitle: initialForm.subtitle ?? '',
        button_label: initialForm.button_label,
        success_message: initialForm.success_message ?? '',
        status: initialForm.status,
        file_id: initialForm.file_id,
        lead_magnet_name: initialForm.file_id ? 'Attached file' : null,
        attached_custom_fields: initialForm.attached_custom_fields.map((f) => ({
          custom_field_id: f.custom_field_id,
          required: f.required,
        })),
      }
    : {
        title: '',
        subtitle: '',
        button_label: 'Submit',
        success_message: '',
        status: 'draft',
        file_id: null,
        lead_magnet_name: null,
        attached_custom_fields: [],
      }

export interface FormBuilderProps {
  organization: schemas['Organization']
  initialForm?: FormResource
  splitMode?: boolean
  onChange?: (values: Partial<FormBuilderValues>) => void
}

export const FormBuilder = ({
  organization,
  initialForm,
  splitMode,
  onChange,
}: FormBuilderProps) => {
  const router = useRouter()
  const form = useForm<FormBuilderValues>({
    defaultValues: toDefaults(initialForm),
  })
  const { control, handleSubmit, setValue } = form

  const createForm = useCreateForm()
  const updateForm = useUpdateForm()
  const isSubmitting = createForm.isPending || updateForm.isPending

  // Lift specific fields up for the live preview. Watching named fields (not
  // the whole form) keeps the references stable so the effect doesn't loop.
  const title = useWatch({ control, name: 'title' })
  const subtitle = useWatch({ control, name: 'subtitle' })
  const buttonLabel = useWatch({ control, name: 'button_label' })
  const leadMagnetName = useWatch({ control, name: 'lead_magnet_name' })
  const attachedCustomFields = useWatch({
    control,
    name: 'attached_custom_fields',
  })

  useEffect(() => {
    onChange?.({
      title,
      subtitle,
      button_label: buttonLabel,
      lead_magnet_name: leadMagnetName,
      attached_custom_fields: attachedCustomFields,
    })
  }, [
    title,
    subtitle,
    buttonLabel,
    leadMagnetName,
    attachedCustomFields,
    onChange,
  ])

  const onSubmit = async (values: FormBuilderValues) => {
    const payload = {
      title: values.title,
      subtitle: values.subtitle.trim() || null,
      button_label: values.button_label,
      success_message: values.success_message.trim() || null,
      status: values.status,
      file_id: values.file_id,
      attached_custom_fields: values.attached_custom_fields.map((f) => ({
        custom_field_id: f.custom_field_id,
        required: f.required,
      })),
    }
    try {
      if (initialForm) {
        await updateForm.mutateAsync({ id: initialForm.id, body: payload })
      } else {
        await createForm.mutateAsync({
          ...payload,
          organization_id: organization.id,
        })
      }
      router.push(
        getStatusRedirect(
          `/dashboard/${organization.slug}/forms`,
          initialForm ? 'Form updated' : 'Form created',
          initialForm
            ? 'Your form was updated successfully.'
            : 'Your form was created successfully.',
        ),
      )
    } catch (e) {
      toast({
        title: 'Error',
        description:
          e instanceof Error ? e.message : 'Failed to save the form.',
      })
    }
  }

  const content = (
    <Form {...form}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-6 pb-12"
      >
        <Section title="Add text">
          <FormField
            control={control}
            name="title"
            rules={{ required: 'A title is required', maxLength: 50 }}
            render={({ field }) => (
              <FormItem>
                <LabeledField
                  label="Title"
                  count={field.value?.length ?? 0}
                  max={50}
                >
                  <FormControl>
                    <Input
                      {...field}
                      maxLength={50}
                      placeholder="Get My FREE Guide Now!"
                    />
                  </FormControl>
                </LabeledField>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="subtitle"
            render={({ field }) => (
              <FormItem>
                <LabeledField
                  label="Subtitle"
                  count={field.value?.length ?? 0}
                  max={100}
                >
                  <FormControl>
                    <TextArea
                      {...field}
                      maxLength={100}
                      placeholder="Join my email list and never miss an update from me!"
                      resizable={false}
                    />
                  </FormControl>
                </LabeledField>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="button_label"
            rules={{ required: 'A button label is required', maxLength: 30 }}
            render={({ field }) => (
              <FormItem>
                <LabeledField
                  label="Button"
                  count={field.value?.length ?? 0}
                  max={30}
                >
                  <FormControl>
                    <Input
                      {...field}
                      maxLength={30}
                      placeholder="SUBMIT & DOWNLOAD"
                    />
                  </FormControl>
                </LabeledField>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <Section
          title="Collect info"
          description="Basic info fields can't be edited."
        >
          <FormFieldsSection organization={organization} />
        </Section>

        <Section
          title="Lead magnet"
          description="The file delivered to subscribers after they submit."
        >
          <LeadMagnetUpload
            organization={organization}
            fileName={leadMagnetName ?? null}
            onChange={(fileId, fileName) => {
              setValue('file_id', fileId, { shouldDirty: true })
              setValue('lead_magnet_name', fileName, { shouldDirty: true })
            }}
          />
        </Section>

        <Section title="Visibility">
          <FormField
            control={control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </Section>

        <div className="flex flex-row items-center gap-2">
          <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
            {initialForm ? 'Save changes' : 'Create form'}
          </Button>
        </div>
      </form>
    </Form>
  )

  if (splitMode) {
    return (
      <div className="flex flex-col gap-6 px-8 py-8">
        <h1 className="text-xl font-semibold text-gray-900">
          {initialForm ? 'Edit form' : 'New form'}
        </h1>
        {content}
      </div>
    )
  }

  return (
    <DashboardBody title={initialForm ? 'Edit form' : 'New form'}>
      {content}
    </DashboardBody>
  )
}
