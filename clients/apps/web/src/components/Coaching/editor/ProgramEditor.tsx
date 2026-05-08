'use client'

import {
  useCoachingEvents,
  useCoachingIntakeResponses,
  useCoachingMembers,
  useCoachingPosts,
} from '@/hooks/queries/coaching'
import type { CourseRead } from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import './coaching-editor.css'
import { CommunityTab } from './tabs/CommunityTab'
import { EventsTab } from './tabs/EventsTab'
import { MembersTab } from './tabs/MembersTab'
import { IntakeTab } from './tabs/IntakeTab'
import { ModulesTab } from './tabs/ModulesTab'
import { PricingTab } from './tabs/PricingTab'
import { Btn } from './ui'
import { Ic } from './icons'

type Lifecycle = 'draft' | 'live' | 'wrapped'

function deriveLifecycle(
  events: ReadonlyArray<{ starts_at: string; status: string }>,
): Lifecycle {
  if (events.length === 0) return 'draft'
  const now = Date.now()
  const hasFuture = events.some(
    (e) => e.status !== 'cancelled' && new Date(e.starts_at).getTime() >= now,
  )
  return hasFuture ? 'live' : 'wrapped'
}

const LIFECYCLE_LABEL: Record<Lifecycle, string> = {
  draft: 'Draft',
  live: 'Live',
  wrapped: 'Wrapped',
}

function buildMeta(
  events: ReadonlyArray<{ starts_at: string; status: string }>,
): string[] {
  if (events.length === 0) return []
  const total = events.length
  const now = Date.now()
  const upcoming = events
    .filter(
      (e) => e.status !== 'cancelled' && new Date(e.starts_at).getTime() >= now,
    )
    .sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    )
  const out: string[] = [`${total} session${total === 1 ? '' : 's'}`]
  if (upcoming[0]) {
    const d = new Date(upcoming[0].starts_at)
    out.push(
      `next ${d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })}`,
    )
  } else {
    out.push('all sessions complete')
  }
  return out
}

type TabId =
  | 'events'
  | 'modules'
  | 'community'
  | 'intake'
  | 'members'
  | 'customize'
  | 'pricing'

const TABS: { id: TabId; label: string }[] = [
  { id: 'events', label: 'Events' },
  { id: 'modules', label: 'Modules' },
  { id: 'community', label: 'Community' },
  { id: 'intake', label: 'Intake' },
  { id: 'members', label: 'Members' },
  { id: 'customize', label: 'Customize' },
  { id: 'pricing', label: 'Pricing' },
]

export default function ProgramEditor({
  organization,
  course,
}: {
  organization: schemas['Organization']
  course: CourseRead
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tabParam = (searchParams.get('tab') as TabId) || null
  const [tab, setTabState] = useState<TabId>(
    TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : 'events',
  )

  const setTab = (next: TabId) => {
    setTabState(next)
    // Persist to URL so refresh / share-link / back-button keep the tab.
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleBack = () =>
    router.push(`/dashboard/${organization.slug}/products`)

  const Body = (() => {
    switch (tab) {
      case 'events':
        return <EventsTab course={course} />
      case 'modules':
        return <ModulesTab course={course} />
      case 'community':
        return <CommunityTab course={course} />
      case 'intake':
        return <IntakeTab course={course} />
      case 'members':
        return <MembersTab course={course} />
      case 'customize':
        return <CustomizeStub />
      case 'pricing':
        return <PricingTab course={course} />
    }
  })()

  return (
    <div className="coaching-editor">
      <TopBar onBack={handleBack} />
      <div className="ce-shell">
        <ProgramHeader
          organization={organization}
          course={course}
          activeTab={tab}
          onTabChange={setTab}
        />
        <div style={{ paddingTop: 8 }}>{Body}</div>
      </div>
    </div>
  )
}

function TopBar({ onBack }: { onBack: () => void }) {
  return (
    <div className="ce-topbar">
      <div className="ce-topbar-inner">
        <button
          type="button"
          className="ce-back-btn"
          aria-label="Back to programs"
          onClick={onBack}
        >
          <Ic.Chevron size={20} style={{ transform: 'rotate(180deg)' }} />
        </button>
      </div>
    </div>
  )
}

function ProgramHeader({
  organization,
  course,
  activeTab,
  onTabChange,
}: {
  organization: schemas['Organization']
  course: CourseRead
  activeTab: TabId
  onTabChange: (next: TabId) => void
}) {
  const { data: events = [] } = useCoachingEvents(course.id)
  const { data: members = [] } = useCoachingMembers(course.id)
  const { data: posts = [] } = useCoachingPosts(course.id)
  const { data: responses = [] } = useCoachingIntakeResponses(course.id)
  const lifecycle = useMemo(() => deriveLifecycle(events), [events])
  const meta = useMemo(() => buildMeta(events), [events])

  const badges: Record<TabId, number | undefined> = {
    events: events.filter((e) => e.status !== 'cancelled').length || undefined,
    modules: undefined,
    community: posts.filter((p) => !p.hidden).length || undefined,
    intake: responses.length || undefined,
    members: members.length || undefined,
    customize: undefined,
    pricing: undefined,
  }

  return (
    <>
      <div className="ce-prog-header">
        <div>
          <div className="ce-prog-eyebrow">Coaching program</div>
          <h1 className="ce-prog-title">
            {course.title || 'Untitled program'}
          </h1>
          <div className="ce-prog-meta">
            <span
              className={
                'ce-status-pill' + (lifecycle === 'draft' ? ' draft' : '')
              }
            >
              <span className="ce-led" /> {LIFECYCLE_LABEL[lifecycle]}
            </span>
            {meta.map((piece, i) => (
              <span key={i} style={{ display: 'contents' }}>
                <span className="ce-dot" />
                <span>{piece}</span>
              </span>
            ))}
            {meta.length === 0 && (
              <>
                <span className="ce-dot" />
                <span>{organization.name}</span>
              </>
            )}
          </div>
        </div>
        <div className="ce-row">
          <Btn
            variant="ghost"
            icon={<Ic.External size={14} />}
            onClick={() =>
              window.open(
                `/${organization.slug}/products/${course.product_id}`,
                '_blank',
              )
            }
          >
            View public page
          </Btn>
          <Btn
            icon={<Ic.Eye size={14} />}
            onClick={() =>
              window.open(
                `/${organization.slug}/portal/courses/${course.id}`,
                '_blank',
              )
            }
          >
            Preview as member
          </Btn>
        </div>
      </div>
      <div style={{ height: 8 }} />
      <div className="ce-tabs" role="tablist">
        {TABS.map((t) => {
          const badge = badges[t.id]
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              onClick={() => onTabChange(t.id)}
              className={'ce-tab' + (activeTab === t.id ? ' active' : '')}
            >
              {t.label}
              {badge != null && <span className="ce-badge">{badge}</span>}
            </button>
          )
        })}
      </div>
    </>
  )
}

function CustomizeStub() {
  return (
    <div style={{ padding: '56px 0', color: 'var(--ink-3)' }}>
      <h2 style={{ fontSize: 19, fontWeight: 500, color: 'var(--ink)' }}>
        Customize
      </h2>
      <p style={{ marginTop: 8 }}>
        Your public landing page. Skipped in this rebuild — the AI handles
        it after publish, and you can edit blocks from the live preview.
      </p>
    </div>
  )
}
