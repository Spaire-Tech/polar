'use client'

import { CustomizationProvider } from '@/components/Customization/CustomizationProvider'
import { ForceLightMode } from '@/components/Profile/ForceLightMode'
import { ProfileCard } from '@/components/Profile/ProfileCard'
import { Storefront } from '@/components/Profile/Storefront'
import { StorefrontLinkItem } from '@/components/Profile/StorefrontLinks'
import { toast } from '@/components/Toast/use-toast'
import { useUpdateOrganization } from '@/hooks/queries'
import { useStorefront } from '@/hooks/queries/storefront'
import { setValidationErrors } from '@/utils/api/errors'
import { spacePageLink } from '@/utils/nav'
import { isValidationError, schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import { Form } from '@spaire/ui/components/ui/form'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { SpaceSettingsPanel } from './InlineEdit/SpaceSettingsPanel'
import { SpaceEditorCanvas } from './SpaceEditorShell'
import {
  AddToSpacePicker,
  AddToSpacePickerCallbacks,
} from './Storefront/AddToSpacePicker'
import { StorefrontLinksPanel } from './Storefront/StorefrontLinksPanel'

export const CustomizationPage = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  return (
    <CustomizationProvider>
      <Customization organization={organization} />
    </CustomizationProvider>
  )
}

const Customization = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const updateOrganization = useUpdateOrganization()
  const [publishing, setPublishing] = useState(false)
  const [linksMode, setLinksMode] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const isSpaceEnabled = organization.storefront_settings?.enabled ?? false
  const [isEditing, setIsEditing] = useState(!isSpaceEnabled)

  const { data: storefrontData } = useStorefront(organization.slug)

  const form = useForm<schemas['OrganizationUpdate']>({
    defaultValues: {
      name: organization.name,
      avatar_url: organization.avatar_url,
      socials: organization.socials,
      storefront_settings: organization.storefront_settings,
    },
  })

  const isDirty = form.formState.isDirty

  // ── Add-to-Space picker callbacks ─────────────────────────────────
  // The picker is form-context-agnostic; it just hands us payloads and
  // we write them into the form here. Each callback flips the form's
  // dirty state so the Publish button activates.

  const appendStorefrontLink = useCallback(
    (link: StorefrontLinkItem) => {
      const settings = form.getValues('storefront_settings') ?? {}
      const links =
        ((settings as { storefront_links?: StorefrontLinkItem[] })
          .storefront_links ?? []).slice()
      links.push(link)
      form.setValue(
        'storefront_settings',
        { ...settings, storefront_links: links },
        { shouldDirty: true },
      )
      toast({
        title: 'Added to your Space',
        description: link.title || link.url,
      })
    },
    [form],
  )

  const pickerCallbacks: AddToSpacePickerCallbacks = {
    onAddLink: (payload) => {
      appendStorefrontLink({
        id: crypto.randomUUID(),
        url: payload.url,
        title: payload.title,
        description: payload.description,
        image_url: payload.image_url,
        type: 'standard',
        platform: null,
      })
    },
    onAddEmbed: ({ url, platform, title, description, image_url }) => {
      appendStorefrontLink({
        id: crypto.randomUUID(),
        url,
        // Use whatever the creator typed in the edit form; fall back
        // to the platform label so embeds always have a sensible
        // title even if the auto-fetch returned nothing.
        title: title ?? platform.label,
        description: description ?? null,
        image_url: image_url ?? null,
        // Platforms we can render inline → 'embedded'. The rest fall
        // back to a stylized standard card; the renderer keys off
        // `platform` for branding either way.
        type: platform.canEmbed ? 'embedded' : 'standard',
        platform: platform.id,
      })
    },
    onChangeProducts: (addIds, removeIds) => {
      // Diff-based update. The picker shows already-featured products
      // pre-selected; toggling them off becomes a `removeIds` entry.
      // We respect the current featured_mode — adding via the picker
      // shouldn't trap the user in curated mode if they're in 'all'.
      const settings = form.getValues('storefront_settings') ?? {}
      const typed = settings as {
        featured_product_ids?: string[]
        featured_mode?: 'all' | 'curated'
      }
      const existing = typed.featured_product_ids ?? []
      const removed = new Set(removeIds)
      const next = Array.from(
        new Set([
          ...existing.filter((id) => !removed.has(id)),
          ...addIds,
        ]),
      )
      const mode = typed.featured_mode ?? 'all'
      form.setValue(
        'storefront_settings',
        { ...settings, featured_product_ids: next },
        { shouldDirty: true },
      )
      const parts: string[] = []
      if (addIds.length > 0)
        parts.push(`Added ${addIds.length} to your Space`)
      if (removeIds.length > 0)
        parts.push(`Removed ${removeIds.length} from your Space`)
      toast({
        title: parts.join(' · ') || 'Selection updated',
        description:
          mode === 'curated'
            ? 'Featured in your curated list.'
            : 'Publish to apply.',
      })
    },
    onCreateProduct: () => {
      router.push(`/dashboard/${organization.slug}/products/new?type=digital`)
    },
    onCreateCourse: () => {
      router.push(`/dashboard/${organization.slug}/products/new?type=course`)
    },
  }

  // ⌘K / Ctrl+K opens the Add-to-Space picker from anywhere in the editor.
  useEffect(() => {
    if (!isEditing) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPickerOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isEditing])

  // Warn before navigating away (or closing the tab) with unpublished
  // edits. Only for the editor, not the published-preview branch.
  useEffect(() => {
    if (!isDirty || !isEditing) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // required by some browsers to show the prompt
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty, isEditing])

  const handlePublish = useCallback(async () => {
    if (publishing) return
    setPublishing(true)

    try {
      const values = form.getValues()

      // Filter out social links with empty URLs before sending
      const cleanSocials = (values.socials ?? []).filter(
        (s: { url?: string }) => s?.url?.trim(),
      )

      const body: schemas['OrganizationUpdate'] = {
        name: values.name ?? organization.name,
        avatar_url: values.avatar_url,
        socials: cleanSocials.length > 0 ? cleanSocials : [],
        storefront_settings: values.storefront_settings,
      }

      const { data: org, error } = await updateOrganization.mutateAsync({
        id: organization.id,
        body,
      })

      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, form.setError)
        } else {
          toast({
            title: 'Publish Failed',
            description: `Error: ${typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail)}`,
          })
        }
        return
      }

      toast({
        title: 'Changes Published',
        description: 'Your storefront has been updated.',
      })

      form.reset({
        name: org.name,
        avatar_url: org.avatar_url,
        socials: org.socials,
        storefront_settings: org.storefront_settings,
      })

      // Wait for the storefront query to refetch so the published-preview
      // branch below renders the new data instead of a stale cache hit.
      await queryClient.refetchQueries({
        queryKey: ['storefront', { organizationSlug: org.slug }],
      })

      // After publishing, switch to preview mode if space is enabled
      if (org.storefront_settings?.enabled) {
        setIsEditing(false)
      }
    } catch (err) {
      toast({
        title: 'Publish Failed',
        description: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      setPublishing(false)
    }
  }, [form, organization, updateOrganization, publishing, queryClient])

  // Published preview mode — card centered with Edit Space button
  if (!isEditing && isSpaceEnabled) {
    return (
      <>
        <ForceLightMode />
        <div className="flex h-full flex-col bg-gray-50">
          {/* Top bar */}
          <div className="flex flex-row items-center justify-between border-b border-gray-200 bg-white px-8 py-4">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/${organization.slug}`)}
              className="text-[14px] text-gray-500 transition-colors hover:text-gray-700"
            >
              &larr; Back to dashboard
            </button>
            <div className="flex items-center gap-3">
              <a
                href={spacePageLink(organization)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-gray-200 px-6 py-2 text-[14px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Visit Space
              </a>
              <Button
                className="rounded-full px-6"
                type="button"
                onClick={() => setIsEditing(true)}
              >
                Edit Space
              </Button>
            </div>
          </div>

          {/* Full storefront preview — on desktop, the left card stays
              fixed while only the right column scrolls. On mobile, the
              whole page scrolls normally (stacked). */}
          <div className="flex min-h-0 flex-1 justify-center overflow-y-auto px-10 md:overflow-hidden">
            <div className="flex w-full max-w-[1100px] flex-col gap-8 py-10 md:h-full md:flex-row md:gap-12 md:py-0">
              <aside className="w-full shrink-0 md:w-[460px] md:py-10">
                <ProfileCard
                  organization={storefrontData?.organization ?? organization}
                  products={storefrontData?.products ?? []}
                  preview
                />
              </aside>
              <main className="flex min-w-0 flex-1 flex-col md:min-h-0 md:overflow-y-auto md:py-10">
                <Storefront
                  organization={storefrontData?.organization ?? organization}
                  products={storefrontData?.products ?? []}
                  preview
                />
              </main>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── Editor mode — single-canvas WYSIWYG ─────────────────────────
  // Toolbar (back / status / settings / publish) sticks to the top.
  // Canvas renders ProfileCard (left, sticky) + Storefront content
  // blocks (right) using our existing public-Space components for
  // visual fidelity. A floating "+ Add to Space" FAB sits at the
  // bottom. The Settings (gear) button toggles a slide-in panel that
  // wraps the existing StorefrontEditorForm for now; PR D ships the
  // redesigned panel and PR C wires inline-edit on the canvas itself.

  const handleBack = () => {
    if (
      isDirty &&
      !window.confirm(
        'You have unpublished changes. Leave without publishing?',
      )
    ) {
      return
    }
    if (isSpaceEnabled) {
      setIsEditing(false)
    } else {
      router.push(`/dashboard/${organization.slug}`)
    }
  }

  const discardChanges = () => {
    if (
      window.confirm(
        'Discard all unpublished edits and revert to the published version?',
      )
    ) {
      form.reset({
        name: organization.name,
        avatar_url: organization.avatar_url,
        socials: organization.socials,
        storefront_settings: organization.storefront_settings,
      })
    }
  }

  return (
    <Form {...form}>
      <ForceLightMode />
      <div className="spaire-editor">
        <div className="toolbar">
          <div className="tb-left">
            <button type="button" className="tb-back" onClick={handleBack}>
              {'←'} {isSpaceEnabled ? 'Back to preview' : 'Dashboard'}
            </button>
          </div>
          <div className="tb-center">
            <span
              className="tb-status"
              data-pub={!isDirty && isSpaceEnabled ? '1' : '0'}
            >
              <span className="dot" />
              {isDirty
                ? 'Unsaved'
                : isSpaceEnabled
                  ? 'Published'
                  : 'Draft'}
            </span>
          </div>
          <div className="tb-right">
            <button
              type="button"
              className="tb-icon-btn"
              onClick={() => {
                if (isSpaceEnabled) setIsEditing(false)
              }}
              disabled={!isSpaceEnabled}
              title={
                isSpaceEnabled
                  ? 'Open the public preview'
                  : 'Enable your Space to preview'
              }
            >
              Preview
            </button>
            <button
              type="button"
              className="tb-icon-btn"
              onClick={() => setSettingsOpen((o) => !o)}
              aria-pressed={settingsOpen}
            >
              Settings
            </button>
            <button
              type="button"
              className="tb-publish"
              onClick={handlePublish}
              disabled={!isDirty || publishing}
            >
              {publishing
                ? 'Publishing…'
                : isDirty
                  ? 'Publish changes'
                  : 'Published'}
            </button>
          </div>
        </div>

        {/* Unsaved-changes banner */}
        {isDirty && (
          <div className="unsaved-banner">
            <div>
              <b>You have unpublished changes.</b>
              <button type="button" onClick={handlePublish}>
                Publish now
              </button>
              <button
                type="button"
                className="discard"
                onClick={discardChanges}
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Canvas — ProfileCard + Storefront content blocks */}
        <SpaceEditorCanvas
          organization={organization}
          hasSettingsPanel={settingsOpen || linksMode}
        />

        {/* Settings side panel (PR D — redesigned to match the
            design hand-off: Visibility, Available for Work, Display,
            Blocks). All inline-editable profile fields live on the
            canvas itself (PR C) so this panel only carries the
            page-level settings. */}
        <SpaceSettingsPanel
          organization={organization}
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onOpenLinks={() => {
            setSettingsOpen(false)
            setLinksMode(true)
          }}
        />

        {/* Manage Links side panel — opens from the Settings form's
            "Manage links" button. PR D folds this into the new panel. */}
        {linksMode && (
          <aside
            className="side-panel open"
            style={{ width: 'min(540px, 100vw)' }}
            aria-label="Manage links"
          >
            <div className="sp-head">
              <h2>Manage links</h2>
              <button
                type="button"
                className="tb-icon-btn"
                onClick={() => setLinksMode(false)}
                aria-label="Close links panel"
              >
                {'×'}
              </button>
            </div>
            <div className="sp-body" style={{ padding: '20px 24px 80px' }}>
              <StorefrontLinksPanel
                organization={organization}
                onBack={() => setLinksMode(false)}
              />
            </div>
          </aside>
        )}

        {/* Floating Add-to-Space FAB */}
        <div
          className={`add-fab-wrap${settingsOpen || linksMode ? ' has-panel' : ''}`}
        >
          <button
            type="button"
            className="add-fab"
            onClick={() => setPickerOpen(true)}
          >
            <span className="plus">+</span>
            Add to Space
            <span className="kbd">{'⌘'}K</span>
          </button>
        </div>

        {pickerOpen && (
          <AddToSpacePicker
            organization={organization}
            alreadySelectedProductIds={
              ((form.getValues('storefront_settings') ?? {}) as {
                featured_product_ids?: string[]
              }).featured_product_ids ?? []
            }
            onClose={() => setPickerOpen(false)}
            callbacks={pickerCallbacks}
          />
        )}
      </div>
    </Form>
  )
}
