'use client'

/**
 * Marketing hub — the course editor's "Marketing" tab.
 *
 * Built in the course editor's own visual language (the same white
 * rounded-xl / border-gray-200 boxes, neutral type, centered tabs) so it reads
 * as a native part of the editor. Dark mode comes for free from the editor's
 * `editor-dark` class, which remaps these Tailwind utilities. Three tabs:
 *   - Broadcast — one-off emails (list + send stats); composing opens the real
 *     editor in-canvas (no redirect).
 *   - Sequence  — the existing per-course automations (unchanged).
 *   - Analytics — subscriber growth + engagement.
 */
import { type CourseRead } from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'
import { cn } from '@spaire/ui/lib/utils'
import * as React from 'react'
import { AutomationsPanel } from '../AutomationsPanel'
import { AnalyticsPanel } from './AnalyticsPanel'
import { BroadcastPanel } from './BroadcastPanel'

type MkTab = 'broadcast' | 'sequence' | 'analytics'

const TABS: { k: MkTab; label: string }[] = [
  { k: 'broadcast', label: 'Broadcast' },
  { k: 'sequence', label: 'Sequence' },
  { k: 'analytics', label: 'Analytics' },
]

export function MarketingHub({
  course,
  organization,
}: {
  course: CourseRead
  organization: schemas['Organization']
  /** Accepted for parity with the other tabs; theming is handled by the
   *  editor-dark class on the editor root. */
  dark?: boolean
}) {
  const [tab, setTab] = React.useState<MkTab>('broadcast')

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center justify-center border-b border-gray-200 bg-white">
        {TABS.map((t) => {
          const active = t.k === tab
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={cn(
                '-mb-px border-b-2 px-4 py-2.5 text-[13px] tracking-tight transition-colors',
                active
                  ? 'border-gray-900 font-medium text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-900',
              )}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="mx-auto w-full max-w-4xl px-8 py-8">
        {tab === 'broadcast' ? (
          <BroadcastPanel organization={organization} />
        ) : tab === 'sequence' ? (
          <div>
            <SectionHead
              title="Sequences"
              sub="Email automations that fire on course enrolment, lesson completion, and other course events."
            />
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

export function SectionHead({
  title,
  sub,
  action,
}: {
  title: string
  sub?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-gray-900">
          {title}
        </h1>
        {sub ? <p className="mt-1 text-sm text-gray-500">{sub}</p> : null}
      </div>
      {action}
    </div>
  )
}

export default MarketingHub
