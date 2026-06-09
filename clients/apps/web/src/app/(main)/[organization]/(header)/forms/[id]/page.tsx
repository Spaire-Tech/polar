import { LeadMagnetCard } from '@/components/Forms/LeadMagnetCard'
import { FormPublic } from '@/hooks/queries/forms'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getStorefrontOrNotFound } from '@/utils/storefront'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

const findForm = (
  storefront: { forms?: FormPublic[] },
  id: string,
): FormPublic | undefined =>
  ((storefront.forms ?? []) as FormPublic[]).find((f) => f.id === id)

export async function generateMetadata(props: {
  params: Promise<{ organization: string; id: string }>
}): Promise<Metadata> {
  const params = await props.params
  const api = await getServerSideAPI()
  const storefront = await getStorefrontOrNotFound(api, params.organization)
  const form = findForm(storefront as { forms?: FormPublic[] }, params.id)

  if (!form) {
    notFound()
  }

  return {
    title: `${form.title} by ${storefront.organization.name}`,
    openGraph: {
      title: form.title,
      description:
        form.subtitle ?? `A free download from ${storefront.organization.name}`,
      siteName: 'Spaire',
      type: 'website',
      images: form.image_url ? [{ url: form.image_url }] : undefined,
    },
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string; id: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const storefront = await getStorefrontOrNotFound(api, params.organization)
  const form = findForm(storefront as { forms?: FormPublic[] }, params.id)

  if (!form) {
    notFound()
  }

  return (
    <div className="flex w-full justify-center px-4 py-10 md:py-16">
      <div className="w-full max-w-4xl">
        <LeadMagnetCard form={form} interactive />
      </div>
    </div>
  )
}
