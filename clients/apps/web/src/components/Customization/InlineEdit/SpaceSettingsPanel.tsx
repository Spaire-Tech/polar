'use client'

import { spacePageLink } from '@/utils/nav'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined'
import { schemas } from '@spaire/client'
import { useCallback, useState } from 'react'
import { useFormContext } from 'react-hook-form'

/**
 * Slide-in settings panel — port of the design hand-off's
 * SettingsPanel. Sections: Visibility, Available for Work, Display,
 * Account. Reads + writes via the surrounding react-hook-form context
 * (same as the canvas inline editors), so the Publish button stays in
 * sync.
 *
 * Inline-editable profile fields (name, photo, cover, description,
 * skills, languages, socials) live on the canvas itself (PR C). This
 * panel only carries the global / page-level settings.
 */

type Settings = NonNullable<schemas['OrganizationStorefrontSettings']>

type DisplayToggle = {
  key: keyof Settings
  label: string
  sub?: string
  def: boolean
}

const DISPLAY_TOGGLES: DisplayToggle[] = [
  { key: 'show_header', label: 'Show cover image', def: true },
  { key: 'show_logo', label: 'Show profile photo', def: true },
  { key: 'show_name', label: 'Show name', def: true },
  { key: 'show_description', label: 'Show description', def: true },
  { key: 'show_product_details', label: 'Show product details', def: true },
  { key: 'show_card_products', label: 'Show product images in card', def: true },
]

export const SpaceSettingsPanel = ({
  organization,
  open,
  onClose,
  onOpenLinks,
}: {
  organization: schemas['Organization']
  open: boolean
  onClose: () => void
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
  const availableForWork = settings.available_for_work ?? false
  const featuredMode = settings.featured_mode ?? 'all'
  const isCurated = featuredMode === 'curated'
  const contactUrl = settings.contact_url ?? ''
  const thumbnailSize = settings.thumbnail_size ?? 'medium'

  const spaceUrl = spacePageLink(organization).replace(/\/$/, '')
  const [copied, setCopied] = useState(false)
  const [copiedShare, setCopiedShare] = useState(false)

  const copyLink = () => {
    navigator.clipboard.writeText(spaceUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareTwitter = () => {
    const msg = "I just launched my Spaire Space\n\nAll my work is up here now!"
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}&url=${encodeURIComponent(spaceUrl)}`,
      '_blank',
    )
  }

  const shareLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(spaceUrl)}`,
      '_blank',
    )
  }

  const copyShareMessage = () => {
    navigator.clipboard.writeText(
      `I just launched my Spaire Space\n\nAll my work is up here now!\n${spaceUrl}`,
    )
    setCopiedShare(true)
    setTimeout(() => setCopiedShare(false), 2000)
  }

  // Confirm-before-disable, mirroring PR 3.9 behavior.
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
    <aside
      className={`side-panel${open ? ' open' : ''}`}
      aria-hidden={!open}
      aria-label="Space settings"
    >
      <div className="sp-head">
        <h2>Space settings</h2>
        <button
          type="button"
          className="tb-icon-btn"
          onClick={onClose}
          aria-label="Close settings"
        >
          {'×'}
        </button>
      </div>

      <div className="sp-body">
        {/* ── Visibility ─────────────────────────────────────────── */}
        <section className="sp-section">
          <h3>Visibility</h3>
          <div className="sp-section-stack">
            <div className="sp-row">
              <div>
                <div className="lbl">Enable your Space</div>
                <div className="sub">
                  Make your storefront visible to the public.
                </div>
              </div>
              <button
                type="button"
                className="sp-toggle"
                data-on={isEnabled ? '1' : '0'}
                onClick={() => handleEnabledChange(!isEnabled)}
                aria-pressed={isEnabled}
                aria-label="Enable your Space"
              >
                <i />
              </button>
            </div>

            {isEnabled && (
              <>
                <div className="sp-url-row">
                  <input value={spaceUrl} readOnly aria-label="Space URL" />
                  <button
                    type="button"
                    className="sp-url-act"
                    title="Copy link"
                    onClick={copyLink}
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
                    className="sp-url-act"
                    title="Open Space"
                  >
                    <OpenInNewOutlined style={{ fontSize: 16 }} />
                  </a>
                </div>

                <div className="sp-share-btns">
                  <button
                    type="button"
                    className="sp-share-btn"
                    onClick={shareTwitter}
                  >
                    Post on X
                  </button>
                  <button
                    type="button"
                    className="sp-share-btn"
                    onClick={shareLinkedIn}
                  >
                    LinkedIn
                  </button>
                  <button
                    type="button"
                    className="sp-share-btn"
                    onClick={copyShareMessage}
                  >
                    {copiedShare ? 'Copied!' : 'Copy message'}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── Available for work ─────────────────────────────────── */}
        <section className="sp-section">
          <h3>Available for work</h3>
          <div className="sp-section-stack">
            <div className="sp-row">
              <div>
                <div className="lbl">Show the badge</div>
                <div className="sub">A green pill on your Space card.</div>
              </div>
              <button
                type="button"
                className="sp-toggle"
                data-on={availableForWork ? '1' : '0'}
                onClick={() =>
                  updateSetting('available_for_work', !availableForWork)
                }
                aria-pressed={availableForWork}
                aria-label="Show available-for-work badge"
              >
                <i />
              </button>
            </div>
            {availableForWork && (
              <input
                type="text"
                className="sp-input"
                placeholder="mailto:hello@example.com  or  https://cal.com/me"
                value={contactUrl}
                onChange={(e) =>
                  updateSetting('contact_url', e.target.value || null)
                }
              />
            )}
          </div>
        </section>

        {/* ── Display preferences ────────────────────────────────── */}
        <section className="sp-section">
          <h3>Display</h3>
          <div className="sp-section-stack">
            {DISPLAY_TOGGLES.map(({ key, label, def }) => {
              const current = (settings[key] as boolean | undefined) ?? def
              return (
                <div className="sp-row" key={key as string}>
                  <div className="lbl">{label}</div>
                  <button
                    type="button"
                    className="sp-toggle"
                    data-on={current ? '1' : '0'}
                    onClick={() =>
                      updateSetting(key, !current as Settings[typeof key])
                    }
                    aria-pressed={current}
                    aria-label={label}
                  >
                    <i />
                  </button>
                </div>
              )
            })}

            <div className="sp-row">
              <div className="lbl">Thumbnail size</div>
              <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={
                      thumbnailSize === size
                        ? 'rounded-md bg-gray-900 px-3 py-1 text-[11px] font-medium text-white'
                        : 'rounded-md px-3 py-1 text-[11px] font-medium text-gray-500 hover:text-gray-900'
                    }
                    onClick={() => updateSetting('thumbnail_size', size)}
                  >
                    {size[0].toUpperCase() + size.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Products to display ────────────────────────────────
            Restored from the old StorefrontEditorForm. Without this,
            once a creator added even one product via the picker we
            forced featured_mode='curated' and they had no way back to
            'all'. The toggle here lets them flip back. The actual
            curated checklist still lives on the canvas (hover a
            product → hide button) for inline editing. */}
        <section className="sp-section">
          <h3>Products to display</h3>
          <div className="sp-section-stack">
            <div className="sp-row">
              <div>
                <div className="lbl">Curate which products appear</div>
                <div className="sub">
                  {isCurated
                    ? 'Only the products you keep visible appear on your Space.'
                    : 'All your active products appear automatically — including new ones you create.'}
                </div>
              </div>
              <button
                type="button"
                className="sp-toggle"
                data-on={isCurated ? '1' : '0'}
                onClick={() =>
                  updateSetting(
                    'featured_mode',
                    isCurated ? 'all' : 'curated',
                  )
                }
                aria-pressed={isCurated}
                aria-label="Curate which products appear"
              >
                <i />
              </button>
            </div>
          </div>
        </section>

        {/* ── Links / blocks shortcuts ───────────────────────────── */}
        <section className="sp-section">
          <h3>Blocks</h3>
          <div className="sp-section-stack">
            <button
              type="button"
              className="sp-secondary-btn"
              onClick={onOpenLinks}
            >
              <span>Manage links & embeds</span>
              <span style={{ fontSize: 16, color: 'var(--muted)' }}>›</span>
            </button>
          </div>
        </section>
      </div>
    </aside>
  )
}
