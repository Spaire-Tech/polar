'use client'

import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { schemas } from '@spaire/client'
import { useEffect, useState } from 'react'
import { CatalogTab } from './CatalogTab'
import { EmbedPickPayload, EmbedTab } from './EmbedTab'
import { FormTab } from './FormTab'
import { UrlPickPayload, UrlTab } from './UrlTab'
import './styles.css'

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
  // its existing product-create flow.
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
    <>
      <div className="atsp-backdrop" onClick={onClose} />
      <div
        className="atsp-surface"
        role="dialog"
        aria-label="Add to your Space"
        aria-modal="true"
        // Use our blue as the picker accent (overrides the design's purple).
        style={{ ['--atsp-accent' as string]: '#0067ff' }}
      >
        <div className="flex items-center justify-between px-2 pt-1 pb-3">
          <div className="text-[22px] font-medium tracking-tight text-gray-900">
            Add to your Space
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-black/5 bg-white/60 text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-900"
          >
            <CloseOutlined className="h-4 w-4" />
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

        <div className="mt-5 flex-1 overflow-y-auto px-1">
          {tab === 'url' && <UrlTab onPick={wrap(callbacks.onAddLink)} />}
          {tab === 'embed' && <EmbedTab onPick={wrap(callbacks.onAddEmbed)} />}
          {tab === 'product' && (
            <CatalogTab
              organization={organization}
              variant="product"
              onAddProducts={wrap(callbacks.onAddProducts)}
              onCreateNew={() => {
                onClose()
                callbacks.onCreateProduct()
              }}
            />
          )}
          {tab === 'course' && (
            <CatalogTab
              organization={organization}
              variant="course"
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
    </>
  )
}
