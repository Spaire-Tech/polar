'use client'

// Right-rail surface used by the v5 community shell. Two stacked
// cards: "Upcoming events" (next 3 non-past events) and "Members" (top
// 6 with the instructor pinned). Both cards are clickable rows that
// route the parent's `setView` so the rail acts as a fast-jump into
// the dedicated views.
//
// Design: __design/Community-v5.html — `.right-rail`, `.rr-card`,
// `.rr-event*`, `.rr-member*`.

import type { CommunityMemberRead } from '@/hooks/queries/community'
import { Avatar } from './Avatar'
import type { CommunityEvent } from './EventsView'
import styles from './community.module.css'
import { IconChevron } from './icons'

type View = 'home' | 'members' | 'events' | 'activities' | 'notifications'

type Props = {
  events: readonly CommunityEvent[]
  members: readonly CommunityMemberRead[]
  memberCount: number
  onJump: (next: View) => void
  onOpenEvent?: (event: CommunityEvent) => void
}

const MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
]

function eventDateBits(iso: string): { day: number; month: string } {
  const d = new Date(iso)
  return { day: d.getDate(), month: MONTHS[d.getMonth()] ?? '' }
}

function durationLabel(minutes: string | number): string {
  const n = Number(minutes)
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n < 60) return `${n} min`
  const h = Math.floor(n / 60)
  const m = n % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function CommunityRightRail({
  events,
  members,
  memberCount,
  onJump,
  onOpenEvent,
}: Props) {
  // Show live events first, then the next 3 upcoming.
  const upcoming = [...events]
    .filter((e) => !e.past)
    .sort((a, b) => {
      if (a.live && !b.live) return -1
      if (b.live && !a.live) return 1
      return new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    })
    .slice(0, 3)

  // Featured members: instructor first, then up to 5 students.
  const featured = (() => {
    const instructors = members.filter((m) => m.kind === 'instructor')
    const students = members.filter((m) => m.kind === 'student')
    return [...instructors.slice(0, 1), ...students.slice(0, 5)]
  })()

  return (
    <aside className={styles.rightRail}>
      <section className={styles.rrCard}>
        <header className={styles.rrCardHead}>
          <div className={styles.rrCardTitle}>Upcoming events</div>
          <button
            type="button"
            className={styles.rrCardLink}
            onClick={() => onJump('events')}
          >
            See all <IconChevron size={10} />
          </button>
        </header>
        {upcoming.length === 0 ? (
          <div
            style={{
              fontSize: 12,
              color: 'var(--c-muted)',
              padding: '6px 0 2px',
            }}
          >
            No events scheduled.
          </div>
        ) : (
          upcoming.map((e) => {
            const { day, month } = eventDateBits(e.startAt)
            return (
              <button
                key={e.id}
                type="button"
                className={styles.rrEvent}
                onClick={() => {
                  if (onOpenEvent) onOpenEvent(e)
                  else onJump('events')
                }}
              >
                <div
                  className={`${styles.rrEventDate} ${e.live ? styles.rrEventDateLive : ''}`}
                >
                  <div className={styles.rrEventDateDay}>{day}</div>
                  <div className={styles.rrEventDateMonth}>{month}</div>
                </div>
                <div className={styles.rrEventInfo}>
                  <div className={styles.rrEventTitle}>{e.title}</div>
                  <div className={styles.rrEventMeta}>
                    {e.live ? (
                      <span className={styles.rrLiveTag}>Live now</span>
                    ) : (
                      <span>{durationLabel(e.duration)}</span>
                    )}
                    <span className={styles.rrSep} />
                    <span>
                      {e.rsvpCount} {e.live ? 'watching' : 'going'}
                    </span>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </section>

      <section className={styles.rrCard}>
        <header className={styles.rrCardHead}>
          <div className={styles.rrCardTitle}>Members</div>
          <span style={{ fontSize: 11, color: 'var(--c-muted)' }}>
            {memberCount}
          </span>
        </header>
        {featured.length === 0 ? (
          <div
            style={{
              fontSize: 12,
              color: 'var(--c-muted)',
              padding: '6px 0 2px',
            }}
          >
            No members yet.
          </div>
        ) : (
          featured.map((m) => (
            <button
              key={m.id}
              type="button"
              className={styles.rrMember}
              onClick={() => onJump('members')}
            >
              <div className={styles.rrMemberAv}>
                <Avatar
                  name={m.name}
                  avatarUrl={m.avatar_url ?? undefined}
                  size={36}
                />
              </div>
              <div className={styles.rrMemberInfo}>
                <div className={styles.rrMemberName}>{m.name ?? 'Member'}</div>
                <div className={styles.rrMemberRole}>
                  {m.kind === 'instructor' ? 'Instructor' : 'Student'}
                </div>
              </div>
              {m.kind === 'instructor' && (
                <span
                  className={`${styles.rrMemberBadge} ${styles.rrMemberBadgeInstr}`}
                >
                  INSTR
                </span>
              )}
            </button>
          ))
        )}
        <button
          type="button"
          className={styles.rrSeeMore}
          onClick={() => onJump('members')}
        >
          See all members <IconChevron size={11} />
        </button>
      </section>
    </aside>
  )
}
