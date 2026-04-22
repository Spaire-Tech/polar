'use client'

import CustomerPortalOrder from '@/components/CustomerPortal/CustomerPortalOrder'
import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@spaire/client'
import { getThemePreset } from '@spaire/ui/hooks/theming'

const ClientPage = ({
  organization,
  order,
  customerSessionToken,
}: {
  organization: schemas['CustomerOrganization']
  order: schemas['CustomerOrder']
  customerSessionToken: string
}) => {
  const themingPreset = getThemePreset(
    organization.slug,
    'light',
  )
  const api = createClientSideAPI(customerSessionToken)

  return (
    <CustomerPortalOrder
      api={api}
      order={order}
      customerSessionToken={customerSessionToken}
      themingPreset={themingPreset}
    />
  )
}

export default ClientPage
