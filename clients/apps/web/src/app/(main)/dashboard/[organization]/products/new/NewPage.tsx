'use client'

import { CreateProductSplitPage } from '@/components/Products/CreateProductSplitPage'
import { schemas } from '@spaire/client'
import { useSearchParams } from 'next/navigation'

export default function Page({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const searchParams = useSearchParams()
  const fromProductId = searchParams.get('fromProductId')

  return (
    <CreateProductSplitPage
      organization={organization}
      fromProductId={fromProductId ?? undefined}
    />
  )
}
