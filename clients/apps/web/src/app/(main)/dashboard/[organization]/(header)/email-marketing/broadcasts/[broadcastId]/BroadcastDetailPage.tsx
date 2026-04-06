'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  useEmailBroadcastAnalytics,
  useSendEmailBroadcast,
  useUpdateEmailBroadcast,
} from '@/hooks/queries/emailMarketing'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import Input from '@spaire/ui/components/atoms/Input'
import { Label } from '@spaire/ui/components/ui/label'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/utils/client'
import { defaultRetry } from '@/hooks/queries/retry'

export default function BroadcastDetailPage({
  organization,
  broadcastId,
}: {
  organization: schemas['Organization']
  broadcastId: string
}) {
  const broadcastQuery = useQuery({
    queryKey: ['email_broadcast', broadcastId],
    queryFn: () =>
      api
        .GET('/v1/email-broadcasts/{broadcast_id}', {
          params: { path: { broadcast_id: broadcastId } },
        })
        .then((r) => r.data),
    retry: defaultRetry,
  })

  const analyticsQuery = useEmailBroadcastAnalytics(broadcastId)
  const updateBroadcast = useUpdateEmailBroadcast()
  const sendBroadcast = useSendEmailBroadcast()

  const broadcast = broadcastQuery.data as any
  const analytics = analyticsQuery.data as any

  const [subject, setSubject] = useState('')
  const [senderName, setSenderName] = useState('')
  const [replyToEmail, setReplyToEmail] = useState('')
  const [contentHtml, setContentHtml] = useState('')

  useEffect(() => {
    if (broadcast) {
      setSubject(broadcast.subject || '')
      setSenderName(broadcast.sender_name || '')
      setReplyToEmail(broadcast.reply_to_email || '')
      setContentHtml(broadcast.content_html || '')
    }
  }, [broadcast])

  const isDraft = broadcast?.status === 'draft'
  const isSent = broadcast?.status === 'sent'

  const handleSave = useCallback(async () => {
    await updateBroadcast.mutateAsync({
      broadcastId,
      body: {
        subject: subject.trim(),
        sender_name: senderName.trim(),
        reply_to_email: replyToEmail.trim() || undefined,
        content_html: contentHtml || undefined,
      },
    })
  }, [broadcastId, subject, senderName, replyToEmail, contentHtml, updateBroadcast])

  const handleSend = useCallback(async () => {
    if (!confirm('Send this broadcast to all active subscribers?')) return
    await sendBroadcast.mutateAsync(broadcastId)
    broadcastQuery.refetch()
  }, [broadcastId, sendBroadcast, broadcastQuery])

  if (!broadcast) {
    return (
      <DashboardBody>
        <div className="flex items-center justify-center py-20">
          <div className="dark:bg-spaire-700 h-8 w-8 animate-pulse rounded-full bg-gray-200" />
        </div>
      </DashboardBody>
    )
  }

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-8">
        {/* Header */}
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-row items-center gap-4">
            <Link
              href={`/dashboard/${organization.slug}/email-marketing/broadcasts`}
              className="dark:text-spaire-400 text-gray-500 transition-colors hover:text-gray-700"
            >
              <ArrowBackOutlined fontSize="small" />
            </Link>
            <div>
              <h1 className="text-2xl font-medium">{broadcast.subject}</h1>
              <p className="dark:text-spaire-400 text-sm text-gray-500">
                {broadcast.status === 'sent'
                  ? `Sent on ${new Date(broadcast.sent_at).toLocaleDateString()}`
                  : `Status: ${broadcast.status}`}
              </p>
            </div>
          </div>
          {isDraft && (
            <div className="flex flex-row gap-3">
              <Button
                variant="secondary"
                onClick={handleSave}
                loading={updateBroadcast.isPending}
              >
                Save draft
              </Button>
              <Button
                onClick={handleSend}
                loading={sendBroadcast.isPending}
                disabled={!contentHtml.trim()}
              >
                Send now
              </Button>
            </div>
          )}
        </div>

        {/* Analytics (for sent broadcasts) */}
        {isSent && analytics && (
          <div className="flex flex-col gap-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <AnalyticsCard label="Recipients" value={analytics.total_recipients} />
              <AnalyticsCard
                label="Delivered"
                value={analytics.delivered}
                total={analytics.total_recipients}
                color="text-blue-500"
              />
              <AnalyticsCard
                label="Opened"
                value={analytics.opened}
                rate={analytics.open_rate}
                color="text-green-500"
              />
              <AnalyticsCard
                label="Clicked"
                value={analytics.clicked}
                rate={analytics.click_rate}
                color="text-purple-500"
              />
              <AnalyticsCard
                label="Bounced"
                value={analytics.bounced}
                total={analytics.total_recipients}
                color="text-red-500"
              />
              <AnalyticsCard
                label="Unsubscribed"
                value={analytics.unsubscribed}
                total={analytics.total_recipients}
                color="text-orange-500"
              />
            </div>

            {/* Delivery funnel */}
            <div className="dark:border-spaire-700 dark:bg-spaire-900 rounded-2xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-sm font-medium">Delivery Funnel</h3>
              <div className="flex flex-col gap-y-3">
                <FunnelBar
                  label="Sent"
                  value={analytics.sent || analytics.total_recipients}
                  total={analytics.total_recipients}
                  color="bg-blue-500"
                />
                <FunnelBar
                  label="Delivered"
                  value={analytics.delivered}
                  total={analytics.total_recipients}
                  color="bg-blue-400"
                />
                <FunnelBar
                  label="Opened"
                  value={analytics.opened}
                  total={analytics.total_recipients}
                  color="bg-green-500"
                />
                <FunnelBar
                  label="Clicked"
                  value={analytics.clicked}
                  total={analytics.total_recipients}
                  color="bg-purple-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Editable form (drafts only) */}
        {isDraft && (
          <div className="dark:border-spaire-700 dark:bg-spaire-900 flex flex-col gap-y-5 rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex flex-col gap-y-2">
              <Label>Subject line</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-y-2">
                <Label>Sender name</Label>
                <Input
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-y-2">
                <Label>Reply-to email</Label>
                <Input
                  value={replyToEmail}
                  onChange={(e) => setReplyToEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="dark:border-spaire-700 dark:bg-spaire-900 flex flex-col gap-y-5 rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-medium">
            {isDraft ? 'Content' : 'Email Content'}
          </h2>
          {isDraft ? (
            <textarea
              className="dark:border-spaire-700 dark:bg-spaire-800 dark:text-spaire-200 min-h-[300px] w-full rounded-xl border border-gray-200 bg-white p-4 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={contentHtml}
              onChange={(e) => setContentHtml(e.target.value)}
            />
          ) : (
            <div
              className="dark:border-spaire-700 rounded-xl border border-gray-100 p-6"
              dangerouslySetInnerHTML={{
                __html: broadcast.content_html || '<p>No content</p>',
              }}
            />
          )}
        </div>
      </div>
    </DashboardBody>
  )
}

function AnalyticsCard({
  label,
  value,
  rate,
  total,
  color,
}: {
  label: string
  value: number
  rate?: number
  total?: number
  color?: string
}) {
  const pct = rate !== undefined ? rate : total && total > 0 ? (value / total) * 100 : undefined

  return (
    <div className="dark:border-spaire-700 dark:bg-spaire-900 flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-4">
      <span className="dark:text-spaire-400 text-xs text-gray-500">{label}</span>
      <span className={`text-2xl font-semibold ${color ?? ''}`}>
        {value.toLocaleString()}
      </span>
      {pct !== undefined && (
        <span className="dark:text-spaire-400 text-xs text-gray-500">
          {pct.toFixed(1)}%
        </span>
      )}
    </div>
  )
}

function FunnelBar({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) {
  const pct = total > 0 ? (value / total) * 100 : 0

  return (
    <div className="flex flex-row items-center gap-4">
      <div className="w-20 text-right text-xs text-gray-500">{label}</div>
      <div className="dark:bg-spaire-800 flex-1 rounded-full bg-gray-100">
        <div
          className={`h-5 rounded-full ${color} transition-all`}
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>
      <div className="w-20 text-xs text-gray-500">
        {value.toLocaleString()} ({pct.toFixed(1)}%)
      </div>
    </div>
  )
}
