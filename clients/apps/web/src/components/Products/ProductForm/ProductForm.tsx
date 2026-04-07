import { Section } from '@/components/Layout/Section'
import { schemas } from '@spaire/client'
import { FormLabel } from '@spaire/ui/components/ui/form'
import Link from 'next/link'
import { ProductMetadataForm } from '../ProductMetadataForm'
import { ProductCustomFieldSection } from './ProductCustomFieldSection'
import { ProductCustomerPortalSection } from './ProductCustomerPortalSection'
import { ProductInfoSection } from './ProductInfoSection'
import { ProductMediaSection } from './ProductMediaSection'
import { ProductPricingSection } from './ProductPricingSection'

export interface ProductFullMediasMixin {
  full_medias: schemas['ProductMediaFileRead'][]
}

export type ProductFormType = Omit<
  schemas['ProductCreate'] | schemas['ProductUpdate'],
  'metadata'
> &
  ProductFullMediasMixin & {
    metadata: { key: string; value: string | number | boolean }[]
  }

const ProductForm = ({
  organization,
  update,
  benefitsSlot,
}: {
  organization: schemas['Organization']
  update?: boolean
  benefitsSlot: React.ReactNode
}) => {
  return (
    <div className="flex flex-col divide-y dark:divide-spaire-700">
      <ProductInfoSection />

      <ProductPricingSection organization={organization} update={update} />

      <ProductMediaSection organization={organization} />

      {benefitsSlot}

      <Section
        title="Metadata"
        description="Attach custom key-value data to this product"
      >
        <ProductMetadataForm />
      </Section>

      <ProductCustomerPortalSection />

      <Section
        title="Custom fields"
        description="Collect additional information from your customers during checkout"
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-row items-center justify-end">
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
      </Section>
    </div>
  )
}

export default ProductForm
