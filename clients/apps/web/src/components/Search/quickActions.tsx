import { Hexagon } from 'lucide-react'
export const getQuickActions = (organizationSlug: string) => [
  {
    id: 'create-product',
    title: 'Create Product',
    url: `/dashboard/${organizationSlug}/products/new`,
    icon: <Hexagon className="h-4 w-4" />,
  },
]
