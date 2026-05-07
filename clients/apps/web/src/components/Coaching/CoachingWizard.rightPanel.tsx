'use client'

import React from 'react'

// ─── Right-side BLACK panel with two scrolling portrait columns ────────────
// Verbatim port of `right-panel.jsx`. Animation keyframes (`coachingScrollUp`/
// `coachingScrollDown`) are injected once by `CoachingWizardStyles`.

const COL_A = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&q=80',
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=600&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&q=80',
]
const COL_B = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600&q=80',
  'https://images.unsplash.com/photo-1463453091185-61582044d556?w=600&q=80',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=600&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&q=80',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&q=80',
]

export function RightPanel({ currentStep }: { currentStep: number }) {
  return (
    <div
      className="pane"
      style={{
        background: '#000',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        padding: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 120,
          zIndex: 5,
          background:
            'linear-gradient(to bottom, #000 0%, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0))',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 160,
          zIndex: 5,
          background:
            'linear-gradient(to top, #000 0%, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0))',
          pointerEvents: 'none',
        }}
      />

      <ScrollColumn images={COL_A} duration={120} offset={0} />
      <ScrollColumn images={COL_B} duration={140} offset={-180} reverse />

      <div
        style={{
          position: 'absolute',
          bottom: 28,
          left: 32,
          zIndex: 10,
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '0.08em',
          color: 'rgba(255,255,255,0.6)',
        }}
      >
        SPAIRE
      </div>

      <div
        style={{
          position: 'absolute',
          top: 28,
          right: 32,
          zIndex: 10,
          fontSize: 12,
          color: 'rgba(255,255,255,0.55)',
          letterSpacing: '0.08em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {currentStep <= 5 ? `0${currentStep} / 05` : 'READY'}
      </div>
    </div>
  )
}

function ScrollColumn({
  images,
  duration,
  offset = 0,
  reverse,
}: {
  images: string[]
  duration: number
  offset?: number
  reverse?: boolean
}) {
  const doubled = [...images, ...images]
  return (
    <div
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        padding: '0 8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          animation: `${reverse ? 'coachingScrollDown' : 'coachingScrollUp'} ${duration}s linear infinite`,
          marginTop: offset,
        }}
      >
        {doubled.map((src, i) => (
          <div
            key={i}
            style={{
              width: '100%',
              aspectRatio: '3 / 4',
              borderRadius: 12,
              overflow: 'hidden',
              background: '#1a1a1a',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              loading="lazy"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
