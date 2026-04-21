import PublicLayout from '@/components/Layout/PublicLayout'
import { ForceLightMode } from '@/components/Profile/ForceLightMode'
import { ProfileCard } from '@/components/Profile/ProfileCard'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getStorefrontOrNotFound } from '@/utils/storefront'
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

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <ForceLightMode />
      <PublicLayout className="gap-y-0 py-4 md:py-8" wide footer={false}>
        <div className="flex flex-col gap-8 md:flex-row md:gap-12">
          <aside data-profile-card className="w-full shrink-0 md:sticky md:top-8 md:w-[420px] md:self-start">
            <ProfileCard organization={organization} products={products} />
          </aside>

          <main className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-full grow flex-col">
              {children}
            </div>
          </main>
        </div>
      </PublicLayout>
    </div>
  )
}
