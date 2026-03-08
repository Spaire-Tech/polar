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
import { founderIntentSchema, type FounderIntentData } from '../types'
import { US_STATES } from '../recommendation'

interface FounderIntentStepProps {
  data: Partial<FounderIntentData>
  onNext: (data: FounderIntentData) => void
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
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-6">
        <h2 className="text-xl font-semibold dark:text-white">
          Founder Setup
        </h2>
        <p className="dark:text-polar-400 mt-1 text-sm text-gray-500">
          Tell us about your startup so we can recommend the best company
          structure for you.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Product type */}
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

          {/* Founder location */}
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

          {/* Founder state (conditional) */}
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

          {/* Planning to raise VC */}
          <FormField
            control={form.control}
            name="planning_to_raise_vc"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Are you planning to raise venture capital?
                </FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex flex-row gap-4"
                  >
                    {[
                      { value: 'yes', label: 'Yes' },
                      { value: 'maybe', label: 'Maybe' },
                      { value: 'no', label: 'No' },
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

          {/* Number of founders */}
          <FormField
            control={form.control}
            name="number_of_founders"
            render={({ field }) => (
              <FormItem>
                <FormLabel>How many founders?</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex flex-row gap-4"
                  >
                    {[
                      { value: 'solo', label: 'Solo' },
                      { value: '2_5', label: '2–5' },
                      { value: '6_plus', label: '6+' },
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

          {/* Equity plans */}
          <FormField
            control={form.control}
            name="equity_plans"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Do you plan to issue equity (stock options, SAFEs)?
                </FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex flex-row gap-4"
                  >
                    {[
                      { value: 'yes', label: 'Yes' },
                      { value: 'maybe', label: 'Maybe' },
                      { value: 'no', label: 'No' },
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
                <FormDescription>
                  Common for startups hiring engineers or raising capital.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end pt-2">
            <Button type="submit">
              Continue
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
