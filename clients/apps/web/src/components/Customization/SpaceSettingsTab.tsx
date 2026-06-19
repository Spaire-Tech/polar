'use client'

// Settings tab for the Space editor — the "switchboard" surface that
// mirrors the course editor's Settings tab: tidy grouped cards of on/off
// switches. Reads + writes via the surrounding react-hook-form context
// (same as the canvas inline editors), so the Publish button stays in sync.
//
// This is the shell-phase port of the old slide-in SpaceSettingsPanel: the
// same controls (Visibility, Display, Blocks), restyled as cards in the
// course-editor design language so they theme light/dark consistently. New
// Space-details settings (SEO, identity, …) land here next.

import { spacePageLink } from '@/utils/nav'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined'
import { schemas } from '@spaire/client'
import { cn } from '@spaire/ui/lib/utils'
import { useCallback, useState } from 'react'
import { useFormContext } from 'react-hook-form'

type Settings = NonNullable<schemas['OrganizationStorefrontSettings']>

type DisplayToggle = { key: keyof Settings; label: string; def: boolean }

const DISPLAY_TOGGLES: DisplayToggle[] = [
  { key: 'show_header', label: 'Show cover image', def: true },
  { key: 'show_logo', label: 'Show profile photo', def: true },
  { key: 'show_name', label: 'Show name', def: true },
  { key: 'show_description', label: 'Show description', def: true },
  { key: 'show_product_details', label: 'Show product details', def: true },
  { key: 'show_card_products', label: 'Show product images in card', def: true },
]

/** Course-editor-style toggle. `bg-[#fff]` keeps the knob white under
 *  `.editor-dark` (which would otherwise remap `bg-white` to a dark fill). */
function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors',
        on ? 'bg-[#0066cc]' : 'bg-gray-300',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-[#fff] shadow-sm transition-transform',
          on && 'translate-x-5',
        )}
      />
    </button>
  )
}

function Card({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="text-base font-semibold tracking-tight text-gray-900">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-[13px] text-gray-500">{description}</p>
      )}
      <div className="mt-4 flex flex-col">{children}</div>
    </section>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-gray-100 py-3 first:border-t-0 first:pt-0">
      <div className="text-[14px] tracking-tight text-gray-900">{label}</div>
      {children}
    </div>
  )
}

export const SpaceSettingsTab = ({
  organization,
  onOpenLinks,
}: {
  organization: schemas['Organization']
  onOpenLinks: () => void
}) => {
  const { watch, setValue } = useFormContext<schemas['OrganizationUpdate']>()
  const watched = watch()
  const settings = (watched.storefront_settings ??
    organization.storefront_settings ??
    {}) as Settings

  const updateSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setValue(
        'storefront_settings',
        { ...settings, [key]: value },
        { shouldDirty: true },
      )
    },
    [settings, setValue],
  )

  const isEnabled = settings.enabled ?? false
  const thumbnailSize = settings.thumbnail_size ?? 'large'

  const spaceUrl = spacePageLink(organization).replace(/\/$/, '')
  const [copied, setCopied] = useState(false)
  const copyLink = () => {
    navigator.clipboard.writeText(spaceUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleEnabledChange = (next: boolean) => {
    if (!next && isEnabled) {
      if (
        !window.confirm(
          'Disable your Space? Your public URL will return 404 to visitors until you re-enable it.',
        )
      ) {
        return
      }
    }
    updateSetting('enabled', next)
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <Card
        title="Visibility"
        description="Publish your Space to make it reachable at your public URL."
      >
        <Row label="Enable your Space">
          <Toggle
            on={isEnabled}
            onChange={handleEnabledChange}
            label="Enable your Space"
          />
        </Row>
        {isEnabled && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2">
            <input
              value={spaceUrl}
              readOnly
              aria-label="Space URL"
              className="min-w-0 flex-1 bg-transparent px-2 text-[13px] text-gray-600 outline-none"
            />
            <button
              type="button"
              title="Copy link"
              onClick={copyLink}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              {copied ? (
                <CheckOutlined style={{ fontSize: 16 }} />
              ) : (
                <ContentCopyOutlined style={{ fontSize: 16 }} />
              )}
            </button>
            <a
              href={spaceUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open Space"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              <OpenInNewOutlined style={{ fontSize: 16 }} />
            </a>
          </div>
        )}
      </Card>

      <Card
        title="Display"
        description="Choose what appears on your Space."
      >
        {DISPLAY_TOGGLES.map(({ key, label, def }) => {
          const current = (settings[key] as boolean | undefined) ?? def
          return (
            <Row label={label} key={key as string}>
              <Toggle
                on={current}
                onChange={(next) =>
                  updateSetting(key, next as Settings[typeof key])
                }
                label={label}
              />
            </Row>
          )
        })}
        <Row label="Thumbnail size">
          <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
            {(['small', 'medium', 'large'] as const).map((size) => (
              <button
                key={size}
                type="button"
                className={cn(
                  'rounded-md px-3 py-1 text-[11px] font-medium transition-colors',
                  thumbnailSize === size
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:text-gray-900',
                )}
                onClick={() => updateSetting('thumbnail_size', size)}
              >
                {size[0].toUpperCase() + size.slice(1)}
              </button>
            ))}
          </div>
        </Row>
      </Card>

      <Card
        title="Blocks"
        description="Manage the links and embeds shown on your Space."
      >
        <button
          type="button"
          onClick={onOpenLinks}
          className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-[14px] text-gray-900 transition-colors hover:bg-gray-50"
        >
          <span>Manage links &amp; embeds</span>
          <span className="text-gray-400">›</span>
        </button>
      </Card>
    </div>
  )
}
