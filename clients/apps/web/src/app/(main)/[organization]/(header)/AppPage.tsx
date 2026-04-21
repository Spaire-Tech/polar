'use client'

import { LinkInBioProfile } from '@/components/Profile/LinkInBioProfile'
import { schemas } from '@spaire/client'

const ClientPage = ({
  organization,
  products,
}: {
  organization: schemas['Organization']
  products: schemas['ProductStorefront'][]
}) => {
  return <LinkInBioProfile organization={organization} products={products} />
}

export default ClientPage
