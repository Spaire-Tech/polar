'use client'

import styles from './community.module.css'
import {
  IconBook,
  IconCalendar,
  IconFilter,
  IconHome,
  IconUsers,
} from './icons'

export type RailLesson = {
  id: string
  label: string
  count?: number
}

export type CommunityView = 'home' | 'members' | 'events'

type Props = {
  view: CommunityView
  onViewChange: (view: CommunityView) => void
  lessons: RailLesson[]
  lessonId: string | null
  onLessonChange: (lessonId: string | null) => void
  memberCount: number | null
  eventCount: number | null
}

export function LeftRail({
  view,
  onViewChange,
  lessons,
  lessonId,
  onLessonChange,
  memberCount,
  eventCount,
}: Props) {
  return (
    <aside className={styles.rail}>
      <div className={styles.railSection}>
        <button
          type="button"
          className={`${styles.railItem} ${view === 'home' ? styles.active : ''}`}
          onClick={() => onViewChange('home')}
        >
          <span className={styles.railIcon}>
            <IconHome size={14} />
          </span>
          <span className={styles.railItemLabel}>Home</span>
        </button>
        <button
          type="button"
          className={`${styles.railItem} ${view === 'members' ? styles.active : ''}`}
          onClick={() => onViewChange('members')}
        >
          <span className={styles.railIcon}>
            <IconUsers size={14} />
          </span>
          <span className={styles.railItemLabel}>Members</span>
          {memberCount !== null && (
            <span className={styles.railCount}>{memberCount}</span>
          )}
        </button>
        <button
          type="button"
          className={`${styles.railItem} ${view === 'events' ? styles.active : ''}`}
          onClick={() => onViewChange('events')}
        >
          <span className={styles.railIcon}>
            <IconCalendar size={14} />
          </span>
          <span className={styles.railItemLabel}>Events</span>
          {eventCount !== null && eventCount > 0 && (
            <span className={styles.railCount}>{eventCount}</span>
          )}
        </button>
      </div>

      {lessons.length > 0 && (
        <div className={styles.railSection}>
          <div className={styles.railLabel}>Discussions</div>
          <button
            type="button"
            className={`${styles.railItem} ${
              view === 'home' && lessonId == null ? styles.active : ''
            }`}
            onClick={() => {
              onViewChange('home')
              onLessonChange(null)
            }}
          >
            <span className={styles.railIcon}>
              <IconFilter size={14} />
            </span>
            <span className={styles.railItemLabel}>All discussions</span>
          </button>
          {lessons.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`${styles.railItem} ${
                view === 'home' && lessonId === l.id ? styles.active : ''
              }`}
              onClick={() => {
                onViewChange('home')
                onLessonChange(l.id)
              }}
              title={l.label}
            >
              <span className={styles.railIcon}>
                <IconBook size={14} />
              </span>
              <span className={styles.railItemLabel}>{l.label}</span>
              {l.count != null && l.count > 0 && (
                <span className={styles.railCount}>{l.count}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </aside>
  )
}
