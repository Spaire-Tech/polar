'use client'

import { TopBar } from '@/components/Courses/CourseWizard.steps'
import type { CoachingCurriculum } from './schemas'

type PartialWeek = Partial<CoachingCurriculum['weeks'][number]>
export type PartialCurriculum = { weeks?: PartialWeek[] }

export function CurriculumScreen({
  programTitle,
  partial,
  isStreaming,
  error,
  onRegenerate,
  onCreate,
  onClose,
}: {
  programTitle: string | null
  partial: PartialCurriculum
  isStreaming: boolean
  error: string | null
  onRegenerate: () => void
  onCreate: () => void
  onClose: () => void
}) {
  const weeks = partial.weeks ?? []
  return (
    <>
      <TopBar step={5} total={5} onClose={onClose} />
      <div className="so-stage">
        <div
          className="so-screen"
          style={{ maxWidth: 880 }}
        >
          <div className="so-eyebrow">Cohort curriculum</div>
          <h2 className="so-title">
            {programTitle?.trim() || 'Your program'}
          </h2>
          <p
            className="so-hint"
            style={{ marginTop: -8, marginBottom: 24 }}
          >
            One live group call per week, plus optional pre-recorded prep.
            You can edit anything later from the Events tab.
          </p>

          {error && (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: '#fef2f2',
                color: '#b91c1c',
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {weeks.length === 0 && isStreaming && (
              <div
                style={{
                  padding: 20,
                  borderRadius: 14,
                  background: 'var(--so-surface)',
                  fontSize: 13,
                  color: 'var(--so-gray4)',
                }}
              >
                Drafting weeks…
              </div>
            )}
            {weeks.map((week, idx) => (
              <WeekCard key={idx} week={week} index={idx} />
            ))}
          </div>

          <div
            className="so-btn-row"
            style={{ marginTop: 32, gap: 8 }}
          >
            <button
              type="button"
              className="so-btn-cta"
              onClick={onCreate}
              disabled={isStreaming || weeks.length === 0}
            >
              {isStreaming ? 'Generating…' : 'Looks good — create program'}
            </button>
            <button
              type="button"
              className="so-btn-back"
              onClick={onRegenerate}
              disabled={isStreaming}
            >
              ← Regenerate
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function WeekCard({ week, index }: { week: PartialWeek; index: number }) {
  const number = week.number ?? index + 1
  const session = week.session
  const modules = week.modules ?? []
  return (
    <article
      style={{
        padding: 20,
        borderRadius: 14,
        border: '1px solid var(--so-border)',
        background: 'var(--so-white)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--so-gray4)',
          }}
        >
          Week {number}
        </span>
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            margin: 0,
            color: 'var(--so-ink)',
          }}
        >
          {week.title || '…'}
        </h3>
      </header>
      {week.theme && (
        <p
          style={{
            margin: 0,
            marginBottom: 12,
            fontSize: 13,
            color: 'var(--so-gray4)',
          }}
        >
          {week.theme}
        </p>
      )}
      {session && (
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            background: 'var(--so-surface)',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--so-gray4)',
              marginBottom: 4,
            }}
          >
            Live session
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--so-ink)',
              marginBottom: 6,
            }}
          >
            {session.title || '…'}
          </div>
          {session.talking_points &&
            session.talking_points.length > 0 && (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 12.5,
                  color: 'var(--so-gray4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                {session.talking_points.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            )}
        </div>
      )}
      {modules.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--so-gray4)',
              marginBottom: 6,
            }}
          >
            Pre-recorded prep
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 12.5,
              color: 'var(--so-gray4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            {modules.map((mod, i) => (
              <li key={i}>
                <span style={{ color: 'var(--so-ink)' }}>{mod?.title}</span>
                {mod?.lessons && mod.lessons.length > 0 && (
                  <ul
                    style={{
                      margin: '4px 0 0 0',
                      paddingLeft: 18,
                      listStyle: 'circle',
                    }}
                  >
                    {mod.lessons.map((l, j) => (
                      <li key={j}>{l?.title}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}
