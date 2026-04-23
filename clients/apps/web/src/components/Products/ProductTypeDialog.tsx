'use client'

import { schemas } from '@spaire/client'
import { cn } from '@spaire/ui/lib/utils'
import AutoStoriesOutlined from '@mui/icons-material/AutoStoriesOutlined'
import GroupsOutlined from '@mui/icons-material/GroupsOutlined'
import HeadphonesOutlined from '@mui/icons-material/HeadphonesOutlined'
import MailOutlined from '@mui/icons-material/MailOutlined'
import RecordVoiceOverOutlined from '@mui/icons-material/RecordVoiceOverOutlined'
import WidgetsOutlined from '@mui/icons-material/WidgetsOutlined'
import { useRouter } from 'next/navigation'
import { ElementType } from 'react'

type TileType = {
  id: string
  label: string
  description: string
  Icon: ElementType
  comingSoon?: boolean
}

const PRODUCT_TYPES: TileType[] = [
  {
    id: 'digital',
    label: 'Digital Product',
    description: 'eBooks, templates, assets, software and more',
    Icon: WidgetsOutlined,
  },
  {
    id: 'course',
    label: 'Course',
    description: 'Structured lessons with video, text, and quizzes',
    Icon: AutoStoriesOutlined,
  },
  {
    id: 'coaching',
    label: 'Coaching',
    description: '1-on-1 sessions, group workshops, or programs',
    Icon: RecordVoiceOverOutlined,
    comingSoon: true,
  },
  {
    id: 'community',
    label: 'Community',
    description: 'Paid community membership with exclusive access',
    Icon: GroupsOutlined,
    comingSoon: true,
  },
  {
    id: 'podcast',
    label: 'Podcast',
    description: 'Premium audio content and exclusive episodes',
    Icon: HeadphonesOutlined,
    comingSoon: true,
  },
  {
    id: 'newsletter',
    label: 'Newsletter',
    description: 'Email-first content with paid subscriber tiers',
    Icon: MailOutlined,
    comingSoon: true,
  },
]

export const ProductTypeDialog = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const router = useRouter()

  const handleSelect = (tile: TileType) => {
    if (tile.comingSoon) return
    if (tile.id === 'digital') {
      router.push(`/dashboard/${organization.slug}/products/new`)
    } else if (tile.id === 'course') {
      router.push(`/dashboard/${organization.slug}/products/new?type=course`)
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-10 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className="text-3xl font-bold text-gray-900">
          What are you creating?
        </h2>
        <p className="max-w-md text-gray-500">
          Choose the type of product you want to sell on your storefront
        </p>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-2 gap-4 md:grid-cols-3">
        {PRODUCT_TYPES.map((tile) => (
          <button
            key={tile.id}
            onClick={() => handleSelect(tile)}
            disabled={tile.comingSoon}
            className={cn(
              'group relative flex flex-col items-start gap-4 rounded-2xl border p-5 text-left transition-all',
              tile.comingSoon
                ? 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-60'
                : 'cursor-pointer border-gray-200 bg-white hover:border-blue-300 hover:shadow-md active:scale-[0.99]',
            )}
          >
            {tile.comingSoon && (
              <span className="absolute right-3 top-3 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Soon
              </span>
            )}
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl',
                tile.comingSoon ? 'bg-gray-100' : 'bg-blue-50',
              )}
            >
              <tile.Icon
                className={cn(
                  'h-5 w-5',
                  tile.comingSoon ? 'text-gray-400' : 'text-blue-500',
                )}
                fontSize="small"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-gray-900">{tile.label}</span>
              <span className="text-xs leading-relaxed text-gray-500">
                {tile.description}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
