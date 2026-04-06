'use client'

import { Section } from '@/components/Layout/Section'
import { schemas } from '@spaire/client'
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@spaire/ui/components/ui/form'
import { useFormContext } from 'react-hook-form'
import ProductMediasField from '../ProductMediasField'
import { ProductFormType } from './ProductForm'

export const ProductMediaSection = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const { control } = useFormContext<ProductFormType>()

  return (
    <Section
      title="Media"
      description="Drop your images here, or click to browse"
    >
      <FormField
        control={control}
        name="full_medias"
        render={({ field }) => (
          <FormItem className="flex w-full flex-col gap-2">
            <FormControl>
              <ProductMediasField
                organization={organization}
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
            <p className="dark:text-spaire-500 text-xs text-gray-500">
              1600 x 1200 (4:3) recommended, up to 10MB each. Add up to 10 images to your product. Used to represent your product during checkout, in email, social sharing and more.
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    </Section>
  )
}
