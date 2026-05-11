import { CatalogTabs } from '@/components/Catalog/CatalogTabs'
import { PropsWithChildren } from 'react'

export default function CoursesLayout({ children }: PropsWithChildren) {
  return (
    <div className="flex h-full flex-col">
      <CatalogTabs />
      {children}
    </div>
  )
}
