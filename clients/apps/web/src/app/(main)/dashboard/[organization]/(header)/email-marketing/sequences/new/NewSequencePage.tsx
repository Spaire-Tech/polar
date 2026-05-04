'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useCreateEmailSequence } from '@/hooks/queries/emailMarketing'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import { Input } from '@spaire/ui/components/atoms/Input'
import { Label } from '@spaire/ui/components/ui/label'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const TRIGGER_OPTIONS = [
  {
    value: 'on_subscribe',
    label: 'On subscribe',
    description: 'Triggered when someone joins your list',
  },
  {
    value: 'on_purchase',
    label: 'On purchase',
    description: 'Triggered when someone buys a product',
  },
  {
    value: 'on_subscription_created',
    label: 'On subscription created',
    description: 'Triggered when a subscription starts',
  },
  {
    value: 'on_subscription_cancelled',
    label: 'On subscription cancelled',
    description: 'Triggered when a subscription is cancelled',
  },
  {
    value: 'manual',
    label: 'Manual',
    description: 'Enroll subscribers manually via API or dashboard',
  },
]

export default function NewSequencePage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState('on_subscribe')

  const createSequence = useCreateEmailSequence(organization.id)
  const base = `/dashboard/${organization.slug}/email-marketing/sequences`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const result = await createSequence.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
      trigger_type: triggerType,
      trigger_config: {},
    })

    const created = (result as any)?.data
    if (created?.id) {
      router.push(`${base}/${created.id}`)
    } else {
      router.push(base)
    }
  }

  return (
    <DashboardBody title="New Sequence">
      <div className="flex flex-col gap-y-6">
        <div>
          <Link
            href={base}
            className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700"
          >
            <ArrowBackOutlined fontSize="small" />
            Back to Sequences
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Welcome series"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short description of what this sequence does"
              rows={2}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-2">
            <Label>Trigger</Label>
            <div className="flex flex-col gap-2">
              {TRIGGER_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                    triggerType === opt.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="trigger"
                    value={opt.value}
                    checked={triggerType === opt.value}
                    onChange={() => setTriggerType(opt.value)}
                    className="mt-0.5 accent-blue-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {opt.label}
                    </p>
                    <p className="text-xs text-gray-400">{opt.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={!name.trim() || createSequence.isPending}
            >
              {createSequence.isPending ? 'Creating…' : 'Create Sequence'}
            </Button>
            <Link href={base}>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </DashboardBody>
  )
}
