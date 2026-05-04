'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  useCreateSequenceStep,
  useDeleteSequenceStep,
  useEmailSequence,
  useReorderSequenceSteps,
  useSequenceAnalytics,
  useSequenceEnrollments,
  useSequenceSteps,
  useUpdateEmailSequence,
  useUpdateSequenceStep,
} from '@/hooks/queries/emailMarketing'
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import DragIndicatorOutlined from '@mui/icons-material/DragIndicatorOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import Input from '@spaire/ui/components/atoms/Input'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@spaire/ui/components/atoms/Tabs'
import { Label } from '@spaire/ui/components/ui/label'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

const TRIGGER_LABELS: Record<string, string> = {
  on_subscribe: 'On subscribe',
  on_purchase: 'On purchase',
  on_subscription_created: 'On subscription created',
  on_subscription_cancelled: 'On subscription cancelled',
  on_form_submit: 'On form submit',
  manual: 'Manual',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-yellow-100 text-yellow-700',
  draft: 'bg-gray-100 text-gray-500',
}

// ── Step editor panel ─────────────────────────────────────────────────────────

function StepEditorPanel({
  step,
  sequenceId,
  onClose,
}: {
  step: any | null
  sequenceId: string
  onClose: () => void
}) {
  const createStep = useCreateSequenceStep(sequenceId)
  const updateStep = useUpdateSequenceStep(sequenceId)

  const [delayHours, setDelayHours] = useState(0)
  const [subject, setSubject] = useState('')
  const [senderName, setSenderName] = useState('')
  const [senderEmail, setSenderEmail] = useState('')
  const [replyToEmail, setReplyToEmail] = useState('')
  const [contentHtml, setContentHtml] = useState('')

  useEffect(() => {
    if (step) {
      setDelayHours(step.delay_hours ?? 0)
      setSubject(step.subject ?? '')
      setSenderName(step.sender_name ?? '')
      setSenderEmail(step.sender_email ?? '')
      setReplyToEmail(step.reply_to_email ?? '')
      setContentHtml(step.content_html ?? '')
    } else {
      setDelayHours(0)
      setSubject('')
      setSenderName('')
      setSenderEmail('')
      setReplyToEmail('')
      setContentHtml('')
    }
  }, [step])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = {
      delay_hours: delayHours,
      subject,
      sender_name: senderName,
      sender_email: senderEmail || undefined,
      reply_to_email: replyToEmail || undefined,
      content_html: contentHtml || undefined,
    }
    if (step) {
      await updateStep.mutateAsync({ stepId: step.id, ...body })
    } else {
      await createStep.mutateAsync(body)
    }
    onClose()
  }

  const isPending = createStep.isPending || updateStep.isPending

  return (
    <div className="flex h-full flex-col border-l border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="font-medium text-gray-900">
          {step ? 'Edit Step' : 'Add Step'}
        </h3>
        <button
          onClick={onClose}
          className="text-sm text-gray-400 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      <form onSubmit={handleSave} className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="space-y-1.5">
          <Label>Delay (hours after previous step)</Label>
          <Input
            type="number"
            min={0}
            value={delayHours}
            onChange={(e) => setDelayHours(Number(e.target.value))}
          />
          <p className="text-xs text-gray-400">
            0 = send immediately
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Subject *</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Your subject line"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Sender name *</Label>
          <Input
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Your name or brand"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Sender email (optional)</Label>
          <Input
            type="email"
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            placeholder="hello@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Reply-to email (optional)</Label>
          <Input
            type="email"
            value={replyToEmail}
            onChange={(e) => setReplyToEmail(e.target.value)}
            placeholder="replies@example.com"
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <Label>Email body (HTML)</Label>
          <textarea
            value={contentHtml}
            onChange={(e) => setContentHtml(e.target.value)}
            placeholder="<p>Your email content here…</p>"
            rows={12}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <p className="text-xs text-gray-400">
            Rich editor coming soon. HTML is wrapped in the org-branded email template automatically.
          </p>
        </div>
        <div className="flex gap-2 border-t border-gray-100 pt-2">
          <Button type="submit" disabled={!subject || !senderName || isPending}>
            {isPending ? 'Saving…' : 'Save Step'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}

// ── Sortable step card ────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  onEdit,
  onDelete,
}: {
  step: any
  index: number
  onEdit: (step: any) => void
  onDelete: (stepId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const delayLabel =
    step.delay_hours === 0
      ? index === 0
        ? 'Immediately'
        : 'Immediately after previous'
      : step.delay_hours === 1
        ? '1 hour after previous'
        : `${step.delay_hours} hours after previous`

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing"
      >
        <DragIndicatorOutlined fontSize="small" />
      </button>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
        {index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {step.subject}
        </p>
        <p className="text-xs text-gray-400">{delayLabel}</p>
      </div>
      <button
        onClick={() => onEdit(step)}
        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        <EditOutlined fontSize="small" />
      </button>
      <button
        onClick={() => onDelete(step.id)}
        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
      >
        <DeleteOutlined fontSize="small" />
      </button>
    </div>
  )
}

// ── Steps tab ─────────────────────────────────────────────────────────────────

function StepsTab({
  sequenceId,
  editorOpen,
  editingStep,
  onEdit,
  onAddStep,
}: {
  sequenceId: string
  editorOpen: boolean
  editingStep: any | null
  onEdit: (step: any | null) => void
  onAddStep: () => void
}) {
  const stepsQuery = useSequenceSteps(sequenceId)
  const deleteStep = useDeleteSequenceStep(sequenceId)
  const reorderSteps = useReorderSequenceSteps(sequenceId)

  const [localSteps, setLocalSteps] = useState<any[]>([])

  useEffect(() => {
    if (stepsQuery.data) setLocalSteps(stepsQuery.data as unknown as any[])
  }, [stepsQuery.data])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = localSteps.findIndex((s) => s.id === active.id)
      const newIndex = localSteps.findIndex((s) => s.id === over.id)
      const reordered = arrayMove(localSteps, oldIndex, newIndex)
      setLocalSteps(reordered)

      reorderSteps.mutate(
        reordered.map((s, i) => ({ id: s.id, position: i })),
      )
    },
    [localSteps, reorderSteps],
  )

  const handleDelete = (stepId: string) => {
    if (confirm('Delete this step?')) {
      deleteStep.mutate(stepId)
    }
  }

  if (stepsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={localSteps.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {localSteps.map((step, i) => (
              <StepCard
                key={step.id}
                step={step}
                index={i}
                onEdit={onEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {localSteps.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-10 text-center">
          <p className="text-sm font-medium text-gray-600">No steps yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Add your first email step to get started.
          </p>
        </div>
      )}

      <div>
        <Button variant="secondary" onClick={onAddStep}>
          + Add Step
        </Button>
      </div>
    </div>
  )
}

// ── Enrollments tab ───────────────────────────────────────────────────────────

function EnrollmentsTab({ sequenceId }: { sequenceId: string }) {
  const enrollmentsQuery = useSequenceEnrollments(sequenceId)
  const enrollments = (enrollmentsQuery.data as any[]) ?? []

  const STATUS_PILL: Record<string, string> = {
    active: 'bg-blue-100 text-blue-700',
    completed: 'bg-emerald-100 text-emerald-700',
    paused: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }

  if (enrollmentsQuery.isLoading) {
    return <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
  }

  if (enrollments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-10 text-center">
        <p className="text-sm text-gray-500">No enrollments yet</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-gray-500">
              Subscriber
            </th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">
              Status
            </th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">
              Step
            </th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">
              Enrolled
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {enrollments.map((e: any) => (
            <tr key={e.id}>
              <td className="px-4 py-2 font-mono text-xs text-gray-500">
                {e.subscriber_id.slice(0, 8)}…
              </td>
              <td className="px-4 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_PILL[e.status] ?? 'bg-gray-100 text-gray-500'}`}
                >
                  {e.status}
                </span>
              </td>
              <td className="px-4 py-2 text-gray-700">
                Step {e.current_step_position + 1}
              </td>
              <td className="px-4 py-2 text-gray-400">
                {new Date(e.enrolled_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Analytics tab ─────────────────────────────────────────────────────────────

function AnalyticsTab({ sequenceId }: { sequenceId: string }) {
  const analyticsQuery = useSequenceAnalytics(sequenceId)
  const a = analyticsQuery.data as any

  if (analyticsQuery.isLoading) {
    return <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
  }

  if (!a) return null

  const stats = [
    { label: 'Total sent', value: a.total_sent ?? 0, color: 'bg-blue-500' },
    {
      label: 'Open rate',
      value: `${((a.open_rate ?? 0) * 100).toFixed(1)}%`,
      color: 'bg-emerald-500',
    },
    {
      label: 'Click rate',
      value: `${((a.click_rate ?? 0) * 100).toFixed(1)}%`,
      color: 'bg-violet-500',
    },
    { label: 'Bounced', value: a.bounced ?? 0, color: 'bg-red-400' },
    {
      label: 'Total enrolled',
      value: a.total_enrolled ?? 0,
      color: 'bg-gray-400',
    },
    {
      label: 'Completed',
      value: a.completed_enrollments ?? 0,
      color: 'bg-emerald-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className={`mb-2 h-1 w-8 rounded-full ${s.color}`} />
          <p className="text-2xl font-semibold text-gray-900">{s.value}</p>
          <p className="text-sm text-gray-400">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SequenceDetailPage({
  organization,
  sequenceId,
}: {
  organization: schemas['Organization']
  sequenceId: string
}) {
  const base = `/dashboard/${organization.slug}/email-marketing/sequences`

  const sequenceQuery = useEmailSequence(sequenceId)
  const updateSequence = useUpdateEmailSequence()

  const sequence = sequenceQuery.data as any

  const [name, setName] = useState('')
  const [nameEditing, setNameEditing] = useState(false)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingStep, setEditingStep] = useState<any | null>(null)

  useEffect(() => {
    if (sequence) setName(sequence.name ?? '')
  }, [sequence])

  const handleNameSave = () => {
    if (name.trim() && name !== sequence?.name) {
      updateSequence.mutate({ sequenceId, name: name.trim() })
    }
    setNameEditing(false)
  }

  const toggleStatus = () => {
    if (!sequence) return
    const newStatus = sequence.status === 'active' ? 'paused' : 'active'
    updateSequence.mutate({ sequenceId, status: newStatus })
  }

  const openEditor = (step: any | null) => {
    setEditingStep(step)
    setEditorOpen(true)
  }

  const closeEditor = () => {
    setEditorOpen(false)
    setEditingStep(null)
  }

  if (sequenceQuery.isLoading) {
    return (
      <DashboardBody title="Sequence">
        <div className="h-48 animate-pulse rounded-2xl bg-gray-100" />
      </DashboardBody>
    )
  }

  if (!sequence) {
    return (
      <DashboardBody title="Sequence">
        <p className="text-gray-500">Sequence not found.</p>
      </DashboardBody>
    )
  }

  return (
    <DashboardBody title={sequence.name}>
      <div className="flex h-full flex-col gap-y-4">
        {/* Back */}
        <div>
          <Link
            href={base}
            className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700"
          >
            <ArrowBackOutlined fontSize="small" />
            Back to Sequences
          </Link>
        </div>

        {/* Header card */}
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:flex-row md:items-center">
          <div className="flex-1">
            {nameEditing ? (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                autoFocus
                className="text-lg font-semibold"
              />
            ) : (
              <button
                onClick={() => setNameEditing(true)}
                className="group flex items-center gap-2 text-left"
              >
                <span className="text-lg font-semibold text-gray-900">
                  {sequence.name}
                </span>
                <EditOutlined
                  fontSize="small"
                  className="text-gray-300 opacity-0 transition-opacity group-hover:opacity-100"
                />
              </button>
            )}
            <p className="mt-0.5 text-sm text-gray-400">
              {TRIGGER_LABELS[sequence.trigger_type] ?? sequence.trigger_type}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_COLORS[sequence.status] ?? 'bg-gray-100 text-gray-500'}`}
            >
              {sequence.status}
            </span>
            <Button
              variant="secondary"
              onClick={toggleStatus}
              disabled={updateSequence.isPending}
            >
              {sequence.status === 'active' ? 'Pause' : 'Activate'}
            </Button>
          </div>
        </div>

        {/* Content: tabs + optional editor panel */}
        <div className="flex flex-1 gap-6 overflow-hidden">
          <div className={`flex-1 overflow-y-auto ${editorOpen ? 'max-w-[60%]' : ''}`}>
            <Tabs defaultValue="steps">
              <TabsList className="mb-4 flex flex-row bg-transparent ring-0">
                <TabsTrigger value="steps">Steps</TabsTrigger>
                <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>
              <TabsContent value="steps">
                <StepsTab
                  sequenceId={sequenceId}
                  editorOpen={editorOpen}
                  editingStep={editingStep}
                  onEdit={openEditor}
                  onAddStep={() => openEditor(null)}
                />
              </TabsContent>
              <TabsContent value="enrollments">
                <EnrollmentsTab sequenceId={sequenceId} />
              </TabsContent>
              <TabsContent value="analytics">
                <AnalyticsTab sequenceId={sequenceId} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Step editor side panel */}
          {editorOpen && (
            <div className="w-[420px] shrink-0 overflow-hidden rounded-2xl border border-gray-200">
              <StepEditorPanel
                step={editingStep}
                sequenceId={sequenceId}
                onClose={closeEditor}
              />
            </div>
          )}
        </div>
      </div>
    </DashboardBody>
  )
}
