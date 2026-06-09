'use client'

import { FormPublic } from '@/hooks/queries/forms'
import { twMerge } from 'tailwind-merge'
import LogoIcon from '../Brand/LogoIcon'

type ThumbnailSize = 'small' | 'medium' | 'large'

const thumbnailAspect: Record<ThumbnailSize, string> = {
  small: 'aspect-video',
  medium: 'aspect-[4/3]',
  large: 'aspect-square',
}

// A lead-magnet rendered as a product-style card on the Space: cover image +
// title, no price (it's free). Visually mirrors ProductCard so forms sit
// alongside products and courses without looking out of place. Clicking it
// (the parent wraps this in a Link on the public Space) opens the full
// capture form.
export const FormCard = ({
  form,
  thumbnailSize = 'medium',
}: {
  form: FormPublic
  thumbnailSize?: ThumbnailSize
}) => {
  const aspect = thumbnailAspect[thumbnailSize]

  return (
    <div className="group flex h-full w-full flex-col gap-4">
      {/* Image area */}
      <div className="relative">
        {form.image_url ? (
          <div className="relative overflow-hidden rounded-3xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={twMerge(
                aspect,
                'w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]',
              )}
              alt={form.title}
              width={600}
              height={450}
              src={form.image_url}
            />
          </div>
        ) : (
          <div
            className={twMerge(
              aspect,
              'flex w-full flex-col items-center justify-center rounded-3xl bg-gray-100',
            )}
          >
            <LogoIcon className="h-12 w-12 text-gray-300" />
          </div>
        )}
        {/* Arrow icon — top right, glass circle with thin border */}
        <div className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full border border-gray-900/25 bg-white/20 backdrop-blur-sm">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 17 17 7" />
            <path d="M7 7h10v10" />
          </svg>
        </div>
      </div>

      {/* Title + subtitle below image — no price, lead magnets are free */}
      <div className="flex flex-col gap-1">
        <h3 className="line-clamp-1 text-xl font-normal text-gray-900">
          {form.title}
        </h3>
        {form.subtitle ? (
          <div className="line-clamp-1 text-base font-normal text-gray-500">
            {form.subtitle}
          </div>
        ) : null}
      </div>
    </div>
  )
}
