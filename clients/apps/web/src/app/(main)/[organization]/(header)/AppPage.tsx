'use client'

import { Storefront } from '@/components/Profile/Storefront'
import { schemas } from '@spaire/client'

const ClientPage = ({
  organization,
  products,
}: {
  organization: schemas['CustomerOrganization']
  products: schemas['ProductStorefront'][]
}) => {
  const storefrontSettings = (organization as any).storefront_settings ?? null

  return (
    <Storefront
      organization={organization}
      products={products}
      storefrontSettings={storefrontSettings}
    />
  )
}

export default ClientPage
