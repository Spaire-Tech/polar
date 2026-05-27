'use client'

// v5 Members view. PageHero on top, a single white toolbar card
// (search + filter chips), then a vertical stack of horizontal
// member rows with avatar + name + role + (when known) an online
// pip. The Member model doesn't carry presence yet — the online
// filter / pip render only when a member is flagged online via an
// extension to the read model.
//
// Design: __design/Community-v5.html — `.members-tools`,
// `.members-grid`, `.member-card`, `.member-info`.

import type { CommunityMemberRead } from '@/hooks/queries/community'
import { useMemo, useState } from 'react'
import { Avatar } from './Avatar'
import { PageHero } from './PageHero'
import styles from './community.module.css'
import { IconSearch } from './icons'

type Props = {
  members: CommunityMemberRead[]
  isLoading: boolean
  courseCoverUrl?: string | null
  courseCoverPosition?: string | null
}

type FilterId = 'all' | 'instructors' | 'students'

export function MembersView({
  members,
  isLoading,
  courseCoverUrl,
  courseCoverPosition,
}: Props) {
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
    {
      id: 'instructors',
      label: 'Instructors',
      count: counts.instructors,
    },
    { id: 'students', label: 'Students', count: counts.students },
  ]

  return (
    <>
      <PageHero
        eyebrow={`${counts.all} ${counts.all === 1 ? 'member' : 'members'}`}
        title="Members"
        subtitle="Everyone enrolled in this course. Tap someone to see what they've shared."
        coverUrl={courseCoverUrl ?? null}
        coverPosition={courseCoverPosition ?? null}
      />

      <div className={styles.membersToolsV5}>
        <div className={styles.membersSearchWrap} style={{ flex: 1 }}>
          <IconSearch size={15} />
          <input
            className={styles.membersSearch}
            placeholder="Search members…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className={styles.membersFilterRow}>
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`${styles.membersFilter} ${
                filter === f.id ? styles.membersFilterActive : ''
              }`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span className={styles.ct}>{f.count}</span>
            </button>
          ))}
        </div>
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
        <div className={styles.membersGridV5}>
          {visible.map((m) => {
            const name =
              m.name ?? (m.kind === 'instructor' ? 'Instructor' : 'Member')
            return (
              <button key={m.id} type="button" className={styles.memberCardV5}>
                <div className={styles.memberAvatarWrapV5}>
                  <Avatar
                    name={name}
                    avatarUrl={m.avatar_url ?? undefined}
                    size={44}
                  />
                </div>
                <div className={styles.memberInfoV5}>
                  <div className={styles.memberNameV5}>
                    {name}
                    {m.kind === 'instructor' && (
                      <span className={styles.instrBadge}>INSTR</span>
                    )}
                  </div>
                  <div className={styles.memberRoleV5}>
                    {m.kind === 'instructor' ? 'Instructor' : 'Student'}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
