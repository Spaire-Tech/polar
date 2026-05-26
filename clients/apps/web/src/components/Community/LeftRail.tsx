'use client'

import styles from './community.module.css'
import {
  IconBook,
  IconCalendar,
  IconCamera,
  IconFilter,
  IconHome,
  IconSettings,
  IconUsers,
} from './icons'

export type RailLesson = {
  id: string
  label: string
  count?: number
}

export type CommunityView =
  | 'home'
  | 'members'
  | 'events'
  | 'activities'
  | 'settings'

// `series` → label items "episodes"; anything else → "modules". Mirrors
// the composer's category selector so the rail and modal agree.
export type DiscussionsKind = 'episode' | 'module'

type Props = {
  view: CommunityView
  onViewChange: (view: CommunityView) => void
  lessons: RailLesson[]
  lessonId: string | null
  onLessonChange: (lessonId: string | null) => void
  memberCount: number | null
  eventCount: number | null
  activityCount?: number | null
  discussionsKind: DiscussionsKind
  // Host-only: render the Settings tab + the inline Community-enabled
  // toggle next to it. When null the section is hidden entirely.
  settings?: {
    enabled: boolean
    onToggleEnabled: (next: boolean) => void
  } | null
}

export function LeftRail({
  view,
  onViewChange,
  lessons,
  lessonId,
  onLessonChange,
  memberCount,
  eventCount,
  activityCount,
  discussionsKind,
  settings,
}: Props) {
  const allLabel =
    discussionsKind === 'episode' ? 'All episodes' : 'All modules'

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
        <button
          type="button"
          className={`${styles.railItem} ${view === 'activities' ? styles.active : ''}`}
          onClick={() => onViewChange('activities')}
        >
          <span className={styles.railIcon}>
            <IconCamera size={14} />
          </span>
          <span className={styles.railItemLabel}>Activities</span>
          {activityCount != null && activityCount > 0 && (
            <span className={styles.railCount}>{activityCount}</span>
          )}
        </button>
        {settings && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <button
              type="button"
              className={`${styles.railItem} ${view === 'settings' ? styles.active : ''}`}
              onClick={() => onViewChange('settings')}
              style={{ flex: 1 }}
            >
              <span className={styles.railIcon}>
                <IconSettings size={14} />
              </span>
              <span className={styles.railItemLabel}>Settings</span>
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={settings.enabled}
              aria-label={
                settings.enabled
                  ? 'Community enabled — click to disable'
                  : 'Community disabled — click to enable'
              }
              title={
                settings.enabled
                  ? 'Community enabled. Click to hide from the student portal.'
                  : 'Community disabled. Click to enable.'
              }
              onClick={(e) => {
                e.stopPropagation()
                settings.onToggleEnabled(!settings.enabled)
              }}
              style={{
                width: 32,
                height: 18,
                borderRadius: 999,
                background: settings.enabled ? 'var(--c-ink)' : 'var(--c-hair)',
                border: 'none',
                position: 'relative',
                cursor: 'pointer',
                flexShrink: 0,
                marginRight: 4,
                transition: 'background 0.18s ease',
              }}
            >
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  background: '#fff',
                  top: 2,
                  left: settings.enabled ? 16 : 2,
                  transition: 'left 0.18s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                }}
              />
            </button>
          </div>
        )}
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
            <span className={styles.railItemLabel}>{allLabel}</span>
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
