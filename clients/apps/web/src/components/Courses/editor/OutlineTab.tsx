'use client'

import { CourseLessonRead, CourseModuleRead, CourseRead } from '@/hooks/queries/courses'
import { useState } from 'react'
import { LessonContentType } from './ModuleCard'

// ─── Gradient thumbnails ──────────────────────────────────────────────────────

const THUMB_GRADS = [
  ['#1c1c2e', '#2d1b69'],
  ['#0f2027', '#2c5364'],
  ['#1a1a1a', '#3d3d3d'],
  ['#16213e', '#533483'],
  ['#0d0d0d', '#1a1a2e'],
  ['#1e3a2f', '#2d5a40'],
  ['#2c1810', '#8b3a1a'],
]

function ThumbGradient({ index }: { index: number }) {
  const [c1, c2] = THUMB_GRADS[index % THUMB_GRADS.length]
  return (
    <svg width="100%" height="100%" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`tg${index}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect width="160" height="90" fill={`url(#tg${index})`} />
      <line x1="0" y1="90" x2="160" y2="0" stroke="rgba(255,255,255,0.04)" strokeWidth="40" />
      <circle cx="140" cy="20" r="35" fill="rgba(255,255,255,0.03)" />
    </svg>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconPlay() {
  return (
    <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
      <path d="M1 1.5l8 4.5-8 4.5V1.5z" fill="#0a0a0a" />
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="9" height="10" viewBox="0 0 9 10" fill="none">
      <rect x="1" y="4" width="7" height="5.5" rx="1.5" stroke="white" strokeWidth="1.2" />
      <path d="M2.5 4V3a2 2 0 014 0v1" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function IconPaywall() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="1.5" y="5" width="9" height="6.5" rx="1.5" stroke="#5b21b6" strokeWidth="1.2" />
      <path d="M3.5 5V3.5a2.5 2.5 0 015 0V5" stroke="#5b21b6" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 3v2.5l1.5 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke="#8e8e93" strokeWidth="1.3" />
      <path d="M9.5 9.5L12 12" stroke="#8e8e93" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function IconDots() {
  return (
    <svg width="14" height="4" viewBox="0 0 14 4" fill="none">
      <circle cx="2" cy="2" r="1.5" fill="currentColor" />
      <circle cx="7" cy="2" r="1.5" fill="currentColor" />
      <circle cx="12" cy="2" r="1.5" fill="currentColor" />
    </svg>
  )
}

// ─── Lesson card ──────────────────────────────────────────────────────────────

function LessonCard({
  lesson,
  index,
  locked,
  onClick,
}: {
  lesson: CourseLessonRead
  index: number
  locked: boolean
  onClick: () => void
}) {
  const durationSec = lesson.duration_seconds ?? 0
  const durationLabel =
    durationSec > 0
      ? durationSec >= 3600
        ? `${Math.floor(durationSec / 3600)}h ${Math.floor((durationSec % 3600) / 60)}m`
        : `${Math.floor(durationSec / 60)}m`
      : null

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 2px 12px rgba(0,0,0,0.04)',
        transition: 'transform 0.18s cubic-bezier(0.22,1,0.36,1), box-shadow 0.18s',
        position: 'relative',
      }}
      className="lesson-card-hover"
    >
      {/* Thumbnail */}
      <div style={{ width: '100%', aspectRatio: '16/9', position: 'relative', overflow: 'hidden' }}>
        {lesson.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lesson.thumbnail_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <ThumbGradient index={index} />
        )}

        {/* Lesson number */}
        <div style={{
          position: 'absolute', top: 8, left: 9,
          fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)',
          textShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }}>
          Lesson {index + 1}
        </div>

        {/* Lock icon */}
        {locked && (
          <div style={{
            position: 'absolute', top: 8, right: 9,
            width: 18, height: 18, background: 'rgba(0,0,0,0.5)',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconLock />
          </div>
        )}

        {/* Play overlay */}
        <div className="lesson-play-overlay" style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0)', transition: 'background 0.18s',
        }}>
          <div className="lesson-play-btn" style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'rgba(255,255,255,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0, transform: 'scale(0.8)',
            transition: 'opacity 0.18s, transform 0.18s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}>
            <div style={{ marginLeft: 2 }}><IconPlay /></div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: '#0a0a0a',
          lineHeight: 1.35, marginBottom: 4,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {lesson.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#8e8e93' }}>
            <IconClock />
            {durationLabel ?? '—'}
          </div>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'none', border: 'none', color: '#c7c7cc',
              padding: '2px 4px', borderRadius: 6,
              display: 'flex', alignItems: 'center', cursor: 'pointer',
            }}
          >
            <IconDots />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main outline tab ─────────────────────────────────────────────────────────

export function OutlineTab({
  course,
  onSelectLesson,
  onAddLesson,
  onDeleteLesson,
  onReorderLessons,
  onEditPaywall,
}: {
  course: CourseRead
  selectedLessonId: string | null
  onSelectLesson: (lessonId: string) => void
  onAddLesson: (module: CourseModuleRead, contentType: LessonContentType) => void
  onDeleteLesson: (lesson: CourseLessonRead) => void
  onReorderLessons: (moduleId: string, orderedIds: string[]) => void
  onEditPaywall?: () => void
}) {
  const [query, setQuery] = useState('')

  // Flatten all lessons
  const allLessons = course.modules.flatMap((m) =>
    m.lessons.map((l) => ({ lesson: l, module: m })),
  )

  const filtered = query.trim()
    ? allLessons.filter((item) =>
        item.lesson.title.toLowerCase().includes(query.toLowerCase()),
      )
    : allLessons

  const paywallPos = course.paywall_position ?? null
  const hasPaywall = paywallPos !== null && paywallPos !== undefined

  // Split into free/locked sections (only when not searching)
  const freeLessons = (!query && hasPaywall) ? filtered.slice(0, paywallPos) : filtered
  const lockedLessons = (!query && hasPaywall) ? filtered.slice(paywallPos) : []
  const showPaywall = !query && hasPaywall

  const firstModule = course.modules[0]

  return (
    <>
      <style>{`
        .lesson-card-hover:hover {
          transform: scale(1.025);
          box-shadow: 0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06) !important;
        }
        .lesson-card-hover:hover .lesson-play-overlay {
          background: rgba(0,0,0,0.18) !important;
        }
        .lesson-card-hover:hover .lesson-play-btn {
          opacity: 1 !important;
          transform: scale(1) !important;
        }
      `}</style>

      <div style={{ background: '#f5f5f7', minHeight: '100%', padding: '24px 24px 80px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#fff', border: '1px solid #e8e8ed',
            borderRadius: 12, padding: '10px 14px', marginBottom: 24,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <IconSearch />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find lesson..."
              style={{
                flex: 1, border: 'none', outline: 'none',
                fontSize: 13, color: '#0a0a0a', background: 'transparent',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Free preview section */}
          {freeLessons.length > 0 && (
            <>
              {showPaywall && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8e8e93' }}>
                    Free preview
                  </span>
                  <span style={{ fontSize: 11, color: '#c7c7cc' }}>{freeLessons.length} lesson{freeLessons.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              {!showPaywall && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8e8e93' }}>
                    {query ? `Results` : 'All lessons'}
                  </span>
                  <span style={{ fontSize: 11, color: '#c7c7cc' }}>{filtered.length} lesson{filtered.length !== 1 ? 's' : ''}</span>
                </div>
              )}

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                gap: 16, marginBottom: 16,
              }}>
                {freeLessons.map((item, i) => (
                  <LessonCard
                    key={item.lesson.id}
                    lesson={item.lesson}
                    index={i}
                    locked={false}
                    onClick={() => onSelectLesson(item.lesson.id)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Paywall divider */}
          {showPaywall && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              margin: '4px 0 16px', padding: '10px 14px',
              background: '#f8f6ff', borderRadius: 10,
              border: '1px solid rgba(109,40,217,0.1)',
            }}>
              <div style={{
                width: 22, height: 22, background: 'rgba(91,33,182,0.14)',
                borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <IconPaywall />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#5b21b6' }}>Paywall</div>
                <div style={{ fontSize: 11, color: '#7c5cbf', marginTop: 1 }}>
                  Members with limited access can only view content above
                </div>
              </div>
              <button
                type="button"
                onClick={onEditPaywall}
                style={{
                  fontSize: 11, fontWeight: 500, color: '#5b21b6',
                  background: 'none', border: 'none', cursor: 'pointer',
                  textDecoration: 'underline', textUnderlineOffset: 2, opacity: 0.6,
                }}
              >
                Edit settings
              </button>
            </div>
          )}

          {/* Members only section */}
          {lockedLessons.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8e8e93' }}>
                  Members only
                </span>
                <span style={{ fontSize: 11, color: '#c7c7cc' }}>{lockedLessons.length} lesson{lockedLessons.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                gap: 16, marginBottom: 16,
              }}>
                {lockedLessons.map((item, i) => (
                  <LessonCard
                    key={item.lesson.id}
                    lesson={item.lesson}
                    index={(paywallPos ?? 0) + i}
                    locked={true}
                    onClick={() => onSelectLesson(item.lesson.id)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Empty states */}
          {filtered.length === 0 && allLessons.length > 0 && (
            <div style={{ textAlign: 'center', color: '#8e8e93', fontSize: 13, padding: '40px 0' }}>
              No lessons match &ldquo;{query}&rdquo;
            </div>
          )}
          {allLessons.length === 0 && (
            <div style={{ textAlign: 'center', color: '#8e8e93', fontSize: 13, padding: '60px 0' }}>
              No lessons yet. Click &ldquo;Add section&rdquo; to get started.
            </div>
          )}

        </div>
      </div>
    </>
  )
}
