'use client'

import { toast } from '@/components/Toast/use-toast'
import { useUpdateBioBlock } from '@/hooks/queries'
import { useProducts } from '@/hooks/queries/products'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import Button from '@spaire/ui/components/atoms/Button'
import Input from '@spaire/ui/components/atoms/Input'
import { useMemo, useState } from 'react'
import { BioBlock, LinksBlockItem } from './types'

export const BioBlockEditor = ({
  block,
  organizationId,
  onClose,
  onSaved,
}: {
  block: BioBlock
  organizationId: string
  onClose: () => void
  onSaved: () => void
}) => {
  const [settings, setSettings] = useState<Record<string, unknown>>(
    block.settings ?? {},
  )
  const [saving, setSaving] = useState(false)
  const updateBlock = useUpdateBioBlock(organizationId)

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      await updateBlock.mutateAsync({
        id: block.id,
        body: { settings },
      })
      toast({ title: 'Block saved' })
      onSaved()
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-row items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="text-[14px] text-gray-500 transition-colors hover:text-gray-700"
        >
          &larr; Back
        </button>
        <h2 className="text-sm font-semibold capitalize text-gray-900">
          {block.type.replace('_', ' ')}
        </h2>
        <Button
          size="sm"
          className="rounded-full px-4"
          type="button"
          onClick={handleSave}
          loading={saving}
        >
          Save
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        {block.type === 'links' && (
          <LinksEditor
            settings={settings as LinksSettingsShape}
            onChange={setSettings as (s: LinksSettingsShape) => void}
          />
        )}
        {block.type === 'product' && (
          <ProductEditor
            organizationId={organizationId}
            settings={settings as { product_id?: string }}
            onChange={setSettings as (s: { product_id?: string }) => void}
          />
        )}
        {block.type === 'video' && (
          <VideoEditor
            settings={settings as VideoSettingsShape}
            onChange={setSettings as (s: VideoSettingsShape) => void}
          />
        )}
        {block.type === 'booking' && (
          <BookingEditor
            settings={settings as BookingSettingsShape}
            onChange={setSettings as (s: BookingSettingsShape) => void}
          />
        )}
        {block.type === 'text' && (
          <TextEditor
            settings={settings as TextSettingsShape}
            onChange={setSettings as (s: TextSettingsShape) => void}
          />
        )}
        {block.type === 'newsletter' && (
          <NewsletterEditor
            settings={settings as NewsletterSettingsShape}
            onChange={setSettings as (s: NewsletterSettingsShape) => void}
          />
        )}
        {block.type === 'profile_header' && (
          <ProfileHeaderEditor
            settings={settings as ProfileHeaderSettingsShape}
            onChange={setSettings as (s: ProfileHeaderSettingsShape) => void}
          />
        )}
        {block.type === 'divider' && (
          <p className="text-sm text-gray-500">
            Dividers have no settings. They draw a horizontal line between
            blocks.
          </p>
        )}
      </div>
    </div>
  )
}

type LinksSettingsShape = {
  heading?: string | null
  items?: LinksBlockItem[]
}

const LinksEditor = ({
  settings,
  onChange,
}: {
  settings: LinksSettingsShape
  onChange: (s: LinksSettingsShape) => void
}) => {
  const items = settings.items ?? []

  const addItem = () => {
    onChange({
      ...settings,
      items: [
        ...items,
        {
          id: crypto.randomUUID(),
          label: '',
          url: '',
          subtitle: null,
          logo_url: null,
          logo_file_id: null,
          cta: null,
        },
      ],
    })
  }

  const updateItem = (index: number, patch: Partial<LinksBlockItem>) => {
    const next = items.slice()
    next[index] = { ...next[index], ...patch }
    onChange({ ...settings, items: next })
  }

  const removeItem = (index: number) => {
    onChange({ ...settings, items: items.filter((_, i) => i !== index) })
  }

  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-700">Heading</span>
        <Input
          value={settings.heading ?? ''}
          placeholder="e.g. My Links"
          onChange={(e) =>
            onChange({ ...settings, heading: e.target.value || null })
          }
        />
      </label>

      <div className="flex flex-col gap-3">
        <div className="flex flex-row items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Links</h3>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <AddOutlined className="h-4 w-4" />
            Add link
          </button>
        </div>
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-500">
            No links yet.
          </p>
        )}
        {items.map((item, i) => (
          <div
            key={item.id}
            className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3"
          >
            <div className="flex flex-row items-center justify-between">
              <span className="text-xs font-medium text-gray-500">
                Link {i + 1}
              </span>
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="text-gray-400 transition-colors hover:text-red-500"
                aria-label="Remove link"
              >
                <DeleteOutline className="h-4 w-4" />
              </button>
            </div>
            <Input
              value={item.label}
              placeholder="Label"
              onChange={(e) => updateItem(i, { label: e.target.value })}
            />
            <Input
              value={item.url}
              placeholder="https://…"
              onChange={(e) => updateItem(i, { url: e.target.value })}
            />
            <Input
              value={item.subtitle ?? ''}
              placeholder="Subtitle (optional)"
              onChange={(e) =>
                updateItem(i, { subtitle: e.target.value || null })
              }
            />
            <Input
              value={item.logo_url ?? ''}
              placeholder="Logo URL (optional)"
              onChange={(e) =>
                updateItem(i, { logo_url: e.target.value || null })
              }
            />
          </div>
        ))}
      </div>
    </>
  )
}

const ProductEditor = ({
  organizationId,
  settings,
  onChange,
}: {
  organizationId: string
  settings: { product_id?: string }
  onChange: (s: { product_id?: string }) => void
}) => {
  const { data } = useProducts(organizationId, { is_archived: false })
  const products = data?.items ?? []
  const selected = useMemo(
    () => products.find((p) => p.id === settings.product_id),
    [products, settings.product_id],
  )
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-700">Product</span>
        <select
          value={settings.product_id ?? ''}
          onChange={(e) => onChange({ ...settings, product_id: e.target.value })}
          className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
        >
          <option value="">Select a product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <p className="text-xs text-gray-500">
          Linked to {selected.name}. The block will display its name, first
          media and description.
        </p>
      )}
    </div>
  )
}

type VideoSettingsShape = {
  url?: string
  heading?: string | null
  thumbnail_url?: string | null
}

const VideoEditor = ({
  settings,
  onChange,
}: {
  settings: VideoSettingsShape
  onChange: (s: VideoSettingsShape) => void
}) => (
  <div className="flex flex-col gap-3">
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-700">Heading</span>
      <Input
        value={settings.heading ?? ''}
        placeholder="Optional"
        onChange={(e) =>
          onChange({ ...settings, heading: e.target.value || null })
        }
      />
    </label>
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-700">Video URL</span>
      <Input
        value={settings.url ?? ''}
        placeholder="https://www.youtube.com/watch?v=…"
        onChange={(e) => onChange({ ...settings, url: e.target.value })}
      />
    </label>
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-700">Thumbnail URL</span>
      <Input
        value={settings.thumbnail_url ?? ''}
        placeholder="Optional fallback image"
        onChange={(e) =>
          onChange({ ...settings, thumbnail_url: e.target.value || null })
        }
      />
    </label>
  </div>
)

type BookingSettingsShape = {
  url?: string
  heading?: string | null
  subtitle?: string | null
}

const BookingEditor = ({
  settings,
  onChange,
}: {
  settings: BookingSettingsShape
  onChange: (s: BookingSettingsShape) => void
}) => (
  <div className="flex flex-col gap-3">
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-700">Heading</span>
      <Input
        value={settings.heading ?? ''}
        placeholder="Book a call"
        onChange={(e) =>
          onChange({ ...settings, heading: e.target.value || null })
        }
      />
    </label>
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-700">Subtitle</span>
      <Input
        value={settings.subtitle ?? ''}
        placeholder="30 minute chat"
        onChange={(e) =>
          onChange({ ...settings, subtitle: e.target.value || null })
        }
      />
    </label>
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-700">Scheduler URL</span>
      <Input
        value={settings.url ?? ''}
        placeholder="https://cal.com/your-handle"
        onChange={(e) => onChange({ ...settings, url: e.target.value })}
      />
    </label>
  </div>
)

type TextSettingsShape = {
  heading?: string | null
  body?: string | null
  align?: 'left' | 'center'
}

const TextEditor = ({
  settings,
  onChange,
}: {
  settings: TextSettingsShape
  onChange: (s: TextSettingsShape) => void
}) => (
  <div className="flex flex-col gap-3">
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-700">Heading</span>
      <Input
        value={settings.heading ?? ''}
        placeholder="Optional"
        onChange={(e) =>
          onChange({ ...settings, heading: e.target.value || null })
        }
      />
    </label>
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-700">Body</span>
      <textarea
        value={settings.body ?? ''}
        placeholder="Write something"
        className="min-h-[120px] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
        onChange={(e) =>
          onChange({ ...settings, body: e.target.value || null })
        }
      />
    </label>
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-gray-700">Alignment</span>
      <div className="flex flex-row gap-2">
        {(['left', 'center'] as const).map((align) => {
          const active = (settings.align ?? 'left') === align
          return (
            <button
              key={align}
              type="button"
              onClick={() => onChange({ ...settings, align })}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                active
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              {align}
            </button>
          )
        })}
      </div>
    </div>
  </div>
)

type NewsletterSettingsShape = {
  heading?: string | null
  description?: string | null
}

const NewsletterEditor = ({
  settings,
  onChange,
}: {
  settings: NewsletterSettingsShape
  onChange: (s: NewsletterSettingsShape) => void
}) => (
  <div className="flex flex-col gap-3">
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-700">Heading</span>
      <Input
        value={settings.heading ?? ''}
        placeholder="Subscribe"
        onChange={(e) =>
          onChange({ ...settings, heading: e.target.value || null })
        }
      />
    </label>
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-700">Description</span>
      <Input
        value={settings.description ?? ''}
        placeholder="Get updates"
        onChange={(e) =>
          onChange({ ...settings, description: e.target.value || null })
        }
      />
    </label>
  </div>
)

type ProfileHeaderSettingsShape = {
  heading?: string | null
  show_socials?: boolean
}

const ProfileHeaderEditor = ({
  settings,
  onChange,
}: {
  settings: ProfileHeaderSettingsShape
  onChange: (s: ProfileHeaderSettingsShape) => void
}) => (
  <div className="flex flex-col gap-4">
    <p className="text-xs text-gray-500">
      Profile header uses your organization name, avatar, display title, short
      bio and social links (managed in Profile and Settings).
    </p>
    <label className="flex flex-row items-center justify-between">
      <span className="text-sm text-gray-900">Show social icons</span>
      <input
        type="checkbox"
        checked={settings.show_socials ?? true}
        onChange={(e) =>
          onChange({ ...settings, show_socials: e.target.checked })
        }
      />
    </label>
  </div>
)
