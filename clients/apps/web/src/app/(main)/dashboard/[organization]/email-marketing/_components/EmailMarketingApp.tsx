'use client'

import { schemas } from '@spaire/client'
import Link from 'next/link'
import { useState } from 'react'
import '../styles.css'
import { Icon } from './Icon'
import { AnalyticsScreen } from './screens/AnalyticsScreen'
import { BroadcastDetailScreen } from './screens/BroadcastDetailScreen'
import { BroadcastsScreen } from './screens/BroadcastsScreen'
import { NewBroadcastScreen } from './screens/NewBroadcastScreen'
import { NewSequenceScreen } from './screens/NewSequenceScreen'
import { SequencesScreen } from './screens/SequencesScreen'
import { SubscribersScreen } from './screens/SubscribersScreen'

type Tab = 'subscribers' | 'broadcasts' | 'sequences' | 'analytics'
type View = 'main' | 'new-broadcast' | 'new-sequence' | 'broadcast-detail'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'subscribers', label: 'Subscribers', icon: 'users' },
  { id: 'broadcasts', label: 'Broadcasts', icon: 'send' },
  { id: 'sequences', label: 'Sequences', icon: 'zap' },
  { id: 'analytics', label: 'Analytics', icon: 'chart' },
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

  const selectTab = (next: Tab) => {
    setTab(next)
    setView('main')
    setActiveBroadcastId(null)
  }

  const openBroadcast = (id: string) => {
    setActiveBroadcastId(id)
    setView('broadcast-detail')
  }

  const initials = (organization.name || 'S')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="spaire-email-app">
      <div
        data-screen-label={`Email Marketing — ${tab}`}
        style={{
          borderBottom: '1px solid var(--line)',
          background: 'rgba(255,255,255,0.92)',
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
            height: 64,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Link
                href={`/dashboard/${organization.slug}`}
                className="btn-icon"
                style={{ width: 34, height: 34, borderRadius: 8 }}
                aria-label="Back to dashboard"
              >
                <Icon name="arrow-left" size={15} />
              </Link>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--ink-2)',
                  letterSpacing: '-0.01em',
                }}
              >
                Email marketing
              </span>
            </div>
            <div className="tabs">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  className={`tab ${tab === t.id ? 'tab-active' : ''}`}
                  onClick={() => selectTab(t.id)}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                    }}
                  >
                    <Icon name={t.icon} size={13} />
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="btn-icon"
              style={{ width: 34, height: 34, borderRadius: 8 }}
              aria-label="Search"
            >
              <Icon name="search" size={15} />
            </button>
            <button
              className="btn-icon"
              style={{ width: 34, height: 34, borderRadius: 8 }}
              aria-label="Settings"
            >
              <Icon name="settings" size={15} />
            </button>
            <div
              className="avatar"
              style={{
                width: 30,
                height: 30,
                background: '#1d1d1f',
                fontSize: 11,
              }}
            >
              {initials}
            </div>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
        {tab === 'subscribers' && (
          <SubscribersScreen organization={organization} />
        )}
        {tab === 'broadcasts' && view === 'main' && (
          <BroadcastsScreen
            organization={organization}
            onNew={() => setView('new-broadcast')}
            onOpen={openBroadcast}
          />
        )}
        {tab === 'broadcasts' && view === 'new-broadcast' && (
          <NewBroadcastScreen onBack={() => setView('main')} />
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
          <SequencesScreen onNew={() => setView('new-sequence')} />
        )}
        {tab === 'sequences' && view === 'new-sequence' && (
          <NewSequenceScreen onBack={() => setView('main')} />
        )}
        {tab === 'analytics' && <AnalyticsScreen organization={organization} />}
      </div>
    </div>
  )
}
