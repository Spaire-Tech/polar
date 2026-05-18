'use client'

import {
  useDeleteNewsletter,
  useNewsletter,
  useUpdateNewsletter,
} from '@/hooks/queries/newsletters'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import Input from '@spaire/ui/components/atoms/Input'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Icon } from '../../email-marketing/_components/Icon'

// Brand-level settings for a newsletter. Currently covers identity
// (name, slug, masthead, description), default sender info, and a
// destructive delete. Theme defaults live in the Style view inside
// the post editor (with "Save as newsletter default" promoting an
// edit onto this row).

export function NewsletterSettingsScreen({
  organization,
  newsletterId,
}: {
  organization: schemas['Organization']
  newsletterId: string
}) {
  const router = useRouter()
  const { data: newsletter, isLoading } = useNewsletter(newsletterId)
  const update = useUpdateNewsletter()
  const del = useDeleteNewsletter()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [masthead, setMasthead] = useState('')
  const [description, setDescription] = useState('')
  const [defaultSenderName, setDefaultSenderName] = useState('')
  const [defaultSenderEmail, setDefaultSenderEmail] = useState('')
  const [defaultReplyTo, setDefaultReplyTo] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [status, setStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Hydrate from the loaded newsletter once. Subsequent re-fetches
  // don't overwrite local edits — autosave (or explicit save) writes
  // back to the server, then TanStack invalidates the query, then we
  // skip re-hydration because `hydrated` is true.
  useEffect(() => {
    if (hydrated || !newsletter) return
    // Legitimate server → local state handoff on first fetch — same
    // pattern the post editor uses to take ownership of an
    // async-loaded resource. The lint rule below disallows setState
    // in effects in general; here it's safe and intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(newsletter.name)
    setSlug(newsletter.slug)
    setMasthead(newsletter.masthead || '')
    setDescription(newsletter.description || '')
    setDefaultSenderName(newsletter.default_sender_name || '')
    setDefaultSenderEmail(newsletter.default_sender_email || '')
    setDefaultReplyTo(newsletter.default_reply_to_email || '')
    setHydrated(true)
  }, [newsletter, hydrated])

  if (isLoading || !newsletter) {
    return (
      <Shell>
        <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
      </Shell>
    )
  }

  const onSave = async () => {
    setStatus('saving')
    try {
      await update.mutateAsync({
        newsletterId,
        body: {
          name: name.trim(),
          slug: slug.trim(),
          masthead: masthead.trim(),
          description: description.trim() || null,
          default_sender_name: defaultSenderName.trim() || null,
          default_sender_email: defaultSenderEmail.trim() || null,
          default_reply_to_email: defaultReplyTo.trim() || null,
        },
      })
      setStatus('saved')
      window.setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('error')
    }
  }

  const onDelete = async () => {
    try {
      await del.mutateAsync({ newsletterId })
      router.push(`/dashboard/${organization.slug}/newsletters`)
    } catch {
      setConfirmDelete(false)
    }
  }

  return (
    <Shell>
      <Link
        href={`/dashboard/${organization.slug}/newsletters/${newsletterId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <Icon name="arrow-left" size={13} /> Back to newsletter
      </Link>

      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-gray-900">
        Settings
      </h1>
      <p className="mb-8 text-sm text-gray-500">
        Brand defaults applied to every post in this newsletter.
      </p>

      <Section title="Identity">
        <Field label="Name">
          <Input
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            maxLength={200}
          />
        </Field>
        <Field
          label="URL slug"
          hint="Used in post URLs and as a unique handle within your organisation."
        >
          <div className="flex items-stretch overflow-hidden rounded-xl border border-gray-200 bg-white">
            <span className="flex items-center bg-gray-50 px-3 text-xs text-gray-500">
              /{organization.slug}/newsletter/
            </span>
            <input
              value={slug}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSlug(e.target.value)}
              className="flex-1 border-0 px-3 py-2 text-sm outline-none"
              maxLength={200}
            />
          </div>
        </Field>
        <Field
          label="Masthead"
          hint="Wordmark rendered above the body of every post. Leave blank to hide."
        >
          <Input
            value={masthead}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMasthead(e.target.value)}
            maxLength={200}
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none"
          />
        </Field>
      </Section>

      <Section title="Default sender">
        <Field
          label="Sender name"
          hint="Shows in the From line in subscribers' inboxes. Falls back to the organisation name if blank."
        >
          <Input
            value={defaultSenderName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaultSenderName(e.target.value)}
            maxLength={100}
          />
        </Field>
        <Field
          label="Sender email"
          hint="Falls back to the platform's notifications sender if blank."
        >
          <Input
            value={defaultSenderEmail}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaultSenderEmail(e.target.value)}
            type="email"
            maxLength={255}
          />
        </Field>
        <Field label="Reply-to email">
          <Input
            value={defaultReplyTo}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaultReplyTo(e.target.value)}
            type="email"
            maxLength={255}
          />
        </Field>
      </Section>

      <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-6">
        {status === 'saving' && (
          <span className="text-xs text-gray-500">Saving…</span>
        )}
        {status === 'saved' && (
          <span className="text-xs text-green-600">Saved</span>
        )}
        {status === 'error' && (
          <span className="text-xs text-red-600">Save failed</span>
        )}
        <Button onClick={onSave} disabled={status === 'saving'}>
          Save changes
        </Button>
      </div>

      <Section title="Danger zone" tone="danger">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">
              Delete this newsletter
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Removes the newsletter and every post inside it. Sent
              broadcasts and analytics are kept.
            </div>
          </div>
          {confirmDelete ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete forever
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Delete newsletter
            </button>
          )}
        </div>
      </Section>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl px-6 py-8">{children}</div>
}

function Section({
  title,
  tone,
  children,
}: {
  title: string
  tone?: 'danger'
  children: React.ReactNode
}) {
  return (
    <section
      className={
        'mb-6 rounded-2xl border bg-white p-5 ' +
        (tone === 'danger'
          ? 'mt-10 border-red-200'
          : 'border-gray-200')
      }
    >
      <h2
        className={
          'mb-4 text-sm font-semibold ' +
          (tone === 'danger' ? 'text-red-700' : 'text-gray-900')
        }
      >
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-900">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}
