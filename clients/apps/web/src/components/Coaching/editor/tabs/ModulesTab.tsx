'use client'

// Modules tab — ported from modules.jsx in the design handoff.
// Reads the existing course's modules + lessons. Edit affordances open
// the existing course outline editor as a follow-up; this commit is a
// faithful read-only / "add" surface for the new design.

import type { CourseLessonRead, CourseRead } from '@/hooks/queries/courses'
import { Ic } from '../icons'
import { Btn, EmptyState, Pill, SectionHead } from '../ui'

const lessonGlyph = (type: string) => {
  if (type === 'video') return <Ic.Video size={12} />
  if (type === 'download') return <Ic.Upload size={12} />
  return <Ic.File size={12} />
}

function lessonMeta(l: CourseLessonRead): string {
  if (l.duration_seconds) {
    const mins = Math.round(l.duration_seconds / 60)
    return `${mins} min`
  }
  return l.content_type
}

export function ModulesTab({ course }: { course: CourseRead }) {
  const modules = course.modules ?? []

  if (modules.length === 0 || modules.every((m) => m.lessons.length === 0)) {
    return (
      <>
        <SectionHead
          title="Modules"
          subtitle="Optional pre-recorded content — videos, lessons, downloads."
          actions={
            <Btn variant="primary" icon={<Ic.Plus size={14} />}>
              Add a module
            </Btn>
          }
        />
        <EmptyState
          glyph={<Ic.File size={20} />}
          title="No modules yet — and that's totally fine"
          body="Many cohorts run on live calls alone. Add modules later if you want a workbook, a pre-call video, or a recorded mini-lesson."
          action={
            <Btn variant="primary" icon={<Ic.Plus size={14} />}>
              Add your first module
            </Btn>
          }
        />
      </>
    )
  }

  return (
    <>
      <SectionHead
        title="Modules"
        subtitle="Pre-recorded prep content. Members access this any time."
        actions={
          <>
            <Btn variant="ghost" icon={<Ic.Eye size={14} />}>
              Preview as member
            </Btn>
            <Btn variant="primary" icon={<Ic.Plus size={14} />}>
              Add module
            </Btn>
          </>
        }
      />

      {modules.map((m, i) => (
        <div className="ce-module-card" key={m.id}>
          <div className="ce-module-head">
            <Ic.Drag
              size={14}
              style={{ color: 'var(--ink-5)', cursor: 'grab' }}
            />
            <div className="ce-module-num">
              {String(i + 1).padStart(2, '0')}
            </div>
            <div className="ce-module-title">{m.title}</div>
            <Pill>
              {m.lessons.length} lesson{m.lessons.length === 1 ? '' : 's'}
            </Pill>
            <Btn variant="ghost" size="icon">
              <Ic.Edit size={13} />
            </Btn>
            <Btn variant="ghost" size="icon">
              <Ic.More size={14} />
            </Btn>
          </div>
          {m.lessons.map((l) => (
            <div className="ce-lesson-row" key={l.id}>
              <Ic.Drag size={12} style={{ color: 'var(--ink-5)' }} />
              <div className="ce-lesson-icon">{lessonGlyph(l.content_type)}</div>
              <div style={{ flex: 1 }}>{l.title}</div>
              <span className="ce-mini">{lessonMeta(l)}</span>
              <Btn variant="ghost" size="icon">
                <Ic.More size={14} />
              </Btn>
            </div>
          ))}
          <button className="ce-lesson-add">
            <Ic.Plus size={12} /> Add lesson — video, text, or download
          </button>
        </div>
      ))}

      <button
        className="ce-btn"
        style={{
          width: '100%',
          padding: 14,
          justifyContent: 'center',
          borderStyle: 'dashed',
          color: 'var(--ink-3)',
          marginTop: 8,
        }}
      >
        <Ic.Plus size={14} /> Add another module
      </button>

      <div
        style={{
          marginTop: 16,
          padding: '12px 14px',
          background: 'var(--bg-muted)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r)',
          color: 'var(--ink-3)',
          fontSize: 12.5,
          display: 'flex',
          gap: 8,
          alignItems: 'flex-start',
        }}
      >
        <Ic.Sparkles
          size={14}
          style={{ color: 'var(--ink-3)', marginTop: 2 }}
        />
        <div>
          <strong style={{ color: 'var(--ink-2)' }}>Tip.</strong> Modules are
          optional. Your live Events are the heartbeat — Modules are just where
          you put homework, workbooks, and anything pre-recorded.
        </div>
      </div>
    </>
  )
}
