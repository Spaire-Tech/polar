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

  const { organization, products } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )

  const authenticatedUser = await getAuthenticatedUser()

  return (
    <div className="min-h-screen bg-white">
      <PublicLayout className="gap-y-0 py-6 md:py-12" wide>
        {/* Topbar — user menu only, no logo */}
        <div className="flex flex-row items-center justify-end">
          <TopbarRight
            authenticatedUser={authenticatedUser}
            storefrontOrg={organization}
          />
        </div>

        {/* Two-column layout */}
        <div className="mt-8 flex flex-col gap-8 md:flex-row md:gap-12">
          {/* Left column — Profile card (sticky on desktop) */}
          <aside className="w-full shrink-0 md:sticky md:top-8 md:w-[420px] md:self-start">
            <ProfileCard organization={organization} products={products} />
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
    </div>
  )
}
