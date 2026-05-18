'use client'

import { useCreateNewsletter } from '@/hooks/queries/newsletters'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import Input from '@spaire/ui/components/atoms/Input'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Icon } from '../../email-marketing/_components/Icon'

// Two-field create flow. We auto-derive a URL slug from the name so
// most users never have to think about it; the input stays visible so
// the slug can be overridden when there's a brand conflict.
//
// Masthead defaults to the uppercased newsletter name. It's editable
// later in the settings page.

export function NewNewsletterScreen({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const create = useCreateNewsletter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveSlug = slugTouched ? slug : slugify(name)

  const canSubmit =
    name.trim().length > 0 &&
    effectiveSlug.length > 0 &&
    !create.isPending

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    try {
      const newsletter = await create.mutateAsync({
        organization_id: organization.id,
        name: name.trim(),
        slug: effectiveSlug,
        masthead: name.trim().toUpperCase(),
      })
      router.push(
        `/dashboard/${organization.slug}/newsletters/${newsletter.id}`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create newsletter')
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <Link
        href={`/dashboard/${organization.slug}/newsletters`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <Icon name="arrow-left" size={13} /> Back to newsletters
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
        New newsletter
      </h1>
      <p className="mt-1.5 text-sm text-gray-500">
        A newsletter holds your brand defaults — name, masthead,
        theme, default sender — and groups every post you publish under
        it.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-900">
            Name
          </label>
          <Input
            autoFocus
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setName(e.target.value)
            }
            placeholder="The Nordiske"
            maxLength={200}
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Shown in the dashboard and as the publication name on the
            web archive.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-900">
            URL slug
          </label>
          <div className="flex items-stretch overflow-hidden rounded-xl border border-gray-200 bg-white">
            <span className="flex items-center bg-gray-50 px-3 text-xs text-gray-500">
              /{organization.slug}/newsletter/
            </span>
            <input
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(slugify(e.target.value))
              }}
              placeholder="the-nordiske"
              maxLength={200}
              className="flex-1 border-0 px-3 py-2 text-sm outline-none"
            />
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            Used in post URLs and as a unique handle. Letters,
            numbers, and dashes only.
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Link href={`/dashboard/${organization.slug}/newsletters`}>
            <Button variant="secondary" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={!canSubmit}>
            {create.isPending ? 'Creating…' : 'Create newsletter'}
          </Button>
        </div>
      </form>
    </div>
  )
}

// Lowercase + collapse runs of non-alphanumerics into single dashes
// + trim leading/trailing dashes. Mirrors the python-slugify behaviour
// the backend would do on a server-side default, just keeps the
// surface honest so the input shows what's actually stored.
export function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}
