'use client'

import { useForms } from '@/hooks/queries/forms'
import { schemas } from '@spaire/client'
import Link from 'next/link'

export type FormPickPayload = {
  id: string
  title: string
}

export const FormTab = ({
  organization,
  onPick,
}: {
  organization: schemas['Organization']
  onPick: (payload: FormPickPayload) => void
}) => {
  const { data, isLoading } = useForms(organization.id, { limit: 100 })
  const forms = data?.items ?? []

  return (
    <div className="wg-tab">
      <p className="wg-help">
        Add a lead-capture form to your Space. Only published forms show to
        visitors.
      </p>
      <div className="wg-grid one">
        <Link
          href={`/dashboard/${organization.slug}/forms/new`}
          className="wg-card create"
          style={{ minHeight: 96 }}
        >
          <div
            className="wg-art"
            style={{ background: 'linear-gradient(135deg, #2a2a2a, #555)' }}
          >
            ✎
          </div>
          <div className="wg-meta">
            <div className="wg-card-title">Create a new form</div>
            <div className="wg-card-sub">
              Build a branded email-capture form.
            </div>
          </div>
        </Link>

        {!isLoading &&
          forms.map((form) => (
            <button
              key={form.id}
              type="button"
              className="wg-card"
              onClick={() => onPick({ id: form.id, title: form.title })}
            >
              <div
                className="wg-art"
                style={{
                  background: 'linear-gradient(135deg, #4f46e5, #818cf8)',
                }}
              >
                ▦
              </div>
              <div className="wg-meta">
                <div className="wg-card-title">
                  {form.title}
                  {form.status !== 'published' ? ' · Draft' : ''}
                </div>
                <div className="wg-card-sub">/{form.slug}</div>
              </div>
              <span className="wg-add-btn small ghost" aria-hidden>
                +
              </span>
            </button>
          ))}
      </div>
    </div>
  )
}
