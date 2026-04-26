import { Toaster } from '@/components/Toast/Toaster'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import Avatar from '@spaire/ui/components/atoms/Avatar'
import { CustomerPortalLayoutWrapper } from './CustomerPortalLayoutWrapper'
import { PortalShell } from './PortalShell'

export const dynamic = 'force-dynamic'

export default async function Layout(props: {
  params: Promise<{ organization: string }>
  children: React.ReactNode
}) {
  const params = await props.params

  const { children } = props

  const api = await getServerSideAPI()
  const { organization } = await getOrganizationOrNotFound(
    api,
    params.organization,
  )

  return (
    <div className="flex min-h-screen grow flex-col">
      <div className="flex w-full flex-col">
        <div className="flex flex-col justify-center gap-y-12 px-4 py-4 lg:px-8 lg:py-8">
          <Avatar
            className="h-8 w-8"
            avatar_url={organization.avatar_url}
            name={organization.name}
          />
        </div>
      </div>
      <CustomerPortalLayoutWrapper organization={organization}>
        <PortalShell organization={organization}>{children}</PortalShell>
      </CustomerPortalLayoutWrapper>
      <Toaster />
    </div>
  )
}
