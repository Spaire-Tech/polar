'use client'

import { schemas } from '@spaire/client'
import { useEffect, useState } from 'react'
import { CatalogTab } from './CatalogTab'
import { CourseTab } from './CourseTab'
import { EmbedPickPayload, EmbedTab } from './EmbedTab'
import { FormTab } from './FormTab'
import { UrlPickPayload, UrlTab } from './UrlTab'

export type { EmbedPickPayload, UrlPickPayload }

export type AddToSpacePickerCallbacks = {
  onAddLink: (payload: UrlPickPayload) => void
  onAddEmbed: (payload: EmbedPickPayload) => void
  onAddProducts: (productIds: string[]) => void
  onCreateProduct: () => void
  onCreateCourse: () => void
}

const TABS = ['URL', 'Embed', 'Digital Product', 'Course', 'Form'] as const
type Tab = (typeof TABS)[number]

export const AddToSpacePicker = ({
  organization,
  initialTab = 'URL',
  onClose,
  callbacks,
}: {
  organization: schemas['Organization']
  initialTab?: Tab
  onClose: () => void
  callbacks: AddToSpacePickerCallbacks
}) => {
  const [tab, setTab] = useState<Tab>(initialTab)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Close + propagate the pick.
  const wrap =
    <T,>(fn: (x: T) => void) =>
    (x: T) => {
      fn(x)
      onClose()
    }

  return (
    <>
      <div className="picker-backdrop" onClick={onClose} />
      <div
        className="pk-library waterglass"
        role="dialog"
        aria-label="Add to your Space"
        aria-modal="true"
      >
        <div className="wg-head">
          <div className="wg-title">Add to your Space</div>
          <button
            type="button"
            className="wg-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="wg-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="wg-body">
          {tab === 'URL' && <UrlTab onPick={wrap(callbacks.onAddLink)} />}
          {tab === 'Embed' && <EmbedTab onPick={wrap(callbacks.onAddEmbed)} />}
          {tab === 'Digital Product' && (
            <CatalogTab
              organization={organization}
              onAddProducts={wrap(callbacks.onAddProducts)}
              onCreateNew={() => {
                onClose()
                callbacks.onCreateProduct()
              }}
            />
          )}
          {tab === 'Course' && (
            <CourseTab
              organization={organization}
              onAddProducts={wrap(callbacks.onAddProducts)}
              onCreateNew={() => {
                onClose()
                callbacks.onCreateCourse()
              }}
            />
          )}
          {tab === 'Form' && <FormTab />}
        </div>
      </div>
    </>
  )
}
