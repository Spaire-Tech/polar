import { ReactNode, useState } from 'react'
import { Icon } from '../Icon'
import { Toggle } from '../shared'

const triggers = [
  {
    id: 'subscribe',
    label: 'On subscribe',
    desc: 'When someone joins your list',
    icon: 'user',
  },
  {
    id: 'purchase',
    label: 'On purchase',
    desc: 'When someone buys a product',
    icon: 'shopping-cart',
  },
  {
    id: 'sub-created',
    label: 'Subscription started',
    desc: 'When a subscription begins',
    icon: 'rotate',
  },
  {
    id: 'sub-cancel',
    label: 'Subscription cancelled',
    desc: 'When a subscription ends',
    icon: 'x-circle',
  },
  {
    id: 'tag',
    label: 'Tag added',
    desc: 'When a tag is added',
    icon: 'tag',
  },
  {
    id: 'manual',
    label: 'Manual',
    desc: 'Enroll via API or dashboard',
    icon: 'mouse-pointer',
  },
]

export const NewSequenceScreen = ({ onBack }: { onBack: () => void }) => {
  const [name, setName] = useState('Course welcome series')
  const [trigger, setTrigger] = useState('purchase')
  const [selectedStep, setSelectedStep] = useState<number | null>(1)
  const [skipIfInAnother, setSkipIfInAnother] = useState(true)
  const [pauseOnUnsub, setPauseOnUnsub] = useState(true)

  const triggerObj = triggers.find((t) => t.id === trigger) ?? triggers[0]

  return (
    <div className="fade-up" style={{ paddingBottom: 80 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 36,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            type="button"
            className="btn-icon"
            onClick={onBack}
            aria-label="Back"
          >
            <Icon name="arrow-left" size={16} />
          </button>
          <div>
            <div className="eyebrow">New sequence · Draft</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                fontSize: 36,
                fontWeight: 400,
                letterSpacing: '-0.02em',
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
          <button type="button" className="btn btn-secondary">
            Save draft
          </button>
          <button type="button" className="btn btn-primary">
            <Icon name="play" size={13} />
            Activate
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
          gap: 32,
        }}
      >
        <div>
          <div className="card" style={{ padding: 28, marginBottom: 24 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 22,
              }}
            >
              <div>
                <div className="eyebrow">Step 0 · Trigger</div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 400,
                    marginTop: 8,
                    color: 'var(--ink)',
                  }}
                >
                  When this happens…
                </div>
              </div>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'var(--indigo-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon
                  name="zap"
                  size={16}
                  style={{ color: 'var(--indigo-2)' }}
                />
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
              }}
            >
              {triggers.map((t) => {
                const active = trigger === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTrigger(t.id)}
                    className="card"
                    style={{
                      padding: '16px 14px',
                      textAlign: 'left',
                      borderColor: active ? 'var(--ink)' : 'var(--line)',
                      borderWidth: active ? 2 : 1,
                      background: active ? 'var(--ink)' : '#fff',
                      boxShadow: active
                        ? '0 6px 18px -10px rgba(0,0,0,0.25)'
                        : 'none',
                      transition: 'all 0.15s',
                      margin: active ? 0 : 1,
                    }}
                  >
                    <Icon
                      name={t.icon}
                      size={14}
                      style={{
                        color: active ? '#fff' : 'var(--ink-3)',
                        marginBottom: 10,
                      }}
                    />
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 400,
                        color: active ? '#fff' : 'var(--ink)',
                      }}
                    >
                      {t.label}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: active
                          ? 'rgba(255,255,255,0.7)'
                          : 'var(--ink-3)',
                        marginTop: 3,
                        lineHeight: 1.45,
                      }}
                    >
                      {t.desc}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: '36px 32px 28px',
              position: 'relative',
              background: '#fff',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 28,
              }}
            >
              <div className="eyebrow">Sequence flow</div>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                5 emails · 14 days
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0,
              }}
            >
              <TriggerNode
                label={triggerObj.label}
                desc={triggerObj.desc}
                icon={triggerObj.icon}
              />
              <Connector />

              <EmailNode
                num="01"
                title="Welcome — you're in"
                preview="A warm welcome and what to expect from the course over the coming weeks."
                delay="Immediately"
                selected={selectedStep === 1}
                onClick={() => setSelectedStep(1)}
              />
              <WaitConnector delay="1 day" />

              <EmailNode
                num="02"
                title="Your first lesson"
                preview="A pointer to module 1, plus what to focus on first."
                delay="Day 2"
                selected={selectedStep === 2}
                onClick={() => setSelectedStep(2)}
              />
              <WaitConnector delay="3 days" />

              <BranchNode question="Did they open the previous email?" />

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 24,
                  width: '100%',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '25%',
                    right: '25%',
                    height: 24,
                    borderLeft: '2px solid var(--indigo-line)',
                    borderRight: '2px solid var(--indigo-line)',
                    borderBottom: '2px solid var(--indigo-line)',
                    borderRadius: '0 0 12px 12px',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: -16,
                    left: '50%',
                    width: 2,
                    height: 18,
                    background: 'var(--indigo-line)',
                    transform: 'translateX(-50%)',
                  }}
                />

                <BranchPath label="Yes" tone="success">
                  <ConnectorShort />
                  <EmailNode
                    num="03a"
                    title="A favourite from the community"
                    preview="Social proof — student work and one piece of advice."
                    delay="Day 6"
                    selected={selectedStep === 3}
                    onClick={() => setSelectedStep(3)}
                    compact
                  />
                  <WaitConnector delay="3 days" compact />
                  <EmailNode
                    num="04a"
                    title="Module 2 unlocks today"
                    preview="What's new in module 2 and a tiny exercise."
                    delay="Day 9"
                    selected={selectedStep === 4}
                    onClick={() => setSelectedStep(4)}
                    compact
                  />
                </BranchPath>

                <BranchPath label="No" tone="muted">
                  <ConnectorShort />
                  <EmailNode
                    num="03b"
                    title="How's it going?"
                    preview="A check-in and a small win they can grab today."
                    delay="Day 6"
                    selected={selectedStep === 5}
                    onClick={() => setSelectedStep(5)}
                    compact
                  />
                  <WaitConnector delay="5 days" compact />
                  <EmailNode
                    num="04b"
                    title="One last nudge"
                    preview="A nudge with the most-loved excerpt from the course."
                    delay="Day 11"
                    selected={selectedStep === 6}
                    onClick={() => setSelectedStep(6)}
                    compact
                  />
                </BranchPath>
              </div>

              <Connector long />

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  paddingTop: 4,
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'var(--ink)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px -4px rgba(0,0,0,0.15)',
                  }}
                >
                  <Icon name="check" size={20} strokeWidth={2} />
                </div>
                <div style={{ textAlign: 'center', marginTop: 6 }}>
                  <div style={{ fontSize: 16, color: 'var(--ink)' }}>
                    End of sequence
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: 'var(--ink-3)',
                      marginTop: 4,
                    }}
                  >
                    Subscriber exits and can be enrolled in others.
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 8,
                marginTop: 32,
                paddingTop: 24,
                borderTop: '1px solid var(--line)',
              }}
            >
              <button type="button" className="btn btn-secondary btn-sm">
                <Icon name="plus" size={12} />
                Add email
              </button>
              <button type="button" className="btn btn-secondary btn-sm">
                <Icon name="clock" size={12} />
                Add wait
              </button>
              <button type="button" className="btn btn-secondary btn-sm">
                <Icon name="split" size={12} />
                Add branch
              </button>
              <button type="button" className="btn btn-secondary btn-sm">
                <Icon name="tag" size={12} />
                Tag action
              </button>
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
          <div className="card" style={{ padding: 22 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>
              Settings
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                fontSize: 13.5,
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
                <span style={{ color: 'var(--ink)' }}>Module 1 started</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: 'var(--ink-2)' }}>Send window</span>
                <span style={{ color: 'var(--ink)' }}>Mon–Fri · 9–5</span>
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

          <div className="card" style={{ padding: 22 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>
              Estimated
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 6,
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  fontSize: 38,
                  fontWeight: 400,
                  letterSpacing: '-0.025em',
                }}
              >
                1,284
              </span>
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>/ mo</span>
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: 'var(--ink-3)',
                lineHeight: 1.6,
              }}
            >
              Based on the last 30 days of{' '}
              <span style={{ color: 'var(--ink-2)' }}>
                Course: Brand Foundations
              </span>{' '}
              purchases.
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: 22,
              background: 'var(--indigo-soft)',
              borderColor: 'var(--indigo-line)',
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'var(--indigo)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 10px -2px rgba(79,70,229,0.4)',
                }}
              >
                <Icon name="sparkles" size={14} />
              </div>
              <div>
                <div
                  style={{ fontSize: 14, color: 'var(--ink)', marginBottom: 6 }}
                >
                  Spaire suggests
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--ink-2)',
                    lineHeight: 1.55,
                  }}
                >
                  Add a check-in email at day 14 — students who get one are{' '}
                  <span style={{ color: 'var(--indigo-2)' }}>
                    3.2× more likely
                  </span>{' '}
                  to finish the course.
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 14 }}
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

const TriggerNode = ({
  label,
  desc,
  icon,
}: {
  label: string
  desc: string
  icon: string
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '14px 22px 14px 16px',
      background: 'var(--ink)',
      color: '#fff',
      borderRadius: 999,
      boxShadow: '0 4px 12px -4px rgba(0,0,0,0.2)',
      minWidth: 320,
    }}
  >
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon name={icon} size={15} />
    </div>
    <div style={{ flex: 1 }}>
      <div
        style={{
          fontSize: 11,
          opacity: 0.75,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
        }}
      >
        Trigger
      </div>
      <div style={{ fontSize: 15.5, marginTop: 1 }}>{label}</div>
    </div>
    <div
      style={{
        fontSize: 11.5,
        opacity: 0.85,
        maxWidth: 160,
        textAlign: 'right',
      }}
    >
      {desc}
    </div>
  </div>
)

const Connector = ({ long }: { long?: boolean }) => (
  <div
    style={{
      width: 2,
      height: long ? 36 : 24,
      background:
        'repeating-linear-gradient(180deg, var(--indigo-line) 0, var(--indigo-line) 4px, transparent 4px, transparent 8px)',
    }}
  />
)

const ConnectorShort = () => (
  <div
    style={{
      width: 2,
      height: 18,
      background:
        'repeating-linear-gradient(180deg, var(--indigo-line) 0, var(--indigo-line) 4px, transparent 4px, transparent 8px)',
    }}
  />
)

const WaitConnector = ({
  delay,
  compact,
}: {
  delay: string
  compact?: boolean
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0,
      padding: 0,
    }}
  >
    <div
      style={{
        width: 2,
        height: compact ? 12 : 18,
        background:
          'repeating-linear-gradient(180deg, var(--indigo-line) 0, var(--indigo-line) 4px, transparent 4px, transparent 8px)',
      }}
    />
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        background: '#fff',
        border: '1px solid var(--indigo-line)',
        color: 'var(--indigo-2)',
        borderRadius: 999,
        fontSize: 11.5,
        boxShadow: '0 2px 6px rgba(79,70,229,0.08)',
      }}
    >
      <Icon name="clock" size={11} />
      Wait {delay}
    </div>
    <div
      style={{
        width: 2,
        height: compact ? 12 : 18,
        background:
          'repeating-linear-gradient(180deg, var(--indigo-line) 0, var(--indigo-line) 4px, transparent 4px, transparent 8px)',
      }}
    />
  </div>
)

const BranchNode = ({ question }: { question: string }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '14px 20px',
      background: '#fff',
      border: '2px solid var(--indigo-line)',
      borderRadius: 14,
      color: 'var(--ink)',
      boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      marginBottom: 18,
    }}
  >
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        background: 'var(--indigo-soft)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon name="split" size={14} style={{ color: 'var(--indigo-2)' }} />
    </div>
    <div>
      <div className="eyebrow" style={{ fontSize: 10 }}>
        Branch
      </div>
      <div style={{ fontSize: 15, marginTop: 2 }}>{question}</div>
    </div>
  </div>
)

const TONES = {
  success: {
    bg: 'var(--green-soft)',
    color: 'var(--green)',
    border: 'rgba(16,122,62,0.25)',
  },
  muted: {
    bg: 'var(--bg-softer)',
    color: 'var(--ink-3)',
    border: 'var(--line-2)',
  },
} as const

const BranchPath = ({
  label,
  tone,
  children,
}: {
  label: string
  tone: keyof typeof TONES
  children: ReactNode
}) => {
  const t = TONES[tone]
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 28,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 400,
          background: t.bg,
          color: t.color,
          border: `1px solid ${t.border}`,
          marginBottom: -2,
        }}
      >
        {label === 'Yes' ? (
          <Icon name="check" size={10} />
        ) : (
          <Icon name="x-circle" size={10} />
        )}
        {label}
      </div>
      {children}
    </div>
  )
}

const EmailNode = ({
  num,
  title,
  preview,
  delay,
  selected,
  onClick,
  compact,
}: {
  num: string
  title: string
  preview: string
  delay: string
  selected: boolean
  onClick: () => void
  compact?: boolean
}) => {
  const [hover, setHover] = useState(false)
  const isHighlighted = selected || hover
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        maxWidth: compact ? '100%' : 540,
        background: '#fff',
        borderRadius: 14,
        border: `1px solid ${selected ? 'var(--ink)' : 'var(--line)'}`,
        boxShadow: selected
          ? '0 0 0 3px rgba(0,0,0,0.06), 0 8px 20px -14px rgba(0,0,0,0.18)'
          : hover
            ? '0 8px 22px -14px rgba(15,23,42,0.18)'
            : '0 1px 2px rgba(15,23,42,0.04)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        transform: isHighlighted ? 'translateY(-1px)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div
          style={{
            width: 56,
            background: selected ? 'var(--ink)' : 'var(--bg-softer)',
            color: selected ? '#fff' : 'var(--ink-3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            padding: compact ? '14px 0' : '18px 0',
            gap: 6,
            borderRight: selected ? 'none' : '1px solid var(--line)',
          }}
        >
          <Icon name="mail" size={16} />
          <div
            style={{
              fontSize: 10,
              fontFamily: 'JetBrains Mono, monospace',
              opacity: selected ? 0.9 : 0.7,
              letterSpacing: '0.05em',
            }}
          >
            {num}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            padding: compact ? '14px 16px' : '18px 22px',
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                fontSize: compact ? 14.5 : 16,
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: 'var(--ink)',
                lineHeight: 1.25,
              }}
            >
              {title}
            </div>
            <span
              style={{
                fontSize: 10.5,
                padding: '3px 8px',
                borderRadius: 999,
                background: 'var(--bg-softer)',
                color: 'var(--ink-3)',
                flexShrink: 0,
                letterSpacing: '0.02em',
              }}
            >
              {delay}
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--ink-3)',
              lineHeight: 1.55,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {preview}
          </div>
          {(selected || hover) && (
            <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11.5, padding: '4px 10px' }}
              >
                <Icon name="edit" size={11} />
                Edit
              </button>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11.5, padding: '4px 10px' }}
              >
                <Icon name="copy" size={11} />
                Duplicate
              </button>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
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
    </div>
  )
}
