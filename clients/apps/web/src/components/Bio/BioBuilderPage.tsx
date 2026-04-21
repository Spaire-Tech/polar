'use client'

import { ForceLightMode } from '@/components/Profile/ForceLightMode'
import { toast } from '@/components/Toast/use-toast'
import {
  useBioBlocks,
  useCreateBioBlock,
  useDeleteBioBlock,
  useUpdateBioBlock,
  useUpdateBioSettings,
} from '@/hooks/queries'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import DragIndicator from '@mui/icons-material/DragIndicator'
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import Input from '@spaire/ui/components/atoms/Input'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { BioProfile } from './BioProfile'
import { BioBlockEditor } from './BioBlockEditor'
import {
  BioBlock,
  BioBlockType,
  BioOrganizationLite,
} from './types'

const BLOCK_LIBRARY: {
  type: BioBlockType
  label: string
  description: string
  defaultSettings: Record<string, unknown>
}[] = [
  {
    type: 'profile_header',
    label: 'Profile',
    description: 'Avatar, name, bio and socials.',
    defaultSettings: { show_socials: true },
  },
  {
    type: 'links',
    label: 'Links',
    description: 'A list of external links.',
    defaultSettings: { heading: null, items: [] },
  },
  {
    type: 'product',
    label: 'Product',
    description: 'A featured Space product.',
    defaultSettings: { product_id: '', layout: 'row' },
  },
  {
    type: 'video',
    label: 'Video',
    description: 'YouTube or Vimeo embed.',
    defaultSettings: { url: '', heading: null },
  },
  {
    type: 'booking',
    label: 'Booking',
    description: 'Link to your Cal.com (or any) scheduler.',
    defaultSettings: { url: '', heading: 'Book a call' },
  },
  {
    type: 'text',
    label: 'Text',
    description: 'A simple heading and paragraph.',
    defaultSettings: { heading: null, body: '', align: 'left' },
  },
  {
    type: 'newsletter',
    label: 'Newsletter',
    description: 'Collect email subscribers.',
    defaultSettings: { heading: null, description: null },
  },
  {
    type: 'divider',
    label: 'Divider',
    description: 'Visual separator.',
    defaultSettings: {},
  },
]

type BioSettings = NonNullable<BioOrganizationLite['bio_settings']>

const toOrganizationLite = (
  org: schemas['Organization'],
  settings: BioSettings,
): BioOrganizationLite => ({
  id: org.id,
  slug: org.slug,
  name: org.name,
  avatar_url: org.avatar_url,
  socials: (org.socials ?? []) as BioOrganizationLite['socials'],
  bio_settings: settings,
})

export const BioBuilderPage = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const router = useRouter()
  const { data: blocks = [] } = useBioBlocks(organization.id)

  const organizationBioSettings =
    (organization as unknown as { bio_settings?: BioSettings }).bio_settings ??
    undefined
  const initialSettings: BioSettings = useMemo(
    () =>
      organizationBioSettings ?? {
        enabled: false,
        avatar_shape: 'circle',
        show_powered_by: true,
      },
    [organizationBioSettings],
  )

  const [settings, setSettings] = useState<BioSettings>(initialSettings)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)

  const createBlock = useCreateBioBlock(organization.id)
  const updateBlock = useUpdateBioBlock(organization.id)
  const deleteBlock = useDeleteBioBlock(organization.id)
  const updateSettings = useUpdateBioSettings(organization.id)

  const organizationLite = toOrganizationLite(organization, settings)

  const orderedBlocks = useMemo(
    () => [...blocks].sort((a, b) => a.order - b.order),
    [blocks],
  )

  const editingBlock = orderedBlocks.find((b) => b.id === editingBlockId) ?? null

  const handleAddBlock = async (type: BioBlockType) => {
    const def = BLOCK_LIBRARY.find((b) => b.type === type)
    if (!def) return
    const nextOrder = orderedBlocks.length
    try {
      const created = await createBlock.mutateAsync({
        type,
        enabled: true,
        order: nextOrder,
        settings: def.defaultSettings,
      })
      setEditingBlockId(created.id)
    } catch (e) {
      toast({
        title: 'Could not add block',
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  const handleToggleBlock = async (block: BioBlock) => {
    await updateBlock.mutateAsync({
      id: block.id,
      body: { enabled: !block.enabled },
    })
  }

  const handleDeleteBlock = async (block: BioBlock) => {
    await deleteBlock.mutateAsync(block.id)
    if (editingBlockId === block.id) setEditingBlockId(null)
  }

  const handlePublish = async () => {
    if (publishing) return
    setPublishing(true)
    try {
      await updateSettings.mutateAsync(settings)
      toast({
        title: 'Bio updated',
        description: 'Your changes are now live.',
      })
    } catch (e) {
      toast({
        title: 'Publish failed',
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setPublishing(false)
    }
  }

  return (
    <>
      <ForceLightMode />
      <div className="flex h-full flex-col bg-gray-50">
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
              href={`https://bio.spairehq.com/${organization.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-5 py-2 text-[14px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Visit Bio
              <OpenInNewOutlined className="h-4 w-4" />
            </a>
            <Button
              className="rounded-full px-6"
              type="button"
              onClick={handlePublish}
              loading={publishing}
            >
              Publish
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 grow flex-row overflow-hidden">
          <div className="hidden flex-1 flex-col items-center overflow-y-auto bg-gray-50 p-10 md:flex">
            <div className="w-full max-w-[460px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <BioProfile
                organization={organizationLite}
                blocks={orderedBlocks}
              />
            </div>
          </div>

          <div className="w-full shrink-0 overflow-y-auto border-l border-gray-200 bg-white shadow-sm md:w-[700px]">
            {editingBlock ? (
              <BioBlockEditor
                block={editingBlock}
                organizationId={organization.id}
                onClose={() => setEditingBlockId(null)}
                onSaved={() => setEditingBlockId(null)}
              />
            ) : (
              <div className="flex flex-col gap-8 p-8">
                <BioEnabledToggle
                  settings={settings}
                  onChange={setSettings}
                />
                <BioProfileSettingsForm
                  settings={settings}
                  onChange={setSettings}
                />
                <BioBlocksList
                  blocks={orderedBlocks}
                  onEdit={(b) => setEditingBlockId(b.id)}
                  onToggle={handleToggleBlock}
                  onDelete={handleDeleteBlock}
                />
                <BioBlockLibrary onAdd={handleAddBlock} />
                <BioNewsletterSettings
                  settings={settings}
                  onChange={setSettings}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

const BioEnabledToggle = ({
  settings,
  onChange,
}: {
  settings: BioSettings
  onChange: (s: BioSettings) => void
}) => (
  <section className="flex flex-row items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
    <div className="flex flex-col">
      <h3 className="text-sm font-semibold text-gray-900">Bio enabled</h3>
      <p className="text-xs text-gray-500">
        Publish your page at bio.spairehq.com/{`{slug}`}.
      </p>
    </div>
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={!!settings.enabled}
        onChange={(e) =>
          onChange({ ...settings, enabled: e.target.checked })
        }
      />
      <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-gray-900 peer-checked:after:translate-x-5" />
    </label>
  </section>
)

const BioProfileSettingsForm = ({
  settings,
  onChange,
}: {
  settings: BioSettings
  onChange: (s: BioSettings) => void
}) => (
  <section className="flex flex-col gap-4">
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold text-gray-900">Profile</h3>
      <p className="text-xs text-gray-500">
        Title, short bio, and avatar shape.
      </p>
    </div>
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-700">Display title</span>
      <Input
        value={settings.display_title ?? ''}
        maxLength={80}
        placeholder="e.g. Designer & Developer"
        onChange={(e) =>
          onChange({ ...settings, display_title: e.target.value || null })
        }
      />
    </label>
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-700">Short bio</span>
      <textarea
        className="min-h-[88px] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
        value={settings.short_bio ?? ''}
        maxLength={280}
        placeholder="A sentence or two about you"
        onChange={(e) =>
          onChange({ ...settings, short_bio: e.target.value || null })
        }
      />
    </label>
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-gray-700">Avatar shape</span>
      <div className="flex flex-row gap-2">
        {(['circle', 'rounded'] as const).map((shape) => {
          const active = (settings.avatar_shape ?? 'circle') === shape
          return (
            <button
              key={shape}
              type="button"
              onClick={() => onChange({ ...settings, avatar_shape: shape })}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                active
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              {shape}
            </button>
          )
        })}
      </div>
    </div>
  </section>
)

const BioBlocksList = ({
  blocks,
  onEdit,
  onToggle,
  onDelete,
}: {
  blocks: BioBlock[]
  onEdit: (b: BioBlock) => void
  onToggle: (b: BioBlock) => void
  onDelete: (b: BioBlock) => void
}) => (
  <section className="flex flex-col gap-3">
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold text-gray-900">Blocks</h3>
      <p className="text-xs text-gray-500">
        Drag to reorder. Click a block to edit it.
      </p>
    </div>
    {blocks.length === 0 ? (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-gray-500">
          No blocks yet. Add one below.
        </p>
      </div>
    ) : (
      <ul className="flex flex-col gap-2">
        {blocks.map((block) => (
          <li
            key={block.id}
            className="flex flex-row items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2"
          >
            <DragIndicator className="h-5 w-5 shrink-0 text-gray-300" />
            <button
              type="button"
              onClick={() => onEdit(block)}
              className="flex min-w-0 flex-1 flex-col text-left"
            >
              <span className="truncate text-sm font-medium text-gray-900 capitalize">
                {block.type.replace('_', ' ')}
              </span>
              <span className="truncate text-xs text-gray-500">
                {summarizeBlock(block)}
              </span>
            </button>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={block.enabled}
                onChange={() => onToggle(block)}
              />
              <div className="h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-gray-900 peer-checked:after:translate-x-4" />
            </label>
            <button
              type="button"
              onClick={() => onDelete(block)}
              className="text-gray-400 transition-colors hover:text-red-500"
              aria-label="Delete block"
            >
              <DeleteOutline className="h-5 w-5" />
            </button>
          </li>
        ))}
      </ul>
    )}
  </section>
)

const summarizeBlock = (block: BioBlock): string => {
  const s = block.settings ?? {}
  if (block.type === 'links') {
    const count = Array.isArray((s as { items?: unknown[] }).items)
      ? ((s as { items: unknown[] }).items).length
      : 0
    return `${count} link${count === 1 ? '' : 's'}`
  }
  if (block.type === 'text') {
    return (
      (s as { heading?: string }).heading ||
      (s as { body?: string }).body ||
      'Text block'
    )
  }
  if (block.type === 'video') {
    return (s as { url?: string }).url || 'No URL set'
  }
  if (block.type === 'booking') {
    return (s as { url?: string }).url || 'No URL set'
  }
  if (block.type === 'product') {
    return (s as { product_id?: string }).product_id
      ? `Product ${(s as { product_id: string }).product_id.slice(0, 8)}…`
      : 'No product selected'
  }
  if (block.type === 'profile_header') return 'Name, bio, socials'
  if (block.type === 'newsletter') return 'Email capture'
  if (block.type === 'divider') return 'Divider'
  return ''
}

const BioBlockLibrary = ({
  onAdd,
}: {
  onAdd: (type: BioBlockType) => void
}) => (
  <section className="flex flex-col gap-3">
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold text-gray-900">Add a block</h3>
      <p className="text-xs text-gray-500">
        Start with links, or get creative.
      </p>
    </div>
    <div className="grid grid-cols-2 gap-2">
      {BLOCK_LIBRARY.map((def) => (
        <button
          key={def.type}
          type="button"
          onClick={() => onAdd(def.type)}
          className="flex flex-col items-start gap-1 rounded-xl border border-gray-200 bg-white p-3 text-left transition-colors hover:border-gray-400"
        >
          <div className="flex flex-row items-center gap-2">
            <AddOutlined className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-900">
              {def.label}
            </span>
          </div>
          <span className="text-xs text-gray-500">{def.description}</span>
        </button>
      ))}
    </div>
  </section>
)

const BioNewsletterSettings = ({
  settings,
  onChange,
}: {
  settings: BioSettings
  onChange: (s: BioSettings) => void
}) => (
  <section className="flex flex-col gap-4">
    <div className="flex flex-row items-center justify-between">
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold text-gray-900">Newsletter</h3>
        <p className="text-xs text-gray-500">
          Collect email subscribers on your page.
        </p>
      </div>
      <label className="relative inline-flex cursor-pointer items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={!!settings.newsletter_enabled}
          onChange={(e) =>
            onChange({ ...settings, newsletter_enabled: e.target.checked })
          }
        />
        <div className="h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-gray-900 peer-checked:after:translate-x-4" />
      </label>
    </div>
    {settings.newsletter_enabled && (
      <>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-700">Heading</span>
          <Input
            value={settings.newsletter_heading ?? ''}
            maxLength={80}
            placeholder="Subscribe to the newsletter"
            onChange={(e) =>
              onChange({
                ...settings,
                newsletter_heading: e.target.value || null,
              })
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-700">Description</span>
          <Input
            value={settings.newsletter_description ?? ''}
            maxLength={200}
            placeholder="Get updates in your inbox"
            onChange={(e) =>
              onChange({
                ...settings,
                newsletter_description: e.target.value || null,
              })
            }
          />
        </label>
      </>
    )}
  </section>
)
