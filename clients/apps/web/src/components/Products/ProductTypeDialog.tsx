'use client'

import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import AutoStoriesOutlined from '@mui/icons-material/AutoStoriesOutlined'
import WidgetsOutlined from '@mui/icons-material/WidgetsOutlined'
import { schemas } from '@spaire/client'
import { cn } from '@spaire/ui/lib/utils'
import { useRouter } from 'next/navigation'
import { ElementType } from 'react'

type TileType = {
  id: 'digital' | 'course'
  label: string
  description: string
  Icon: ElementType
  accent: string
  iconBg: string
}

const PRODUCT_TYPES: TileType[] = [
  {
    id: 'digital',
    label: 'Digital Product',
    description:
      'Sell eBooks, templates, presets, software licenses, downloadable assets, and any one-off file your audience pays for.',
    Icon: WidgetsOutlined,
    accent: 'from-orange-50 via-white to-white',
    iconBg: 'bg-orange-100 text-orange-600',
  },
  {
    id: 'course',
    label: 'Course',
    description:
      'Build a structured learning experience with modules, video lessons, downloadable resources, and quizzes.',
    Icon: AutoStoriesOutlined,
    accent: 'from-sky-50 via-white to-white',
    iconBg: 'bg-sky-100 text-sky-600',
  },
]

export const ProductTypeDialog = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const router = useRouter()

  const handleSelect = (tile: TileType) => {
    router.push(`/dashboard/${organization.slug}/products/new?type=${tile.id}`)
  }

  const handleBack = () => router.back()

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-5xl flex-col px-6 py-8">
      <div className="mb-12 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <ArrowBackOutlined sx={{ fontSize: 18 }} />
          Back
        </button>
      </div>

      <div className="mb-12 flex flex-col items-center gap-3 text-center">
        <h2 className="text-4xl font-bold tracking-tight text-gray-900">
          What are you creating?
        </h2>
        <p className="max-w-md text-gray-500">
          Pick the format that fits what you sell. You can always add more later.
        </p>
      </div>

      <div className="relative mx-auto grid w-full max-w-4xl grid-cols-1 items-stretch gap-6 md:grid-cols-[1fr_auto_1fr]">
        {/* Left tile */}
        <Tile tile={PRODUCT_TYPES[0]} onSelect={handleSelect} />

        {/* Modern divider — vertical line with central pill on desktop, hidden on mobile */}
        <div className="relative hidden items-center justify-center md:flex">
          <div className="absolute inset-y-8 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-gray-200 to-transparent" />
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-[11px] font-semibold uppercase tracking-wider text-gray-400 shadow-sm">
            or
          </div>
        </div>

        {/* Right tile */}
        <Tile tile={PRODUCT_TYPES[1]} onSelect={handleSelect} />
      </div>
    </div>
  )
}

function Tile({
  tile,
  onSelect,
}: {
  tile: TileType
  onSelect: (tile: TileType) => void
}) {
  return (
    <button
      onClick={() => onSelect(tile)}
      className={cn(
        'group relative flex h-full flex-col items-start gap-6 overflow-hidden rounded-3xl border border-gray-200 bg-white p-8 text-left transition-all hover:border-gray-300 hover:shadow-lg active:scale-[0.995]',
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-70 transition-opacity group-hover:opacity-100',
          tile.accent,
        )}
      />
      <div className="relative flex flex-col gap-6">
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-2xl',
            tile.iconBg,
          )}
        >
          <tile.Icon sx={{ fontSize: 28 }} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xl font-bold text-gray-900">{tile.label}</span>
          <span className="max-w-md text-sm leading-relaxed text-gray-500">
            {tile.description}
          </span>
        </div>
        <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 transition-transform group-hover:translate-x-0.5">
          Get started
          <ArrowForwardOutlined sx={{ fontSize: 16 }} />
        </span>
      </div>
    </button>
  )
}
