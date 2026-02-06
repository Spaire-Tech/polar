'use client'

import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

export const PolarLogotype = ({
  logoVariant = 'icon',
  size,
  className,
  logoClassName,
  href,
}: {
  logoVariant?: 'icon' | 'logotype'
  size?: number
  className?: string
  logoClassName?: string
  href?: string
}) => {
  const fontSize = size ? `${Math.max(size * 0.4, 14)}px` : '18px'

  const content = (
    <span
      className={twMerge(
        'font-bold tracking-tight text-gray-900 dark:text-white',
        logoClassName,
      )}
      style={{ fontSize }}
    >
      {logoVariant === 'icon' ? 'S' : 'Spaire'}
    </span>
  )

  return (
    <div className={twMerge('relative flex flex-row items-center', className)}>
      {href ? <Link href={href}>{content}</Link> : <div>{content}</div>}
    </div>
  )
}
