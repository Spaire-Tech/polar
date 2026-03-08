'use client'

import { useCallback, useMemo } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import Button from '@spaire/ui/components/atoms/Button'
import Input from '@spaire/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@spaire/ui/components/atoms/Select'
import {
  RadioGroup,
  RadioGroupItem,
} from '@spaire/ui/components/ui/radio-group'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@spaire/ui/components/ui/form'
import {
  getRecommendation,
  US_STATES,
  type RecommendationInput,
  type RecommendationOutput,
} from '../recommendation'
import { companyDetailsSchema, type CompanyDetailsData } from '../types'

interface CompanyDetailsStepProps {
  intentData: RecommendationInput
  data: Partial<CompanyDetailsData>
  onNext: (data: CompanyDetailsData, recommendation: RecommendationOutput) => void
  onBack: () => void
}

export default function CompanyDetailsStep({
  intentData,
  data,
  onNext,
  onBack,
}: CompanyDetailsStepProps) {
  const recommendation = useMemo(
    () => getRecommendation(intentData),
    [intentData],
  )

  const form = useForm<CompanyDetailsData>({
    defaultValues: {
      legal_name: data.legal_name || '',
      entity_type: data.entity_type || recommendation.entity_type,
      formation_state: data.formation_state || recommendation.formation_state,
      founders: data.founders?.length
        ? data.founders
        : [{ name: '', email: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'founders',
  })

  const onSubmit = useCallback(
    (values: CompanyDetailsData) => {
      const result = companyDetailsSchema.safeParse(values)
      if (!result.success) {
        for (const issue of result.error.issues) {
          const field = issue.path.join('.') as keyof CompanyDetailsData
          form.setError(field, { message: issue.message })
        }
        return
      }
      onNext(result.data as CompanyDetailsData, recommendation)
    },
    [onNext, recommendation, form],
  )

  const entityLabel =
    recommendation.entity_type === 'C_CORP' ? 'C-Corporation' : 'LLC'

  return (
    <div className="w-full">
      <div className="mb-10">
        <h2 className="text-2xl font-medium tracking-tight dark:text-white">
          Company details
        </h2>
        <p className="dark:text-spaire-400 mt-3 text-base leading-relaxed text-gray-500">
          Based on your answers, we recommend a{' '}
          <span className="font-medium dark:text-white text-gray-900">{entityLabel}</span>.
          You can change this below.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="legal_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder='e.g., "Acme Inc."'
                  />
                </FormControl>
                <FormDescription>
                  The legal name for your company.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="entity_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Entity type</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="flex flex-row gap-6"
                  >
                    {[
                      { value: 'C_CORP', label: 'C-Corporation' },
                      { value: 'LLC', label: 'LLC' },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className="flex cursor-pointer items-center gap-2"
                      >
                        <RadioGroupItem value={option.value} />
                        <span className="text-sm">{option.label}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="formation_state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Formation state</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {US_STATES.map((state) => (
                      <SelectItem key={state.code} value={state.code}>
                        {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-3">
            <FormLabel>Founders</FormLabel>
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-2">
                <FormField
                  control={form.control}
                  name={`founders.${index}.name`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input {...field} placeholder="Full name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`founders.${index}.email`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input {...field} placeholder="Email" type="email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="dark:text-spaire-500 dark:hover:text-spaire-300 mt-2 text-gray-400 hover:text-gray-600"
                  >
                    <CloseOutlined style={{ fontSize: 18 }} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => append({ name: '', email: '' })}
              className="flex items-center gap-1 text-sm font-medium text-blue-500 hover:text-blue-600"
            >
              <AddOutlined style={{ fontSize: 16 }} />
              Add founder
            </button>
          </div>

          <div className="flex justify-between pt-4">
            <Button type="button" variant="ghost" onClick={onBack}>
              Back
            </Button>
            <Button type="submit">Continue</Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
