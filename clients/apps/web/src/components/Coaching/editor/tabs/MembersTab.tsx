'use client'

// Members + Cohorts tab — ported from members.jsx in the design handoff.
// Wires to /v1/coaching/cohorts and /v1/coaching/members.

import {
  useAssignMemberCohort,
  useCoachingCohorts,
  useCoachingMembers,
  useCreateCoachingCohort,
  useDeleteCoachingCohort,
  type CoachingCohortRead,
  type CoachingMemberRead,
} from '@/hooks/queries/coaching'
import type { CourseRead } from '@/hooks/queries/courses'
import { useMemo, useState } from 'react'
import { toast } from '../../../Toast/use-toast'
import { Ic } from '../icons'
import { Avatar, Btn, Menu, Modal, Pill, SectionHead } from '../ui'

const COHORTS_ALL = 'all' as const
type CohortFilter = string | typeof COHORTS_ALL

export function MembersTab({ course }: { course: CourseRead }) {
  const courseId = course.id
  const { data: cohorts = [], isLoading: cohortsLoading } =
    useCoachingCohorts(courseId)
  const { data: members = [], isLoading: membersLoading } =
    useCoachingMembers(courseId)
  const createCohort = useCreateCoachingCohort(courseId)
  const deleteCohort = useDeleteCoachingCohort(courseId)
  const assignCohort = useAssignMemberCohort(courseId)

  const [activeCohort, setActiveCohort] = useState<CohortFilter>(COHORTS_ALL)
  const [search, setSearch] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [newCohortOpen, setNewCohortOpen] = useState(false)
  const [draftCohort, setDraftCohort] = useState({ name: '', capacity: '' })

  const filtered = useMemo(() => {
    return members
      .filter((m) =>
        activeCohort === COHORTS_ALL ? true : m.cohort_id === activeCohort,
      )
      .filter(
        (m) =>
          !search ||
          (m.customer.name ?? '')
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          (m.customer.email ?? '')
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
  }, [members, activeCohort, search])

  const handleCreateCohort = async () => {
    const name = draftCohort.name.trim()
    if (!name) return
    try {
      await createCohort.mutateAsync({
        course_id: courseId,
        name,
        capacity: draftCohort.capacity
          ? Math.max(1, parseInt(draftCohort.capacity, 10))
          : null,
      })
      setNewCohortOpen(false)
      setDraftCohort({ name: '', capacity: '' })
    } catch (e) {
      toast({
        title: 'Could not create cohort',
        description: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  }

  return (
    <>
      <SectionHead
        title="Members & Cohorts"
        subtitle="Who's enrolled, where they are in the program, and which wave they're in."
      />

      {/* Cohorts */}
      <div className="ce-cohorts">
        <CohortFilterCard
          label="All cohorts"
          meta={`${members.length} member${members.length === 1 ? '' : 's'}`}
          active={activeCohort === COHORTS_ALL}
          onSelect={() => setActiveCohort(COHORTS_ALL)}
        />
        {cohorts.map((cohort) => (
          <CohortCard
            key={cohort.id}
            cohort={cohort}
            active={activeCohort === cohort.id}
            onSelect={() => setActiveCohort(cohort.id)}
            onDelete={
              cohort.is_default
                ? undefined
                : () => deleteCohort.mutate(cohort.id)
            }
          />
        ))}
        <button
          className="ce-cohort-card"
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            borderStyle: 'dashed',
            color: 'var(--ink-3)',
            cursor: 'pointer',
            background: 'transparent',
          }}
          onClick={() => setNewCohortOpen(true)}
        >
          <Ic.Plus size={14} />
          <span style={{ fontSize: 13 }}>New cohort</span>
        </button>
      </div>

      {/* Members table */}
      <div className="ce-card">
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--bg-muted)',
          }}
        >
          <div
            style={{ position: 'relative', flex: 1, maxWidth: 320 }}
          >
            <Ic.Search
              size={13}
              style={{
                position: 'absolute',
                left: 10,
                top: 9,
                color: 'var(--ink-4)',
              }}
            />
            <input
              className="ce-input"
              placeholder="Search members…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                paddingLeft: 30,
                fontSize: 12.5,
                padding: '6px 10px 6px 30px',
              }}
            />
          </div>
          <div style={{ flex: 1 }} />
          <span className="ce-muted ce-tiny">
            {filtered.length} member{filtered.length === 1 ? '' : 's'}
          </span>
        </div>

        {membersLoading || cohortsLoading ? (
          <div style={{ padding: 32, color: 'var(--ink-4)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="ce-empty" style={{ borderRadius: 0 }}>
            <div className="glyph">
              <Ic.Users size={20} />
            </div>
            <h3>No members yet</h3>
            <p>
              Members appear here as soon as someone completes checkout for
              this program.
            </p>
          </div>
        ) : (
          <table className="ce-tbl">
            <thead>
              <tr>
                <th style={{ paddingLeft: 22 }}>Member</th>
                <th>Joined</th>
                <th>Progress</th>
                <th>Cohort</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <MemberRow
                  key={m.enrollment_id}
                  member={m}
                  cohorts={cohorts}
                  openMenu={openMenu}
                  setOpenMenu={setOpenMenu}
                  onAssignCohort={(cohortId) =>
                    assignCohort.mutate({
                      enrollmentId: m.enrollment_id,
                      cohortId,
                    })
                  }
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={newCohortOpen}
        onClose={() => setNewCohortOpen(false)}
        title="New cohort"
        subtitle="Run multiple parallel waves of the same program."
        footer={
          <>
            <Btn variant="ghost" onClick={() => setNewCohortOpen(false)}>
              Cancel
            </Btn>
            <Btn
              variant="primary"
              onClick={handleCreateCohort}
              disabled={!draftCohort.name.trim() || createCohort.isPending}
            >
              {createCohort.isPending ? 'Creating…' : 'Create cohort'}
            </Btn>
          </>
        }
      >
        <div className="ce-stack-16">
          <div>
            <label className="ce-label">Name</label>
            <input
              className="ce-input"
              autoFocus
              placeholder="Spring 2026"
              value={draftCohort.name}
              onChange={(e) =>
                setDraftCohort({ ...draftCohort, name: e.target.value })
              }
            />
          </div>
          <div>
            <label className="ce-label">Capacity (optional)</label>
            <input
              className="ce-input"
              type="number"
              min={1}
              placeholder="e.g. 25"
              value={draftCohort.capacity}
              onChange={(e) =>
                setDraftCohort({ ...draftCohort, capacity: e.target.value })
              }
              style={{ maxWidth: 200 }}
            />
            <div className="ce-help">
              Informational only — purchases are never blocked after a
              successful charge.
            </div>
          </div>
        </div>
      </Modal>
    </>
  )
}

function CohortCard({
  cohort,
  active,
  onSelect,
  onDelete,
}: {
  cohort: CoachingCohortRead
  active: boolean
  onSelect: () => void
  onDelete?: () => void
}) {
  const pct =
    cohort.capacity != null && cohort.capacity > 0
      ? Math.min(100, (cohort.member_count / cohort.capacity) * 100)
      : 0
  return (
    <div
      className={'ce-cohort-card' + (active ? ' active' : '')}
      onClick={onSelect}
      style={{ cursor: 'pointer' }}
    >
      <div className="ce-row" style={{ justifyContent: 'space-between' }}>
        <div className="title">{cohort.name}</div>
        {cohort.enrollment_open ? (
          <Pill tone="success">Open</Pill>
        ) : (
          <Pill>Closed</Pill>
        )}
      </div>
      {cohort.starts_at && (
        <div className="meta">
          <Ic.Calendar size={11} />{' '}
          {new Date(cohort.starts_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>
      )}
      <div className="meta">
        <span style={{ fontWeight: 500, color: 'var(--ink-2)' }}>
          {cohort.member_count}
        </span>
        {cohort.capacity != null
          ? ` / ${cohort.capacity} enrolled`
          : ' members'}
      </div>
      {cohort.capacity != null && (
        <div className="ce-cap-bar">
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
      {onDelete && (
        <Btn
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            if (confirm(`Delete the "${cohort.name}" cohort?`)) onDelete()
          }}
          style={{ alignSelf: 'flex-start' }}
        >
          Delete
        </Btn>
      )}
    </div>
  )
}

function CohortFilterCard({
  label,
  meta,
  active,
  onSelect,
}: {
  label: string
  meta: string
  active: boolean
  onSelect: () => void
}) {
  return (
    <div
      className={'ce-cohort-card' + (active ? ' active' : '')}
      onClick={onSelect}
      style={{ cursor: 'pointer' }}
    >
      <div className="title">{label}</div>
      <div className="meta">{meta}</div>
    </div>
  )
}

function MemberRow({
  member,
  cohorts,
  openMenu,
  setOpenMenu,
  onAssignCohort,
}: {
  member: CoachingMemberRead
  cohorts: CoachingCohortRead[]
  openMenu: string | null
  setOpenMenu: (id: string | null) => void
  onAssignCohort: (cohortId: string) => void
}) {
  const pct =
    member.total_lessons > 0
      ? Math.round((member.completed_lessons / member.total_lessons) * 100)
      : 0
  const cohortName =
    member.cohort_name ||
    cohorts.find((c) => c.id === member.cohort_id)?.name ||
    'Unassigned'
  return (
    <tr>
      <td style={{ paddingLeft: 22 }}>
        <div className="ce-member-cell">
          <Avatar
            name={member.customer.name || member.customer.email || '?'}
            size={28}
          />
          <div>
            <div className="ce-member-name">
              {member.customer.name ||
                member.customer.email ||
                member.customer.id.slice(0, 8)}
            </div>
            <div className="ce-member-email">
              {member.customer.email ?? '—'}
            </div>
          </div>
        </div>
      </td>
      <td className="ce-muted">
        {new Date(member.enrolled_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </td>
      <td style={{ minWidth: 160 }}>
        <div className="ce-row" style={{ gap: 10 }}>
          <div className="ce-progress" style={{ width: 100 }}>
            <span style={{ width: pct + '%' }} />
          </div>
          <span
            className="ce-mini"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {pct}%
          </span>
        </div>
      </td>
      <td>
        <Pill>{cohortName}</Pill>
      </td>
      <td style={{ position: 'relative', textAlign: 'right' }}>
        <Btn
          variant="ghost"
          size="icon"
          onClick={() =>
            setOpenMenu(
              openMenu === member.enrollment_id ? null : member.enrollment_id,
            )
          }
        >
          <Ic.More size={14} />
        </Btn>
        <Menu
          open={openMenu === member.enrollment_id}
          onClose={() => setOpenMenu(null)}
        >
          {cohorts.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                onAssignCohort(c.id)
                setOpenMenu(null)
              }}
              disabled={c.id === member.cohort_id}
              style={{
                opacity: c.id === member.cohort_id ? 0.5 : 1,
              }}
            >
              <Ic.Users size={13} /> Move to {c.name}
            </button>
          ))}
        </Menu>
      </td>
    </tr>
  )
}
