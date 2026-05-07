'use client'

import {
  CoachingEventRead,
  MeetingProvider,
  useCoachingEvents,
  useCreateCoachingEvent,
  useCreateCoachingRecordingUpload,
  useDeleteCoachingEvent,
  useUpdateCoachingEvent,
} from '@/hooks/queries/coaching'
import AddOutlined from '@mui/icons-material/AddOutlined'
import VideocamOutlined from '@mui/icons-material/VideocamOutlined'
import { useMemo, useState } from 'react'
import { toast } from '../../Toast/use-toast'

const MEETING_PROVIDERS: { id: MeetingProvider; label: string }[] = [
  { id: 'zoom', label: 'Zoom' },
  { id: 'google_meet', label: 'Google Meet' },
  { id: 'whereby', label: 'Whereby' },
  { id: 'riverside', label: 'Riverside' },
  { id: 'other', label: 'Other' },
]

type DraftEvent = {
  id?: string
  title: string
  description: string
  starts_at_local: string // datetime-local value
  duration_minutes: number
  meeting_url: string
  meeting_provider: MeetingProvider
}

const emptyDraft = (): DraftEvent => ({
  title: '',
  description: '',
  starts_at_local: defaultStartsAt(),
  duration_minutes: 60,
  meeting_url: '',
  meeting_provider: 'zoom',
})

function defaultStartsAt(): string {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 24)
  // Convert to local datetime-local format
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromEvent(e: CoachingEventRead): DraftEvent {
  const local = new Date(e.starts_at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    id: e.id,
    title: e.title,
    description: e.description ?? '',
    starts_at_local: `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`,
    duration_minutes: e.duration_minutes,
    meeting_url: e.meeting_url ?? '',
    meeting_provider: (e.meeting_provider ?? 'zoom') as MeetingProvider,
  }
}

function localToISO(local: string): string {
  return new Date(local).toISOString()
}

function formatStartsAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function EventsTab({ courseId }: { courseId: string }) {
  const { data: events = [], isLoading } = useCoachingEvents(courseId)
  const createEvent = useCreateCoachingEvent(courseId)
  const updateEvent = useUpdateCoachingEvent(courseId)
  const deleteEvent = useDeleteCoachingEvent(courseId)
  const recordingUpload = useCreateCoachingRecordingUpload()

  const [draft, setDraft] = useState<DraftEvent | null>(null)

  const upcoming = useMemo(
    () =>
      [...events]
        .filter((e) => new Date(e.starts_at).getTime() >= Date.now())
        .sort(
          (a, b) =>
            new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
        ),
    [events],
  )
  const past = useMemo(
    () =>
      [...events]
        .filter((e) => new Date(e.starts_at).getTime() < Date.now())
        .sort(
          (a, b) =>
            new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
        ),
    [events],
  )

  const handleSave = async () => {
    if (!draft) return
    try {
      const tz =
        Intl.DateTimeFormat().resolvedOptions().timeZone || null
      if (draft.id) {
        await updateEvent.mutateAsync({
          eventId: draft.id,
          body: {
            title: draft.title,
            description: draft.description || null,
            starts_at: localToISO(draft.starts_at_local),
            duration_minutes: draft.duration_minutes,
            meeting_url: draft.meeting_url || null,
            meeting_provider: draft.meeting_provider,
            timezone: tz,
          },
        })
      } else {
        await createEvent.mutateAsync({
          course_id: courseId,
          title: draft.title,
          description: draft.description || null,
          starts_at: localToISO(draft.starts_at_local),
          duration_minutes: draft.duration_minutes,
          meeting_url: draft.meeting_url || null,
          meeting_provider: draft.meeting_provider,
          timezone: tz,
        })
      }
      setDraft(null)
    } catch (e) {
      toast({
        title: 'Could not save event',
        description: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event? This cannot be undone.')) return
    try {
      await deleteEvent.mutateAsync(id)
    } catch (e) {
      toast({
        title: 'Could not delete event',
        description: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  }

  const handleUploadRecording = async (
    event: CoachingEventRead,
    file: File,
  ) => {
    try {
      const { upload_url } = await recordingUpload.mutateAsync(event.id)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Upload failed (${xhr.status})`))
        xhr.onerror = () => reject(new Error('Network error during upload'))
        xhr.open('PUT', upload_url)
        xhr.send(file)
      })
      toast({
        title: 'Recording uploaded',
        description: 'It will appear in the customer portal once Mux finishes processing.',
      })
    } catch (e) {
      toast({
        title: 'Upload failed',
        description: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">
            Events
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Live group calls in this program. Customers see them on the
            program&apos;s schedule with a join link and can add them to their
            calendar.
          </p>
        </div>
        <button
          onClick={() => setDraft(emptyDraft())}
          className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white transition hover:brightness-110"
        >
          <AddOutlined sx={{ fontSize: 14 }} /> Add event
        </button>
      </div>

      {draft && (
        <EventForm
          draft={draft}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSave={handleSave}
          saving={createEvent.isPending || updateEvent.isPending}
        />
      )}

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
      ) : events.length === 0 && !draft ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-12 text-center">
          <p className="text-sm text-gray-500">
            No events scheduled yet. Add the first one above.
          </p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <Section title="Upcoming">
              {upcoming.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  onEdit={() => setDraft(fromEvent(event))}
                  onDelete={() => handleDelete(event.id)}
                  onUploadRecording={(file) =>
                    handleUploadRecording(event, file)
                  }
                />
              ))}
            </Section>
          )}
          {past.length > 0 && (
            <Section title="Past">
              {past.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  onEdit={() => setDraft(fromEvent(event))}
                  onDelete={() => handleDelete(event.id)}
                  onUploadRecording={(file) =>
                    handleUploadRecording(event, file)
                  }
                />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold tracking-wider text-gray-400 uppercase">
        {title}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function EventRow({
  event,
  onEdit,
  onDelete,
  onUploadRecording,
}: {
  event: CoachingEventRead
  onEdit: () => void
  onDelete: () => void
  onUploadRecording: (file: File) => void
}) {
  const isPast = new Date(event.starts_at).getTime() < Date.now()
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col">
        <div className="text-sm font-medium text-gray-900">{event.title}</div>
        <div className="text-xs text-gray-500">
          {formatStartsAt(event.starts_at)} · {event.duration_minutes} min
          {event.meeting_provider ? ` · ${event.meeting_provider}` : ''}
          {event.status === 'cancelled' ? ' · cancelled' : ''}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isPast && (
          <label className="flex cursor-pointer items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
            <VideocamOutlined sx={{ fontSize: 14 }} />
            {event.recording_mux_playback_id
              ? 'Replace recording'
              : 'Upload recording'}
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onUploadRecording(f)
                e.target.value = ''
              }}
            />
          </label>
        )}
        <button
          onClick={onEdit}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

function EventForm({
  draft,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  draft: DraftEvent
  onChange: (d: DraftEvent) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
}) {
  const canSave = draft.title.trim().length > 0 && draft.starts_at_local
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium tracking-wider text-gray-500 uppercase">
          Title
        </label>
        <input
          autoFocus
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
          placeholder="Week 1 — Live group call"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium tracking-wider text-gray-500 uppercase">
            Starts at
          </label>
          <input
            type="datetime-local"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={draft.starts_at_local}
            onChange={(e) =>
              onChange({ ...draft, starts_at_local: e.target.value })
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium tracking-wider text-gray-500 uppercase">
            Duration (minutes)
          </label>
          <input
            type="number"
            min={5}
            max={480}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={draft.duration_minutes}
            onChange={(e) =>
              onChange({
                ...draft,
                duration_minutes: Math.max(
                  5,
                  Math.min(480, parseInt(e.target.value || '60', 10) || 60),
                ),
              })
            }
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_180px]">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium tracking-wider text-gray-500 uppercase">
            Meeting URL
          </label>
          <input
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={draft.meeting_url}
            onChange={(e) =>
              onChange({ ...draft, meeting_url: e.target.value })
            }
            placeholder="https://zoom.us/j/123456"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium tracking-wider text-gray-500 uppercase">
            Provider
          </label>
          <select
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={draft.meeting_provider}
            onChange={(e) =>
              onChange({
                ...draft,
                meeting_provider: e.target.value as MeetingProvider,
              })
            }
          >
            {MEETING_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium tracking-wider text-gray-500 uppercase">
          Description / agenda
        </label>
        <textarea
          rows={4}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          value={draft.description}
          onChange={(e) =>
            onChange({ ...draft, description: e.target.value })
          }
          placeholder="Topics we'll cover, prework, anything customers should bring."
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-full px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!canSave || saving}
          className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Add event'}
        </button>
      </div>
    </div>
  )
}
