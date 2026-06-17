'use client'

/**
 * Community Hub — Events tab (creator).
 *
 * Live moments: a form (cover, type, custom date/time pickers, meeting provider
 * + link, description) → published cards split Upcoming / Past → an enroll-style
 * detail sheet. Wired to the existing community_event endpoints. To use the
 * existing backend unchanged we map the design's 3 type labels onto the stored
 * enum and infer the meeting provider from the saved URL.
 */
import {
  type CommunityEventCreateBody,
  type CommunityEventRead,
  type CommunityEventType,
  useCreateCommunityEvent,
  useCommunityEvents,
  useUploadPostImage,
} from '@/hooks/queries/community'
import * as React from 'react'
import { CoverDrop, Field, Seg } from './atoms'
import { Glyph } from './icons'
import {
  browserTz,
  DatePicker,
  type ProviderKey,
  ProviderLogo,
  ProviderSelect,
  providerFromUrl,
  providerOf,
  providerPlaceholder,
  TimePicker,
  toStartAtISO,
} from './pickers'

const { useEffect, useState } = React

/* type label ↔ stored enum (uses the existing enum values) */
const FORM_TYPES = ['Workshop', 'Q&A', 'Watch Party'] as const
const TYPE_LABEL: Record<CommunityEventType, string> = {
  workshop: 'Workshop',
  office: 'Q&A',
  cohort: 'Watch Party',
  guest: 'Guest',
}
const labelToType = (l: string): CommunityEventType =>
  l === 'Q&A' ? 'office' : l === 'Watch Party' ? 'cohort' : 'workshop'

const DURATIONS = [30, 45, 60, 90]

/* ---------- date/time display in the event's own tz ---------- */
function eventWhen(ev: CommunityEventRead) {
  const d = new Date(ev.start_at)
  const tz = ev.timezone || undefined
  return {
    short: d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: tz,
    }),
    time: d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: tz,
    }),
    full: d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: tz,
    }),
  }
}

/* ---------- form ---------- */
type FormState = {
  title: string
  typeLabel: string
  date: string
  time: string
  dur: number
  provider: ProviderKey
  link: string
  desc: string
  cover: string
  coverPos: string
}
const emptyForm = (provider: ProviderKey): FormState => ({
  title: '',
  typeLabel: 'Workshop',
  date: '',
  time: '18:00',
  dur: 45,
  provider,
  link: '',
  desc: '',
  cover: '',
  coverPos: 'center 50%',
})

function EventForm({
  courseId,
  defaultProvider,
  onCancel,
  onCreated,
  showToast,
}: {
  courseId: string
  defaultProvider: ProviderKey
  onCancel: (() => void) | null
  onCreated: () => void
  showToast: (m: string) => void
}) {
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultProvider))
  const set = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }))
  const [busy, setBusy] = useState(false)
  const uploadImg = useUploadPostImage(null, courseId, 'creator')
  const create = useCreateCommunityEvent(null, courseId, 'creator')

  const can = form.title.trim() && form.date && !busy
  const onCover = async (file: File, dataUrl: string) => {
    set({ cover: dataUrl })
    try {
      const res = await uploadImg.mutateAsync(file)
      set({ cover: res.public_url })
    } catch {
      set({ cover: '' })
      showToast('Could not upload that image')
    }
  }

  const submit = async () => {
    if (!can) return
    setBusy(true)
    const body: CommunityEventCreateBody = {
      title: form.title.trim(),
      type: labelToType(form.typeLabel),
      description: form.desc.trim() || null,
      start_at: toStartAtISO(form.date, form.time),
      timezone: browserTz(),
      duration_minutes: form.dur,
      meeting_url: form.link.trim() || null,
      cover_url: form.cover || null,
      cover_object_position: form.cover ? form.coverPos : null,
    }
    try {
      await create.mutateAsync(body)
      showToast('Event scheduled')
      onCreated()
    } catch {
      showToast('Could not schedule that event')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card form-card">
      <div className="form-title">Schedule a live moment</div>
      <Field label="Cover image">
        <CoverDrop
          src={form.cover}
          onFile={onCover}
          pos={form.coverPos}
          onPos={(p) => set({ coverPos: p })}
        />
      </Field>
      <Field label="Type">
        <Seg
          value={form.typeLabel}
          options={[...FORM_TYPES]}
          onChange={(v) => set({ typeLabel: v })}
        />
      </Field>
      <Field label="Title">
        <input
          className="input"
          value={form.title}
          placeholder="e.g. Live Welcome Q&A"
          onChange={(e) => set({ title: e.target.value })}
        />
      </Field>
      <div className="field-row">
        <Field label="Date">
          <DatePicker value={form.date} onChange={(v) => set({ date: v })} />
        </Field>
        <Field label="Time">
          <TimePicker value={form.time} onChange={(v) => set({ time: v })} />
        </Field>
      </div>
      <Field label="Duration">
        <select
          className="input"
          value={form.dur}
          onChange={(e) => set({ dur: Number(e.target.value) })}
        >
          {DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d} min
            </option>
          ))}
        </select>
      </Field>
      <Field label="Meeting link">
        <div className="meet-row">
          <ProviderSelect
            value={form.provider}
            onChange={(v) => set({ provider: v })}
          />
          <input
            className="input"
            value={form.link}
            placeholder={providerPlaceholder(form.provider)}
            onChange={(e) => set({ link: e.target.value })}
          />
        </div>
      </Field>
      <Field label="Description">
        <textarea
          className="textarea"
          value={form.desc}
          placeholder="What happens in this session?"
          onChange={(e) => set({ desc: e.target.value })}
        />
      </Field>
      <div className="form-foot">
        <span className="sp" />
        {onCancel && (
          <button className="btn btn-quiet btn-sm" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          className="btn btn-primary"
          disabled={!can}
          style={!can ? { opacity: 0.4 } : undefined}
          onClick={submit}
        >
          {busy ? 'Scheduling…' : 'Schedule'}
        </button>
      </div>
    </div>
  )
}

/* ---------- card ---------- */
function EventCard({
  ev,
  onOpen,
  past,
}: {
  ev: CommunityEventRead
  onOpen: (ev: CommunityEventRead) => void
  past?: boolean
}) {
  const when = eventWhen(ev)
  const provider = providerFromUrl(ev.meeting_url)
  return (
    <button className={`ev-card${past ? ' is-past' : ''}`} onClick={() => onOpen(ev)}>
      <div
        className="ev-card-cover"
        style={{
          backgroundImage: ev.cover_url ? `url(${ev.cover_url})` : undefined,
          backgroundPosition: ev.cover_object_position || 'center',
        }}
      >
        <span className="ev-card-type">{TYPE_LABEL[ev.type]}</span>
        <span className="ev-card-prov">
          <ProviderLogo k={provider} size={26} />
        </span>
        {past && <span className="ev-card-past">Ended</span>}
      </div>
      <div className="ev-card-body">
        <div className="ev-card-when">
          <Glyph d="calendar" size={14} stroke={1.9} /> {when.short} · {when.time}
        </div>
        <div className="ev-card-title">{ev.title || 'Untitled event'}</div>
        <div className="ev-card-join">
          {past ? (
            <>
              View recap <Glyph d="chevR" size={15} stroke={2} />
            </>
          ) : (
            <>
              Join with {providerOf(provider).name}{' '}
              <Glyph d="chevR" size={15} stroke={2} />
            </>
          )}
        </div>
      </div>
    </button>
  )
}

/* ---------- detail sheet ---------- */
function EventSheet({
  ev,
  onClose,
  showToast,
}: {
  ev: CommunityEventRead
  onClose: () => void
  showToast: (m: string) => void
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', h)
      document.body.style.overflow = prev
    }
  }, [onClose])
  const provider = providerFromUrl(ev.meeting_url)
  const prov = providerOf(provider)
  const when = eventWhen(ev)
  const join = () => {
    if (ev.meeting_url) window.open(ev.meeting_url, '_blank')
    else showToast('No meeting link set')
  }
  return (
    <div className="ev-overlay" onClick={onClose}>
      <div className="ev-sheet" onClick={(e) => e.stopPropagation()}>
        <div
          className="ev-sheet-cover"
          style={{
            backgroundImage: ev.cover_url ? `url(${ev.cover_url})` : undefined,
            backgroundPosition: ev.cover_object_position || 'center',
          }}
        >
          <button className="ev-sheet-x" onClick={onClose} aria-label="Close">
            <Glyph d="close" size={18} stroke={2.2} />
          </button>
          <span className="ev-sheet-type">{TYPE_LABEL[ev.type]}</span>
        </div>
        <div className="ev-sheet-body">
          <div className="ev-sheet-when">
            <Glyph d="calendar" size={15} stroke={1.9} /> {when.full} · {when.time}
          </div>
          <h3 className="ev-sheet-title">{ev.title || 'Untitled event'}</h3>
          <div className="ev-sheet-prov">
            <ProviderLogo k={provider} size={22} /> Hosted on {prov.name} ·{' '}
            {ev.duration_minutes} min
          </div>
          {ev.description && <p className="ev-sheet-desc">{ev.description}</p>}
          <button className="ev-sheet-join" onClick={join}>
            <ProviderLogo k={provider} size={24} /> Join with {prov.name}
            <Glyph d="chevR" size={16} stroke={2.2} />
          </button>
          {ev.meeting_url && (
            <div className="ev-sheet-url">{ev.meeting_url}</div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- tab ---------- */
export function EventsTab({
  courseId,
  defaultProvider = 'zoom',
  showToast,
}: {
  courseId: string
  defaultProvider?: ProviderKey
  showToast: (m: string) => void
}) {
  const eventsQ = useCommunityEvents(null, courseId, 'creator')
  const events = eventsQ.data ?? []
  const [showForm, setShowForm] = useState(false)
  const [openEv, setOpenEv] = useState<CommunityEventRead | null>(null)

  const upcoming = events
    .filter((e) => !e.past)
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
  const past = events
    .filter((e) => e.past)
    .sort((a, b) => b.start_at.localeCompare(a.start_at))

  return (
    <>
      <div className="cr-head">
        <div>
          <div className="h">Events</div>
          <div className="s">
            Live moments that bring the room together — a workshop, a Q&amp;A, or
            a watch party. Schedule one and it publishes a card members can join
            in a tap.
          </div>
        </div>
        {!showForm && events.length > 0 && (
          <button
            className="ev-add-btn"
            onClick={() => setShowForm(true)}
            aria-label="New event"
          >
            <Glyph d="plus" size={20} stroke={2.2} />
          </button>
        )}
      </div>

      {showForm ? (
        <EventForm
          courseId={courseId}
          defaultProvider={defaultProvider}
          onCancel={events.length > 0 ? () => setShowForm(false) : null}
          onCreated={() => setShowForm(false)}
          showToast={showToast}
        />
      ) : events.length === 0 ? (
        <div className="card ev-empty">
          <span className="ev-empty-ic">
            <Glyph d="calendar" size={26} stroke={1.7} />
          </span>
          <h3>No live moments yet</h3>
          <p>
            Schedule a workshop, Q&amp;A, or watch party. It publishes a card
            members can join with one tap when it goes live.
          </p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            Schedule an event
          </button>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <div className="ev-sec-label">Upcoming · {upcoming.length}</div>
              <div className="ev-grid">
                {upcoming.map((ev) => (
                  <EventCard key={ev.id} ev={ev} onOpen={setOpenEv} />
                ))}
              </div>
            </>
          )}
          {past.length > 0 && (
            <>
              <div className="ev-sec-label past">Past · {past.length}</div>
              <div className="ev-grid ev-grid-past">
                {past.map((ev) => (
                  <EventCard key={ev.id} ev={ev} onOpen={setOpenEv} past />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {openEv && (
        <EventSheet
          ev={openEv}
          onClose={() => setOpenEv(null)}
          showToast={showToast}
        />
      )}
    </>
  )
}
