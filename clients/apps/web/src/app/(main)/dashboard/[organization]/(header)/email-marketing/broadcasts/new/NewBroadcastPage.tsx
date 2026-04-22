'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  useCreateEmailBroadcast,
  useEmailSegments,
} from '@/hooks/queries/emailMarketing'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import Input from '@spaire/ui/components/atoms/Input'
import { Label } from '@spaire/ui/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@spaire/ui/components/atoms/Select'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

export default function NewBroadcastPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const createBroadcast = useCreateEmailBroadcast(organization.id)
  const segmentsQuery = useEmailSegments(organization.id)
  const segments = segmentsQuery.data as any[] | undefined

  const [subject, setSubject] = useState('')
  const [senderName, setSenderName] = useState(organization.name)
  const [replyToEmail, setReplyToEmail] = useState('')
  const [contentHtml, setContentHtml] = useState('')
  const [segmentId, setSegmentId] = useState<string>('all')

  const handleCreate = useCallback(async () => {
    if (!subject.trim() || !senderName.trim()) return

    const result = await createBroadcast.mutateAsync({
      subject: subject.trim(),
      sender_name: senderName.trim(),
      reply_to_email: replyToEmail.trim() || undefined,
      content_html: contentHtml || undefined,
      segment_id: segmentId !== 'all' ? segmentId : undefined,
    })

    if (result.data) {
      router.push(
        `/dashboard/${organization.slug}/email-marketing/broadcasts/${result.data.id}`,
      )
    }
  }, [subject, senderName, replyToEmail, contentHtml, segmentId, createBroadcast, router, organization.slug])

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-8">
        {/* Header */}
        <div className="flex flex-row items-center gap-4">
          <Link
            href={`/dashboard/${organization.slug}/email-marketing/broadcasts`}
            className=" text-gray-500 transition-colors hover:text-gray-700"
          >
            <ArrowBackOutlined fontSize="small" />
          </Link>
          <h1 className="text-2xl font-medium">New Broadcast</h1>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-y-6">
          {/* Info section */}
          <div className=" flex flex-col gap-y-5 rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-base font-medium">Email Details</h2>

            <div className="flex flex-col gap-y-2">
              <Label>Subject line</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Your weekly update"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-y-2">
                <Label>Sender name</Label>
                <Input
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder={organization.name}
                />
              </div>
              <div className="flex flex-col gap-y-2">
                <Label>Reply-to email (optional)</Label>
                <Input
                  value={replyToEmail}
                  onChange={(e) => setReplyToEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {/* Segment selector */}
            <div className="flex flex-col gap-y-2">
              <Label>Send to</Label>
              <Select value={segmentId} onValueChange={setSegmentId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="All subscribers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All active subscribers</SelectItem>
                  {segments?.map((seg: any) => (
                    <SelectItem key={seg.id} value={seg.id}>
                      {seg.name} ({seg.subscriber_count.toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className=" text-xs text-gray-400">
                Choose a segment to target specific subscribers, or send to all.
              </p>
            </div>

            <p className=" text-xs text-gray-400">
              Emails will be sent from{' '}
              <span className="font-medium">noreply@notifications.spairehq.com</span>.
              Custom sending domains are coming soon.
            </p>
          </div>

          {/* Content section */}
          <div className=" flex flex-col gap-y-5 rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-base font-medium">Content</h2>
            <p className=" text-xs text-gray-400">
              Write your email content in HTML. A rich editor is coming soon.
            </p>
            <textarea
              className="  min-h-[300px] w-full rounded-xl border border-gray-200 bg-white p-4 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={contentHtml}
              onChange={(e) => setContentHtml(e.target.value)}
              placeholder="<h1>Hello!</h1>
<p>We just launched something new...</p>"
            />
          </div>

          {/* Preview */}
          {contentHtml && (
            <div className=" flex flex-col gap-y-3 rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-base font-medium">Preview</h2>
              <div
                className=" rounded-xl border border-gray-100 p-6"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-row items-center gap-3">
            <Button
              onClick={handleCreate}
              loading={createBroadcast.isPending}
              disabled={!subject.trim() || !senderName.trim()}
            >
              Save as draft
            </Button>
            <Link href={`/dashboard/${organization.slug}/email-marketing/broadcasts`}>
              <Button variant="secondary">Cancel</Button>
            </Link>
          </div>
        </div>
      </div>
    </DashboardBody>
  )
}
