'use client'

import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import { ToolCallGroup } from '@/components/Onboarding/ToolCallGroup'
import {
  StudioConversation,
  StudioConversationMessage,
  useDeleteStudioConversation,
  useStudioConversations,
  useSyncStudioConversation,
  useUpdateStudioConversation,
} from '@/hooks/queries/studio'
import { useChat } from '@ai-sdk/react'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import DriveFileRenameOutline from '@mui/icons-material/DriveFileRenameOutline'
import HistoryOutlined from '@mui/icons-material/HistoryOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import TextArea from '@spaire/ui/components/atoms/TextArea'
import { DefaultChatTransport, DynamicToolUIPart, UIMessage } from 'ai'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type MessagePart = {
  type: string
  [key: string]: unknown
}

type RenderableItem =
  | { type: 'single'; part: MessagePart; index: number }
  | { type: 'group'; parts: MessagePart[]; startIndex: number }

// Group consecutive dynamic-tool parts together
const groupMessageParts = (parts: MessagePart[]): RenderableItem[] => {
  const result: RenderableItem[] = []
  let currentGroup: MessagePart[] = []
  let groupStartIndex = 0

  parts
    .filter(({ type }) => type !== 'step-start')
    .forEach((part, index) => {
      if (part.type === 'dynamic-tool') {
        if (currentGroup.length === 0) {
          groupStartIndex = index
        }
        currentGroup.push(part)
      } else {
        if (currentGroup.length > 0) {
          result.push({
            type: 'group',
            parts: currentGroup,
            startIndex: groupStartIndex,
          })
          currentGroup = []
        }
        result.push({ type: 'single', part, index })
      }
    })

  if (currentGroup.length > 0) {
    result.push({
      type: 'group',
      parts: currentGroup,
      startIndex: groupStartIndex,
    })
  }

  return result
}

const PROMPT_SUGGESTIONS = [
  'A 30-day morning routine workbook for remote founders',
  'A launch playbook for solo SaaS founders in year one',
  'A founder-interview workbook for early-stage product validation',
]

function deriveTitle(messages: UIMessage[]): string {
  for (const message of messages) {
    if (message.role !== 'user') continue
    for (const part of message.parts) {
      if (
        part.type === 'text' &&
        typeof (part as { text?: unknown }).text === 'string'
      ) {
        const text = (part as { text: string }).text.trim()
        if (text.length > 0) {
          return text.length > 60 ? `${text.slice(0, 57)}…` : text
        }
      }
    }
  }
  return 'Untitled workbook'
}

function hydrateMessages(messages: StudioConversationMessage[]): UIMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role as UIMessage['role'],
    parts: m.parts as UIMessage['parts'],
  }))
}

type StudioPageProps = {
  organization: schemas['Organization']
  initialConversationId?: string | null
  initialMessages?: StudioConversationMessage[]
  initialTitle?: string
  initialProductId?: string | null
}

export const StudioPage = ({
  organization,
  initialConversationId = null,
  initialMessages,
  initialTitle,
  initialProductId = null,
}: StudioPageProps) => {
  const router = useRouter()
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  // Conversation id is stable for this mount: either resumed from the URL or
  // freshly generated. We post it to the chat route on every turn and use it
  // as the key when syncing history back to the server.
  const conversationId = useMemo(
    () => initialConversationId ?? crypto.randomUUID(),
    [initialConversationId],
  )
  const isNewConversation = initialConversationId === null

  const seedMessages = useMemo(
    () => (initialMessages ? hydrateMessages(initialMessages) : undefined),
    [initialMessages],
  )

  const { messages, sendMessage, status, error } = useChat({
    messages: seedMessages,
    transport: new DefaultChatTransport({
      api: `/dashboard/${organization.slug}/studio/chat`,
      credentials: 'include',
      body: {
        organizationId: organization.id,
        conversationId,
      },
    }),
  })

  const publishedProductId = useMemo(() => {
    for (const message of messages) {
      for (const part of message.parts) {
        if (
          part.type === 'tool-markAsDone' &&
          (part.state === 'input-available' ||
            part.state === 'output-available')
        ) {
          const input = part.input as { productId?: string } | undefined
          if (input?.productId) {
            return input.productId
          }
        }
      }
    }
    return initialProductId ?? null
  }, [messages, initialProductId])

  const isFinished = publishedProductId !== null

  const syncMutation = useSyncStudioConversation()

  // Autosave after each streamed response finishes. We wait until the chat
  // settles (status === 'ready') and at least one new message has been added
  // since the last sync before firing.
  const lastSyncedCountRef = useRef<number>(seedMessages?.length ?? 0)
  const pushedUrlRef = useRef<boolean>(!isNewConversation)
  useEffect(() => {
    if (status !== 'ready') return
    if (messages.length === 0) return
    if (messages.length === lastSyncedCountRef.current) return

    const title = initialTitle ?? deriveTitle(messages)
    lastSyncedCountRef.current = messages.length

    syncMutation.mutate(
      {
        id: conversationId,
        organization_id: organization.id,
        title,
        product_id: publishedProductId,
        messages: messages.map((m) => ({
          role: m.role,
          parts: m.parts as Array<Record<string, unknown>>,
        })),
      },
      {
        onSuccess: () => {
          // Move the URL to the canonical conversation path the first time
          // we persist, so refresh / copy-link behaves correctly.
          if (!pushedUrlRef.current) {
            pushedUrlRef.current = true
            router.replace(
              `/dashboard/${organization.slug}/studio/${conversationId}`,
            )
          }
        },
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, messages.length, publishedProductId])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      sendMessage({ text: input })
      setInput('')
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && status === 'ready') {
        sendMessage({ text: input })
        setInput('')
        textareaRef.current?.focus()
      }
    }
  }

  const handleSuggestion = (suggestion: string) => {
    if (status !== 'ready') return
    sendMessage({ text: suggestion })
  }

  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="dark:text-polar-400 dark:hover:bg-polar-800 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
        >
          <HistoryOutlined fontSize="inherit" />
          History
        </button>
        <Link
          href={`/dashboard/${organization.slug}/studio`}
          className="dark:text-polar-400 dark:hover:bg-polar-800 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
        >
          <AddOutlined fontSize="inherit" />
          New workbook
        </Link>
      </div>

      {messages.length === 0 && (
        <div className="flex flex-col gap-6 pt-4">
          <div className="flex flex-col items-start gap-3">
            <div className="dark:bg-polar-800 inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
              <AutoAwesomeOutlined fontSize="inherit" />
              Spaire Studio
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl dark:text-white">
              Describe a product. Ship it.
            </h1>
            <p className="dark:text-polar-400 max-w-xl text-base text-gray-500">
              Tell Studio what you want to create — Claude drafts the workbook,
              Imagen paints the cover, and together they publish a real product
              in{' '}
              <span className="font-medium text-gray-900 dark:text-white">
                {organization.name}
              </span>
              . Every workbook ships with a downloadable PDF and its raw
              markdown source.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium tracking-wide text-gray-400 uppercase">
              Try one of these
            </span>
            <div className="flex flex-col gap-2">
              {PROMPT_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSuggestion(suggestion)}
                  disabled={status !== 'ready'}
                  className="dark:border-polar-700 dark:hover:bg-polar-800 group flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4 text-left text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-transparent dark:text-gray-200"
                >
                  <span>{suggestion}</span>
                  <ArrowForwardOutlined
                    className="text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400"
                    fontSize="small"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="dark:bg-spaire-900 flex flex-col overflow-hidden rounded-3xl">
        {messages.length > 0 && (
          <div
            className={twMerge(
              'dark:border-spaire-700 flex h-full max-h-[720px] flex-1 flex-col gap-y-6 overflow-y-auto rounded-t-3xl border border-gray-200 p-6',
              isFinished ? 'rounded-b-3xl border-b' : 'border-b-0',
            )}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col gap-y-1 ${
                  message.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`prose dark:prose-invert text-sm ${
                    message.role === 'user'
                      ? 'dark:bg-spaire-800 rounded-2xl bg-gray-100 px-4 py-2 dark:text-white'
                      : 'w-full space-y-4 dark:text-white'
                  }`}
                >
                  {groupMessageParts(message.parts).map((item) => {
                    if (item.type === 'group') {
                      return (
                        <ToolCallGroup
                          key={`${message.id}-group-${item.startIndex}`}
                          parts={item.parts as DynamicToolUIPart[]}
                          messageId={message.id}
                        />
                      )
                    }

                    const part = item.part
                    const index = item.index

                    if (part.type === 'text') {
                      return (
                        <MemoizedMarkdown
                          key={`${message.id}-${index}`}
                          content={part.text as string}
                        />
                      )
                    }

                    if (part.type === 'reasoning') {
                      if (part.state === 'streaming') {
                        return (
                          <p
                            key={`${message.id}-${index}`}
                            className="dark:text-spaire-500 animate-pulse text-sm text-gray-500 italic"
                          >
                            Thinking…
                          </p>
                        )
                      }
                      return null
                    }

                    if (part.type === 'tool-markAsDone') {
                      switch (part.state) {
                        case 'input-available':
                        case 'output-available': {
                          const productId = (
                            part.input as { productId?: string }
                          ).productId

                          if (!productId) return null

                          return (
                            <div
                              key={`${message.id}-${index}`}
                              className="dark:bg-spaire-800 dark:text-spaire-500 flex flex-col items-center gap-y-4 rounded-2xl bg-gray-100 p-4 text-center text-gray-500"
                            >
                              Your workbook is live.
                              <br />
                              Open it to preview the storefront or share the
                              checkout link.
                              <Link
                                href={`/dashboard/${organization.slug}/products/${productId}`}
                              >
                                <Button className="dark:hover:bg-spaire-50 rounded-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black">
                                  Open product
                                </Button>
                              </Link>
                            </div>
                          )
                        }
                        default:
                          return null
                      }
                    }

                    return null
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} className="-mt-6" />
          </div>
        )}

        {error && (
          <div className="dark:border-spaire-700 border-t border-gray-200 px-6 py-3 text-xs text-red-500">
            {error.message}
          </div>
        )}

        {!isFinished && (
          <form
            onSubmit={handleSubmit}
            className="dark:border-spaire-700 flex shrink-0 flex-col gap-3 overflow-hidden rounded-b-3xl border first:rounded-t-3xl"
          >
            <TextArea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={status !== 'ready'}
              placeholder={
                messages.length === 0
                  ? 'Describe the workbook you want to create…'
                  : 'Reply…'
              }
              rows={1}
              className="max-h-[240px] min-h-[72px] resize-none overflow-y-auto border-none px-6 pt-5 pb-0 text-sm/5 shadow-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none disabled:opacity-50 dark:bg-transparent"
            />
            <div className="flex items-center justify-end gap-2 px-4 pb-4">
              <Button
                type="submit"
                disabled={status !== 'ready' || !input.trim()}
                loading={status === 'submitted' || status === 'streaming'}
                className="dark:hover:bg-spaire-50 rounded-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black"
              >
                {messages.length === 0 ? 'Create' : 'Send'}
                <ArrowForwardOutlined className="ml-2" fontSize="inherit" />
              </Button>
            </div>
          </form>
        )}
      </div>

      {historyOpen && (
        <HistoryDrawer
          organizationId={organization.id}
          organizationSlug={organization.slug}
          activeId={isNewConversation ? null : conversationId}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  )
}

function HistoryDrawer({
  organizationId,
  organizationSlug,
  activeId,
  onClose,
}: {
  organizationId: string
  organizationSlug: string
  activeId: string | null
  onClose: () => void
}) {
  const { data, isLoading } = useStudioConversations(organizationId)
  const updateMutation = useUpdateStudioConversation()
  const deleteMutation = useDeleteStudioConversation()

  const handleRename = (conversation: StudioConversation) => {
    const next = window.prompt('Rename workbook draft', conversation.title)
    if (!next || next.trim() === conversation.title) return
    updateMutation.mutate({
      id: conversation.id,
      organization_id: organizationId,
      body: { title: next.trim().slice(0, 200) },
    })
  }

  const handleDelete = (conversation: StudioConversation) => {
    if (
      !window.confirm(
        `Delete "${conversation.title}"? This removes the chat history, not any published product.`,
      )
    )
      return
    deleteMutation.mutate({
      id: conversation.id,
      organization_id: organizationId,
    })
  }

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/30"
      onClick={onClose}
    >
      <div
        className="dark:bg-polar-900 dark:border-polar-700 flex h-full w-full max-w-sm flex-col gap-4 overflow-hidden border-l border-gray-200 bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Studio history
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="dark:text-polar-400 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Close
          </button>
        </div>

        {isLoading && (
          <div className="dark:bg-polar-800 h-20 animate-pulse rounded-xl bg-gray-100" />
        )}

        {!isLoading && (data?.items.length ?? 0) === 0 && (
          <p className="dark:text-polar-400 text-sm text-gray-500">
            No saved drafts yet. Start a chat and it'll appear here.
          </p>
        )}

        <div className="flex flex-col gap-2 overflow-y-auto">
          {data?.items.map((conversation) => {
            const isActive = conversation.id === activeId
            return (
              <div
                key={conversation.id}
                className={twMerge(
                  'group flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm transition',
                  isActive
                    ? 'border-gray-900 bg-gray-900/5 dark:border-white dark:bg-white/10'
                    : 'dark:border-polar-700 dark:hover:bg-polar-800 border-gray-200 hover:bg-gray-50',
                )}
              >
                <Link
                  href={`/dashboard/${organizationSlug}/studio/${conversation.id}`}
                  onClick={onClose}
                  className="flex flex-col gap-1"
                >
                  <span className="line-clamp-2 font-medium text-gray-900 dark:text-white">
                    {conversation.title}
                  </span>
                  <span className="dark:text-polar-400 flex items-center gap-2 text-xs text-gray-500">
                    {new Date(
                      conversation.modified_at ?? conversation.created_at,
                    ).toLocaleString()}
                    {conversation.product_id && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Published
                      </span>
                    )}
                  </span>
                </Link>
                <div className="flex gap-2 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => handleRename(conversation)}
                    className="dark:text-polar-400 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <DriveFileRenameOutline fontSize="inherit" />
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(conversation)}
                    className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                  >
                    <DeleteOutline fontSize="inherit" />
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
