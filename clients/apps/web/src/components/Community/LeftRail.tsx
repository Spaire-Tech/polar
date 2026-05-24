'use client'

import type { CommunitySortProperty } from '@/hooks/queries/community'
import { Avatar } from './Avatar'
import styles from './community.module.css'
import { IconBook, IconChat, IconFilter, IconSort, IconStar } from './icons'

export type RailModule = {
  id: string
  label: string
  count: number
}

const SORTS: { id: CommunitySortProperty; label: string; Icon: typeof IconSort }[] = [
  { id: 'recent', label: 'Recent', Icon: IconSort },
  { id: 'top_week', label: 'Top this week', Icon: IconStar },
  { id: 'unanswered', label: 'Unanswered', Icon: IconChat },
]

type PresenceProps = {
  instructorName: string | null
  instructorAvatarUrl: string | null
  blurb: string | null
}

export function LeftRail({
  sort,
  onSortChange,
  moduleId,
  onModuleChange,
  modules,
  presence,
}: {
  sort: CommunitySortProperty
  onSortChange: (sort: CommunitySortProperty) => void
  moduleId: string | null
  onModuleChange: (moduleId: string | null) => void
  modules: RailModule[]
  presence: PresenceProps | null
}) {
  return (
    <aside className={styles.rail}>
      <div className={styles.railSection}>
        <div className={styles.railLabel}>Sort</div>
        {SORTS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`${styles.railItem} ${sort === id ? styles.active : ''}`}
            onClick={() => onSortChange(id)}
          >
            <span className={styles.railIcon}>
              <Icon size={14} />
            </span>
            <span className={styles.railItemLabel}>{label}</span>
          </button>
        ))}
      </div>

      {modules.length > 0 && (
        <div className={styles.railSection}>
          <div className={styles.railLabel}>Modules</div>
          <button
            type="button"
            className={`${styles.railItem} ${moduleId == null ? styles.active : ''}`}
            onClick={() => onModuleChange(null)}
          >
            <span className={styles.railIcon}>
              <IconFilter size={14} />
            </span>
            <span className={styles.railItemLabel}>All modules</span>
          </button>
          {modules.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`${styles.railItem} ${moduleId === m.id ? styles.active : ''}`}
              onClick={() => onModuleChange(m.id)}
            >
              <span className={styles.railIcon}>
                <IconBook size={14} />
              </span>
              <span className={styles.railItemLabel}>{m.label}</span>
              {m.count > 0 && (
                <span className={styles.railCount}>{m.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {presence && (
        <div className={styles.presence}>
          <div className={styles.presenceHead}>
            <Avatar
              name={presence.instructorName ?? 'Instructor'}
              avatarUrl={presence.instructorAvatarUrl ?? undefined}
              size={32}
            />
            <div>
              <div className={styles.presenceName}>
                {presence.instructorName ?? 'Instructor'}{' '}
                <span
                  className={styles.presenceDot}
                  title="Active recently"
                />
              </div>
              <div className={styles.presenceRole}>Instructor</div>
            </div>
          </div>
          {presence.blurb && (
            <div className={styles.presenceStat}>{presence.blurb}</div>
          )}
        </div>
      )}
    </aside>
  )
}
