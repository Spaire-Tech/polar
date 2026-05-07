'use client'

import {
  patchCoachingProgram,
  publishCoachingProgram,
  unpublishCoachingProgram,
  type CoachingProgram,
} from '@/components/Coaching/api'
import CoachingLanding from '@/components/Coaching/CoachingLanding'
import { defaultCoachingLandingData } from '@/components/Coaching/CoachingLanding.defaults'
import type { CoachingLandingData } from '@/components/Coaching/CoachingLanding.types'
import type { schemas } from '@spaire/client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Build a usable CoachingLandingData from a CoachingProgram. If the program
// already has landing_data, that wins. Otherwise we seed defaults and inject
// program-specific fields so the editor isn't fully populated with placeholder
// fitness copy.
function landingFromProgram(program: CoachingProgram): CoachingLandingData {
  if (program.landing_data) return program.landing_data
  const seed: CoachingLandingData = {
    ...defaultCoachingLandingData,
    nav: {
      ...defaultCoachingLandingData.nav,
      brand: program.title || defaultCoachingLandingData.nav.brand,
    },
    hero: {
      ...defaultCoachingLandingData.hero,
      titleParts: program.title
        ? [{ text: program.title }]
        : defaultCoachingLandingData.hero.titleParts,
      subtitle:
        program.promise || defaultCoachingLandingData.hero.subtitle,
    },
    coreEvolution: {
      ...defaultCoachingLandingData.coreEvolution,
      heading:
        program.title || defaultCoachingLandingData.coreEvolution.heading,
    },
    atlas: {
      ...defaultCoachingLandingData.atlas,
      title: program.title || defaultCoachingLandingData.atlas.title,
    },
  }
  return seed
}

export default function EditClient({
  organization,
  program: initialProgram,
}: {
  organization: schemas['Organization']
  program: CoachingProgram
}) {
  const [program, setProgram] = useState<CoachingProgram>(initialProgram)
  const [data, setData] = useState<CoachingLandingData>(() =>
    landingFromProgram(initialProgram),
  )
  const [busy, setBusy] = useState<'publish' | 'unpublish' | null>(null)
  const [copied, setCopied] = useState(false)

  // Debounced PATCH whenever the landing data changes.
  const patchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onChange = useCallback(
    (next: CoachingLandingData) => {
      setData(next)
      if (patchTimer.current) clearTimeout(patchTimer.current)
      patchTimer.current = setTimeout(() => {
        patchCoachingProgram(program.id, { landing_data: next }).catch(() => {
          /* logged in api.ts */
        })
      }, 600)
    },
    [program.id],
  )

  useEffect(() => {
    return () => {
      if (patchTimer.current) clearTimeout(patchTimer.current)
    }
  }, [])

  const isPublished = !!program.published_at
  const slug = program.slug ?? program.id

  // Public landing URL — used by both "View as buyer" and the share-copy
  // button. Built relative to the current origin so it works locally and in
  // preview deploys without extra config.
  const publicUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/${organization.slug}/coaching/${slug}`
  }, [organization.slug, slug])

  const togglePublish = async () => {
    setBusy(isPublished ? 'unpublish' : 'publish')
    try {
      const next = isPublished
        ? await unpublishCoachingProgram(program.id)
        : await publishCoachingProgram(program.id)
      setProgram(next)
    } catch (e) {
      console.warn('[coaching/edit] publish toggle failed', e)
    } finally {
      setBusy(null)
    }
  }

  const copyShare = async () => {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Sticky top bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          background: 'rgba(255,255,255,0.7)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 14,
            fontWeight: 500,
            color: '#0a0a0a',
          }}
        >
          <span style={{ letterSpacing: '-0.01em' }}>
            {program.title || 'Untitled program'}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: '3px 10px',
              borderRadius: 999,
              background: isPublished ? '#0a0a0a' : '#F2F2F4',
              color: isPublished ? '#fff' : '#6B6B70',
              letterSpacing: '0.02em',
            }}
          >
            {isPublished ? 'Published' : 'Draft'}
          </span>
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer noopener"
            style={{
              fontSize: 13,
              color: '#0a0a0a',
              textDecoration: 'none',
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.1)',
              background: '#fff',
            }}
          >
            View as buyer
          </a>
          <button
            type="button"
            onClick={copyShare}
            style={{
              fontSize: 13,
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.1)',
              background: '#fff',
              cursor: 'pointer',
              color: '#0a0a0a',
              fontFamily: 'inherit',
            }}
          >
            {copied ? 'Copied!' : 'Copy share URL'}
          </button>
          <button
            type="button"
            onClick={togglePublish}
            disabled={busy !== null}
            style={{
              fontSize: 13,
              fontWeight: 500,
              padding: '7px 14px',
              borderRadius: 8,
              border: 'none',
              background: isPublished ? '#F2F2F4' : '#0a0a0a',
              color: isPublished ? '#0a0a0a' : '#fff',
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.6 : 1,
              fontFamily: 'inherit',
            }}
          >
            {busy === 'publish'
              ? 'Publishing…'
              : busy === 'unpublish'
                ? 'Unpublishing…'
                : isPublished
                  ? 'Unpublish'
                  : 'Publish'}
          </button>
        </div>
      </div>

      <CoachingLanding
        editable
        program={data}
        onChange={onChange}
      />
    </div>
  )
}
