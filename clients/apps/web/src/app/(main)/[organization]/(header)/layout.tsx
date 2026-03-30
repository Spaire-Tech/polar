import TopbarRight from '@/components/Layout/Public/TopbarRight'
import { StorefrontNav } from '@/components/Organization/StorefrontNav'
import { StorefrontHeader } from '@/components/Profile/StorefrontHeader'
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
    <div className="dark:bg-spaire-950 min-h-screen bg-gray-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-6 md:px-8 md:py-10">
        <div className="relative flex flex-row items-center justify-end gap-x-6">
          <TopbarRight
            authenticatedUser={authenticatedUser}
            storefrontOrg={organization}
          />
        </div>
        <div className="flex flex-col">
          <StorefrontHeader organization={organization} />
          <div className="mt-6 flex flex-col items-center">
            <StorefrontNav organization={organization} />
          </div>
          <div className="mt-8 md:mt-12">{children}</div>
        </div>
        <div className="mt-16 flex items-center justify-center pb-8">
          <span className="text-xs text-gray-400 dark:text-spaire-700">
            Powered by Spaire Space
          </span>
        </div>
      </div>
    </div>
  )
}
