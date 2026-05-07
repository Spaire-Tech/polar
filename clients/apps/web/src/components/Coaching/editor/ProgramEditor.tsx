'use client'

import { useUpdateCourse, type CourseRead } from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import './coaching-editor.css'
import { CommunityTab } from './tabs/CommunityTab'
import { EventsTab } from './tabs/EventsTab'
import { MembersTab } from './tabs/MembersTab'
import { IntakeTab } from './tabs/IntakeTab'
import { ModulesTab } from './tabs/ModulesTab'
import { PricingTab } from './tabs/PricingTab'
import { Btn } from './ui'
import { Ic } from './icons'

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
  const searchParams = useSearchParams()
  const tabParam = (searchParams.get('tab') as TabId) || null
  const [tab, setTab] = useState<TabId>(
    TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : 'events',
  )

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
  const updateCourse = useUpdateCourse()
  // Counts come in lazily — show without badges if not yet fetched, the
  // tab content fills them in.
  return (
    <>
      <div className="ce-prog-header">
        <div>
          <div className="ce-prog-eyebrow">Coaching program</div>
          <h1 className="ce-prog-title">
            {course.title || 'Untitled program'}
          </h1>
          <div className="ce-prog-meta">
            <span className="ce-status-pill">
              <span className="ce-led" /> Live
            </span>
            <span className="ce-dot" />
            <span>
              {organization.name}
            </span>
          </div>
        </div>
        <div className="ce-row">
          <Btn variant="ghost" icon={<Ic.External size={14} />}>
            View public page
          </Btn>
          <Btn icon={<Ic.Eye size={14} />}>Preview as member</Btn>
          <Btn variant="primary" icon={<Ic.Sparkles size={14} />}>
            Share invite
          </Btn>
        </div>
      </div>
      <div style={{ height: 8 }} />
      <div className="ce-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            onClick={() => onTabChange(t.id)}
            className={'ce-tab' + (activeTab === t.id ? ' active' : '')}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* updateCourse is wired so individual tabs can call it via context
          later; no-op here keeps the import live. */}
      <span style={{ display: 'none' }}>{updateCourse.isPending ? '' : ''}</span>
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
