'use client'

import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import { usePostHog } from '@/hooks/posthog'
import { getServerURL } from '@/utils/api'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import DownloadOutlined from '@mui/icons-material/DownloadOutlined'
import StopCircleOutlined from '@mui/icons-material/StopCircleOutlined'
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
import TextArea from '@spaire/ui/components/atoms/TextArea'
import React, { useCallback, useMemo, useRef, useState } from 'react'

type Tone = 'warm' | 'direct' | 'playful' | 'clinical'
type Length = 'short' | 'standard' | 'deep'
type Status = 'idle' | 'streaming' | 'done' | 'error'

interface Usage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}

interface FormState {
  topic: string
  audience: string
  outcome: string
  tone: Tone
  length: Length
}

const DEFAULT_FORM: FormState = {
  topic: '',
  audience: '',
  outcome: '',
  tone: 'warm',
  length: 'standard',
}

// Parse a chunk of an SSE stream, yielding complete events.
const parseSSE = (
  buffer: string,
): { events: Array<{ event: string; data: string }>; remainder: string } => {
  const blocks = buffer.split('\n\n')
  const remainder = blocks.pop() ?? ''
  const events: Array<{ event: string; data: string }> = []
  for (const block of blocks) {
    if (!block.trim()) continue
    let event = 'message'
    let data = ''
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        data += line.slice(5).trim()
      }
    }
    events.push({ event, data })
  }
  return { events, remainder }
}

export const StudioPage = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const posthog = usePostHog()
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [status, setStatus] = useState<Status>('idle')
  const [markdown, setMarkdown] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const canSubmit =
    form.topic.trim().length >= 3 &&
    form.audience.trim().length >= 3 &&
    form.outcome.trim().length >= 3 &&
    status !== 'streaming'

  const handleGenerate = useCallback(async () => {
    setStatus('streaming')
    setMarkdown('')
    setError(null)
    setUsage(null)

    posthog.capture('dashboard:studio:workbook:start', {
      organization_id: organization.id,
      tone: form.tone,
      length: form.length,
    })

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch(
        `${getServerURL()}/v1/studio/workbook/generate`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'content-type': 'application/json',
            accept: 'text/event-stream',
          },
          body: JSON.stringify({
            organization_id: organization.id,
            topic: form.topic.trim(),
            audience: form.audience.trim(),
            outcome: form.outcome.trim(),
            tone: form.tone,
            length: form.length,
          }),
          signal: controller.signal,
        },
      )

      if (!response.ok || !response.body) {
        const body = await response.text().catch(() => '')
        throw new Error(body || `Request failed (${response.status})`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const { events, remainder } = parseSSE(buffer)
        buffer = remainder
        for (const { event, data } of events) {
          if (!data) continue
          try {
            const payload = JSON.parse(data)
            if (event === 'delta' && typeof payload.text === 'string') {
              setMarkdown((prev) => prev + payload.text)
            } else if (event === 'done') {
              setUsage(payload.usage ?? null)
              setStatus('done')
              posthog.capture('dashboard:studio:workbook:done', {
                organization_id: organization.id,
                output_tokens: payload?.usage?.output_tokens ?? null,
                cache_read_input_tokens:
                  payload?.usage?.cache_read_input_tokens ?? null,
              })
            } else if (event === 'error') {
              setError(payload.message ?? 'Generation failed')
              setStatus('error')
              posthog.capture('dashboard:studio:workbook:fail', {
                organization_id: organization.id,
                message: payload.message,
              })
            }
          } catch {
            // Swallow malformed frames; the stream will recover.
          }
        }
      }

      setStatus((prev) => (prev === 'streaming' ? 'done' : prev))
    } catch (e: unknown) {
      if ((e as Error).name === 'AbortError') {
        setStatus('idle')
        return
      }
      const message = e instanceof Error ? e.message : 'Generation failed'
      setError(message)
      setStatus('error')
      posthog.capture('dashboard:studio:workbook:fail', {
        organization_id: organization.id,
        message,
      })
    } finally {
      abortRef.current = null
    }
  }, [form, organization.id, posthog])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const handleCopy = useCallback(() => {
    if (!markdown) return
    void navigator.clipboard.writeText(markdown)
    posthog.capture('dashboard:studio:workbook:copy', {
      organization_id: organization.id,
    })
  }, [markdown, organization.id, posthog])

  const handleDownload = useCallback(() => {
    if (!markdown) return
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const slug = form.topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48)
    a.href = url
    a.download = `${slug || 'workbook'}.md`
    a.click()
    URL.revokeObjectURL(url)
    posthog.capture('dashboard:studio:workbook:download', {
      organization_id: organization.id,
    })
  }, [markdown, form.topic, organization.id, posthog])

  const wordCount = useMemo(
    () => (markdown.trim() ? markdown.trim().split(/\s+/).length : 0),
    [markdown],
  )

  return (
    <div className="flex h-full w-full flex-col gap-6 p-4 md:flex-row md:gap-8 md:p-8">
      {/* Brief form */}
      <aside className="dark:border-polar-700 dark:bg-polar-800 flex w-full flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-6 md:w-[420px] md:shrink-0">
        <div className="flex items-center gap-2">
          <AutoAwesomeOutlined className="text-blue-500" fontSize="small" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Studio · Workbook
          </h2>
        </div>
        <p className="dark:text-polar-400 text-sm text-gray-500">
          Draft a print-ready workbook in minutes. Tell Studio who it's for and
          what transformation it delivers — Claude writes the rest.
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Topic
          </label>
          <Input
            value={form.topic}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm({ ...form, topic: e.target.value })
            }
            placeholder="Morning routines for remote founders"
            maxLength={200}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Audience
          </label>
          <Input
            value={form.audience}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm({ ...form, audience: e.target.value })
            }
            placeholder="First-time SaaS founders in year 1"
            maxLength={200}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Outcome
          </label>
          <TextArea
            value={form.outcome}
            onChange={(e) => setForm({ ...form, outcome: e.target.value })}
            placeholder="A repeatable 30-day launch plan with daily checklists"
            maxLength={300}
            resizable={false}
            className="min-h-[88px]"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Tone
            </label>
            <Select
              value={form.tone}
              onValueChange={(v) => setForm({ ...form, tone: v as Tone })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="direct">Direct</SelectItem>
                <SelectItem value="playful">Playful</SelectItem>
                <SelectItem value="clinical">Clinical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Length
            </label>
            <Select
              value={form.length}
              onValueChange={(v) => setForm({ ...form, length: v as Length })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Short · ~8 pages</SelectItem>
                <SelectItem value="standard">Standard · ~16 pages</SelectItem>
                <SelectItem value="deep">Deep · ~32 pages</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {status === 'streaming' ? (
          <Button
            variant="secondary"
            onClick={handleStop}
            className="mt-2 w-full"
          >
            <StopCircleOutlined className="mr-2" fontSize="small" />
            Stop
          </Button>
        ) : (
          <Button
            onClick={handleGenerate}
            disabled={!canSubmit}
            className="mt-2 w-full"
          >
            <AutoAwesomeOutlined className="mr-2" fontSize="small" />
            Generate workbook
          </Button>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 p-3 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="dark:border-polar-700 mt-2 border-t border-gray-100 pt-3 text-[11px] text-gray-400">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/40 px-2.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <span className="text-[10px] font-semibold tracking-[0.14em] text-gray-700 uppercase dark:text-gray-300">
              Made with Claude
            </span>
          </div>
        </div>
      </aside>

      {/* Preview */}
      <section className="dark:border-polar-700 dark:bg-polar-800 flex min-h-0 flex-1 flex-col rounded-2xl border border-gray-200 bg-white">
        <header className="dark:border-polar-700 flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Manuscript
            </span>
            <span className="text-[11px] text-gray-400">
              {status === 'streaming'
                ? 'Generating…'
                : status === 'done'
                  ? `${wordCount.toLocaleString()} words`
                  : status === 'error'
                    ? 'Stopped'
                    : 'Idle'}
              {usage && status === 'done' ? (
                <>
                  {' · '}
                  {usage.output_tokens.toLocaleString()} output tokens
                  {usage.cache_read_input_tokens > 0 ? (
                    <>
                      {' · '}
                      {usage.cache_read_input_tokens.toLocaleString()} cached
                    </>
                  ) : null}
                </>
              ) : null}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!markdown || status === 'streaming'}
              onClick={handleCopy}
            >
              <ContentCopyOutlined className="mr-1.5" fontSize="inherit" />
              Copy
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!markdown || status === 'streaming'}
              onClick={handleDownload}
            >
              <DownloadOutlined className="mr-1.5" fontSize="inherit" />
              Download .md
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-8 py-6">
          {markdown ? (
            <article className="prose dark:prose-invert prose-sm prose-headings:font-semibold prose-h1:text-2xl prose-h2:mt-10 prose-h2:text-xl prose-h3:text-base prose-h3:uppercase prose-h3:tracking-[0.12em] prose-h3:text-gray-500 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-li:marker:text-blue-500 max-w-3xl">
              <MemoizedMarkdown content={markdown} />
              {status === 'streaming' && (
                <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-blue-500" />
              )}
            </article>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <AutoAwesomeOutlined className="text-gray-300" fontSize="large" />
              <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
                Fill out the brief and click <b>Generate workbook</b>. Studio
                will stream a complete Markdown manuscript you can copy,
                download, or publish as a Spaire product.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
