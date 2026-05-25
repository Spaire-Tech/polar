'use client'

import { Avatar } from './Avatar'
import styles from './community.module.css'
import { IconBook, IconFilter } from './icons'

export type RailModule = {
  id: string
  label: string
  count: number
}

type PresenceProps = {
  instructorName: string | null
  instructorAvatarUrl: string | null
  blurb: string | null
}

export function LeftRail({
  moduleId,
  onModuleChange,
  modules,
  presence,
}: {
  moduleId: string | null
  onModuleChange: (moduleId: string | null) => void
  modules: RailModule[]
  presence: PresenceProps | null
}) {
  return (
    <aside className={styles.rail}>
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
