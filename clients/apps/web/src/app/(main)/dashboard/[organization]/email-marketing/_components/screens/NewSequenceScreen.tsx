import { useState } from 'react'
import { Icon } from '../Icon'
import { Toggle } from '../shared'

type SequenceStepData =
  | { id: number; type: 'email'; title: string; preview: string; delay: string }
  | { id: number; type: 'wait'; delay: string }
  | { id: number; type: 'condition'; branch: string }

const initialSteps: SequenceStepData[] = [
  {
    id: 1,
    type: 'email',
    title: "Welcome — you're in",
    preview: 'A warm welcome and what to expect from the course.',
    delay: 'Immediately',
  },
  { id: 2, type: 'wait', delay: '1 day' },
  {
    id: 3,
    type: 'email',
    title: 'Your first lesson',
    preview: 'A pointer to module 1, plus what to focus on first.',
    delay: '1 day later',
  },
  { id: 4, type: 'wait', delay: '3 days' },
  { id: 5, type: 'condition', branch: 'Opened previous email?' },
  {
    id: 6,
    type: 'email',
    title: "How's it going?",
    preview: 'A check-in and a small win they can grab today.',
    delay: '4 days later',
  },
  { id: 7, type: 'wait', delay: '3 days' },
  {
    id: 8,
    type: 'email',
    title: 'A favourite from the community',
    preview: 'Social proof — student work and one piece of advice.',
    delay: '7 days later',
  },
]

const triggers = [
  {
    id: 'subscribe',
    label: 'On subscribe',
    desc: 'Triggered when someone joins your list',
    icon: 'user',
  },
  {
    id: 'purchase',
    label: 'On purchase',
    desc: 'Triggered when someone buys a product',
    icon: 'shopping-cart',
  },
  {
    id: 'sub-created',
    label: 'Subscription started',
    desc: 'Triggered when a subscription begins',
    icon: 'rotate',
  },
  {
    id: 'sub-cancel',
    label: 'Subscription cancelled',
    desc: 'Triggered when a subscription ends',
    icon: 'x-circle',
  },
  {
    id: 'tag',
    label: 'Tag added',
    desc: 'Triggered when a tag is added to a subscriber',
    icon: 'tag',
  },
  {
    id: 'manual',
    label: 'Manual',
    desc: 'Enroll subscribers via API or dashboard',
    icon: 'mouse-pointer',
  },
]

export const NewSequenceScreen = ({ onBack }: { onBack: () => void }) => {
  const [name, setName] = useState('Course welcome series')
  const [trigger, setTrigger] = useState('purchase')
  const [steps] = useState<SequenceStepData[]>(initialSteps)
  const [skipIfInAnother, setSkipIfInAnother] = useState(true)
  const [pauseOnUnsub, setPauseOnUnsub] = useState(true)

  return (
    <div className="fade-up" style={{ paddingBottom: 80 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 32,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn-icon" onClick={onBack}>
            <Icon name="arrow-left" size={16} />
          </button>
          <div>
            <div className="eyebrow">New sequence · Draft</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                fontSize: 32,
                fontWeight: 600,
                letterSpacing: '-0.03em',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                padding: '6px 0',
                width: 600,
                color: 'var(--ink)',
              }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary">Save draft</button>
          <button className="btn btn-primary">
            <Icon name="play" size={13} />
            Activate
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
          gap: 40,
        }}
      >
        <div>
          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 18,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--ink-3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 500,
                  }}
                >
                  Step 0 — Trigger
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    marginTop: 6,
                    color: 'var(--ink)',
                  }}
                >
                  When this happens…
                </div>
              </div>
              <Icon name="zap" size={18} style={{ color: 'var(--ink-3)' }} />
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 8,
              }}
            >
              {triggers.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTrigger(t.id)}
                  className="card"
                  style={{
                    padding: '14px 14px',
                    textAlign: 'left',
                    borderColor:
                      trigger === t.id ? 'var(--ink)' : 'var(--line)',
                    borderWidth: trigger === t.id ? 2 : 1,
                    background: trigger === t.id ? 'var(--bg-soft)' : '#fff',
                    transition: 'all 0.15s',
                    margin: trigger === t.id ? 0 : 1,
                  }}
                >
                  <Icon
                    name={t.icon}
                    size={14}
                    style={{ color: 'var(--ink-2)', marginBottom: 8 }}
                  />
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: 'var(--ink)',
                    }}
                  >
                    {t.label}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--ink-3)',
                      marginTop: 2,
                      lineHeight: 1.4,
                    }}
                  >
                    {t.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div
            className="card"
            style={{ padding: '32px 32px 24px', position: 'relative' }}
          >
            <div
              style={{
                fontSize: 11,
                color: 'var(--ink-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 500,
                marginBottom: 20,
              }}
            >
              Sequence flow
            </div>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 19,
                  top: 32,
                  bottom: 32,
                  width: 1,
                  background: 'var(--line)',
                }}
              />

              {steps.map((s) => (
                <SequenceStep key={s.id} step={s} />
              ))}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 16,
                  paddingLeft: 0,
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: 'var(--bg-soft)',
                    border: '1px dashed var(--line-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon
                    name="plus"
                    size={14}
                    style={{ color: 'var(--ink-3)' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm">Add email</button>
                  <button className="btn btn-ghost btn-sm">Add wait</button>
                  <button className="btn btn-ghost btn-sm">
                    Add condition
                  </button>
                  <button className="btn btn-ghost btn-sm">
                    Add tag action
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 24,
                  paddingTop: 20,
                  borderTop: '1px solid var(--line)',
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: 'var(--ink)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="check" size={14} />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--ink)',
                    }}
                  >
                    End of sequence
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--ink-3)',
                      marginTop: 2,
                    }}
                  >
                    Subscriber exits and can be enrolled in others.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            position: 'sticky',
            top: 32,
            alignSelf: 'flex-start',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div className="card" style={{ padding: 20 }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--ink-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 500,
                marginBottom: 12,
              }}
            >
              Settings
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                fontSize: 13,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: 'var(--ink-2)' }}>Goal event</span>
                <span style={{ color: 'var(--ink)', fontWeight: 500 }}>
                  Module 1 started
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: 'var(--ink-2)' }}>Send window</span>
                <span style={{ color: 'var(--ink)', fontWeight: 500 }}>
                  Mon–Fri · 9–5
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: 'var(--ink-2)' }}>
                  Skip if in another
                </span>
                <Toggle on={skipIfInAnother} onChange={setSkipIfInAnother} />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: 'var(--ink-2)' }}>
                  Pause on unsubscribe
                </span>
                <Toggle on={pauseOnUnsub} onChange={setPauseOnUnsub} />
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--ink-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 500,
                marginBottom: 12,
              }}
            >
              Estimated
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 4,
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 600,
                  letterSpacing: '-0.03em',
                }}
              >
                1,284
              </span>
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                subscribers will enter / mo
              </span>
            </div>
            <div
              style={{
                height: 1,
                background: 'var(--line)',
                margin: '14px 0',
              }}
            />
            <div
              style={{
                fontSize: 12,
                color: 'var(--ink-3)',
                lineHeight: 1.6,
              }}
            >
              Based on the last 30 days of{' '}
              <strong style={{ color: 'var(--ink-2)', fontWeight: 500 }}>
                Course: Brand Foundations
              </strong>{' '}
              purchases.
            </div>
          </div>

          <div
            className="card"
            style={{ padding: 20, background: 'var(--bg-soft)' }}
          >
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <Icon
                name="sparkles"
                size={16}
                style={{ color: 'var(--ink-2)', marginTop: 2 }}
              />
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--ink)',
                    marginBottom: 4,
                  }}
                >
                  Spaire suggests
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--ink-2)',
                    lineHeight: 1.55,
                  }}
                >
                  Add a check-in email at day 14 — students who get one are 3.2×
                  more likely to finish the course.
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 12 }}
                >
                  Insert step
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const SequenceStep = ({ step }: { step: SequenceStepData }) => {
  const [hover, setHover] = useState(false)
  if (step.type === 'wait') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 0',
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: '#fff',
            border: '1px solid var(--line-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="clock" size={14} style={{ color: 'var(--ink-3)' }} />
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
          Wait{' '}
          <span style={{ color: 'var(--ink)', fontWeight: 500 }}>
            {step.delay}
          </span>
        </div>
        {hover && (
          <button
            className="btn-ghost"
            style={{ marginLeft: 'auto', padding: 6, borderRadius: 6 }}
          >
            <Icon name="more" size={14} />
          </button>
        )}
      </div>
    )
  }
  if (step.type === 'condition') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 0',
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: '#fff',
            border: '1px solid var(--line-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="split" size={14} style={{ color: 'var(--ink-2)' }} />
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
          Branch —{' '}
          <span style={{ color: 'var(--ink)', fontWeight: 500 }}>
            {step.branch}
          </span>
        </div>
      </div>
    )
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '8px 0',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: 'var(--ink)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="mail" size={14} />
      </div>
      <div
        style={{
          flex: 1,
          padding: '8px 16px',
          background: 'var(--bg-soft)',
          borderRadius: 10,
          border: '1px solid var(--line)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 4,
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>
            {step.title}
          </div>
          <span className="chip" style={{ fontSize: 10.5 }}>
            {step.delay}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          {step.preview}
        </div>
        {hover && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11.5, padding: '4px 10px' }}
            >
              <Icon name="edit" size={11} />
              Edit
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11.5, padding: '4px 10px' }}
            >
              <Icon name="copy" size={11} />
              Duplicate
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{
                fontSize: 11.5,
                padding: '4px 10px',
                color: 'var(--red)',
              }}
            >
              <Icon name="trash" size={11} />
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
