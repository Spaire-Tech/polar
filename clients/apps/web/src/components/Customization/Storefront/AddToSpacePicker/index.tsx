'use client'

import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { schemas } from '@spaire/client'
import { useEffect, useState } from 'react'
import { CatalogTab } from './CatalogTab'
import { CourseTab } from './CourseTab'
import { EmbedPickPayload, EmbedTab } from './EmbedTab'
import { FormTab } from './FormTab'
import { UrlPickPayload, UrlTab } from './UrlTab'

export type { EmbedPickPayload, UrlPickPayload }

export type AddToSpacePickerCallbacks = {
  // The user pasted a URL and confirmed → add a standard storefront link.
  onAddLink: (payload: UrlPickPayload) => void
  // The user picked a platform and entered a URL → add an embedded link
  // (or a stylized fallback card if the platform doesn't support inline
  // embedding).
  onAddEmbed: (payload: EmbedPickPayload) => void
  // The user selected one or more existing products to feature.
  onAddProducts: (productIds: string[]) => void
  // The user clicked "+ New product" / "+ New course". The parent opens
  // its existing product / course creation flow.
  onCreateProduct: () => void
  onCreateCourse: () => void
}

const TABS = [
  { id: 'url', label: 'URL' },
  { id: 'embed', label: 'Embed' },
  { id: 'product', label: 'Digital Product' },
  { id: 'course', label: 'Course' },
  { id: 'form', label: 'Form' },
] as const
type TabId = (typeof TABS)[number]['id']

export const AddToSpacePicker = ({
  organization,
  initialTab = 'url',
  onClose,
  callbacks,
}: {
  organization: schemas['Organization']
  initialTab?: TabId
  onClose: () => void
  callbacks: AddToSpacePickerCallbacks
}) => {
  const [tab, setTab] = useState<TabId>(initialTab)

  // Escape closes the modal. Click outside is handled by the backdrop.
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
    <div className="atsp-root">
      <div className="atsp-backdrop" onClick={onClose} />
      <div
        className="atsp-surface"
        role="dialog"
        aria-label="Add to your Space"
        aria-modal="true"
      >
        <div className="atsp-head">
          <div className="atsp-title">Add to your Space</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="atsp-close"
          >
            <CloseOutlined style={{ fontSize: 18 }} />
          </button>
        </div>

        <div className="atsp-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className="atsp-tab"
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="atsp-body">
          {tab === 'url' && <UrlTab onPick={wrap(callbacks.onAddLink)} />}
          {tab === 'embed' && <EmbedTab onPick={wrap(callbacks.onAddEmbed)} />}
          {tab === 'product' && (
            <CatalogTab
              organization={organization}
              onAddProducts={wrap(callbacks.onAddProducts)}
              onCreateNew={() => {
                onClose()
                callbacks.onCreateProduct()
              }}
            />
          )}
          {tab === 'course' && (
            <CourseTab
              organization={organization}
              onAddProducts={wrap(callbacks.onAddProducts)}
              onCreateNew={() => {
                onClose()
                callbacks.onCreateCourse()
              }}
            />
          )}
          {tab === 'form' && <FormTab />}
        </div>
      </div>
    </div>
  )
}
