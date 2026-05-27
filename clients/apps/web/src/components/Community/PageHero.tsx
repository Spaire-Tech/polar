'use client'

// v5 page hero — sits above the feed on Home. Two-column 70/30 white
// card: course title + eyebrow + 1-2 actions on the left, course
// cover image bleeding to the right edge.
//
// Design ref: __design/Community-v5.html — `.page-hero*`.

import type { ReactNode } from 'react'
import styles from './community.module.css'

type Props = {
  eyebrow: string
  /** When true, prepend a green pulsing dot before the eyebrow. */
  live?: boolean
  title: string
  subtitle?: string | null
  coverUrl?: string | null
  /** CSS object-position; defaults to center. */
  coverPosition?: string | null
  actions?: ReactNode
}

export function PageHero({
  eyebrow,
  live = false,
  title,
  subtitle,
  coverUrl,
  coverPosition,
  actions,
}: Props) {
  return (
    <section className={styles.pageHero}>
      <div className={styles.pageHeroText}>
        <div className={styles.pageHeroEyebrow}>
          {live && <span className={styles.pageHeroLive} aria-hidden />}
          {eyebrow}
        </div>
        <h1 className={styles.pageHeroTitle}>{title}</h1>
        {subtitle && <p className={styles.pageHeroSub}>{subtitle}</p>}
        {actions && <div className={styles.pageHeroActions}>{actions}</div>}
      </div>
      <div
        className={styles.pageHeroImg}
        style={
          coverUrl
            ? {
                backgroundImage: `url(${coverUrl})`,
                backgroundPosition: coverPosition || '50% 50%',
              }
            : undefined
        }
        aria-hidden
      />
    </section>
  )
}
