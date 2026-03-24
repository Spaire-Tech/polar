import { Section } from '@/components/Layout/Section'
import { schemas } from '@spaire/client'
import { ProductMetadataForm } from '../ProductMetadataForm'
import { ProductCheckoutSection } from './ProductCheckoutSection'
import { ProductCustomerPortalSection } from './ProductCustomerPortalSection'
import { ProductInfoSection } from './ProductInfoSection'
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

      {benefitsSlot}

      <Section
        title="Metadata"
        description="Attach custom key-value data to this product"
      >
        <ProductMetadataForm />
      </Section>

      <ProductCustomerPortalSection />

      <ProductCheckoutSection organization={organization} />
    </div>
  )
}

export default ProductForm
