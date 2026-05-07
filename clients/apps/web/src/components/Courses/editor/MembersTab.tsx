'use client'

import {
  CoachingCohortRead,
  CoachingMemberRead,
  useAssignMemberCohort,
  useCoachingCohorts,
  useCoachingMembers,
  useCreateCoachingCohort,
  useDeleteCoachingCohort,
  useUpdateCoachingCohort,
} from '@/hooks/queries/coaching'
import AddOutlined from '@mui/icons-material/AddOutlined'
import { useMemo, useState } from 'react'
import { toast } from '../../Toast/use-toast'

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

export function MembersTab({ courseId }: { courseId: string }) {
  const { data: members = [], isLoading: membersLoading } =
    useCoachingMembers(courseId)
  const { data: cohorts = [], isLoading: cohortsLoading } =
    useCoachingCohorts(courseId)

  const cohortById = useMemo(
    () => new Map(cohorts.map((c) => [c.id, c])),
    [cohorts],
  )

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-8">
      <CohortsSection
        courseId={courseId}
        cohorts={cohorts}
        loading={cohortsLoading}
      />

      <section className="flex flex-col gap-4">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">
            Members
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Customers enrolled in this coaching program. Move them between
            cohorts when running multiple waves.
          </p>
        </header>

        {membersLoading ? (
          <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-12 text-center">
            <p className="text-sm text-gray-500">
              No members yet. They&apos;ll show up here as soon as someone
              completes checkout.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {members.map((member) => (
              <MemberRow
                key={member.enrollment_id}
                member={member}
                cohorts={cohorts}
                courseId={courseId}
                cohortById={cohortById}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Cohorts ─────────────────────────────────────────────────────────────────

function CohortsSection({
  courseId,
  cohorts,
  loading,
}: {
  courseId: string
  cohorts: CoachingCohortRead[]
  loading: boolean
}) {
  const [draft, setDraft] = useState<CohortDraft | null>(null)
  const createCohort = useCreateCoachingCohort(courseId)
  const updateCohort = useUpdateCoachingCohort(courseId)
  const deleteCohort = useDeleteCoachingCohort(courseId)

  const handleSave = async () => {
    if (!draft) return
    try {
      if (draft.id) {
        await updateCohort.mutateAsync({
          cohortId: draft.id,
          body: {
            name: draft.name,
            capacity: draft.capacity,
            enrollment_open: draft.enrollment_open,
          },
        })
      } else {
        await createCohort.mutateAsync({
          course_id: courseId,
          name: draft.name,
          capacity: draft.capacity,
          enrollment_open: draft.enrollment_open,
        })
      }
      setDraft(null)
    } catch (e) {
      toast({
        title: 'Could not save cohort',
        description: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  }

  const handleDelete = async (cohort: CoachingCohortRead) => {
    if (cohort.is_default) {
      toast({ title: 'The default cohort cannot be deleted.' })
      return
    }
    if (
      !confirm(
        `Delete the "${cohort.name}" cohort? Members will become unassigned.`,
      )
    )
      return
    try {
      await deleteCohort.mutateAsync(cohort.id)
    } catch (e) {
      toast({
        title: 'Could not delete cohort',
        description: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-semibold tracking-wider text-gray-400 uppercase">
            Cohorts
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Run parallel waves of the same program. Each cohort has its own
            name, capacity, and enrollment toggle.
          </p>
        </div>
        <button
          onClick={() => setDraft(emptyCohortDraft())}
          className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white transition hover:brightness-110"
        >
          <AddOutlined sx={{ fontSize: 14 }} /> Add cohort
        </button>
      </header>

      {draft && (
        <CohortForm
          draft={draft}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSave={handleSave}
          saving={createCohort.isPending || updateCohort.isPending}
        />
      )}

      {loading ? (
        <div className="h-20 animate-pulse rounded-xl bg-gray-100" />
      ) : cohorts.length === 0 ? null : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {cohorts.map((cohort) => (
            <div
              key={cohort.id}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {cohort.name}
                  </span>
                  {cohort.is_default && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium tracking-wider text-blue-700 uppercase">
                      Default
                    </span>
                  )}
                  {!cohort.enrollment_open && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium tracking-wider text-gray-600 uppercase">
                      Closed
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {cohort.member_count}
                  {cohort.capacity ? ` / ${cohort.capacity}` : ''} members
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDraft(fromCohort(cohort))}
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  Edit
                </button>
                {!cohort.is_default && (
                  <button
                    onClick={() => handleDelete(cohort)}
                    className="rounded-full px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

type CohortDraft = {
  id?: string
  name: string
  capacity: number | null
  enrollment_open: boolean
}

const emptyCohortDraft = (): CohortDraft => ({
  name: '',
  capacity: null,
  enrollment_open: true,
})

const fromCohort = (cohort: CoachingCohortRead): CohortDraft => ({
  id: cohort.id,
  name: cohort.name,
  capacity: cohort.capacity,
  enrollment_open: cohort.enrollment_open,
})

function CohortForm({
  draft,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  draft: CohortDraft
  onChange: (d: CohortDraft) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
}) {
  const canSave = draft.name.trim().length > 0
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium tracking-wider text-gray-500 uppercase">
          Name
        </label>
        <input
          autoFocus
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="Spring 2026 cohort"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium tracking-wider text-gray-500 uppercase">
            Capacity (optional)
          </label>
          <input
            type="number"
            min={1}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={draft.capacity ?? ''}
            onChange={(e) => {
              const value = e.target.value.trim()
              onChange({
                ...draft,
                capacity: value ? Math.max(1, parseInt(value, 10)) : null,
              })
            }}
            placeholder="e.g. 25"
          />
          <span className="text-[11px] text-gray-400">
            Informational only — purchases are never blocked after a
            successful charge.
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium tracking-wider text-gray-500 uppercase">
            Enrollment
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={draft.enrollment_open}
              onChange={(e) =>
                onChange({ ...draft, enrollment_open: e.target.checked })
              }
            />
            <span>Open for new members</span>
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-full px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!canSave || saving}
          className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Add cohort'}
        </button>
      </div>
    </div>
  )
}

// ── Member row ──────────────────────────────────────────────────────────────

function MemberRow({
  member,
  cohorts,
  courseId,
  cohortById,
}: {
  member: CoachingMemberRead
  cohorts: CoachingCohortRead[]
  courseId: string
  cohortById: Map<string, CoachingCohortRead>
}) {
  const assignCohort = useAssignMemberCohort(courseId)
  const completionPct =
    member.total_lessons > 0
      ? Math.round((member.completed_lessons / member.total_lessons) * 100)
      : 0

  const handleChangeCohort = async (cohortId: string) => {
    if (cohortId === (member.cohort_id ?? '')) return
    try {
      await assignCohort.mutateAsync({
        enrollmentId: member.enrollment_id,
        cohortId,
      })
    } catch (e) {
      toast({
        title: 'Could not move member',
        description: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  }

  const displayName =
    member.customer.name ||
    member.customer.email ||
    member.customer.id.slice(0, 8)
  const cohortLabel = member.cohort_id
    ? cohortById.get(member.cohort_id)?.name ?? member.cohort_name
    : null

  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
          {displayName.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">
            {displayName}
          </span>
          <span className="text-xs text-gray-500">
            {member.customer.email ?? '—'} · joined {fmtDate(member.enrolled_at)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-end">
          <span className="text-xs font-medium text-gray-700">
            {completionPct}% complete
          </span>
          <span className="text-[11px] text-gray-400">
            {member.completed_lessons} / {member.total_lessons} lessons
          </span>
        </div>
        {cohorts.length > 0 && (
          <select
            value={member.cohort_id ?? ''}
            onChange={(e) => handleChangeCohort(e.target.value)}
            className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 focus:border-blue-500 focus:outline-none"
            disabled={assignCohort.isPending}
          >
            {!cohortLabel && <option value="">Unassigned</option>}
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}
