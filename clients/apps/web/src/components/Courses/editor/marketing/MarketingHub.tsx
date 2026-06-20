'use client'

/**
 * Marketing hub — the course editor's "Marketing" tab.
 *
 * Mirrors the Community hub: a tabbed surface scoped under `.spaire-hub` so it
 * inherits the exact editor look (Apple system font, light/dark tokens, the
 * blue accent) and the same sticky tab bar. Three tabs:
 *   - Broadcast — one-off emails to subscribers (list + send stats), wired to
 *     the real email-broadcast endpoints. Composing opens the actual editor.
 *   - Sequence  — the existing per-course automations (unchanged).
 *   - Analytics — subscriber growth + engagement, styled like the dashboard.
 *
 * Subscribers are intentionally omitted — those are the course's customers,
 * surfaced elsewhere.
 */
import { type CourseRead } from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'
import * as React from 'react'
import '../../../Community/hub/hub.css'
import '../../../Community/hub/hub-extra.css'
import { AutomationsPanel } from '../AutomationsPanel'
import { AnalyticsPanel } from './AnalyticsPanel'
import { BroadcastPanel } from './BroadcastPanel'
import './marketing.css'

type MkTab = 'broadcast' | 'sequence' | 'analytics'

const TABS: { k: MkTab; label: string }[] = [
  { k: 'broadcast', label: 'Broadcast' },
  { k: 'sequence', label: 'Sequence' },
  { k: 'analytics', label: 'Analytics' },
]

export function MarketingHub({
  course,
  organization,
  dark,
}: {
  course: CourseRead
  organization: schemas['Organization']
  dark?: boolean
}) {
  const [tab, setTab] = React.useState<MkTab>('broadcast')

  return (
    <div className={`spaire-hub is-embedded${dark ? ' dark' : ''}`}>
      <div className="ch-statusbar">
        <div className="ch-crumb">
          <span className="ch-crumb-parent">Marketing</span>
          <span className="ch-crumb-sep">›</span>
          <span className="ch-crumb-title">
            {course.title ?? 'Untitled course'}
          </span>
        </div>
      </div>

      <div className="tabs cr-tabs">
        <div className="wrap tabs-in">
          {TABS.map((t) => (
            <button
              key={t.k}
              className={`tab ${tab === t.k ? 'on' : ''}`}
              onClick={() => setTab(t.k)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="wrap content">
        {tab === 'broadcast' ? (
          <BroadcastPanel organization={organization} />
        ) : tab === 'sequence' ? (
          <div className="mk-seq">
            <div className="mk-head">
              <div>
                <div className="mk-h">Sequences</div>
                <div className="mk-sub">
                  Email automations that fire on course enrolment, lesson
                  completion, and other course events.
                </div>
              </div>
            </div>
            <AutomationsPanel
              organization={organization}
              courseId={course.id}
              scopeLabel="course"
            />
          </div>
        ) : (
          <AnalyticsPanel organization={organization} />
        )}
      </div>
    </div>
  )
}

export default MarketingHub
