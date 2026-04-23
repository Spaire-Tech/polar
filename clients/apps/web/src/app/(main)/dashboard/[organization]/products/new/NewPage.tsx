'use client'

import { CreateProductSplitPage } from '@/components/Products/CreateProductSplitPage'
import CourseWizard from '@/components/Courses/CourseWizard'
import { schemas } from '@spaire/client'
import { useSearchParams } from 'next/navigation'

export default function Page({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const searchParams = useSearchParams()
  const fromProductId = searchParams.get('fromProductId')
  const type = searchParams.get('type')

  if (type === 'course') {
    return <CourseWizard organization={organization} />
  }

  return (
    <CreateProductSplitPage
      organization={organization}
      fromProductId={fromProductId ?? undefined}
    />
  )
}
