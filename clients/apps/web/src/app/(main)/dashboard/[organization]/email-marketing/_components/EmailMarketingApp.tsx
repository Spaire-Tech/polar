'use client'

import { schemas } from '@spaire/client'
import Link from 'next/link'
import { useState } from 'react'
import '../styles.css'
import { Icon } from './Icon'
import {
  MarkAnalytics,
  MarkBroadcast,
  MarkPeople,
  MarkSequences,
} from './MarkIcons'
import { AnalyticsScreen } from './screens/AnalyticsScreen'
import { BroadcastDetailScreen } from './screens/BroadcastDetailScreen'
import { BroadcastsScreen } from './screens/BroadcastsScreen'
import { NewBroadcastScreen } from './screens/NewBroadcastScreen'
import { NewSequenceScreen } from './screens/NewSequenceScreen'
import { SequencesScreen } from './screens/SequencesScreen'
import { SubscribersScreen } from './screens/SubscribersScreen'

type Tab = 'subscribers' | 'broadcasts' | 'sequences' | 'analytics'
type View = 'main' | 'new-broadcast' | 'new-sequence' | 'broadcast-detail'

const TABS: {
  id: Tab
  label: string
  Mark: (props: { size?: number }) => React.ReactElement
}[] = [
  { id: 'subscribers', label: 'Subscribers', Mark: MarkPeople },
  { id: 'broadcasts', label: 'Broadcasts', Mark: MarkBroadcast },
  { id: 'sequences', label: 'Sequences', Mark: MarkSequences },
  { id: 'analytics', label: 'Analytics', Mark: MarkAnalytics },
]

export default function EmailMarketingApp({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const [tab, setTab] = useState<Tab>('subscribers')
  const [view, setView] = useState<View>('main')
  const [activeBroadcastId, setActiveBroadcastId] = useState<string | null>(
    null,
  )
  const [editingBroadcastId, setEditingBroadcastId] = useState<string | null>(
    null,
  )
  const [editingSequenceId, setEditingSequenceId] = useState<string | null>(
    null,
  )

  const selectTab = (next: Tab) => {
    setTab(next)
    setView('main')
    setActiveBroadcastId(null)
    setEditingBroadcastId(null)
    setEditingSequenceId(null)
  }

  const openBroadcast = (id: string) => {
    setActiveBroadcastId(id)
    setView('broadcast-detail')
  }

  const editBroadcast = (id: string | null) => {
    setEditingBroadcastId(id)
    setView('new-broadcast')
  }

  return (
    <div className="spaire-email-app">
      <div
        data-screen-label={`Email Marketing — ${tab}`}
        style={{
          borderBottom: '1px solid var(--line)',
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          className="container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 78,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <Link
              href={`/dashboard/${organization.slug}`}
              className="btn-icon"
              style={{ width: 36, height: 36, borderRadius: 9 }}
              aria-label="Back to dashboard"
            >
              <Icon name="arrow-left" size={15} />
            </Link>
            <a href="#" className="brand">
              <span className="brand-text">
                <span className="brand-name">Email Studio</span>
              </span>
            </a>
            <span className="brand-divider" />
            <div className="tabs">
              {TABS.map(({ id, label, Mark }) => (
                <button
                  key={id}
                  className={`tab ${tab === id ? 'tab-active' : ''}`}
                  onClick={() => selectTab(id)}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Mark size={18} />
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} />
        </div>
      </div>

      <div className="container" style={{ paddingTop: 56, paddingBottom: 96 }}>
        {tab === 'subscribers' && (
          <SubscribersScreen organization={organization} />
        )}
        {tab === 'broadcasts' && view === 'main' && (
          <BroadcastsScreen
            organization={organization}
            onNew={() => editBroadcast(null)}
            onOpen={openBroadcast}
            onEdit={(id) => editBroadcast(id)}
          />
        )}
        {tab === 'broadcasts' && view === 'new-broadcast' && (
          <NewBroadcastScreen
            organization={organization}
            broadcastId={editingBroadcastId}
            onBack={() => {
              setEditingBroadcastId(null)
              setView('main')
            }}
            onOpened={(id) => setEditingBroadcastId(id)}
          />
        )}
        {tab === 'broadcasts' &&
          view === 'broadcast-detail' &&
          activeBroadcastId && (
            <BroadcastDetailScreen
              broadcastId={activeBroadcastId}
              onBack={() => setView('main')}
            />
          )}
        {tab === 'sequences' && view === 'main' && (
          <SequencesScreen
            organization={organization}
            onNew={() => {
              setEditingSequenceId(null)
              setView('new-sequence')
            }}
            onEdit={(id) => {
              setEditingSequenceId(id)
              setView('new-sequence')
            }}
          />
        )}
        {tab === 'sequences' && view === 'new-sequence' && (
          <NewSequenceScreen
            organization={organization}
            sequenceId={editingSequenceId}
            onBack={() => {
              setEditingSequenceId(null)
              setView('main')
            }}
            onOpened={(id) => setEditingSequenceId(id)}
          />
        )}
        {tab === 'analytics' && <AnalyticsScreen organization={organization} />}
      </div>
    </div>
  )
}
