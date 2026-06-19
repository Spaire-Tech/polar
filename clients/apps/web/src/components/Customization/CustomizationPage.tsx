'use client'

import { CustomizationProvider } from '@/components/Customization/CustomizationProvider'
import { ForceLightMode } from '@/components/Profile/ForceLightMode'
import { detectPlatform } from '@/components/Profile/linkPlatforms'
import { ProfileCard } from '@/components/Profile/ProfileCard'
import { Storefront } from '@/components/Profile/Storefront'
import { StorefrontLinkItem } from '@/components/Profile/StorefrontLinks'
import {
  appendSpaceItem,
  reconcileSpaceProducts,
} from '@/components/Profile/spaceItems'
import { toast } from '@/components/Toast/use-toast'
import { useUpdateOrganization } from '@/hooks/queries'
import { FormPublic } from '@/hooks/queries/forms'
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
import ChevronLeftOutlined from '@mui/icons-material/ChevronLeftOutlined'
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlined from '@mui/icons-material/LightModeOutlined'
import { cn } from '@spaire/ui/lib/utils'
import '@/styles/space-dark.css'
import { ArrangePanel } from './InlineEdit/ArrangePanel'
import { MobilePreviewFrame } from './MobilePreviewFrame'
import { SpaceEmptyHero } from './SpaceEmptyHero'
import { SpaceSettingsTab } from './SpaceSettingsTab'
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
  const [arrangeOpen, setArrangeOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'storefront' | 'settings'>(
    'storefront',
  )
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>(
    'desktop',
  )
  const isSpaceEnabled = organization.storefront_settings?.enabled ?? false
  const [isEditing, setIsEditing] = useState(!isSpaceEnabled)

  const { data: storefrontData } = useStorefront(organization.slug)

  const form = useForm<schemas['OrganizationUpdate']>({
    defaultValues: {
      name: organization.name,
      avatar_url: organization.avatar_url,
      socials: organization.socials,
      // Fall back to an empty object so brand-new orgs (where
      // storefront_settings is null) can still have settings flipped
      // on. Spreading null is a silent no-op everywhere downstream.
      storefront_settings: organization.storefront_settings ?? {},
    },
  })

  const isDirty = form.formState.isDirty

  // The Space's light/dark theme is a published setting
  // (storefront_settings.theme). The top-bar switch writes it — dirtying the
  // form so the editor chrome + canvas preview it, and Publish ships it to the
  // public Space page.
  const watchedTheme =
    (form.watch('storefront_settings') as
      | { theme?: 'light' | 'dark' }
      | undefined)?.theme ??
    organization.storefront_settings?.theme ??
    'light'
  const dark = watchedTheme === 'dark'
  const toggleDark = () => {
    const current = form.getValues('storefront_settings') ?? {}
    form.setValue(
      'storefront_settings',
      { ...current, theme: dark ? 'light' : 'dark' },
      { shouldDirty: true },
    )
  }

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
      // Also append to space_items so the new link shows up at the end
      // of the Space's flat order. appendSpaceItem materialises the
      // current order if it's still legacy-derived, so this is also
      // the first write that "locks in" the new ordering model for
      // Spaces still on the legacy fields.
      const itemPatch = appendSpaceItem({
        settings: settings as schemas['OrganizationStorefrontSettings'],
        products: storefrontData?.products ?? [],
        links,
        item: { kind: 'link', id: link.id },
      })
      form.setValue(
        'storefront_settings',
        { ...settings, storefront_links: links, ...itemPatch },
        { shouldDirty: true },
      )
      toast({
        title: 'Added to your Space',
        description: link.title || link.url,
      })
    },
    [form, storefrontData],
  )

  const pickerCallbacks: AddToSpacePickerCallbacks = {
    onAddLink: (payload) => {
      // The URL tab ALWAYS produces a standard link card — never an
      // embed. Auto-upgrading known platforms (YouTube, Instagram, …) to
      // inline players was wrong: pasting a channel/profile URL (not a
      // video) still tried to embed, and anyone who just wanted a link
      // had no way to opt out. Embeds now come exclusively from the
      // Embed tab. We still record the detected platform so the card can
      // show the brand logo.
      const detected = detectPlatform(payload.url)
      appendStorefrontLink({
        id: crypto.randomUUID(),
        url: payload.url,
        title: payload.title,
        description: payload.description,
        image_url: payload.image_url,
        type: 'standard',
        platform: detected?.id ?? null,
        // New links default to List; the creator changes it per-link from
        // the link's "…" menu on the canvas.
        layout: 'classic',
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
      // Diff-based update. The picker shows products that are
      // currently on the Space as pre-selected; toggling them off
      // becomes a `removeIds` entry. We update both `space_items`
      // (the new source of truth — appends adds at the end, drops
      // removes in place) and `featured_product_ids` (kept in sync
      // so older client builds + the carousel scoping in the profile
      // card don't see a stale list).
      const settings = form.getValues('storefront_settings') ?? {}
      const typed = settings as {
        featured_product_ids?: string[]
        storefront_links?: StorefrontLinkItem[]
      }
      const existing = typed.featured_product_ids ?? []
      const removed = new Set(removeIds)
      const nextFeatured = Array.from(
        new Set([
          ...existing.filter((id) => !removed.has(id)),
          ...addIds,
        ]),
      )
      const itemPatch = reconcileSpaceProducts({
        settings: settings as schemas['OrganizationStorefrontSettings'],
        products: storefrontData?.products ?? [],
        links: typed.storefront_links ?? [],
        addIds,
        removeIds,
      })
      form.setValue(
        'storefront_settings',
        {
          ...settings,
          featured_product_ids: nextFeatured,
          ...itemPatch,
        },
        { shouldDirty: true },
      )
      const parts: string[] = []
      if (addIds.length > 0)
        parts.push(`Added ${addIds.length} to your Space`)
      if (removeIds.length > 0)
        parts.push(`Removed ${removeIds.length} from your Space`)
      toast({
        title: parts.join(' · ') || 'Selection updated',
        description: 'Publish to apply.',
      })
    },
    onCreateProduct: () => {
      if (!confirmIfDirty()) return
      const returnTo = `/dashboard/${organization.slug}/storefront`
      router.push(
        `/dashboard/${organization.slug}/products/new?type=digital&returnTo=${encodeURIComponent(returnTo)}`,
      )
    },
    onCreateCourse: () => {
      if (!confirmIfDirty()) return
      const returnTo = `/dashboard/${organization.slug}/storefront`
      router.push(
        `/dashboard/${organization.slug}/products/new?type=course&returnTo=${encodeURIComponent(returnTo)}`,
      )
    },
    onAddForm: (payload) => {
      const settings = form.getValues('storefront_settings') ?? {}
      const itemPatch = appendSpaceItem({
        settings: settings as schemas['OrganizationStorefrontSettings'],
        products: storefrontData?.products ?? [],
        links:
          (settings as { storefront_links?: StorefrontLinkItem[] })
            .storefront_links ?? [],
        item: { kind: 'form', id: payload.id },
      })
      form.setValue(
        'storefront_settings',
        { ...settings, ...itemPatch },
        { shouldDirty: true },
      )
      toast({
        title: 'Added form to your Space',
        description: payload.title,
      })
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
          // Attach errors to the form (helps any registered FormField),
          // BUT also surface them as a toast — the Space card uses inline
          // contentEditable elements that aren't registered with
          // react-hook-form, so setError alone produces no visible UI.
          setValidationErrors(error.detail, form.setError)
          const summary = error.detail
            .slice(0, 3)
            .map((e) => {
              const field = e.loc.slice(1).join('.') || 'value'
              return `${field}: ${e.msg}`
            })
            .join('\n')
          toast({
            title: 'Publish Failed',
            description:
              summary +
              (error.detail.length > 3
                ? `\n…and ${error.detail.length - 3} more.`
                : ''),
          })
        } else {
          // Stringify safely so the toast never shows "[object Object]".
          const detail =
            typeof error.detail === 'string'
              ? error.detail
              : (() => {
                  try {
                    return JSON.stringify(error.detail, null, 2)
                  } catch {
                    return 'Unknown error. Please try again.'
                  }
                })()
          toast({
            title: 'Publish Failed',
            description: detail,
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

  // Shared dirty-check used by every code path that takes the user
  // away from the editor (client-side navigations don't fire
  // beforeunload, so we have to ask explicitly). Declared here, BEFORE
  // any early returns, so the hook count stays stable across edit and
  // preview branches.
  const confirmIfDirty = useCallback((): boolean => {
    if (!isDirty) return true
    return window.confirm(
      'You have unpublished changes. Leave without publishing?',
    )
  }, [isDirty])

  // Published preview mode — card centered with Edit Space button
  if (!isEditing && isSpaceEnabled) {
    // Overlay any unpublished form edits on top of the published org
    // so the preview branch shows "what publishing would produce" —
    // not the stale published copy. The user can't edit while in
    // preview, so a single getValues() snapshot at render is enough
    // (no reactive watch() at page level, which would re-render the
    // editor mode on every keystroke).
    const publishedOrg = storefrontData?.organization ?? organization
    const draft = form.getValues()
    const previewOrg = {
      ...publishedOrg,
      name: draft.name ?? publishedOrg.name,
      avatar_url: draft.avatar_url ?? publishedOrg.avatar_url,
      socials: draft.socials ?? publishedOrg.socials,
      storefront_settings:
        draft.storefront_settings ?? publishedOrg.storefront_settings,
    } as typeof publishedOrg
    const previewProducts = (storefrontData?.products ?? []) as schemas['ProductStorefront'][]
    const previewForms = ((
      storefrontData as { forms?: FormPublic[] } | undefined
    )?.forms ?? []) as FormPublic[]
    const previewSettings = previewOrg.storefront_settings ?? {}
    const previewFeaturedMode = previewSettings?.featured_mode ?? 'curated'
    const previewFeaturedIds = previewSettings?.featured_product_ids ?? []
    const previewLinks = previewSettings?.storefront_links ?? []
    const visiblePreviewProductCount =
      previewFeaturedMode === 'curated'
        ? previewFeaturedIds.length
        : previewProducts.length
    const isPreviewSpaceEmpty =
      visiblePreviewProductCount === 0 && previewLinks.length === 0

    // Jump back into the editor with the picker already open — the
    // empty-state CTA in preview should land the creator straight on
    // the "add products / links" surface.
    const openEditorAtPicker = () => {
      setIsEditing(true)
      setPickerOpen(true)
    }

    return (
      <>
        <ForceLightMode />
        <div className="flex h-full flex-col bg-gray-50">
          {/* Top bar */}
          <div className="flex flex-row items-center justify-between border-b border-gray-200 bg-white px-8 py-4">
            <button
              type="button"
              onClick={() => {
                if (!confirmIfDirty()) return
                router.push(`/dashboard/${organization.slug}`)
              }}
              className="text-[14px] text-gray-500 transition-colors hover:text-gray-700"
            >
              &larr; Back to dashboard
            </button>

            {/* Centered device toggle — preview only. */}
            <div
              className="preview-device"
              role="tablist"
              aria-label="Preview device"
            >
              <button
                type="button"
                role="tab"
                aria-selected={previewDevice === 'desktop'}
                className="preview-device-btn"
                data-active={previewDevice === 'desktop' ? '1' : '0'}
                onClick={() => setPreviewDevice('desktop')}
                title="Desktop preview"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
                <span>Desktop</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={previewDevice === 'mobile'}
                className="preview-device-btn"
                data-active={previewDevice === 'mobile' ? '1' : '0'}
                onClick={() => setPreviewDevice('mobile')}
                title="Mobile preview (iPhone)"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <rect x="6" y="2" width="12" height="20" rx="3" />
                  <path d="M11 18h2" />
                </svg>
                <span>Mobile</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              {isDirty && (
                <span
                  className="rounded-full bg-amber-100 px-3 py-1 text-[12px] font-medium text-amber-800"
                  title="Showing your unpublished edits — visitors still see the published version."
                >
                  Unpublished preview
                </span>
              )}
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

          {previewDevice === 'desktop' ? (
            /* Desktop preview — same layout the public Space renders
               on a wide viewport. */
            <div className="flex min-h-0 flex-1 justify-center overflow-y-auto px-10 md:overflow-hidden">
              <div className="flex w-full max-w-[1100px] flex-col gap-8 py-10 md:h-full md:flex-row md:gap-12 md:py-0">
                <aside className="w-full shrink-0 md:w-[460px] md:py-10">
                  <ProfileCard
                    organization={previewOrg}
                    products={previewProducts}
                    preview
                  />
                </aside>
                <main className="flex min-w-0 flex-1 flex-col md:min-h-0 md:overflow-y-auto md:py-10">
                  {isPreviewSpaceEmpty ? (
                    <div className="py-10">
                      <SpaceEmptyHero onAddToSpace={openEditorAtPicker} />
                    </div>
                  ) : (
                    <Storefront
                      organization={previewOrg}
                      products={previewProducts}
                      forms={previewForms}
                      preview
                    />
                  )}
                </main>
              </div>
            </div>
          ) : (
            /* Mobile preview — iPhone-shaped frame. Same components,
               but the .mobile-frame-scroll CSS overrides collapse the
               public layout to its mobile rendering. */
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-6">
              <MobilePreviewFrame>
                <div className="mp-page-wrap">
                  <div className="flex flex-col gap-8 md:flex-row md:gap-12">
                    <aside
                      data-profile-card
                      className="w-full shrink-0 md:sticky md:top-8 md:w-[420px] md:self-start"
                    >
                      <ProfileCard
                        organization={previewOrg}
                        products={previewProducts}
                        preview
                      />
                    </aside>
                    <main className="flex min-w-0 flex-1 flex-col">
                      <div className="flex h-full grow flex-col">
                        {isPreviewSpaceEmpty ? (
                          <SpaceEmptyHero
                            onAddToSpace={openEditorAtPicker}
                          />
                        ) : (
                          <Storefront
                            organization={previewOrg}
                            products={previewProducts}
                            forms={previewForms}
                            preview
                          />
                        )}
                      </div>
                    </main>
                  </div>
                </div>
              </MobilePreviewFrame>
            </div>
          )}
        </div>
      </>
    )
  }

  // ── Editor mode — single-canvas WYSIWYG ─────────────────────────
  // Toolbar (back / status / settings / publish) sticks to the top.
  // Canvas renders the EditableProfileCard (left, sticky) + the
  // DraggableBlocks product/links grid (right). Both subscribe to form
  // state directly. The Settings / Arrange / Links panels slide in
  // from the right; a floating "+ Add to Space" FAB opens the picker.

  const handleBack = () => {
    if (!confirmIfDirty()) return
    if (isSpaceEnabled) {
      setIsEditing(false)
    } else {
      router.push(`/dashboard/${organization.slug}`)
    }
  }

  const discardChanges = () => {
    if (
      !window.confirm(
        'Discard all unpublished edits and revert to the published version?',
      )
    ) {
      return
    }
    // form.reset() with no args reverts to the most-recent defaults,
    // which handlePublish updates after every successful publish — so
    // we revert to what's actually published right now, not to the
    // (potentially stale) SSR'd organization prop.
    form.reset()
    setArrangeOpen(false)
    setLinksMode(false)
    setPickerOpen(false)
    toast({
      title: 'Changes discarded',
      description: 'Your Space is back to its last published state.',
    })
  }

  return (
    <Form {...form}>
      <ForceLightMode />
      <div
        className={cn('spaire-editor spaire-editor-root', dark && 'space-dark')}
      >
        {/* ── Chrome: course-editor top bar + tabs ──────────────────
            The whole editor root carries `.space-dark` when the Space theme is
            dark, so the chrome AND the storefront canvas preview the published
            dark theme together. */}
        <div className="flex flex-shrink-0 flex-col">
          <div className="relative z-10 grid h-12 grid-cols-[1fr_auto_1fr] items-center border-b border-gray-200 bg-gray-50/85 px-5 backdrop-blur">
            <div className="flex items-center">
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-0.5 py-1 text-[13px] tracking-tight text-[#0066cc] transition-opacity hover:opacity-70"
              >
                <ChevronLeftOutlined sx={{ fontSize: 16 }} />
                Dashboard
              </button>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-[13px] font-semibold tracking-tight text-gray-900">
                {organization.name || 'Your Space'}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    isDirty
                      ? 'bg-amber-500'
                      : isSpaceEnabled
                        ? 'bg-emerald-500'
                        : 'bg-gray-400',
                  )}
                />
                {isDirty ? 'Unsaved' : isSpaceEnabled ? 'Published' : 'Draft'}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              {activeTab === 'storefront' && (
                <button
                  type="button"
                  onClick={() => setArrangeOpen((o) => !o)}
                  aria-pressed={arrangeOpen}
                  className={cn(
                    'rounded-full px-3 py-[5px] text-xs font-medium tracking-tight transition-colors',
                    arrangeOpen
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100',
                  )}
                >
                  Arrange
                </button>
              )}
              {isDirty && (
                <button
                  type="button"
                  onClick={discardChanges}
                  className="rounded-full px-3 py-[5px] text-xs font-medium tracking-tight text-gray-500 transition-colors hover:bg-gray-100"
                >
                  Discard
                </button>
              )}
              <button
                type="button"
                onClick={toggleDark}
                aria-label={
                  dark ? 'Switch to light mode' : 'Switch to dark mode'
                }
                title={dark ? 'Light mode' : 'Dark mode'}
                className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                {dark ? (
                  <LightModeOutlined sx={{ fontSize: 17 }} />
                ) : (
                  <DarkModeOutlined sx={{ fontSize: 17 }} />
                )}
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={!isDirty || publishing}
                className="flex items-center gap-1 rounded-full bg-[#0066cc] px-3.5 py-[5px] text-xs font-medium tracking-tight text-white transition-[filter] hover:brightness-110 disabled:cursor-default disabled:opacity-40"
              >
                {publishing ? 'Publishing…' : isDirty ? 'Publish' : 'Published'}
              </button>
            </div>
          </div>

          {/* Tabs — Storefront · Settings */}
          <div className="flex flex-shrink-0 items-center justify-center border-b border-gray-200 bg-white">
            {(['storefront', 'settings'] as const).map((tab) => {
              const active = tab === activeTab
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    '-mb-px border-b-2 px-4 py-2.5 text-[13px] capitalize tracking-tight transition-colors',
                    active
                      ? 'border-[#0066cc] font-medium text-[#0066cc]'
                      : 'border-transparent text-gray-500 hover:text-gray-900',
                  )}
                >
                  {tab}
                </button>
              )
            })}
          </div>
        </div>

        {activeTab === 'storefront' ? (
          <>
            {/* Canvas — ProfileCard + Storefront content blocks */}
            <SpaceEditorCanvas
              organization={organization}
              hasSettingsPanel={linksMode || arrangeOpen}
              onAddToSpace={() => setPickerOpen(true)}
            />

            {/* Arrange panel — single source of truth for reordering
                every item in the Space (products, categories, links). */}
            {arrangeOpen && (
              <aside
                className="side-panel open"
                style={{ width: 'min(440px, 100vw)' }}
                aria-label="Arrange items"
              >
                <ArrangePanel
                  organization={organization}
                  products={(storefrontData?.products ?? []) as schemas['ProductStorefront'][]}
                  forms={
                    ((storefrontData as { forms?: FormPublic[] } | undefined)
                      ?.forms ?? []) as FormPublic[]
                  }
                  onClose={() => setArrangeOpen(false)}
                />
              </aside>
            )}

            {/* Manage Links side panel — opens from the Settings tab's
                "Manage links" button. */}
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

            {/* Floating Add-to-Space FAB — hidden when the canvas is
                fully empty (the SpaceEmptyHero shows its own CTA). */}
            {(() => {
              const liveSettings = (form.watch('storefront_settings') as
                | {
                    featured_product_ids?: string[]
                    storefront_links?: unknown[]
                    featured_mode?: 'all' | 'curated'
                  }
                | undefined) ?? {}
              const featuredMode = liveSettings.featured_mode ?? 'curated'
              const featuredIds = liveSettings.featured_product_ids ?? []
              const visibleProductCount =
                featuredMode === 'curated'
                  ? featuredIds.length
                  : storefrontData?.products?.length ?? 0
              const linkCount = liveSettings.storefront_links?.length ?? 0
              if (visibleProductCount === 0 && linkCount === 0) return null
              return (
                <div
                  className={`add-fab-wrap${linksMode || arrangeOpen ? ' has-panel' : ''}`}
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
              )
            })()}

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
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SpaceSettingsTab
              organization={organization}
              dark={dark}
              onOpenLinks={() => {
                setActiveTab('storefront')
                setLinksMode(true)
              }}
            />
          </div>
        )}
      </div>
    </Form>
  )
}
