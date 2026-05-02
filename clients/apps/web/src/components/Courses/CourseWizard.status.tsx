'use client'

import CloseIcon from '@mui/icons-material/Close'
import { useEffect, useRef, useState } from 'react'

function MinimalTopBar({ onClose }: { onClose: () => void }) {
  return (
    <div className="so-topbar">
      <div className="so-logo">Spaire</div>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="so-close"
      >
        <CloseIcon style={{ fontSize: 18 }} />
      </button>
    </div>
  )
}

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

  // Timer-driven stage advance — restarts whenever the phase changes.
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
      // Hold on the last stage — the wizard advances when generation
      // finishes; we don't want to "complete" the rail before that happens.
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
  // Cap at 95% — the final percent ticks over only when generation truly
  // finishes upstream. Users hate seeing 100% and then waiting.
  const overallProgress = Math.min(
    0.95,
    (passed + stageElapsed) / totalDuration,
  )

  return (
    <>
      <GeneratingHeader
        progress={overallProgress}
        flowCrumb={
          phase === 'landing' ? 'Generating landing page' : 'Generating outline'
        }
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
    </>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

function GeneratingHeader({
  progress,
  flowCrumb,
  onClose,
}: {
  progress: number
  flowCrumb: string
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

// ─── Orb ──────────────────────────────────────────────────────────────────────

function Orb() {
  return (
    <div className="cg-orb">
      <svg
        width="132"
        height="132"
        viewBox="0 0 132 132"
        className="cg-orb-rings"
      >
        <circle
          cx="66"
          cy="66"
          r="62"
          fill="none"
          stroke="var(--so-gray2)"
          strokeWidth="1"
        />
        <circle
          cx="66"
          cy="66"
          r="62"
          fill="none"
          stroke="var(--so-orange)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="60 320"
          className="cg-orb-spin"
        />
      </svg>
      <svg
        width="100"
        height="100"
        viewBox="0 0 100 100"
        className="cg-orb-dashed"
      >
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke="#c8c8c8"
          strokeWidth="1"
          strokeDasharray="2 4"
          opacity="0.6"
        />
      </svg>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`cg-orb-dot cg-orb-dot-${i}`} />
      ))}
      <div className="cg-orb-core">
        <img src="/spaire-logo-light.png" alt="" />
        <span className="cg-orb-pulse" />
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
      body = <LandingPreview />
      break
    case 'polish':
      body = <PolishPreview />
      break
  }
  return (
    <div className="cg-preview">
      <div className="cg-preview-sweep" />
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
  // Either show real counts (when known) or the placeholder labels.
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

function LessonsPreview({ progress }: { progress: number }) {
  const fullText =
    'Most courses fail at the first 90 seconds. Open with the smallest possible promise — what the student will be able to do by the end of this lesson — then prove you can deliver it in under three minutes.'
  const visibleCount = Math.floor(progress * fullText.length * 1.4)
  const visible = fullText.slice(0, Math.min(visibleCount, fullText.length))
  return (
    <div className="cg-stack">
      <div className="cg-lesson-meta">
        <span className="cg-preview-eyebrow">Lesson 03</span>
        <span className="cg-dot" />
        <span className="cg-lesson-title">The 90-second hook</span>
      </div>
      <div className="cg-typewriter">
        {visible}
        <span className="cg-caret" />
      </div>
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

function LandingPreview() {
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

// ─── Did you know ────────────────────────────────────────────────────────────

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

// ─── Side rail ───────────────────────────────────────────────────────────────

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
              className={`cg-rail-item${done ? 'done' : ''}${active ? 'active' : ''}`}
            >
              <div className="cg-rail-marker">
                {!isLast && (
                  <span
                    className="cg-rail-connector"
                    style={{
                      background: done ? 'var(--so-orange)' : 'var(--so-gray2)',
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
        we’ll email you when your draft is ready.
      </div>
    </aside>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function GeneratingStyles() {
  return (
    <style jsx global>{`
      .cg-header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        padding: 18px 32px;
        background: rgba(255, 255, 255, 0.92);
        backdrop-filter: blur(8px);
        border-bottom: 1px solid var(--so-gray2);
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
        font-family: var(--font-poppins), system-ui, sans-serif;
        min-width: 0;
      }
      .cg-crumb-sep {
        color: #c8c8c8;
      }
      .cg-crumb-muted {
        color: var(--so-gray3);
      }
      .cg-crumb-active {
        color: var(--so-gray4);
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cg-mark {
        display: inline-flex;
      }
      .cg-spaire-mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        background: var(--so-black);
        overflow: hidden;
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
        font-family: var(--font-poppins), system-ui, sans-serif;
      }
      .cg-pct {
        font-size: 12px;
        color: var(--so-gray3);
        font-variant-numeric: tabular-nums;
      }
      .cg-cancel {
        padding: 7px 14px;
        font-size: 12px;
        font-weight: 500;
        background: transparent;
        border: 1px solid var(--so-gray2);
        color: var(--so-gray4);
        border-radius: 7px;
        cursor: pointer;
        font-family: inherit;
      }
      .cg-cancel:hover {
        background: var(--so-gray1);
        color: var(--so-black);
      }
      .cg-progress-track {
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--so-gray2);
      }
      .cg-progress-fill {
        height: 100%;
        background: var(--so-orange);
        box-shadow: 0 0 8px var(--so-orange);
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
        font-family: var(--font-poppins), system-ui, sans-serif;
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
        color: var(--so-gray3);
        margin-bottom: 10px;
      }
      .cg-title {
        font-size: 32px;
        font-weight: 600;
        margin: 0;
        letter-spacing: -0.7px;
        color: var(--so-black);
        animation: cgFadeIn 0.5s ease both;
      }
      .cg-sub {
        font-size: 15px;
        color: var(--so-gray3);
        margin-top: 10px;
        line-height: 1.55;
        animation: cgFadeIn 0.6s 0.1s ease both;
      }

      /* Orb */
      .cg-orb {
        width: 132px;
        height: 132px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .cg-orb-rings,
      .cg-orb-dashed {
        position: absolute;
        inset: 0;
        margin: auto;
      }
      .cg-orb-spin {
        transform-origin: center;
        animation: cgRingspin 2.4s linear infinite;
      }
      .cg-orb-dot {
        position: absolute;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        animation: cgOrbit 3s linear infinite;
      }
      .cg-orb-dot-0 {
        background: var(--so-orange);
      }
      .cg-orb-dot-1 {
        background: var(--so-black);
        animation-duration: 3.6s;
        animation-delay: -1s;
      }
      .cg-orb-dot-2 {
        background: #c8c8c8;
        animation-duration: 4.2s;
        animation-delay: -2s;
      }
      .cg-orb-core {
        position: relative;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--so-black);
        box-shadow:
          0 0 32px rgba(255, 92, 0, 0.18),
          0 0 0 6px var(--so-white);
        animation: cgFloat 3s ease-in-out infinite;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .cg-orb-core img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .cg-orb-pulse {
        position: absolute;
        inset: -6px;
        border-radius: 50%;
        border: 1.5px solid var(--so-orange);
        opacity: 0.4;
        animation: cgPulse 2.2s ease-in-out infinite;
      }

      /* Preview card */
      .cg-preview {
        width: 100%;
        max-width: 560px;
        background: var(--so-white);
        border: 1px solid var(--so-gray2);
        border-radius: 14px;
        padding: 18px;
        min-height: 180px;
        position: relative;
        overflow: hidden;
        box-shadow: 0 1px 2px rgba(20, 20, 20, 0.04);
      }
      .cg-preview-sweep {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(
          90deg,
          transparent,
          rgba(255, 92, 0, 0.08),
          transparent
        );
        animation: cgLineSweep 2.8s ease-in-out infinite;
        opacity: 0.6;
      }
      .cg-preview-body {
        position: relative;
      }
      .cg-preview-eyebrow {
        font-size: 11px;
        font-weight: 600;
        color: var(--so-gray3);
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

      /* Thinking — tags */
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
        background: var(--so-gray1);
        border: 1px solid var(--so-gray2);
        border-radius: 8px;
        animation: cgFadeIn 0.5s ease both;
      }
      .cg-tag-key {
        color: var(--so-gray3);
        font-weight: 500;
      }
      .cg-tag-val {
        color: var(--so-black);
        font-weight: 500;
      }

      /* Outline */
      .cg-outline-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        background: var(--so-gray1);
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
        background: var(--so-white);
        border: 1px solid var(--so-gray2);
        font-size: 11px;
        font-weight: 600;
        color: var(--so-gray3);
        font-variant-numeric: tabular-nums;
      }
      .cg-outline-title {
        font-size: 13px;
        font-weight: 500;
        color: var(--so-black);
        flex: 1;
      }
      .cg-outline-count {
        font-size: 11px;
        color: var(--so-gray3);
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
        background: var(--so-gray3);
      }
      .cg-lesson-title {
        font-size: 12px;
        color: var(--so-gray4);
        font-weight: 500;
      }
      .cg-typewriter {
        font-size: 13.5px;
        color: var(--so-gray4);
        line-height: 1.6;
        min-height: 100px;
      }
      .cg-caret {
        display: inline-block;
        width: 7px;
        height: 15px;
        margin-left: 2px;
        background: var(--so-orange);
        vertical-align: middle;
        animation: cgBlink 1s steps(1) infinite;
      }

      /* Research */
      .cg-research-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        background: var(--so-gray1);
        border-radius: 9px;
        font-size: 13px;
        color: var(--so-gray4);
        animation: cgSlideIn 0.45s ease both;
      }
      .cg-bullet {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--so-orange);
      }

      /* Landing skeleton */
      .cg-landing-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .cg-landing-block {
        padding: 12px;
        background: var(--so-gray1);
        border-radius: 10px;
        border: 1px solid var(--so-gray2);
        animation: cgFadeIn 0.5s ease both;
      }
      .cg-shimmer {
        height: 6px;
        margin-top: 6px;
        border-radius: 3px;
        background: linear-gradient(
          90deg,
          var(--so-gray2),
          #ededed,
          var(--so-gray2)
        );
        background-size: 200% 100%;
        animation: cgShimmer 1.6s linear infinite;
      }

      /* Polish */
      .cg-polish-row {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 13px;
        color: var(--so-gray4);
        animation: cgSlideIn 0.4s ease both;
      }
      .cg-check {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--so-orange);
        color: var(--so-white);
        animation: cgCheckPop 0.35s ease both;
      }

      /* Tip */
      .cg-tip {
        max-width: 560px;
        width: 100%;
        padding: 16px 18px;
        background: var(--so-gray1);
        border: 1px solid var(--so-gray2);
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
        color: var(--so-orange);
        padding: 4px 8px;
        border-radius: 5px;
        background: rgba(255, 92, 0, 0.08);
      }
      .cg-tip-text {
        font-size: 13.5px;
        color: var(--so-gray4);
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
        color: var(--so-gray3);
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
        background: #ededed;
        border: 1px solid #c8c8c8;
        color: var(--so-gray3);
        font-size: 10px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .cg-rail-item.active .cg-rail-bubble {
        background: var(--so-white);
        border: 1.5px solid var(--so-orange);
        color: var(--so-orange);
      }
      .cg-rail-item.done .cg-rail-bubble {
        background: var(--so-orange);
        border: none;
        color: var(--so-white);
      }
      .cg-rail-pulse {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--so-orange);
        animation: cgPulse 1.5s ease-in-out infinite;
      }
      .cg-rail-body {
        flex: 1;
        min-width: 0;
      }
      .cg-rail-title {
        font-size: 13.5px;
        font-weight: 500;
        color: var(--so-gray3);
      }
      .cg-rail-item.active .cg-rail-title {
        font-weight: 600;
        color: var(--so-black);
      }
      .cg-rail-item.done .cg-rail-title {
        color: var(--so-gray4);
      }
      .cg-rail-status {
        font-size: 12px;
        color: var(--so-gray3);
        margin-top: 2px;
        line-height: 1.45;
      }
      .cg-rail-bar {
        margin-top: 8px;
        height: 2px;
        background: var(--so-gray2);
        border-radius: 999px;
        overflow: hidden;
      }
      .cg-rail-bar-fill {
        height: 100%;
        background: var(--so-orange);
        transition: width 0.15s linear;
      }
      .cg-rail-note {
        margin-top: 28px;
        padding: 14px;
        background: var(--so-gray1);
        border: 1px dashed #c8c8c8;
        border-radius: 10px;
        font-size: 12px;
        color: var(--so-gray3);
        line-height: 1.5;
      }

      /* Animations */
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
      @keyframes cgRingspin {
        to {
          transform: rotate(360deg);
        }
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
      @keyframes cgFloat {
        0%,
        100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-3px);
        }
      }
      @keyframes cgOrbit {
        from {
          transform: rotate(0deg) translateX(46px) rotate(0deg);
        }
        to {
          transform: rotate(360deg) translateX(46px) rotate(-360deg);
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
      @keyframes cgLineSweep {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(100%);
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

// ─── Creating screen (unchanged behaviour, kept here for compactness) ─────────

export function CreatingScreen({ onClose }: { onClose: () => void }) {
  return (
    <>
      <MinimalTopBar onClose={onClose} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 24px',
          textAlign: 'center',
          background: '#fff',
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
            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
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
            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
          }}
        >
          Setting everything up…
        </p>
      </div>
    </>
  )
}
