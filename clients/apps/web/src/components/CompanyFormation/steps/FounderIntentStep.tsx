'use client'

import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import Button from '@spaire/ui/components/atoms/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@spaire/ui/components/atoms/Select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@spaire/ui/components/ui/form'
import { twMerge } from 'tailwind-merge'
import { founderIntentSchema, type FounderIntentData } from '../types'
import { US_STATES } from '../recommendation'

interface FounderIntentStepProps {
  data: Partial<FounderIntentData>
  onNext: (data: FounderIntentData) => void
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="dark:bg-spaire-900 dark:border-spaire-700 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={twMerge(
            'rounded-md px-4 py-2 text-sm font-medium transition-all',
            value === option.value
              ? 'bg-white text-gray-900 shadow-sm dark:bg-spaire-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-spaire-400 dark:hover:text-spaire-300',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default function FounderIntentStep({
  data,
  onNext,
}: FounderIntentStepProps) {
  const form = useForm<FounderIntentData>({
    defaultValues: {
      product_type: data.product_type || undefined,
      founder_location: data.founder_location || undefined,
      founder_state: data.founder_state || undefined,
      planning_to_raise_vc: data.planning_to_raise_vc || undefined,
      number_of_founders: data.number_of_founders || undefined,
      equity_plans: data.equity_plans || undefined,
    },
  })

  const founderLocation = form.watch('founder_location')

  const onSubmit = useCallback(
    (values: FounderIntentData) => {
      const result = founderIntentSchema.safeParse(values)
      if (!result.success) {
        for (const issue of result.error.issues) {
          const field = issue.path[0] as keyof FounderIntentData
          form.setError(field, { message: issue.message })
        }
        return
      }
      onNext(result.data as FounderIntentData)
    },
    [onNext, form],
  )

  return (
    <div className="flex flex-col gap-12 p-8 md:p-12">
      <div className="flex flex-col gap-y-2">
        <h2 className="text-lg font-medium">Tell us about your startup</h2>
        <p className="dark:text-spaire-500 leading-snug text-gray-500">
          We will use this to recommend the best company structure for you.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex w-full flex-col gap-y-6">
            <FormField
              control={form.control}
              name="product_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What are you building?</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product type..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="saas">SaaS</SelectItem>
                      <SelectItem value="ai">AI</SelectItem>
                      <SelectItem value="marketplace">Marketplace</SelectItem>
                      <SelectItem value="agency">Agency</SelectItem>
                      <SelectItem value="consulting">Consulting</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="founder_location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Where are you located?</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="us">United States</SelectItem>
                      <SelectItem value="non_us">Outside US</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {founderLocation === 'us' && (
              <FormField
                control={form.control}
                name="founder_state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Which state?</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
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
            )}

            <FormField
              control={form.control}
              name="planning_to_raise_vc"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Planning to raise venture capital?</FormLabel>
                  <FormControl>
                    <SegmentedControl
                      options={[
                        { value: 'yes', label: 'Yes' },
                        { value: 'maybe', label: 'Maybe' },
                        { value: 'no', label: 'No' },
                      ]}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="number_of_founders"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>How many founders?</FormLabel>
                  <FormControl>
                    <SegmentedControl
                      options={[
                        { value: 'solo', label: 'Solo' },
                        { value: '2_5', label: '2–5' },
                        { value: '6_plus', label: '6+' },
                      ]}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="equity_plans"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan to issue equity (stock options, SAFEs)?</FormLabel>
                  <FormControl>
                    <SegmentedControl
                      options={[
                        { value: 'yes', label: 'Yes' },
                        { value: 'maybe', label: 'Maybe' },
                        { value: 'no', label: 'No' },
                      ]}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex flex-row items-center gap-2 pt-8">
            <Button type="submit">Continue</Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
