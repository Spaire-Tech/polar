import { useState } from 'react'
import { Icon } from '../Icon'
import { KV, Section, Toggle } from '../shared'

type Step = 'details' | 'content' | 'audience' | 'preview' | 'review'

const sections: { id: Step; label: string; icon: string }[] = [
  { id: 'details', label: 'Details', icon: 'mail' },
  { id: 'content', label: 'Content', icon: 'edit' },
  { id: 'audience', label: 'Audience', icon: 'users' },
  { id: 'preview', label: 'Preview', icon: 'eye' },
  { id: 'review', label: 'Review & send', icon: 'send' },
]

export const NewBroadcastScreen = ({ onBack }: { onBack: () => void }) => {
  const [step, setStep] = useState<Step>('details')
  const [subject, setSubject] = useState('Brand Foundations — Module 5 is live')
  const [preview, setPreview] = useState(
    'A new lesson on systems, plus three reader notes.',
  )
  const [previewDevice, setPreviewDevice] = useState<
    'desktop' | 'mobile' | 'inbox'
  >('desktop')
  const [abEnabled, setAbEnabled] = useState(true)
  const [scheduleType, setScheduleType] = useState<
    'now' | 'optimal' | 'custom'
  >('optimal')

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
            <div className="eyebrow">New broadcast · Draft</div>
            <h1 className="h1" style={{ marginTop: 6 }}>
              {subject || 'Untitled broadcast'}
            </h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost">
            <Icon name="eye" size={15} />
            Preview
          </button>
          <button className="btn btn-secondary">Save draft</button>
          <button className="btn btn-primary">
            <Icon name="send" size={15} />
            Schedule send
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr',
          gap: 40,
        }}
      >
        <div style={{ position: 'sticky', top: 32, alignSelf: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {sections.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 14px',
                  borderRadius: 10,
                  background:
                    step === s.id ? 'var(--bg-softer)' : 'transparent',
                  color: step === s.id ? 'var(--ink)' : 'var(--ink-3)',
                  fontSize: 13.5,
                  fontWeight: step === s.id ? 500 : 400,
                  textAlign: 'left',
                  transition: 'all 0.12s',
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background:
                      step === s.id ? 'var(--ink)' : 'var(--bg-softer)',
                    color: step === s.id ? '#fff' : 'var(--ink-3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    border: step !== s.id ? '1px solid var(--line)' : 'none',
                  }}
                >
                  {i + 1}
                </div>
                {s.label}
              </button>
            ))}
          </div>
          <div
            style={{
              marginTop: 24,
              padding: '16px 14px',
              background: 'var(--bg-soft)',
              borderRadius: 12,
              border: '1px solid var(--line)',
            }}
          >
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 500,
                color: 'var(--ink-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8,
              }}
            >
              Pre-send checklist
            </div>
            <Checklist
              items={[
                { label: 'Subject line', done: subject.length > 5 },
                { label: 'Preview text', done: preview.length > 5 },
                { label: 'Audience selected', done: true },
                { label: 'Content blocks', done: true },
                { label: 'A/B test set up', done: abEnabled },
                { label: 'Schedule confirmed', done: false },
              ]}
            />
          </div>
        </div>

        <div>
          {step === 'details' && (
            <DetailsSection
              subject={subject}
              setSubject={setSubject}
              preview={preview}
              setPreview={setPreview}
              abEnabled={abEnabled}
              setAbEnabled={setAbEnabled}
            />
          )}
          {step === 'content' && <ContentSection />}
          {step === 'audience' && <AudienceSection />}
          {step === 'preview' && (
            <PreviewSection
              device={previewDevice}
              setDevice={setPreviewDevice}
              subject={subject}
              preview={preview}
            />
          )}
          {step === 'review' && (
            <ReviewSection
              scheduleType={scheduleType}
              setScheduleType={setScheduleType}
            />
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 40,
              paddingTop: 24,
              borderTop: '1px solid var(--line)',
            }}
          >
            <button
              className="btn btn-ghost"
              onClick={() => {
                const i = sections.findIndex((s) => s.id === step)
                if (i > 0) setStep(sections[i - 1].id)
              }}
              disabled={step === 'details'}
              style={{ opacity: step === 'details' ? 0.4 : 1 }}
            >
              <Icon name="arrow-left" size={15} />
              Back
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                const i = sections.findIndex((s) => s.id === step)
                if (i < sections.length - 1) setStep(sections[i + 1].id)
              }}
            >
              Continue
              <Icon name="arrow-right" size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const Checklist = ({
  items,
}: {
  items: { label: string; done: boolean }[]
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {items.map((item, i) => (
      <div
        key={i}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 12.5,
          color: item.done ? 'var(--ink-2)' : 'var(--ink-3)',
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: item.done ? 'var(--ink)' : 'transparent',
            border: item.done ? 'none' : '1.5px solid var(--line-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          {item.done && <Icon name="check" size={10} strokeWidth={2.5} />}
        </div>
        {item.label}
      </div>
    ))}
  </div>
)

const DetailsSection = ({
  subject,
  setSubject,
  preview,
  setPreview,
  abEnabled,
  setAbEnabled,
}: {
  subject: string
  setSubject: (v: string) => void
  preview: string
  setPreview: (v: string) => void
  abEnabled: boolean
  setAbEnabled: (v: boolean) => void
}) => (
  <>
    <Section
      title="The basics"
      sub="Subject and preview text are the first — sometimes only — thing your readers see."
    >
      <div className="card" style={{ padding: 28 }}>
        <div style={{ marginBottom: 24 }}>
          <label className="label">Subject line</label>
          <input
            className="input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{ fontSize: 15 }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 8,
              fontSize: 11.5,
              color: 'var(--ink-4)',
            }}
          >
            <span>
              {subject.length} / 60 characters · iPhone Mail truncates ~40
            </span>
            <button
              style={{
                color: 'var(--ink-2)',
                fontSize: 11.5,
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Icon name="sparkles" size={12} />
              Suggest with AI
            </button>
          </div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <label className="label">Preview text</label>
          <input
            className="input"
            value={preview}
            onChange={(e) => setPreview(e.target.value)}
            placeholder="A short hint at what's inside…"
          />
          <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-4)' }}>
            Shows after subject in the inbox preview · {preview.length} / 90
            characters
          </div>
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
        >
          <div>
            <label className="label">Sender name</label>
            <input className="input" defaultValue="Robin Kaye" />
          </div>
          <div>
            <label className="label">Reply-to email</label>
            <input className="input" defaultValue="robin@spaire.co" />
          </div>
        </div>
      </div>
    </Section>

    <Section
      title="A/B test the subject line"
      sub="Send two subjects to a small slice of your list. We'll send the winner to the rest."
    >
      <div className="card" style={{ padding: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: abEnabled ? 24 : 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="flask" size={18} style={{ color: 'var(--ink-2)' }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                Run an A/B test
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                Test subject lines on 20% of recipients first
              </div>
            </div>
          </div>
          <Toggle on={abEnabled} onChange={setAbEnabled} />
        </div>
        {abEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'var(--bg-softer)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--ink-2)',
                }}
              >
                A
              </span>
              <input className="input" defaultValue={subject} />
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'var(--bg-softer)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--ink-2)',
                }}
              >
                B
              </span>
              <input
                className="input"
                defaultValue="A new lesson on systems is live"
              />
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 12,
                marginTop: 8,
                padding: 16,
                background: 'var(--bg-soft)',
                borderRadius: 10,
              }}
            >
              <KV k="Test slice" v="20% of audience" />
              <KV k="Decide after" v="4 hours" />
              <KV k="Winner by" v="Open rate" />
            </div>
          </div>
        )}
      </div>
    </Section>
  </>
)

const ContentSection = () => {
  const blocks = [
    { type: 'heading', label: 'Heading' },
    { type: 'text', label: 'Paragraph' },
    { type: 'image', label: 'Image' },
    { type: 'button', label: 'Button' },
    { type: 'divider', label: 'Divider' },
    { type: 'video', label: 'Video' },
  ]
  return (
    <Section
      title="Compose"
      sub="Drag blocks into the canvas. We'll auto-format for inboxes that hate fancy markup."
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '200px 1fr',
          gap: 24,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--ink-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 12,
            }}
          >
            Blocks
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
            }}
          >
            {blocks.map((b) => (
              <div
                key={b.type}
                className="card"
                style={{
                  padding: '14px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'grab',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = 'var(--ink-3)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = 'var(--line)')
                }
              >
                <Icon
                  name={b.type === 'button' ? 'button-icon' : b.type}
                  size={16}
                  style={{ color: 'var(--ink-2)' }}
                />
                <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
                  {b.label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-soft)',
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              620px · branded template
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost btn-sm">Theme</button>
              <button className="btn btn-ghost btn-sm">Code</button>
            </div>
          </div>
          <div style={{ padding: 40, background: 'var(--bg-soft)' }}>
            <div
              style={{
                background: '#fff',
                maxWidth: 540,
                margin: '0 auto',
                padding: 36,
                borderRadius: 12,
                border: '1px solid var(--line)',
              }}
            >
              <Block type="heading" preview="Module 5 — Designing systems" />
              <Block
                type="text"
                preview="Hi friends — this week's lesson is the longest yet, and I think the most useful. We'll look at how design systems actually save time once they grow past the first couple of components."
              />
              <Block type="image" />
              <Block type="text" preview="Three things we cover inside…" />
              <Block type="button" preview="Watch the lesson" />
              <Block type="divider" />
              <Block
                type="text"
                preview="As always — reply if you've got questions. — Robin"
              />
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}

const Block = ({ type, preview }: { type: string; preview?: string }) => {
  const [hover, setHover] = useState(false)
  const wrap: React.CSSProperties = {
    padding: '8px 0',
    position: 'relative',
    borderRadius: 6,
    transition: 'background 0.12s',
    background: hover ? 'rgba(0,0,0,0.02)' : 'transparent',
  }
  return (
    <div
      style={wrap}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {type === 'heading' && (
        <h3
          style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            margin: 0,
            color: 'var(--ink)',
          }}
        >
          {preview}
        </h3>
      )}
      {type === 'text' && (
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            color: 'var(--ink-2)',
            margin: 0,
          }}
        >
          {preview}
        </p>
      )}
      {type === 'image' && (
        <div
          className="placeholder-img"
          style={{ height: 180, margin: '12px 0' }}
        >
          module 5 hero · 1200×600
        </div>
      )}
      {type === 'button' && (
        <a
          style={{
            display: 'inline-block',
            background: 'var(--ink)',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            textDecoration: 'none',
            margin: '8px 0',
          }}
        >
          {preview}
        </a>
      )}
      {type === 'divider' && (
        <hr
          style={{
            border: 'none',
            borderTop: '1px solid var(--line)',
            margin: '20px 0',
          }}
        />
      )}
      {hover && (
        <div
          style={{
            position: 'absolute',
            right: -10,
            top: '50%',
            transform: 'translateY(-50%) translateX(100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <button
            className="btn-icon"
            style={{ width: 28, height: 28, borderRadius: 7 }}
          >
            <Icon name="drag" size={13} />
          </button>
          <button
            className="btn-icon"
            style={{ width: 28, height: 28, borderRadius: 7 }}
          >
            <Icon name="copy" size={13} />
          </button>
          <button
            className="btn-icon"
            style={{ width: 28, height: 28, borderRadius: 7 }}
          >
            <Icon name="trash" size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

const AudienceSection = () => {
  const [mode, setMode] = useState<'all' | 'segment' | 'tag' | 'csv'>('segment')
  return (
    <Section
      title="Who gets this?"
      sub="Send to your whole list, or build a segment with filters."
    >
      <div className="card" style={{ padding: 8, marginBottom: 16 }}>
        <div className="tabs" style={{ width: '100%' }}>
          {(
            [
              { id: 'all', label: 'All active subscribers', count: '4,142' },
              { id: 'segment', label: 'Custom segment', count: '1,284' },
              { id: 'tag', label: 'By tag', count: '—' },
              { id: 'csv', label: 'Upload list', count: '—' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              className={`tab ${mode === m.id ? 'tab-active' : ''}`}
              onClick={() => setMode(m.id)}
              style={{ flex: 1 }}
            >
              {m.label}{' '}
              <span style={{ color: 'var(--ink-4)', marginLeft: 6 }}>
                {m.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {mode === 'segment' && (
        <div className="card" style={{ padding: 28 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--ink-2)',
              marginBottom: 16,
            }}
          >
            Subscribers who match all of:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <FilterRow
              field="Source"
              op="is"
              value="Course: Brand Foundations"
            />
            <FilterRow field="Subscribed" op="in the last" value="30 days" />
            <FilterRow field="Last opened" op="within" value="14 days" />
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 14, color: 'var(--ink-2)' }}
          >
            <Icon name="plus" size={13} />
            Add filter
          </button>
          <div
            style={{
              marginTop: 24,
              padding: 18,
              background: 'var(--bg-soft)',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}
              >
                Estimated audience
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                }}
              >
                1,284 subscribers
              </div>
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--ink-3)',
                textAlign: 'right',
              }}
            >
              ≈ 30% of your list
              <br />
              updates live as your list grows
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: 16,
          padding: 16,
          border: '1px dashed var(--line-2)',
          borderRadius: 12,
          fontSize: 12.5,
          color: 'var(--ink-3)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Icon name="users" size={15} />
        Exclude subscribers active in another sequence in the last 24 hours ·{' '}
        <button
          style={{
            color: 'var(--ink)',
            fontWeight: 500,
            marginLeft: 'auto',
          }}
        >
          Configure
        </button>
      </div>
    </Section>
  )
}

const FilterRow = ({
  field,
  op,
  value,
}: {
  field: string
  op: string
  value: string
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <select className="select" style={{ width: 160 }} defaultValue={field}>
      <option>{field}</option>
    </select>
    <select className="select" style={{ width: 130 }} defaultValue={op}>
      <option>{op}</option>
    </select>
    <input className="input" defaultValue={value} style={{ flex: 1 }} />
    <button className="btn-ghost" style={{ padding: 8, borderRadius: 8 }}>
      <Icon name="trash" size={15} />
    </button>
  </div>
)

const PreviewSection = ({
  device,
  setDevice,
  subject,
  preview,
}: {
  device: 'desktop' | 'mobile' | 'inbox'
  setDevice: (d: 'desktop' | 'mobile' | 'inbox') => void
  subject: string
  preview: string
}) => (
  <Section
    title="Preview"
    sub="See what this looks like in the inbox and across devices."
  >
    <div className="card" style={{ padding: 0 }}>
      <div
        style={{
          padding: 16,
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div className="tabs">
          <button
            className={`tab ${device === 'desktop' ? 'tab-active' : ''}`}
            onClick={() => setDevice('desktop')}
          >
            <Icon name="monitor" size={13} /> Desktop
          </button>
          <button
            className={`tab ${device === 'mobile' ? 'tab-active' : ''}`}
            onClick={() => setDevice('mobile')}
          >
            <Icon name="phone" size={13} /> Mobile
          </button>
          <button
            className={`tab ${device === 'inbox' ? 'tab-active' : ''}`}
            onClick={() => setDevice('inbox')}
          >
            <Icon name="mail" size={13} /> Inbox
          </button>
        </div>
        <button className="btn btn-secondary btn-sm">
          <Icon name="send" size={13} />
          Send test to me
        </button>
      </div>
      <div
        style={{
          padding: 40,
          background: 'var(--bg-soft)',
          display: 'flex',
          justifyContent: 'center',
          minHeight: 420,
        }}
      >
        {device === 'desktop' && <DesktopPreview subject={subject} />}
        {device === 'mobile' && <MobilePreview subject={subject} />}
        {device === 'inbox' && (
          <InboxPreview subject={subject} preview={preview} />
        )}
      </div>
    </div>
  </Section>
)

const DesktopPreview = ({ subject }: { subject: string }) => (
  <div
    style={{
      width: 600,
      background: '#fff',
      borderRadius: 10,
      border: '1px solid var(--line)',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        padding: '20px 32px',
        borderBottom: '1px solid var(--line)',
        fontSize: 13,
        color: 'var(--ink-3)',
      }}
    >
      From <strong style={{ color: 'var(--ink)' }}>Robin Kaye</strong>{' '}
      &lt;robin@spaire.co&gt;
    </div>
    <div style={{ padding: 32 }}>
      <h3
        style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          margin: '0 0 16px',
        }}
      >
        {subject}
      </h3>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.65,
          color: 'var(--ink-2)',
        }}
      >
        Hi friends — this week&apos;s lesson is the longest yet…
      </p>
      <div
        className="placeholder-img"
        style={{ height: 180, margin: '20px 0' }}
      >
        module 5 hero · 1200×600
      </div>
      <a
        style={{
          display: 'inline-block',
          background: 'var(--ink)',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          textDecoration: 'none',
        }}
      >
        Watch the lesson
      </a>
    </div>
  </div>
)

const MobilePreview = ({ subject }: { subject: string }) => (
  <div
    style={{
      width: 320,
      background: '#fff',
      borderRadius: 28,
      border: '8px solid #1d1d1f',
      overflow: 'hidden',
      boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
    }}
  >
    <div
      style={{
        padding: '20px 16px',
        borderBottom: '1px solid var(--line)',
        fontSize: 11,
        color: 'var(--ink-3)',
      }}
    >
      Robin Kaye
    </div>
    <div style={{ padding: 18 }}>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 600,
          margin: '0 0 12px',
          letterSpacing: '-0.01em',
        }}
      >
        {subject}
      </h3>
      <p
        style={{
          fontSize: 12.5,
          lineHeight: 1.6,
          color: 'var(--ink-2)',
        }}
      >
        Hi friends — this week&apos;s lesson is the longest yet…
      </p>
      <div
        className="placeholder-img"
        style={{ height: 100, margin: '12px 0', fontSize: 9 }}
      >
        module 5 hero
      </div>
      <a
        style={{
          display: 'inline-block',
          background: 'var(--ink)',
          color: '#fff',
          padding: '8px 14px',
          borderRadius: 7,
          fontSize: 11,
          fontWeight: 500,
        }}
      >
        Watch the lesson
      </a>
    </div>
  </div>
)

const InboxPreview = ({
  subject,
  preview,
}: {
  subject: string
  preview: string
}) => (
  <div
    style={{
      width: 560,
      background: '#fff',
      borderRadius: 10,
      border: '1px solid var(--line)',
      overflow: 'hidden',
    }}
  >
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        style={{
          padding: '14px 18px',
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          borderBottom: '1px solid var(--line)',
          opacity: i === 2 ? 1 : 0.45,
        }}
      >
        <div
          className="avatar"
          style={{ background: i === 2 ? '#1d1d1f' : '#86868b' }}
        >
          {i === 2 ? 'RK' : 'XX'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 2,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: i === 2 ? 600 : 500 }}>
              {i === 2 ? 'Robin Kaye' : 'Other sender'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              {i === 2 ? '8:01 AM' : 'Yesterday'}
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: i === 2 ? 500 : 400,
              marginBottom: 2,
            }}
          >
            {i === 2 ? subject : '—'}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--ink-3)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {i === 2 ? preview : '—'}
          </div>
        </div>
      </div>
    ))}
  </div>
)

const ReviewSection = ({
  scheduleType,
  setScheduleType,
}: {
  scheduleType: 'now' | 'optimal' | 'custom'
  setScheduleType: (s: 'now' | 'optimal' | 'custom') => void
}) => (
  <Section
    title="Review & send"
    sub="Last look. Ship it now, schedule it, or pick the time most likely to be opened."
  >
    <div className="card" style={{ padding: 28, marginBottom: 16 }}>
      <h3 className="h3" style={{ marginBottom: 18 }}>
        Schedule
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
        }}
      >
        <ScheduleOption
          id="now"
          current={scheduleType}
          onClick={setScheduleType}
          icon="send"
          title="Send now"
          sub="Immediately"
        />
        <ScheduleOption
          id="optimal"
          current={scheduleType}
          onClick={setScheduleType}
          icon="sparkles"
          title="Optimal time"
          sub="Tue, May 6 · 8:42 AM"
        />
        <ScheduleOption
          id="custom"
          current={scheduleType}
          onClick={setScheduleType}
          icon="calendar"
          title="Pick a time"
          sub="Choose date & time"
        />
      </div>
    </div>
    <div className="card" style={{ padding: 28 }}>
      <h3 className="h3" style={{ marginBottom: 18 }}>
        Summary
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <KV k="From" v="Robin Kaye <robin@spaire.co>" />
        <KV k="Audience" v="1,284 subscribers" />
        <KV k="Subject" v="Brand Foundations — Module 5 is live" />
        <KV k="A/B test" v="20% test slice · winner by opens" />
        <KV k="Delivery" v="Tue, May 6 · 8:42 AM (optimal)" />
        <KV k="Estimated cost" v="Included in plan" />
      </div>
    </div>
  </Section>
)

const ScheduleOption = ({
  id,
  current,
  onClick,
  icon,
  title,
  sub,
}: {
  id: 'now' | 'optimal' | 'custom'
  current: 'now' | 'optimal' | 'custom'
  onClick: (id: 'now' | 'optimal' | 'custom') => void
  icon: string
  title: string
  sub: string
}) => {
  const active = current === id
  return (
    <button
      onClick={() => onClick(id)}
      className="card"
      style={{
        padding: 18,
        textAlign: 'left',
        borderColor: active ? 'var(--ink)' : 'var(--line)',
        borderWidth: active ? 2 : 1,
        background: active ? 'var(--bg-soft)' : '#fff',
        transition: 'all 0.15s',
      }}
    >
      <Icon
        name={icon}
        size={18}
        style={{ color: 'var(--ink-2)', marginBottom: 12 }}
      />
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
        {title}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>
        {sub}
      </div>
    </button>
  )
}
