'use client'

// Audience picker, device-mock previews (MacBook / iPhone / Inbox), and
// review-and-send sections for the V2 broadcast composer.
//
// These mirror the visual chrome the legacy NewBroadcastScreen wizard
// uses, adapted to V2's state shape (subject / senderName / replyTo +
// pre-rendered HTML from @react-email/editor instead of the legacy
// content_doc → renderBlocksToHtml round trip).
//
// Lifting the visual code rather than importing the legacy sections so
// V2's state model can evolve independently of the legacy wizard.

import {
  useBroadcastEngagementHeatmap,
  useEmailSegments,
  useEmailSubscriberStats,
  useSegmentFilterPreview,
  type FilterRule,
  type FilterRules,
} from '@/hooks/queries/emailMarketing'
import { schemas } from '@spaire/client'
import { memo, useMemo, useState } from 'react'

import { Icon } from '../Icon'
import { sanitizeEmailHtml } from '../sanitize'
import { KV, Section } from '../shared'

// ---------------------------------------------------------------------------
// Audience
// ---------------------------------------------------------------------------

export type AudienceMode = 'all' | 'segment' | 'filter'

export const audienceMode = (
  segmentId: string | null,
  filterRules: FilterRules | null,
): AudienceMode => {
  if (filterRules) return 'filter'
  if (segmentId) return 'segment'
  return 'all'
}

const SOURCE_OPTIONS = [
  { value: 'space_signup', label: 'Newsletter form' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'manual', label: 'Manual' },
  { value: 'import', label: 'CSV import' },
]

export function AudienceSection({
  organization,
  segmentId,
  filterRules,
  onChange,
}: {
  organization: schemas['Organization']
  segmentId: string | null
  filterRules: FilterRules | null
  onChange: (next: {
    segmentId: string | null
    filterRules: FilterRules | null
  }) => void
}) {
  const segmentsQuery = useEmailSegments(organization.id)
  const subStatsQuery = useEmailSubscriberStats(organization.id)
  const segments = segmentsQuery.data ?? []
  const mode = audienceMode(segmentId, filterRules)
  const totalActive = subStatsQuery.data?.active ?? 0

  const previewQuery = useSegmentFilterPreview(
    organization.id,
    filterRules,
    mode === 'filter',
  )

  const selectedSegment = segments.find((s) => s.id === segmentId)
  const audienceCount =
    mode === 'all'
      ? totalActive
      : mode === 'segment'
        ? (selectedSegment?.subscriber_count ?? 0)
        : (previewQuery.data?.count ?? 0)
  const audiencePct =
    totalActive > 0 ? Math.round((audienceCount / totalActive) * 100) : 0

  const setFilterRules = (rules: FilterRule[] | null) => {
    if (rules === null) {
      onChange({ segmentId: null, filterRules: null })
      return
    }
    onChange({ segmentId: null, filterRules: { all: rules } })
  }

  const rules = filterRules?.all ?? []

  return (
    <Section
      title="Who gets this?"
      sub="Send to your whole list, pick a saved segment, or build a filter."
    >
      <div className="card" style={{ padding: 8, marginBottom: 16 }}>
        <div className="tabs" style={{ width: '100%' }}>
          <button
            className={`tab ${mode === 'all' ? 'tab-active' : ''}`}
            onClick={() => onChange({ segmentId: null, filterRules: null })}
            style={{ flex: 1 }}
          >
            All active{' '}
            <span style={{ color: 'var(--ink-4)', marginLeft: 6 }}>
              {totalActive.toLocaleString()}
            </span>
          </button>
          <button
            className={`tab ${mode === 'segment' ? 'tab-active' : ''}`}
            onClick={() => {
              if (segments.length > 0)
                onChange({
                  segmentId: segments[0].id,
                  filterRules: null,
                })
            }}
            style={{ flex: 1 }}
            disabled={segments.length === 0}
            title={
              segments.length === 0
                ? 'No segments yet — create one from the segments area.'
                : undefined
            }
          >
            By segment
            <span style={{ color: 'var(--ink-4)', marginLeft: 6 }}>
              {segments.length}
            </span>
          </button>
          <button
            className={`tab ${mode === 'filter' ? 'tab-active' : ''}`}
            onClick={() =>
              onChange({
                segmentId: null,
                filterRules: filterRules ?? {
                  all: [
                    { field: 'source', op: 'is', value: 'space_signup' },
                  ],
                },
              })
            }
            style={{ flex: 1 }}
          >
            Custom segment
          </button>
        </div>
      </div>

      {mode === 'segment' && (
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <label className="label">Pick a segment</label>
          <select
            className="select"
            value={segmentId ?? ''}
            onChange={(e) =>
              onChange({
                segmentId: e.target.value || null,
                filterRules: null,
              })
            }
          >
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.subscriber_count} subscribers
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === 'filter' && (
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--ink-2)',
              marginBottom: 16,
            }}
          >
            Subscribers who match all of:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rules.map((rule, i) => (
              <FilterRowEditor
                key={i}
                rule={rule}
                onChange={(next) => {
                  const copy = [...rules]
                  copy[i] = next
                  setFilterRules(copy)
                }}
                onRemove={() => {
                  const copy = rules.filter((_, j) => j !== i)
                  setFilterRules(copy.length ? copy : null)
                }}
              />
            ))}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 14, color: 'var(--ink-2)' }}
            onClick={() =>
              setFilterRules([
                ...rules,
                { field: 'source', op: 'is', value: 'space_signup' },
              ])
            }
          >
            <Icon name="plus" size={13} />
            Add filter
          </button>
        </div>
      )}

      <div
        style={{
          padding: 18,
          background: 'var(--bg-soft)',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>
            Estimated audience
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}
          >
            {mode === 'filter' && previewQuery.isFetching && !previewQuery.data
              ? '…'
              : audienceCount.toLocaleString()}{' '}
            subscribers
          </div>
        </div>
        <div
          style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'right' }}
        >
          {mode === 'all'
            ? 'Everyone marked active.'
            : `≈ ${audiencePct}% of your list`}
          <br />
          updates live as your list grows
        </div>
      </div>

      {mode === 'filter' &&
        previewQuery.data &&
        previewQuery.data.sample.length > 0 && (
          <div
            className="card"
            style={{
              marginTop: 16,
              padding: '12px 18px',
              fontSize: 12.5,
              color: 'var(--ink-3)',
            }}
          >
            <div
              style={{
                marginBottom: 6,
                color: 'var(--ink-2)',
                fontWeight: 500,
              }}
            >
              Sample matches
            </div>
            {previewQuery.data.sample.slice(0, 5).map((s) => (
              <div key={s.id} style={{ padding: '2px 0' }}>
                {s.name ? `${s.name} · ` : ''}
                <span style={{ color: 'var(--ink-2)' }}>{s.email}</span>
              </div>
            ))}
          </div>
        )}
    </Section>
  )
}

const FILTER_FIELDS = [
  {
    field: 'source',
    label: 'Source',
    ops: [
      { op: 'is', label: 'is' },
      { op: 'is_not', label: 'is not' },
    ],
    valueKind: 'source' as const,
  },
  {
    field: 'subscribed_at',
    label: 'Subscribed',
    ops: [
      { op: 'within_days', label: 'in the last' },
      { op: 'more_than_days_ago', label: 'more than days ago' },
    ],
    valueKind: 'days' as const,
  },
  {
    field: 'last_opened_at',
    label: 'Last opened',
    ops: [
      { op: 'within_days', label: 'within' },
      { op: 'more_than_days_ago', label: 'more than days ago' },
      { op: 'never_opened', label: 'never opened' },
    ],
    valueKind: 'days' as const,
  },
]

function FilterRowEditor({
  rule,
  onChange,
  onRemove,
}: {
  rule: FilterRule
  onChange: (next: FilterRule) => void
  onRemove: () => void
}) {
  const fieldDef =
    FILTER_FIELDS.find((f) => f.field === rule.field) ?? FILTER_FIELDS[0]
  const showValue = rule.op !== 'never_opened'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <select
        className="select"
        style={{ width: 160 }}
        value={rule.field}
        onChange={(e) => {
          const next = FILTER_FIELDS.find((f) => f.field === e.target.value)!
          onChange({
            field: next.field,
            op: next.ops[0].op,
            value: next.valueKind === 'days' ? 30 : 'space_signup',
          })
        }}
      >
        {FILTER_FIELDS.map((f) => (
          <option key={f.field} value={f.field}>
            {f.label}
          </option>
        ))}
      </select>
      <select
        className="select"
        style={{ width: 170 }}
        value={rule.op}
        onChange={(e) =>
          onChange({
            ...rule,
            op: e.target.value,
            value:
              e.target.value === 'never_opened'
                ? null
                : (rule.value ??
                  (fieldDef.valueKind === 'days' ? 30 : 'space_signup')),
          })
        }
      >
        {fieldDef.ops.map((o) => (
          <option key={o.op} value={o.op}>
            {o.label}
          </option>
        ))}
      </select>
      {showValue && fieldDef.valueKind === 'source' && (
        <select
          className="select"
          style={{ flex: 1 }}
          value={typeof rule.value === 'string' ? rule.value : ''}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
        >
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {showValue && fieldDef.valueKind === 'days' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 1,
          }}
        >
          <input
            className="input"
            type="number"
            min={1}
            max={365}
            value={typeof rule.value === 'number' ? rule.value : 30}
            onChange={(e) =>
              onChange({ ...rule, value: Number(e.target.value) || 30 })
            }
            style={{ width: 100 }}
          />
          <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>days</span>
        </div>
      )}
      {!showValue && <div style={{ flex: 1 }} />}
      <button
        className="btn-ghost"
        style={{ padding: 8, borderRadius: 8 }}
        onClick={onRemove}
        aria-label="Remove filter"
      >
        <Icon name="trash" size={15} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Previews (Desktop / Mobile / Inbox)
// ---------------------------------------------------------------------------

const SF_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro", "Helvetica Neue", sans-serif'

export type PreviewProps = {
  subject: string
  senderName: string
  replyToEmail: string
  /** Pre-rendered email HTML from composeReactEmail. */
  html: string
}

const initialsOf = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

const previewFieldsEqual = (a: PreviewProps, b: PreviewProps) =>
  a.subject === b.subject &&
  a.senderName === b.senderName &&
  a.replyToEmail === b.replyToEmail &&
  a.html === b.html

// MacBook: lid + screen + base/hinge. Mail.app menu bar + traffic lights
// + email body.
function DesktopPreviewBase({ subject, senderName, replyToEmail, html }: PreviewProps) {
  const initials = initialsOf(senderName)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        style={{
          width: 720,
          padding: 14,
          background: 'linear-gradient(180deg, #2a2a2c 0%, #1a1a1c 100%)',
          borderRadius: '18px 18px 4px 4px',
          boxShadow:
            '0 30px 60px -20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
          border: '1px solid #0a0a0c',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#0a0a0a',
              boxShadow: 'inset 0 0 0 1px #2a2a2c',
            }}
          />
        </div>
        <div
          style={{
            background: '#f5f5f7',
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid #000',
          }}
        >
          <div
            style={{
              height: 26,
              background: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(20px)',
              borderBottom: '0.5px solid rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              gap: 16,
              fontFamily: SF_FONT,
              fontSize: 12.5,
            }}
          >
            <span style={{ fontWeight: 600 }}>Mail</span>
            <span style={{ color: 'rgba(0,0,0,0.85)' }}>File</span>
            <span style={{ color: 'rgba(0,0,0,0.85)' }}>Edit</span>
            <span style={{ color: 'rgba(0,0,0,0.85)' }}>View</span>
            <span style={{ color: 'rgba(0,0,0,0.85)' }}>Mailbox</span>
            <span style={{ color: 'rgba(0,0,0,0.85)' }}>Message</span>
            <div style={{ flex: 1 }} />
            <span style={{ color: 'rgba(0,0,0,0.7)', fontSize: 12 }}>Tue 9:41 AM</span>
          </div>
          <div
            style={{
              background: '#ebebed',
              borderBottom: '0.5px solid rgba(0,0,0,0.08)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
            </div>
            <div
              style={{
                flex: 1,
                textAlign: 'center',
                fontFamily: SF_FONT,
                fontSize: 12,
                fontWeight: 600,
                color: 'rgba(0,0,0,0.7)',
              }}
            >
              Inbox — {replyToEmail || 'you@yourdomain.com'}
            </div>
            <div style={{ width: 60 }} />
          </div>
          <div
            style={{
              background: '#fff',
              padding: '22px 30px 28px',
              fontFamily: SF_FONT,
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                paddingBottom: 14,
                borderBottom: '0.5px solid rgba(60,60,67,0.18)',
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#1d1d1f',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#000' }}>
                  {senderName}{' '}
                  {replyToEmail && (
                    <span style={{ fontWeight: 400, color: 'rgba(60,60,67,0.6)' }}>
                      &lt;{replyToEmail}&gt;
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.6)', marginTop: 2 }}>
                  to me · Today, 9:41 AM
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.6)' }}>↩ Reply</div>
            </div>
            <h3
              style={{
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                margin: '0 0 18px',
                color: '#000',
                lineHeight: 1.25,
              }}
            >
              {subject || 'Untitled broadcast'}
            </h3>
            <div
              style={{ fontSize: 14, lineHeight: 1.65, color: '#000' }}
              dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(html) }}
            />
          </div>
        </div>
      </div>
      <div
        style={{
          width: 800,
          height: 14,
          background: 'linear-gradient(180deg, #c5c5c8 0%, #9a9a9d 50%, #5a5a5d 100%)',
          borderRadius: '0 0 14px 14px',
          position: 'relative',
          boxShadow: '0 10px 20px -8px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 100,
            height: 4,
            background: 'linear-gradient(180deg, #4a4a4c 0%, #6a6a6c 100%)',
            borderRadius: '0 0 6px 6px',
          }}
        />
      </div>
    </div>
  )
}
export const DesktopPreview = memo(DesktopPreviewBase, previewFieldsEqual)

function MobilePreviewBase({ subject, senderName, html }: PreviewProps) {
  const initials = initialsOf(senderName)
  return (
    <div
      style={{
        width: 360,
        height: 720,
        background: '#000',
        borderRadius: 48,
        padding: 6,
        boxShadow:
          '0 30px 60px -20px rgba(0,0,0,0.45), inset 0 0 0 2px rgba(255,255,255,0.05)',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#fff',
          borderRadius: 42,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 110,
            height: 32,
            background: '#000',
            borderRadius: 20,
            zIndex: 5,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 0,
            right: 0,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 28px',
            fontFamily: SF_FONT,
            fontSize: 14,
            fontWeight: 600,
            color: '#000',
            zIndex: 4,
          }}
        >
          <span>9:41</span>
          <span style={{ width: 110 }} />
          <span style={{ fontSize: 12 }}>● ● ●</span>
        </div>
        <div
          style={{
            paddingTop: 56,
            paddingBottom: 8,
            background: '#fff',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              height: 44,
            }}
          >
            <span style={{ fontSize: 17, color: '#007aff', fontFamily: SF_FONT }}>‹ Inbox</span>
            <div style={{ display: 'flex', gap: 18 }}>
              <span style={{ fontSize: 17, color: '#007aff' }}>⌃</span>
              <span style={{ fontSize: 17, color: '#007aff' }}>⌄</span>
            </div>
          </div>
        </div>
        <div
          style={{
            background: '#fff',
            padding: '14px 16px 24px',
            overflowY: 'auto',
            height: 'calc(100% - 110px)',
          }}
        >
          <h3
            style={{
              fontSize: 19,
              fontWeight: 600,
              margin: '0 0 12px',
              letterSpacing: '-0.01em',
              color: '#000',
              lineHeight: 1.25,
              fontFamily: SF_FONT,
            }}
          >
            {subject || 'Untitled broadcast'}
          </h3>
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              marginBottom: 14,
              paddingBottom: 14,
              borderBottom: '0.5px solid rgba(60,60,67,0.18)',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#1d1d1f',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: SF_FONT,
              }}
            >
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#000', fontFamily: SF_FONT }}>
                {senderName}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(60,60,67,0.6)', fontFamily: SF_FONT }}>
                to me · Today, 9:41 AM
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.55,
              color: '#000',
              fontFamily: SF_FONT,
            }}
            dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(html) }}
          />
        </div>
      </div>
    </div>
  )
}
export const MobilePreview = memo(MobilePreviewBase, previewFieldsEqual)

export function InboxPreview({ subject, senderName }: PreviewProps) {
  return (
    <div
      style={{
        width: 560,
        background: '#fff',
        borderRadius: 10,
        border: '1px solid var(--line)',
        overflow: 'hidden',
      }}
    >
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            padding: '14px 18px',
            display: 'flex',
            gap: 14,
            alignItems: 'center',
            borderBottom: '1px solid var(--line)',
            opacity: i === 2 ? 1 : 0.45,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: i === 2 ? '#1d1d1f' : '#86868b',
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {i === 2 ? initialsOf(senderName) : 'XX'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--ink)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {i === 2 ? senderName : 'Other sender'}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--ink-2)',
                marginTop: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {i === 2 ? subject || 'Untitled broadcast' : 'Lorem ipsum dolor sit amet'}
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>9:41 AM</div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Preview tab — switcher between the three device mocks + send-test
// ---------------------------------------------------------------------------

export function PreviewTabContent({
  preview,
  testEmail,
  setTestEmail,
  onSendTest,
  sending,
  testSent,
}: {
  preview: PreviewProps
  testEmail: string
  setTestEmail: (v: string) => void
  onSendTest: () => void
  sending: boolean
  testSent: string | null
}) {
  const [device, setDevice] = useState<'desktop' | 'mobile' | 'inbox'>('desktop')
  const validEmail = /[^@\s]+@[^@\s]+\.[^@\s]+/.test(testEmail.trim())
  return (
    <Section
      title="Preview"
      sub="See what this looks like in the inbox and across devices."
    >
      <div className="card" style={{ padding: 0 }}>
        <div
          style={{
            padding: 16,
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div className="tabs">
            <button
              className={`tab ${device === 'desktop' ? 'tab-active' : ''}`}
              onClick={() => setDevice('desktop')}
            >
              <Icon name="monitor" size={13} /> Desktop
            </button>
            <button
              className={`tab ${device === 'mobile' ? 'tab-active' : ''}`}
              onClick={() => setDevice('mobile')}
            >
              <Icon name="phone" size={13} /> Mobile
            </button>
            <button
              className={`tab ${device === 'inbox' ? 'tab-active' : ''}`}
              onClick={() => setDevice('inbox')}
            >
              <Icon name="mail" size={13} /> Inbox
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              style={{ width: 240, height: 36 }}
            />
            <button
              className="btn btn-secondary btn-sm"
              onClick={onSendTest}
              disabled={!validEmail || sending}
              style={{ opacity: !validEmail || sending ? 0.5 : 1 }}
            >
              <Icon name="send" size={13} />
              {sending ? 'Sending…' : 'Send test'}
            </button>
          </div>
        </div>
        {testSent && (
          <div
            style={{
              padding: '10px 18px',
              background: 'rgba(16,185,129,0.06)',
              color: '#047857',
              fontSize: 12.5,
              borderBottom: '1px solid var(--line)',
            }}
          >
            Test sent to {testSent}.
          </div>
        )}
        <div
          style={{
            padding: 40,
            background: 'var(--bg-soft)',
            display: 'flex',
            justifyContent: 'center',
            minHeight: 420,
          }}
        >
          {device === 'desktop' && <DesktopPreview {...preview} />}
          {device === 'mobile' && <MobilePreview {...preview} />}
          {device === 'inbox' && <InboxPreview {...preview} />}
        </div>
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Review & send (with scheduling)
// ---------------------------------------------------------------------------

const MIN_HEATMAP_SAMPLE = 8

const toLocalDateTimeInputValue = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type Heatmap = {
  matrix: (number | null)[][]
  sample_size: number
  threshold: number
} | undefined

const computeOptimalTime = (heatmap: Heatmap) => {
  const now = new Date()
  if (heatmap && heatmap.sample_size >= MIN_HEATMAP_SAMPLE) {
    let bestDow = -1
    let bestHour = -1
    let bestScore = -Infinity
    for (let dow = 0; dow < heatmap.matrix.length; dow++) {
      const row = heatmap.matrix[dow] ?? []
      for (let hour = 0; hour < row.length; hour++) {
        const score = row[hour]
        if (score == null) continue
        if (score > bestScore) {
          bestScore = score
          bestDow = dow
          bestHour = hour
        }
      }
    }
    if (bestDow >= 0 && bestHour >= 0) {
      const next = new Date(now)
      const daysUntil = (7 + bestDow - now.getDay()) % 7
      next.setDate(
        now.getDate() +
          (daysUntil === 0 && bestHour <= now.getHours() ? 7 : daysUntil),
      )
      next.setHours(bestHour, 0, 0, 0)
      return { date: next, source: 'heatmap' as const }
    }
  }
  // Fallback: next Tuesday at 9 AM.
  const tue = new Date(now)
  const daysUntilTue = (7 + 2 - now.getDay()) % 7 || 7
  tue.setDate(now.getDate() + daysUntilTue)
  tue.setHours(9, 0, 0, 0)
  return { date: tue, source: 'default' as const }
}

export function ReviewSection({
  organization,
  subject,
  previewText,
  senderName,
  replyToEmail,
  segmentId,
  filterRules,
  isReadyToSend,
  persisting,
  onSendNow,
  onSchedule,
}: {
  organization: schemas['Organization']
  subject: string
  previewText: string
  senderName: string
  replyToEmail: string
  segmentId: string | null
  filterRules: FilterRules | null
  isReadyToSend: boolean
  persisting: boolean
  onSendNow: () => Promise<void>
  onSchedule: (date: Date) => Promise<void>
}) {
  const [scheduleType, setScheduleType] = useState<'now' | 'optimal' | 'custom'>('now')
  const heatmapQuery = useBroadcastEngagementHeatmap(organization.id, 90)
  const optimal = useMemo(
    () => computeOptimalTime(heatmapQuery.data as Heatmap),
    [heatmapQuery.data],
  )
  const [customWhen, setCustomWhen] = useState(() => toLocalDateTimeInputValue(optimal.date))
  const [customMin] = useState(() =>
    toLocalDateTimeInputValue(new Date(Date.now() + 5 * 60_000)),
  )

  const subStatsQuery = useEmailSubscriberStats(organization.id)
  const segmentsQuery = useEmailSegments(organization.id)
  const segment = (segmentsQuery.data ?? []).find((s) => s.id === segmentId)
  const filterPreviewQuery = useSegmentFilterPreview(
    organization.id,
    filterRules,
    !!filterRules,
  )
  const audienceCount = filterRules
    ? (filterPreviewQuery.data?.count ?? 0)
    : segmentId
      ? (segment?.subscriber_count ?? 0)
      : (subStatsQuery.data?.active ?? 0)
  const audienceLabel = filterRules
    ? 'Custom segment'
    : segment
      ? segment.name
      : null

  const fmtFull = (d: Date) =>
    d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const onConfirm = async () => {
    if (!isReadyToSend) return
    if (scheduleType === 'now') return onSendNow()
    if (scheduleType === 'optimal') return onSchedule(optimal.date)
    const date = new Date(customWhen)
    if (Number.isNaN(date.getTime())) return
    if (date.getTime() <= Date.now()) return
    return onSchedule(date)
  }

  return (
    <Section
      title="Review & send"
      sub="Last look. Ship it now, schedule it, or pick the time most likely to be opened."
    >
      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <h3 className="h3" style={{ marginBottom: 18 }}>
          Schedule
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }}
        >
          <ScheduleOption
            id="now"
            current={scheduleType}
            onClick={setScheduleType}
            title="Send now"
            sub="Immediately"
          />
          <ScheduleOption
            id="optimal"
            current={scheduleType}
            onClick={setScheduleType}
            title={optimal.source === 'heatmap' ? 'Optimal time' : 'Suggested time'}
            sub={
              optimal.source === 'heatmap'
                ? fmtFull(optimal.date)
                : `${fmtFull(optimal.date)} · default until you have more sends`
            }
          />
          <ScheduleOption
            id="custom"
            current={scheduleType}
            onClick={setScheduleType}
            title="Pick a time"
            sub="Choose date & time"
          />
        </div>
        {scheduleType === 'custom' && (
          <div style={{ marginTop: 16 }}>
            <label className="label">Send at (your timezone)</label>
            <input
              type="datetime-local"
              className="input"
              value={customWhen}
              min={customMin}
              onChange={(e) => setCustomWhen(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h3 className="h3" style={{ marginBottom: 18 }}>
          Summary
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 24,
          }}
        >
          <KV
            k="From"
            v={`${senderName}${replyToEmail ? ` <${replyToEmail}>` : ''}`}
          />
          <KV
            k="Audience"
            v={`${audienceCount.toLocaleString()} subscribers${audienceLabel ? ` · ${audienceLabel}` : ''}`}
          />
          <KV k="Subject" v={subject || '—'} />
          <KV k="Preview" v={previewText || '—'} />
          <KV
            k="Delivery"
            v={
              scheduleType === 'now'
                ? 'Right away'
                : scheduleType === 'optimal'
                  ? `${fmtFull(optimal.date)} (${optimal.source === 'heatmap' ? 'optimal' : 'suggested'})`
                  : customWhen
                    ? fmtFull(new Date(customWhen))
                    : '—'
            }
          />
          <KV k="Estimated cost" v="Included in plan" />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => void onConfirm()}
          disabled={!isReadyToSend || persisting}
          style={{ opacity: !isReadyToSend || persisting ? 0.5 : 1 }}
        >
          <Icon name={scheduleType === 'now' ? 'send' : 'calendar'} size={15} />
          {scheduleType === 'now'
            ? persisting
              ? 'Sending…'
              : `Send to ${audienceCount.toLocaleString()}`
            : persisting
              ? 'Scheduling…'
              : 'Confirm & schedule'}
        </button>
      </div>
    </Section>
  )
}

function ScheduleOption({
  id,
  current,
  onClick,
  title,
  sub,
}: {
  id: 'now' | 'optimal' | 'custom'
  current: 'now' | 'optimal' | 'custom'
  onClick: (id: 'now' | 'optimal' | 'custom') => void
  title: string
  sub: string
}) {
  const active = current === id
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`option-card ${active ? 'is-active' : ''}`}
      style={{
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        alignItems: 'flex-start',
        textAlign: 'left',
        position: 'relative',
      }}
    >
      <span
        className="option-card-radio"
        style={{ position: 'absolute', top: 14, right: 14 }}
      />
      <div style={{ paddingRight: 28 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
          {title}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.45 }}>
          {sub}
        </div>
      </div>
    </button>
  )
}
