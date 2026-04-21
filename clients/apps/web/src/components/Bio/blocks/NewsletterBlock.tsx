'use client'

import { FormEvent, useState } from 'react'

export const NewsletterBlock = ({
  heading,
  description,
  organizationSlug,
}: {
  heading?: string | null
  description?: string | null
  organizationSlug: string
}) => {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    // Placeholder: wire to email_subscriber endpoint in a follow-up
    try {
      setSubmitted(true)
      setEmail('')
    } catch {
      setError('Something went wrong. Please try again.')
    }
  }

  if (submitted) {
    return (
      <section className="flex flex-col items-center gap-2 py-4 text-center">
        <p className="text-sm text-gray-900">Thanks for subscribing.</p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      {heading && (
        <h2 className="text-sm font-semibold text-gray-900">{heading}</h2>
      )}
      {description && (
        <p className="text-xs text-gray-500">{description}</p>
      )}
      <form onSubmit={onSubmit} className="flex flex-row gap-2">
        <input
          type="email"
          required
          placeholder="Subscribe to newsletter"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-gray-400"
        >
          Subscribe
        </button>
      </form>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <span className="sr-only">{organizationSlug}</span>
    </section>
  )
}
