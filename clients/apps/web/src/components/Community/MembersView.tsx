'use client'

import type { CommunityMemberRead } from '@/hooks/queries/community'
import { useMemo, useState } from 'react'
import { Avatar } from './Avatar'
import styles from './community.module.css'
import { IconSearch } from './icons'

type Props = {
  members: CommunityMemberRead[]
  isLoading: boolean
}

type FilterId = 'all' | 'instructors' | 'students'

export function MembersView({ members, isLoading }: Props) {
  const [filter, setFilter] = useState<FilterId>('all')
  const [query, setQuery] = useState('')

  const counts = useMemo(
    () => ({
      all: members.length,
      instructors: members.filter((m) => m.kind === 'instructor').length,
      students: members.filter((m) => m.kind === 'student').length,
    }),
    [members],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return members.filter((m) => {
      if (filter === 'instructors' && m.kind !== 'instructor') return false
      if (filter === 'students' && m.kind !== 'student') return false
      if (q && !(m.name ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [members, filter, query])

  const filters: { id: FilterId; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'instructors', label: 'Instructors', count: counts.instructors },
    { id: 'students', label: 'Students', count: counts.students },
  ]

  return (
    <>
      <header className={styles.feedHeader}>
        <div className={styles.feedEyebrow}>
          {counts.all} {counts.all === 1 ? 'member' : 'members'}
        </div>
        <h1 className={styles.feedTitle}>Members</h1>
        <p className={styles.feedSub}>
          Everyone enrolled in this course. Tap someone to see what they’ve
          shared.
        </p>
      </header>

      <div className={styles.membersToolbar}>
        <div className={styles.membersSearchWrap}>
          <IconSearch size={15} />
          <input
            className={styles.membersSearch}
            placeholder="Search members…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div
        className={styles.filterbar}
        style={{ marginTop: 0, marginBottom: 24 }}
      >
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`${styles.filterChip} ${
              filter === f.id ? styles.active : ''
            }`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            <span className={styles.filterChipCount}>{f.count}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className={styles.empty}>Loading members…</div>
      ) : visible.length === 0 ? (
        <div className={styles.empty}>
          {query
            ? 'No members match that search.'
            : 'No members in this community yet.'}
        </div>
      ) : (
        <div className={styles.membersGrid}>
          {visible.map((m) => (
            <div key={m.id} className={styles.memberCard}>
              <div className={styles.memberAvatarWrap}>
                <Avatar
                  name={
                    m.name ??
                    (m.kind === 'instructor' ? 'Instructor' : 'Member')
                  }
                  avatarUrl={m.avatar_url ?? undefined}
                  size={84}
                />
              </div>
              <div className={styles.memberName}>
                {m.name ?? (m.kind === 'instructor' ? 'Instructor' : 'Member')}
                {m.kind === 'instructor' && (
                  <span className={styles.memberInstrBadge}>INSTR</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
