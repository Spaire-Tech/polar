import {
  SequenceTemplate,
  useCreateSequenceFromTemplate,
  useDeleteEmailSequence,
  useDuplicateEmailSequence,
  useEmailSequenceTemplates,
  useEmailSequences,
  useUpdateEmailSequence,
} from '@/hooks/queries/emailMarketing'
import { schemas } from '@spaire/client'
import { useState } from 'react'
import { ActionMenu } from '../ActionMenu'
import { Icon } from '../Icon'
import { MetricTile, Stat } from '../shared'

type Sequence = {
  id: string
  organization_id: string
  name: string
  description: string | null
  trigger_type: string
  trigger_config: Record<string, unknown>
  status: 'draft' | 'active' | 'paused'
  step_count: number
  enrollment_count: number
  created_at: string
}

const TRIGGER_LABEL: Record<string, string> = {
  on_subscribe: 'On subscribe',
  on_purchase: 'On purchase',
  on_subscription_created: 'Subscription started',
  on_subscription_cancelled: 'Subscription cancelled',
  on_form_submit: 'Form submitted',
  manual: 'Manual',
}

export const SequencesScreen = ({
  organization,
  onNew,
  onEdit,
}: {
  organization: schemas['Organization']
  onNew: () => void
  onEdit: (sequenceId: string) => void
}) => {
  const [view, setView] = useState<'mine' | 'templates'>('mine')
  const sequencesQuery = useEmailSequences(organization.id, { limit: 100 })
  const sequences: Sequence[] = sequencesQuery.data?.items ?? []

  const totalEnrolled = sequences.reduce(
    (acc, s) => acc + (s.enrollment_count ?? 0),
    0,
  )
  const activeCount = sequences.filter((s) => s.status === 'active').length

  return (
    <div className="fade-up">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 40,
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Automations
          </div>
          <h1 className="h-display">Sequences</h1>
          <p
            className="muted"
            style={{ fontSize: 15, marginTop: 12, maxWidth: 560 }}
          >
            Automated email series triggered by what subscribers do — joining
            your list, buying a course, finishing a lesson.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-secondary"
            onClick={() => setView('templates')}
          >
            <Icon name="grid" size={15} />
            Browse templates
          </button>
          <button className="btn btn-primary" onClick={onNew}>
            <Icon name="plus" size={15} />
            New sequence
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 56,
        }}
      >
        <MetricTile
          value={String(activeCount)}
          label="Active sequences"
          delta={`${sequences.length}`}
          deltaLabel="total"
          subtle
        />
        <MetricTile
          value={totalEnrolled.toLocaleString()}
          label="Total enrolled"
          delta=""
          deltaLabel="across all sequences"
        />
        <MetricTile
          value={String(
            sequences.reduce((acc, s) => acc + (s.step_count ?? 0), 0),
          )}
          label="Total emails"
          delta=""
          deltaLabel="across all sequences"
        />
        <MetricTile
          value={String(sequences.filter((s) => s.status === 'draft').length)}
          label="Drafts"
          delta=""
          deltaLabel="not yet active"
        />
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        <button
          className={`tab ${view === 'mine' ? 'tab-active' : ''}`}
          onClick={() => setView('mine')}
        >
          Your sequences
        </button>
        <button
          className={`tab ${view === 'templates' ? 'tab-active' : ''}`}
          onClick={() => setView('templates')}
        >
          Templates
        </button>
      </div>

      {view === 'mine' ? (
        <MySequences
          sequences={sequences}
          isLoading={sequencesQuery.isLoading}
          onEdit={onEdit}
          onNew={onNew}
        />
      ) : (
        <TemplateGallery
          organization={organization}
          onCreated={(id) => onEdit(id)}
        />
      )}
    </div>
  )
}

const MySequences = ({
  sequences,
  isLoading,
  onEdit,
  onNew,
}: {
  sequences: Sequence[]
  isLoading: boolean
  onEdit: (id: string) => void
  onNew: () => void
}) => {
  const updateMutation = useUpdateEmailSequence()
  const duplicateMutation = useDuplicateEmailSequence()
  const deleteMutation = useDeleteEmailSequence()

  if (isLoading) {
    return (
      <div
        className="card"
        style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}
      >
        Loading…
      </div>
    )
  }

  if (sequences.length === 0) {
    return (
      <div className="card" style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 16, color: 'var(--ink)', marginBottom: 8 }}>
          No sequences yet
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 18 }}>
          Build a multi-step automation, or start from a proven template.
        </div>
        <button className="btn btn-primary" onClick={onNew}>
          <Icon name="plus" size={14} />
          New sequence
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sequences.map((s) => {
        const active = s.status === 'active'
        const paused = s.status === 'paused'
        const trigger = TRIGGER_LABEL[s.trigger_type] ?? s.trigger_type

        const setStatus = (status: 'active' | 'paused' | 'draft') =>
          updateMutation.mutate({ sequenceId: s.id, status })

        return (
          <div
            key={s.id}
            className="card"
            style={{
              padding: 24,
              display: 'grid',
              gridTemplateColumns: '1fr 140px 140px 140px 40px',
              gap: 24,
              alignItems: 'center',
              cursor: 'pointer',
            }}
            onClick={() => onEdit(s.id)}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                {active ? (
                  <span className="chip chip-success">
                    <span className="dot" />
                    Active
                  </span>
                ) : paused ? (
                  <span className="chip">
                    <span
                      className="dot"
                      style={{ background: 'var(--ink-4)' }}
                    />
                    Paused
                  </span>
                ) : (
                  <span className="chip">
                    <span
                      className="dot"
                      style={{ background: 'var(--ink-4)' }}
                    />
                    Draft
                  </span>
                )}
                <span className="chip">{trigger}</span>
                <span className="chip">{s.step_count} emails</span>
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  color: 'var(--ink)',
                  letterSpacing: '-0.01em',
                }}
              >
                {s.name}
              </div>
              {s.description && (
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--ink-3)',
                    marginTop: 4,
                  }}
                >
                  {s.description}
                </div>
              )}
            </div>
            <Stat
              label="Enrolled"
              value={(s.enrollment_count ?? 0).toLocaleString()}
            />
            <Stat label="Steps" value={String(s.step_count)} />
            <Stat
              label="Status"
              value={active ? 'Running' : paused ? 'Paused' : 'Draft'}
            />
            <div onClick={(e) => e.stopPropagation()}>
              <ActionMenu
                items={[
                  {
                    label: 'Edit',
                    icon: 'edit',
                    onClick: () => onEdit(s.id),
                  },
                  {
                    label: 'Activate',
                    icon: 'play',
                    hidden: active,
                    onClick: () => setStatus('active'),
                  },
                  {
                    label: 'Pause',
                    icon: 'x-circle',
                    hidden: !active,
                    onClick: () => setStatus('paused'),
                  },
                  {
                    label: 'Duplicate',
                    icon: 'copy',
                    onClick: () => duplicateMutation.mutate(s.id),
                  },
                  {
                    label: 'Archive',
                    icon: 'trash',
                    destructive: true,
                    onClick: () => {
                      if (
                        window.confirm(
                          `Archive "${s.name}"? Active enrollments will stop.`,
                        )
                      ) {
                        deleteMutation.mutate(s.id)
                      }
                    },
                  },
                ]}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

const TemplateGallery = ({
  organization,
  onCreated,
}: {
  organization: schemas['Organization']
  onCreated: (sequenceId: string) => void
}) => {
  const templatesQuery = useEmailSequenceTemplates()
  const fromTemplate = useCreateSequenceFromTemplate(organization.id)
  const templates = templatesQuery.data ?? []

  const onUse = async (slug: string) => {
    const created = await fromTemplate.mutateAsync(slug)
    if (created?.id) onCreated(created.id)
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 20,
          background: 'var(--bg-soft)',
          borderRadius: 14,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'var(--ink)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="sparkles" size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>
            Start from a proven sequence
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
            Copy in pre-written, structurally tight templates and edit the parts
            that matter.
          </div>
        </div>
      </div>

      {templatesQuery.isLoading ? (
        <div
          className="card"
          style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}
        >
          Loading templates…
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
          }}
        >
          {templates.map((t) => (
            <TemplateCard
              key={t.slug}
              t={t}
              onUse={() => onUse(t.slug)}
              busy={fromTemplate.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const CATEGORY_ICON: Record<string, string> = {
  Course: 'book',
  Launch: 'package',
  Audience: 'mic',
  Commerce: 'shopping-cart',
  Customer: 'gift',
  Retention: 'rotate',
  Conversion: 'sparkles',
}

const CATEGORY_COLOR: Record<string, string> = {
  Course: '#1d1d1f',
  Launch: '#0066CC',
  Audience: '#7B5BFF',
  Commerce: '#FF6B35',
  Customer: '#1A7A3E',
  Retention: '#D6336C',
  Conversion: '#5856D6',
}

const TemplateCard = ({
  t,
  onUse,
  busy,
}: {
  t: SequenceTemplate
  onUse: () => void
  busy: boolean
}) => {
  const [hover, setHover] = useState(false)
  const icon = CATEGORY_ICON[t.category] ?? 'sparkles'
  const color = CATEGORY_COLOR[t.category] ?? '#1d1d1f'
  return (
    <div
      className="card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: 20,
        transition: 'all 0.18s',
        cursor: busy ? 'wait' : 'pointer',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? 'var(--shadow-md)' : 'none',
        borderColor: hover ? 'var(--line-2)' : 'var(--line)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 220,
        opacity: busy ? 0.6 : 1,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: color,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Icon name={icon} size={17} />
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--ink)',
          marginBottom: 6,
          letterSpacing: '-0.01em',
        }}
      >
        {t.name}
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: 'var(--ink-3)',
          lineHeight: 1.5,
          flex: 1,
        }}
      >
        {t.description}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 14,
          marginTop: 16,
          paddingTop: 14,
          borderTop: '1px solid var(--line)',
          fontSize: 11.5,
          color: 'var(--ink-3)',
        }}
      >
        <span>
          <strong style={{ color: 'var(--ink-2)', fontWeight: 500 }}>
            {t.step_count}
          </strong>{' '}
          emails
        </span>
        <span>{t.category}</span>
        <button
          type="button"
          disabled={busy}
          style={{
            marginLeft: 'auto',
            color: 'var(--ink)',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            fontWeight: 500,
            background: 'transparent',
            border: 'none',
            cursor: busy ? 'wait' : 'pointer',
          }}
          onClick={(e) => {
            e.stopPropagation()
            onUse()
          }}
        >
          {busy ? 'Creating…' : 'Use'}
          <Icon name="arrow-right" size={11} />
        </button>
      </div>
    </div>
  )
}
