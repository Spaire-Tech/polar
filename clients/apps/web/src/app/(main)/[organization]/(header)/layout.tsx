import { SpaireLogotype } from '@/components/Layout/Public/SpaireLogotype'
import TopbarRight from '@/components/Layout/Public/TopbarRight'
import PublicLayout from '@/components/Layout/PublicLayout'
import { StorefrontNav } from '@/components/Organization/StorefrontNav'
import { ProfileCard } from '@/components/Profile/ProfileCard'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getStorefrontOrNotFound } from '@/utils/storefront'
import { getAuthenticatedUser } from '@/utils/user'
import React from 'react'

export default async function Layout(props: {
  params: Promise<{ organization: string }>
  children: React.ReactNode
}) {
  const params = await props.params

  const { children } = props

  const api = await getServerSideAPI()

  const { organization } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )

  const authenticatedUser = await getAuthenticatedUser()

  return (
    <PublicLayout className="gap-y-0 py-6 md:py-12" wide>
      {/* Topbar */}
      <div className="relative flex flex-row items-center justify-end gap-x-6">
        <SpaireLogotype
          className="absolute left-1/2 -translate-x-1/2"
          size={50}
        />
        <TopbarRight
          authenticatedUser={authenticatedUser}
          storefrontOrg={organization}
        />
      </div>

      {/* Two-column layout */}
      <div className="mt-8 flex flex-col gap-8 md:flex-row md:gap-12">
        {/* Left column — Profile card (sticky on desktop) */}
        <aside className="w-full shrink-0 md:sticky md:top-8 md:w-[380px] md:self-start">
          <ProfileCard organization={organization} />
        </aside>

        {/* Right column — Nav + Products */}
        <main className="flex min-w-0 flex-1 flex-col gap-y-6">
          <StorefrontNav organization={organization} />
          <div className="flex h-full grow flex-col">
            {children}
          </div>
        </main>
      </div>
    </PublicLayout>
  )
}
