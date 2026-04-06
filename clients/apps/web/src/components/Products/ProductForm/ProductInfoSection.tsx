'use client'

import { Section } from '@/components/Layout/Section'
import { schemas } from '@spaire/client'
import Input from '@spaire/ui/components/atoms/Input'
import TextArea from '@spaire/ui/components/atoms/TextArea'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@spaire/ui/components/ui/form'
import Link from 'next/link'
import { useFormContext } from 'react-hook-form'
import ProductMediasField from '../ProductMediasField'
import { ProductCustomFieldSection } from './ProductCustomFieldSection'
import { ProductFormType } from './ProductForm'

export interface ProductInfoSectionProps {
  className?: string
  compact?: boolean
  organization?: schemas['Organization']
}

export const ProductInfoSection = ({
  className,
  compact,
  organization,
}: ProductInfoSectionProps) => {
  const { control } = useFormContext<ProductFormType>()

  return (
    <Section
      title="Details"
      description="Name and describe your product"
      className={className}
      compact={compact}
    >
      <div className="flex w-full flex-col gap-y-6">
        <FormField
          control={control}
          name="name"
          rules={{
            required: 'This field is required',
            minLength: { value: 3, message: 'Name must be at least 3 characters' },
          }}
          defaultValue=""
          render={({ field }) => (
            <FormItem>
              <div className="flex flex-row items-center justify-between">
                <FormLabel>Name</FormLabel>
              </div>
              <FormControl>
                <Input {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="description"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-2">
              <div className="flex flex-row items-center justify-between">
                <FormLabel>Description</FormLabel>
                <p className="dark:text-spaire-500 text-sm text-gray-500">
                  Markdown format
                </p>
              </div>
              <FormControl>
                <TextArea
                  className="min-h-44 resize-none rounded-2xl font-mono text-xs!"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {organization && (
          <>
            <FormField
              control={control}
              name="full_medias"
              render={({ field }) => (
                <FormItem className="flex w-full flex-col gap-2">
                  <div className="flex flex-row items-center justify-between">
                    <FormLabel>Product images</FormLabel>
                  </div>
                  <FormControl>
                    <ProductMediasField
                      organization={organization}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <p className="dark:text-spaire-500 text-xs text-gray-500">
                    Up to 10MB each. 16:9 ratio recommended for optimal display.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-2">
              <div className="flex flex-row items-center justify-between">
                <FormLabel>Custom fields</FormLabel>
                <p className="dark:text-spaire-500 text-sm text-gray-500">
                  <Link
                    className="text-blue-500 hover:underline"
                    href={`/dashboard/${organization.slug}/settings/custom-fields`}
                    target="_blank"
                  >
                    Manage Custom Fields
                  </Link>
                </p>
              </div>
              <ProductCustomFieldSection organization={organization} />
            </div>
          </>
        )}
      </div>
    </Section>
  )
}
