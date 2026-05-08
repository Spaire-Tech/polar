'use client'

// Members + Cohorts tab — ported from members.jsx in the design handoff.
// Wires to /v1/coaching/cohorts and /v1/coaching/members.

import {
  useAssignMemberCohort,
  useCoachingCohorts,
  useCoachingMembers,
  useCreateCoachingCohort,
  useDeleteCoachingCohort,
  useUpdateCoachingCohort,
  type CoachingCohortRead,
  type CoachingMemberRead,
} from '@/hooks/queries/coaching'
import type { CourseRead } from '@/hooks/queries/courses'
import { useEffect, useMemo, useState } from 'react'
import { toast } from '../../../Toast/use-toast'
import { Ic } from '../icons'
import { Avatar, Btn, Menu, Modal, Pill, SectionHead, Toggle } from '../ui'

const COHORTS_ALL = 'all' as const
type CohortFilter = string | typeof COHORTS_ALL

export function MembersTab({ course }: { course: CourseRead }) {
  const courseId = course.id
  const { data: cohorts = [], isLoading: cohortsLoading } =
    useCoachingCohorts(courseId)
  const { data: members = [], isLoading: membersLoading } =
    useCoachingMembers(courseId)
  const createCohort = useCreateCoachingCohort(courseId)
  const updateCohort = useUpdateCoachingCohort(courseId)
  const deleteCohort = useDeleteCoachingCohort(courseId)
  const assignCohort = useAssignMemberCohort(courseId)
  const [editing, setEditing] = useState<CoachingCohortRead | null>(null)

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
            onEdit={() => setEditing(cohort)}
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

      <EditCohortModal
        cohort={editing}
        onClose={() => setEditing(null)}
        onSave={async (patch) => {
          if (!editing) return
          try {
            await updateCohort.mutateAsync({
              cohortId: editing.id,
              body: patch,
            })
            setEditing(null)
          } catch (e) {
            toast({
              title: 'Could not save cohort',
              description: e instanceof Error ? e.message : 'Unknown error',
            })
          }
        }}
        onDelete={
          editing && !editing.is_default
            ? async () => {
                if (!editing) return
                if (
                  !confirm(
                    `Delete the "${editing.name}" cohort? Members get unassigned.`,
                  )
                )
                  return
                try {
                  await deleteCohort.mutateAsync(editing.id)
                  setEditing(null)
                  if (activeCohort === editing.id) setActiveCohort(COHORTS_ALL)
                } catch (e) {
                  toast({
                    title: 'Could not delete cohort',
                    description:
                      e instanceof Error ? e.message : 'Unknown error',
                  })
                }
              }
            : undefined
        }
        saving={updateCohort.isPending || deleteCohort.isPending}
      />
    </>
  )
}

function EditCohortModal({
  cohort,
  onClose,
  onSave,
  onDelete,
  saving,
}: {
  cohort: CoachingCohortRead | null
  onClose: () => void
  onSave: (patch: {
    name?: string
    starts_at?: string | null
    ends_at?: string | null
    capacity?: number | null
    enrollment_open?: boolean
  }) => void
  onDelete?: () => void
  saving: boolean
}) {
  const [draft, setDraft] = useState<{
    name: string
    startDate: string
    endDate: string
    capacity: string
    enrollment_open: boolean
  } | null>(null)

  // Re-seed from the cohort whenever the modal opens with a new target.
  useEffect(() => {
    if (cohort) {
      setDraft({
        name: cohort.name,
        startDate: cohort.starts_at ? cohort.starts_at.slice(0, 10) : '',
        endDate: cohort.ends_at ? cohort.ends_at.slice(0, 10) : '',
        capacity: cohort.capacity != null ? String(cohort.capacity) : '',
        enrollment_open: cohort.enrollment_open,
      })
    } else {
      setDraft(null)
    }
  }, [cohort?.id])

  const open = !!cohort && !!draft

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={cohort ? `Edit ${cohort.name}` : 'Edit cohort'}
      subtitle={
        cohort?.is_default
          ? 'This is the default cohort and cannot be deleted.'
          : 'Capacity is informational; purchases are never blocked.'
      }
      footer={
        draft ? (
          <>
            {onDelete && (
              <Btn
                variant="ghost"
                onClick={onDelete}
                style={{ marginRight: 'auto', color: 'var(--danger)' }}
                disabled={saving}
              >
                Delete cohort
              </Btn>
            )}
            <Btn variant="ghost" onClick={onClose}>
              Cancel
            </Btn>
            <Btn
              variant="primary"
              disabled={saving || !draft.name.trim()}
              onClick={() =>
                onSave({
                  name: draft.name.trim(),
                  starts_at: draft.startDate
                    ? new Date(`${draft.startDate}T00:00:00`).toISOString()
                    : null,
                  ends_at: draft.endDate
                    ? new Date(`${draft.endDate}T23:59:59`).toISOString()
                    : null,
                  capacity: draft.capacity
                    ? Math.max(1, parseInt(draft.capacity, 10))
                    : null,
                  enrollment_open: draft.enrollment_open,
                })
              }
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Btn>
          </>
        ) : null
      }
    >
      {draft && (
        <div className="ce-stack-16">
          <div>
            <label className="ce-label">Name</label>
            <input
              className="ce-input"
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="ce-grid-2">
            <div>
              <label className="ce-label">Starts</label>
              <input
                className="ce-input"
                type="date"
                value={draft.startDate}
                onChange={(e) =>
                  setDraft({ ...draft, startDate: e.target.value })
                }
              />
            </div>
            <div>
              <label className="ce-label">Ends</label>
              <input
                className="ce-input"
                type="date"
                value={draft.endDate}
                onChange={(e) =>
                  setDraft({ ...draft, endDate: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <label className="ce-label">Capacity (optional)</label>
            <input
              className="ce-input"
              type="number"
              min={1}
              placeholder="e.g. 25"
              value={draft.capacity}
              onChange={(e) =>
                setDraft({ ...draft, capacity: e.target.value })
              }
              style={{ maxWidth: 200 }}
            />
          </div>
          <div className="ce-card-pad" style={{ padding: 0 }}>
            <div className="ce-row-between">
              <div>
                <div style={{ fontWeight: 500, fontSize: 13.5 }}>
                  Enrollment
                </div>
                <div className="ce-mini" style={{ marginTop: 2 }}>
                  When closed, the storefront shows this cohort as full.
                </div>
              </div>
              <Toggle
                on={draft.enrollment_open}
                onChange={(v) => setDraft({ ...draft, enrollment_open: v })}
              />
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

function CohortCard({
  cohort,
  active,
  onSelect,
  onEdit,
}: {
  cohort: CoachingCohortRead
  active: boolean
  onSelect: () => void
  onEdit: () => void
}) {
  const pct =
    cohort.capacity != null && cohort.capacity > 0
      ? Math.min(100, (cohort.member_count / cohort.capacity) * 100)
      : 0
  return (
    <div
      className={'ce-cohort-card' + (active ? ' active' : '')}
      onClick={onSelect}
      style={{ cursor: 'pointer', position: 'relative' }}
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
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onEdit()
        }}
        className="ce-btn ce-btn-ghost ce-btn-sm"
        style={{ alignSelf: 'flex-start', padding: '2px 0' }}
      >
        Edit
      </button>
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
