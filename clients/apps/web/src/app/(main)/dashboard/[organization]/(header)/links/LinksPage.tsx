'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal, InlineModalHeader } from '@/components/Modal/InlineModal'
import { toast } from '@/components/Toast/use-toast'
import { useUpdateOrganization } from '@/hooks/queries'
import {
  OrganizationLink,
  useCreateOrganizationLink,
  useDeleteOrganizationLink,
  useOrganizationLinks,
  useReorderOrganizationLinks,
  useUpdateOrganizationLink,
} from '@/hooks/queries/organizationLinks'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowDownwardOutlined from '@mui/icons-material/ArrowDownwardOutlined'
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import EditOutlined from '@mui/icons-material/EditOutlined'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import Input from '@spaire/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@spaire/ui/components/atoms/Select'
import Switch from '@spaire/ui/components/atoms/Switch'
import { ChangeEvent, useMemo, useState } from 'react'

const ICON_OPTIONS = [
  { value: 'link', label: 'Link' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'email', label: 'Email' },
  { value: 'document', label: 'Document' },
  { value: 'video', label: 'Video' },
  { value: 'shop', label: 'Shop' },
]

interface LinkFormState {
  label: string
  url: string
  icon: string
  description: string
  button_label: string
  enabled: boolean
}

const emptyForm: LinkFormState = {
  label: '',
  url: '',
  icon: 'link',
  description: '',
  button_label: '',
  enabled: true,
}

const LinksPage = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const linksQuery = useOrganizationLinks(organization.id)
  const links = useMemo(() => linksQuery.data ?? [], [linksQuery.data])

  const createLink = useCreateOrganizationLink(organization.id)
  const updateLink = useUpdateOrganizationLink(organization.id)
  const deleteLink = useDeleteOrganizationLink(organization.id)
  const reorderLinks = useReorderOrganizationLinks(organization.id)
  const updateOrganization = useUpdateOrganization()

  const theme =
    (organization.storefront_settings as { theme?: string } | null)?.theme ??
    'light'

  const handleThemeChange = async (nextTheme: 'light' | 'dark') => {
    if (nextTheme === theme) return
    try {
      await updateOrganization.mutateAsync({
        id: organization.id,
        body: {
          storefront_settings: {
            ...(organization.storefront_settings ?? {}),
            theme: nextTheme,
          } as schemas['OrganizationStorefrontSettings'],
        },
      })
      toast({ title: `Theme set to ${nextTheme}` })
    } catch (e) {
      toast({ title: 'Failed to update theme' })
    }
  }

  const [showNewModal, setShowNewModal] = useState(false)
  const [editingLink, setEditingLink] = useState<OrganizationLink | null>(null)

  const handleCreate = async (form: LinkFormState) => {
    try {
      await createLink.mutateAsync({
        label: form.label,
        url: form.url,
        icon: form.icon,
        description: form.description.trim() || null,
        button_label: form.button_label.trim() || null,
        enabled: form.enabled,
      })
      toast({ title: 'Link created' })
      setShowNewModal(false)
    } catch (e) {
      toast({ title: 'Failed to create link' })
    }
  }

  const handleUpdate = async (id: string, form: LinkFormState) => {
    try {
      await updateLink.mutateAsync({
        id,
        body: {
          label: form.label,
          url: form.url,
          icon: form.icon,
          description: form.description.trim() || null,
          button_label: form.button_label.trim() || null,
          enabled: form.enabled,
        },
      })
      toast({ title: 'Link updated' })
      setEditingLink(null)
    } catch (e) {
      toast({ title: 'Failed to update link' })
    }
  }

  const handleDelete = async (link: OrganizationLink) => {
    if (!window.confirm(`Delete "${link.label}"?`)) return
    try {
      await deleteLink.mutateAsync(link.id)
      toast({ title: 'Link deleted' })
    } catch (e) {
      toast({ title: 'Failed to delete link' })
    }
  }

  const handleToggleEnabled = async (link: OrganizationLink) => {
    try {
      await updateLink.mutateAsync({
        id: link.id,
        body: { enabled: !link.enabled },
      })
    } catch (e) {
      toast({ title: 'Failed to update link' })
    }
  }

  const handleMove = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= links.length) return
    const newIds = links.map((l) => l.id)
    ;[newIds[index], newIds[target]] = [newIds[target], newIds[index]]
    try {
      await reorderLinks.mutateAsync(newIds)
    } catch (e) {
      toast({ title: 'Failed to reorder links' })
    }
  }

  return (
    <DashboardBody
      header={
        <div className="flex flex-row items-center gap-2">
          <div className="flex flex-row items-center rounded-xl border border-gray-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => handleThemeChange('light')}
              className={`rounded-lg px-3 py-1 text-xs font-medium ${
                theme === 'light'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => handleThemeChange('dark')}
              className={`rounded-lg px-3 py-1 text-xs font-medium ${
                theme === 'dark'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Dark
            </button>
          </div>
          <Button
            wrapperClassNames="flex flex-row gap-x-2"
            type="button"
            onClick={() => setShowNewModal(true)}
          >
            <AddOutlined className="h-4 w-4" />
            <span>New Link</span>
          </Button>
        </div>
      }
      wide
    >
      <div className="flex flex-col gap-4">
        {linksQuery.isLoading && (
          <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
        )}
        {!linksQuery.isLoading && links.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
            <LinkOutlined className="h-10 w-10 text-gray-300" />
            <h3 className="mt-4 text-base font-medium text-gray-900">
              No links yet
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Add custom call-to-action buttons to your storefront profile.
            </p>
            <Button
              className="mt-4"
              variant="secondary"
              onClick={() => setShowNewModal(true)}
            >
              Add your first link
            </Button>
          </div>
        )}
        {links.map((link, index) => (
          <div
            key={link.id}
            className="flex flex-row items-center gap-3 rounded-xl border border-gray-200 bg-white p-4"
          >
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => handleMove(index, -1)}
                disabled={index === 0}
                className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
                aria-label="Move up"
              >
                <ArrowUpwardOutlined className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleMove(index, 1)}
                disabled={index === links.length - 1}
                className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
                aria-label="Move down"
              >
                <ArrowDownwardOutlined className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-gray-900">
                {link.label}
              </span>
              <span className="truncate text-xs text-gray-500">{link.url}</span>
            </div>

            <div className="flex flex-row items-center gap-3">
              <Switch
                checked={link.enabled}
                onCheckedChange={() => handleToggleEnabled(link)}
              />
              <Button
                size="icon"
                variant="secondary"
                onClick={() => setEditingLink(link)}
                aria-label="Edit link"
              >
                <EditOutlined className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={() => handleDelete(link)}
                aria-label="Delete link"
              >
                <DeleteOutline className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <InlineModal
        isShown={showNewModal}
        hide={() => setShowNewModal(false)}
        modalContent={
          <LinkFormModal
            title="New Link"
            submitLabel="Create"
            initial={emptyForm}
            isSubmitting={createLink.isPending}
            onSubmit={handleCreate}
            onCancel={() => setShowNewModal(false)}
          />
        }
      />
      <InlineModal
        isShown={!!editingLink}
        hide={() => setEditingLink(null)}
        modalContent={
          editingLink ? (
            <LinkFormModal
              title="Edit Link"
              submitLabel="Save"
              initial={{
                label: editingLink.label,
                url: editingLink.url,
                icon: editingLink.icon ?? 'link',
                description: editingLink.description ?? '',
                button_label: editingLink.button_label ?? '',
                enabled: editingLink.enabled,
              }}
              isSubmitting={updateLink.isPending}
              onSubmit={(form) => handleUpdate(editingLink.id, form)}
              onCancel={() => setEditingLink(null)}
            />
          ) : (
            <></>
          )
        }
      />
    </DashboardBody>
  )
}

const LinkFormModal = ({
  title,
  submitLabel,
  initial,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  title: string
  submitLabel: string
  initial: LinkFormState
  isSubmitting: boolean
  onSubmit: (form: LinkFormState) => void
  onCancel: () => void
}) => {
  const [form, setForm] = useState<LinkFormState>(initial)

  const canSubmit =
    form.label.trim().length > 0 && form.url.trim().length > 0 && !isSubmitting

  return (
    <>
      <InlineModalHeader hide={onCancel}>
        <span>{title}</span>
      </InlineModalHeader>
      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-900">Label</label>
          <Input
            value={form.label}
            maxLength={80}
            placeholder="Book a call"
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setForm({ ...form, label: e.target.value })
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-900">URL</label>
          <Input
            value={form.url}
            placeholder="https://..."
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setForm({ ...form, url: e.target.value })
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-900">
            Description <span className="text-gray-400">(optional)</span>
          </label>
          <Input
            value={form.description}
            maxLength={200}
            placeholder="Short subtitle shown on the card"
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setForm({ ...form, description: e.target.value })
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-900">
            Button label <span className="text-gray-400">(optional)</span>
          </label>
          <Input
            value={form.button_label}
            maxLength={40}
            placeholder="View"
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setForm({ ...form, button_label: e.target.value })
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-900">Icon</label>
          <Select
            value={form.icon}
            onValueChange={(icon) => setForm({ ...form, icon })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ICON_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-row items-center gap-3">
          <Switch
            checked={form.enabled}
            onCheckedChange={(enabled) => setForm({ ...form, enabled })}
          />
          <span className="text-sm text-gray-700">
            Show on storefront profile
          </span>
        </div>
        <div className="flex flex-row justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            disabled={!canSubmit}
            loading={isSubmitting}
            onClick={() => onSubmit(form)}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </>
  )
}

export default LinksPage
