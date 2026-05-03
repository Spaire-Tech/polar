'use client'

import { useEffect, useRef, useState } from 'react'

// ─── Stage definitions ────────────────────────────────────────────────────────

type Stage = { key: StageKey; title: string; sub: string; duration: number }
type StageKey =
  | 'thinking'
  | 'outline'
  | 'lessons'
  | 'research'
  | 'landing'
  | 'polish'

const OUTLINE_STAGES: Stage[] = [
  {
    key: 'thinking',
    title: 'Reading your brief',
    sub: 'Pulling intent, audience, and depth from your topic.',
    duration: 3500,
  },
  {
    key: 'outline',
    title: 'Crafting your outline',
    sub: 'Sequencing modules from fundamentals to mastery.',
    duration: 5500,
  },
  {
    key: 'lessons',
    title: 'Drafting lesson scripts',
    sub: 'Each lesson gets a hook, the core idea, and a recap.',
    duration: 5500,
  },
]

const LANDING_STAGES: Stage[] = [
  {
    key: 'research',
    title: 'Studying your topic',
    sub: 'Looking at how similar courses position and price themselves.',
    duration: 3500,
  },
  {
    key: 'landing',
    title: 'Writing your landing page',
    sub: 'Hero, curriculum, instructor bio, and social proof.',
    duration: 5500,
  },
  {
    key: 'polish',
    title: 'Polishing copy & emails',
    sub: 'Receipts, welcome flow, and reminders are ready to send.',
    duration: 4000,
  },
]

const FACTS = [
  'Courses with a clear promise in the title convert ~2× better.',
  'Most students drop off in the first 3 minutes. A strong hook fixes that.',
  '12–18 lesson courses tend to feel substantial without feeling heavy.',
  'Free preview lessons lift conversion when they end on a cliffhanger.',
  'Live cohorts charge ~3× more than the same content sold async.',
  'Bundling worksheets with video lessons raises completion rates.',
  'A short instructor intro builds more trust than a polished bio.',
  'Pricing in three tiers wins more often than a single fixed price.',
]

// ─── Generating screen ────────────────────────────────────────────────────────

export function GeneratingScreen({
  title,
  modulesCount,
  lessonsCount,
  onClose,
  phase = 'outline',
}: {
  title: string
  modulesCount: number
  lessonsCount: number
  onClose: () => void
  phase?: 'outline' | 'landing'
}) {
  const stages = phase === 'landing' ? LANDING_STAGES : OUTLINE_STAGES
  const flowTitle =
    phase === 'landing' ? 'Building your landing page' : 'Building your outline'
  const flowCrumb =
    phase === 'landing' ? 'Generating landing page' : 'Generating outline'

  const [stageIdx, setStageIdx] = useState(0)
  const [stageStart, setStageStart] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [factIdx, setFactIdx] = useState(0)

  const phaseRef = useRef(phase)
  useEffect(() => {
    if (phaseRef.current !== phase) {
      phaseRef.current = phase
      setStageIdx(0)
      setStageStart(Date.now())
    }
  }, [phase])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 80)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const stage = stages[stageIdx]
    if (!stage) return
    const t = setTimeout(() => {
      if (stageIdx < stages.length - 1) {
        setStageIdx((i) => i + 1)
        setStageStart(Date.now())
      }
    }, stage.duration)
    return () => clearTimeout(t)
  }, [stageIdx, stages])

  useEffect(() => {
    const id = setInterval(
      () => setFactIdx((i) => (i + 1) % FACTS.length),
      5500,
    )
    return () => clearInterval(id)
  }, [])

  const stage = stages[stageIdx]
  const stageElapsed = Math.min(now - stageStart, stage.duration)
  const stageProgress = stageElapsed / stage.duration
  const totalDuration = stages.reduce((a, b) => a + b.duration, 0)
  const passed = stages.slice(0, stageIdx).reduce((a, b) => a + b.duration, 0)
  const overallProgress = Math.min(
    0.95,
    (passed + stageElapsed) / totalDuration,
  )

  return (
    <div className="cg-root">
      <GeneratingHeader
        progress={overallProgress}
        flowCrumb={flowCrumb}
        courseTitle={title}
        onClose={onClose}
      />
      <main className="cg-main">
        <CenterStage
          stages={stages}
          stageIdx={stageIdx}
          stage={stage}
          stageProgress={stageProgress}
          factIdx={factIdx}
          courseTitle={title}
          modulesCount={modulesCount}
          lessonsCount={lessonsCount}
        />
        <SideRail
          flowTitle={flowTitle}
          stages={stages}
          stageIdx={stageIdx}
          stageProgress={stageProgress}
        />
      </main>
      <GeneratingStyles />
    </div>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

function GeneratingHeader({
  progress,
  flowCrumb,
  courseTitle,
  onClose,
}: {
  progress: number
  flowCrumb: string
  courseTitle: string
  onClose: () => void
}) {
  return (
    <header className="cg-header">
      <div className="cg-header-row">
        <div className="cg-crumbs">
          <span className="cg-mark">
            <SpaireMark size={22} />
          </span>
          <span className="cg-crumb-sep">/</span>
          <span className="cg-crumb-muted">Courses</span>
          <span className="cg-crumb-sep">/</span>
          <span className="cg-crumb-muted">{courseTitle || 'New course'}</span>
          <span className="cg-crumb-sep">/</span>
          <span className="cg-crumb-active">{flowCrumb}</span>
        </div>
        <div className="cg-header-right">
          <span className="cg-pct">{Math.round(progress * 100)}%</span>
          <button type="button" className="cg-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
      <div className="cg-progress-track">
        <div
          className="cg-progress-fill"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </header>
  )
}

function SpaireMark({ size = 22 }: { size?: number }) {
  return (
    <span className="cg-spaire-mark" style={{ width: size, height: size }}>
      <img src="/spaire-logo-light.png" alt="spaire" />
    </span>
  )
}

// ─── Center stage ─────────────────────────────────────────────────────────────

function CenterStage({
  stages,
  stageIdx,
  stage,
  stageProgress,
  factIdx,
  courseTitle,
  modulesCount,
  lessonsCount,
}: {
  stages: Stage[]
  stageIdx: number
  stage: Stage
  stageProgress: number
  factIdx: number
  courseTitle: string
  modulesCount: number
  lessonsCount: number
}) {
  return (
    <div className="cg-center">
      <Orb />
      <div className="cg-heading">
        <div className="cg-eyebrow">
          Step {stageIdx + 1} of {stages.length}
        </div>
        <h1 key={'t' + stageIdx} className="cg-title">
          {stage.title}
        </h1>
        <p key={'s' + stageIdx} className="cg-sub">
          {stage.sub}
        </p>
      </div>
      <StagePreview
        stageKey={stage.key}
        progress={stageProgress}
        courseTitle={courseTitle}
        modulesCount={modulesCount}
        lessonsCount={lessonsCount}
      />
      <DidYouKnow factIdx={factIdx} />
    </div>
  )
}

// ─── Orb — 3D sphere with halo, sheen, breathe ───────────────────────────────

function Orb() {
  return (
    <div className="cg-orb">
      {/* soft halo */}
      <div className="cg-orb-halo" />
      {/* orb body */}
      <div className="cg-orb-body">
        {/* slow sheen */}
        <div className="cg-orb-sheen" />
        {/* highlight */}
        <div className="cg-orb-highlight" />
      </div>
    </div>
  )
}

// ─── Stage previews ───────────────────────────────────────────────────────────

function StagePreview({
  stageKey,
  progress,
  courseTitle,
  modulesCount,
  lessonsCount,
}: {
  stageKey: StageKey
  progress: number
  courseTitle: string
  modulesCount: number
  lessonsCount: number
}) {
  let body: React.ReactNode = null
  switch (stageKey) {
    case 'thinking':
      body = <ThinkingPreview courseTitle={courseTitle} />
      break
    case 'outline':
      body = (
        <OutlinePreview
          modulesCount={modulesCount}
          lessonsCount={lessonsCount}
        />
      )
      break
    case 'lessons':
      body = <LessonsPreview progress={progress} />
      break
    case 'research':
      body = <ResearchPreview />
      break
    case 'landing':
      body = <LandingSkeletonPreview />
      break
    case 'polish':
      body = <PolishPreview />
      break
  }
  return (
    <div className="cg-preview">
      <div className="cg-preview-body">{body}</div>
    </div>
  )
}

function ThinkingPreview({ courseTitle }: { courseTitle: string }) {
  const tags = [
    { t: 'topic', v: courseTitle || 'course on spaire' },
    { t: 'audience', v: 'first-time creators' },
    { t: 'depth', v: 'intermediate' },
    { t: 'tone', v: 'practical, encouraging' },
    { t: 'format', v: 'video + worksheets' },
  ]
  return (
    <div className="cg-stack">
      <div className="cg-preview-eyebrow">Extracted signals</div>
      <div className="cg-tags">
        {tags.map((t, i) => (
          <span
            key={i}
            className="cg-tag"
            style={{ animationDelay: `${i * 0.18}s` }}
          >
            <span className="cg-tag-key">{t.t}</span>
            <span className="cg-tag-val">{t.v}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function OutlinePreview({
  modulesCount,
  lessonsCount,
}: {
  modulesCount: number
  lessonsCount: number
}) {
  const labels = [
    'Picking a topic that pays',
    'Recording without overthinking',
    'Structuring lessons that finish',
    'Pricing & launch playbook',
  ]
  const items = labels.slice(
    0,
    Math.max(2, Math.min(labels.length, modulesCount || 4)),
  )
  const perModule = Math.max(
    2,
    Math.round((lessonsCount || 12) / Math.max(items.length, 1)),
  )
  return (
    <div className="cg-stack tight">
      <div className="cg-preview-eyebrow">
        Outline · {items.length} modules ·{' '}
        {lessonsCount || items.length * perModule} lessons
      </div>
      {items.map((title, i) => (
        <div
          key={i}
          className="cg-outline-row"
          style={{ animationDelay: `${i * 0.25}s` }}
        >
          <span className="cg-outline-num">0{i + 1}</span>
          <span className="cg-outline-title">{title}</span>
          <span className="cg-outline-count">{perModule} lessons</span>
        </div>
      ))}
    </div>
  )
}

function LessonsPreview({ progress: _ }: { progress: number }) {
  const text =
    'Most courses fail at the first 90 seconds. Open with the smallest possible promise — what the student will be able to do by the end of this lesson — then prove you can deliver it in under three minutes.'
  return (
    <div className="cg-stack">
      <div className="cg-lesson-meta">
        <span className="cg-preview-eyebrow">Lesson 03</span>
        <span className="cg-dot" />
        <span className="cg-lesson-title">The 90-second hook</span>
      </div>
      <div className="cg-typewriter">{text}</div>
    </div>
  )
}

function ResearchPreview() {
  const items = [
    '12 similar courses analysed',
    'Top hooks: outcome-led, time-bound, contrarian',
    'Median price band: $49–$129',
    'Most-cited objections: time, fit, support',
  ]
  return (
    <div className="cg-stack">
      <div className="cg-preview-eyebrow">Market signals</div>
      {items.map((m, i) => (
        <div
          key={i}
          className="cg-research-row"
          style={{ animationDelay: `${i * 0.25}s` }}
        >
          <span className="cg-bullet" />
          {m}
        </div>
      ))}
    </div>
  )
}

function LandingSkeletonPreview() {
  const blocks = ['Hero', 'Curriculum', 'Instructor', 'Reviews']
  return (
    <div className="cg-landing-grid">
      {blocks.map((label, i) => (
        <div
          key={label}
          className="cg-landing-block"
          style={{ animationDelay: `${i * 0.2}s` }}
        >
          <div className="cg-preview-eyebrow">{label}</div>
          {[1, 2, 3].map((j) => (
            <div
              key={j}
              className="cg-shimmer"
              style={{
                width: `${100 - j * 12}%`,
                animationDelay: `${j * 0.15}s`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function PolishPreview() {
  const items = [
    'Tightening hero headline',
    'Generating receipt template',
    'Drafting welcome email',
    'Scheduling 7-day reminder',
  ]
  return (
    <div className="cg-stack">
      <div className="cg-preview-eyebrow">Final touches</div>
      {items.map((m, i) => (
        <div
          key={m}
          className="cg-polish-row"
          style={{ animationDelay: `${i * 0.6}s` }}
        >
          <span className="cg-check" style={{ animationDelay: `${i * 0.6}s` }}>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          {m}
        </div>
      ))}
    </div>
  )
}

// ─── Did you know ─────────────────────────────────────────────────────────────

function DidYouKnow({ factIdx }: { factIdx: number }) {
  return (
    <div className="cg-tip">
      <div className="cg-tip-pill">Tip</div>
      <div key={factIdx} className="cg-tip-text">
        {FACTS[factIdx]}
      </div>
    </div>
  )
}

// ─── Side rail ────────────────────────────────────────────────────────────────

function SideRail({
  flowTitle,
  stages,
  stageIdx,
  stageProgress,
}: {
  flowTitle: string
  stages: Stage[]
  stageIdx: number
  stageProgress: number
}) {
  return (
    <aside className="cg-rail">
      <div className="cg-rail-eyebrow">{flowTitle}</div>
      <ol className="cg-rail-list">
        {stages.map((s, i) => {
          const done = i < stageIdx
          const active = i === stageIdx
          const isLast = i === stages.length - 1
          return (
            <li
              key={s.key}
              className={`cg-rail-item${done ? ' done' : ''}${active ? ' active' : ''}`}
            >
              <div className="cg-rail-marker">
                {!isLast && (
                  <span
                    className="cg-rail-connector"
                    style={{
                      background: done
                        ? 'var(--cg-ink)'
                        : 'var(--cg-hair)',
                    }}
                  />
                )}
                <span className="cg-rail-bubble">
                  {done ? (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : active ? (
                    <span className="cg-rail-pulse" />
                  ) : (
                    i + 1
                  )}
                </span>
              </div>
              <div className="cg-rail-body">
                <div className="cg-rail-title">{s.title}</div>
                <div className="cg-rail-status">
                  {done ? 'Done' : active ? 'Working on it…' : 'Up next'}
                </div>
                {active && (
                  <div className="cg-rail-bar">
                    <div
                      className="cg-rail-bar-fill"
                      style={{ width: `${stageProgress * 100}%` }}
                    />
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      <div className="cg-rail-note">
        You can close this window — generation continues in the background and
        we&apos;ll email you when your draft is ready.
      </div>
    </aside>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function GeneratingStyles() {
  return (
    <style jsx global>{`
      /* Design tokens — same Poppins system as Product Flow */
      .cg-root {
        --cg-bg: oklch(0.995 0.002 80);
        --cg-ink: oklch(0.18 0.012 270);
        --cg-ink-2: oklch(0.36 0.012 270);
        --cg-muted: oklch(0.56 0.014 270);
        --cg-muted-2: oklch(0.72 0.012 270);
        --cg-hair: oklch(0.92 0.006 270);
        --cg-hair-strong: oklch(0.86 0.008 270);
        --cg-surface-2: oklch(0.975 0.004 270);
        --cg-surface-3: oklch(0.955 0.006 270);
        --cg-accent: oklch(0.52 0.18 270);
        --cg-accent-soft: oklch(0.96 0.04 270);
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background: var(--cg-bg);
        color: var(--cg-ink);
      }
      .cg-root,
      .cg-root * {
        font-family: 'Poppins', system-ui, sans-serif;
      }

      /* Header */
      .cg-header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        padding: 18px 32px;
        background: rgba(255, 255, 255, 0.92);
        backdrop-filter: blur(8px);
        border-bottom: 1px solid var(--cg-hair);
        z-index: 200;
      }
      .cg-header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      .cg-crumbs {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 13px;
        min-width: 0;
      }
      .cg-crumb-sep {
        color: var(--cg-muted-2);
        flex-shrink: 0;
      }
      .cg-crumb-muted {
        color: var(--cg-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 200px;
      }
      .cg-crumb-active {
        color: var(--cg-ink-2);
        font-weight: 500;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .cg-mark {
        display: inline-flex;
        flex-shrink: 0;
      }
      .cg-spaire-mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        background: var(--cg-ink);
        overflow: hidden;
        flex-shrink: 0;
      }
      .cg-spaire-mark img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .cg-header-right {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
      }
      .cg-pct {
        font-size: 12px;
        color: var(--cg-muted);
        font-variant-numeric: tabular-nums;
      }
      .cg-cancel {
        padding: 7px 14px;
        font-size: 12px;
        font-weight: 500;
        background: transparent;
        border: 1px solid var(--cg-hair);
        color: var(--cg-ink-2);
        border-radius: 7px;
        cursor: pointer;
      }
      .cg-cancel:hover {
        background: var(--cg-surface-2);
        color: var(--cg-ink);
      }
      .cg-progress-track {
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--cg-hair);
      }
      .cg-progress-fill {
        height: 100%;
        background: var(--cg-ink);
        transition: width 0.2s linear;
      }

      /* Main grid */
      .cg-main {
        flex: 1;
        max-width: 1080px;
        margin: 0 auto;
        width: 100%;
        padding: 96px 32px 80px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 340px;
        gap: 56px;
      }
      @media (max-width: 880px) {
        .cg-main {
          grid-template-columns: 1fr;
          gap: 40px;
          padding: 96px 20px 60px;
        }
      }

      /* Center column */
      .cg-center {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 36px;
        padding-top: 24px;
      }
      .cg-heading {
        text-align: center;
        max-width: 520px;
      }
      .cg-eyebrow {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--cg-muted-2);
        margin-bottom: 10px;
      }
      .cg-title {
        font-size: 30px;
        font-weight: 600;
        margin: 0;
        letter-spacing: -0.7px;
        color: var(--cg-ink);
        animation: cgFadeIn 0.5s ease both;
      }
      .cg-sub {
        font-size: 15px;
        color: var(--cg-muted);
        margin-top: 10px;
        line-height: 1.55;
        animation: cgFadeIn 0.6s 0.1s ease both;
      }

      /* Orb */
      .cg-orb {
        width: 120px;
        height: 120px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .cg-orb-halo {
        position: absolute;
        inset: -8px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(10,10,10,0.10) 0%, rgba(10,10,10,0) 70%);
        animation: haloPulse 3.6s ease-in-out infinite;
      }
      .cg-orb-body {
        position: relative;
        width: 84px;
        height: 84px;
        border-radius: 50%;
        background: radial-gradient(circle at 32% 28%, #ffffff 0%, #e8e8eb 38%, #1a1a1a 92%);
        box-shadow: 0 1px 2px rgba(0,0,0,0.08), 0 12px 30px rgba(0,0,0,0.18), inset 0 -6px 14px rgba(0,0,0,0.25), inset 0 2px 4px rgba(255,255,255,0.6);
        animation: orbBreathe 3.6s ease-in-out infinite;
        overflow: hidden;
      }
      .cg-orb-sheen {
        position: absolute;
        inset: -6px;
        border-radius: 50%;
        background: conic-gradient(from 0deg, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.45) 60deg, rgba(255,255,255,0) 140deg, rgba(255,255,255,0) 360deg);
        mix-blend-mode: screen;
        animation: sheenSpin 5.5s linear infinite;
      }
      .cg-orb-highlight {
        position: absolute;
        top: 10px;
        left: 16px;
        width: 22px;
        height: 14px;
        border-radius: 50%;
        background: rgba(255,255,255,0.85);
        filter: blur(3px);
      }

      /* Preview card */
      .cg-preview {
        width: 100%;
        max-width: 560px;
        background: #fff;
        border: 1px solid var(--cg-hair);
        border-radius: 14px;
        padding: 18px;
        min-height: 180px;
        position: relative;
        overflow: hidden;
        box-shadow: 0 1px 2px oklch(0.2 0.02 270 / 0.04);
      }
      .cg-preview-body {
        position: relative;
      }
      .cg-preview-eyebrow {
        font-size: 11px;
        font-weight: 600;
        color: var(--cg-muted-2);
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .cg-stack {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .cg-stack.tight {
        gap: 8px;
      }

      /* Thinking tags */
      .cg-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .cg-tag {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        padding: 6px 10px;
        font-size: 12px;
        background: var(--cg-surface-2);
        border: 1px solid var(--cg-hair);
        border-radius: 8px;
        animation: cgFadeIn 0.5s ease both;
      }
      .cg-tag-key {
        color: var(--cg-muted-2);
        font-weight: 500;
      }
      .cg-tag-val {
        color: var(--cg-ink);
        font-weight: 500;
      }

      /* Outline rows */
      .cg-outline-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        background: var(--cg-surface-2);
        border-radius: 9px;
        animation: cgSlideIn 0.5s ease both;
      }
      .cg-outline-num {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 6px;
        background: #fff;
        border: 1px solid var(--cg-hair);
        font-size: 11px;
        font-weight: 600;
        color: var(--cg-muted);
        font-variant-numeric: tabular-nums;
      }
      .cg-outline-title {
        font-size: 13px;
        font-weight: 500;
        color: var(--cg-ink);
        flex: 1;
      }
      .cg-outline-count {
        font-size: 11px;
        color: var(--cg-muted-2);
      }

      /* Lessons typewriter */
      .cg-lesson-meta {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .cg-dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: var(--cg-muted-2);
      }
      .cg-lesson-title {
        font-size: 12px;
        color: var(--cg-ink-2);
        font-weight: 500;
      }
      .cg-typewriter {
        font-size: 13.5px;
        color: var(--cg-ink-2);
        line-height: 1.6;
        min-height: 100px;
      }
      .cg-caret {
        display: inline-block;
        width: 7px;
        height: 15px;
        margin-left: 2px;
        background: var(--cg-ink);
        vertical-align: middle;
        animation: cgBlink 1s steps(1) infinite;
      }

      /* Research rows */
      .cg-research-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        background: var(--cg-surface-2);
        border-radius: 9px;
        font-size: 13px;
        color: var(--cg-ink-2);
        animation: cgSlideIn 0.45s ease both;
      }
      .cg-bullet {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--cg-ink);
        flex-shrink: 0;
      }

      /* Landing skeleton grid */
      .cg-landing-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .cg-landing-block {
        padding: 12px;
        background: var(--cg-surface-2);
        border-radius: 10px;
        border: 1px solid var(--cg-hair);
        animation: cgFadeIn 0.5s ease both;
      }
      .cg-shimmer {
        height: 6px;
        margin-top: 6px;
        border-radius: 3px;
        background: linear-gradient(
          90deg,
          var(--cg-hair),
          var(--cg-surface-3),
          var(--cg-hair)
        );
        background-size: 200% 100%;
        animation: cgShimmer 1.6s linear infinite;
      }

      /* Polish rows */
      .cg-polish-row {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 13px;
        color: var(--cg-ink-2);
        animation: cgSlideIn 0.4s ease both;
      }
      .cg-check {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--cg-ink);
        color: #fff;
        flex-shrink: 0;
        animation: cgCheckPop 0.35s ease both;
      }

      /* Tip box */
      .cg-tip {
        max-width: 560px;
        width: 100%;
        padding: 16px 18px;
        background: var(--cg-surface-2);
        border: 1px solid var(--cg-hair);
        border-radius: 12px;
        display: flex;
        gap: 14px;
        align-items: flex-start;
      }
      .cg-tip-pill {
        flex-shrink: 0;
        margin-top: 2px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--cg-ink);
        padding: 4px 8px;
        border-radius: 5px;
        background: var(--cg-surface-3);
      }
      .cg-tip-text {
        font-size: 13.5px;
        color: var(--cg-ink-2);
        line-height: 1.55;
        animation: cgFadeIn 0.6s ease both;
      }

      /* Side rail */
      .cg-rail {
        padding-top: 24px;
      }
      .cg-rail-eyebrow {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--cg-muted-2);
        margin-bottom: 16px;
      }
      .cg-rail-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .cg-rail-item {
        display: flex;
        gap: 14px;
        align-items: flex-start;
        padding: 12px 0;
        opacity: 0.5;
        transition: opacity 0.3s;
      }
      .cg-rail-item.active,
      .cg-rail-item.done {
        opacity: 1;
      }
      .cg-rail-marker {
        position: relative;
        flex-shrink: 0;
        width: 22px;
        height: 22px;
        margin-top: 1px;
      }
      .cg-rail-connector {
        position: absolute;
        left: 50%;
        top: 22px;
        width: 1px;
        height: 38px;
        transform: translateX(-50%);
      }
      .cg-rail-bubble {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: var(--cg-surface-3);
        border: 1px solid var(--cg-hair-strong);
        color: var(--cg-muted);
        font-size: 10px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .cg-rail-item.active .cg-rail-bubble {
        background: #fff;
        border: 1.5px solid var(--cg-ink);
        color: var(--cg-ink);
      }
      .cg-rail-item.done .cg-rail-bubble {
        background: var(--cg-ink);
        border: none;
        color: #fff;
      }
      .cg-rail-pulse {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--cg-ink);
        animation: cgPulse 1.5s ease-in-out infinite;
      }
      .cg-rail-body {
        flex: 1;
        min-width: 0;
      }
      .cg-rail-title {
        font-size: 13.5px;
        font-weight: 500;
        color: var(--cg-muted);
      }
      .cg-rail-item.active .cg-rail-title {
        font-weight: 600;
        color: var(--cg-ink);
      }
      .cg-rail-item.done .cg-rail-title {
        color: var(--cg-ink-2);
      }
      .cg-rail-status {
        font-size: 12px;
        color: var(--cg-muted);
        margin-top: 2px;
        line-height: 1.45;
      }
      .cg-rail-bar {
        margin-top: 8px;
        height: 2px;
        background: var(--cg-hair);
        border-radius: 999px;
        overflow: hidden;
      }
      .cg-rail-bar-fill {
        height: 100%;
        background: var(--cg-ink);
        transition: width 0.15s linear;
      }
      .cg-rail-note {
        margin-top: 28px;
        padding: 14px;
        background: var(--cg-surface-2);
        border: 1px dashed var(--cg-hair-strong);
        border-radius: 10px;
        font-size: 12px;
        color: var(--cg-muted);
        line-height: 1.5;
      }

      /* Keyframes */
      @keyframes cgFadeIn {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes cgSlideIn {
        from {
          opacity: 0;
          transform: translateX(-8px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      @keyframes cgShimmer {
        0% {
          background-position: -200% 0;
        }
        100% {
          background-position: 200% 0;
        }
      }
      @keyframes haloPulse {
        0%, 100% { opacity: 0.6; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.06); }
      }
      @keyframes orbBreathe {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.04); }
      }
      @keyframes sheenSpin {
        to { transform: rotate(360deg); }
      }
      @keyframes cgPulse {
        0%,
        100% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.4);
          opacity: 0.4;
        }
      }
      @keyframes cgBlink {
        0%,
        49% {
          opacity: 1;
        }
        50%,
        100% {
          opacity: 0;
        }
      }
      @keyframes cgCheckPop {
        0% {
          transform: scale(0.4);
          opacity: 0;
        }
        60% {
          transform: scale(1.15);
          opacity: 1;
        }
        100% {
          transform: scale(1);
          opacity: 1;
        }
      }
    `}</style>
  )
}

// ─── Creating screen ──────────────────────────────────────────────────────────

export function CreatingScreen({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        fontFamily: "'Poppins', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: '#f4f4f4',
            border: '1.5px solid #e8e8e8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path
              d="M6 14l6 6 10-12"
              stroke="#0a0a0a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p
          style={{
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '-0.025em',
            margin: 0,
            color: '#0a0a0a',
          }}
        >
          Creating your course
        </p>
        <p
          style={{
            marginTop: 8,
            fontSize: 14,
            color: '#a0a0a0',
          }}
        >
          Setting everything up…
        </p>
      </div>
    </div>
  )
}
