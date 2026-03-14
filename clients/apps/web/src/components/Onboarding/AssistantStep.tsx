'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, DynamicToolUIPart } from 'ai'
import { nanoid } from 'nanoid'
import Link from 'next/link'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import { useOnboardingTracking } from '@/hooks/onboarding'
import { OrganizationContext } from '@/providers/maintainerOrganization'

import Button from '@spaire/ui/components/atoms/Button'
import { ToolCallGroup } from './ToolCallGroup'
import LogoIcon from '../Brand/LogoIcon'

type MessagePart = {
  type: string
  [key: string]: unknown
}

type RenderableItem =
  | { type: 'single'; part: MessagePart; index: number }
  | { type: 'group'; parts: MessagePart[]; startIndex: number }

const groupMessageParts = (parts: MessagePart[]): RenderableItem[] => {
  const result: RenderableItem[] = []
  let currentGroup: MessagePart[] = []
  let groupStartIndex = 0

  parts
    .filter(({ type }) => type !== 'step-start')
    .forEach((part, index) => {
      if (part.type === 'dynamic-tool') {
        if (currentGroup.length === 0) groupStartIndex = index
        currentGroup.push(part)
      } else {
        if (currentGroup.length > 0) {
          result.push({ type: 'group', parts: currentGroup, startIndex: groupStartIndex })
          currentGroup = []
        }
        result.push({ type: 'single', part, index })
      }
    })

  if (currentGroup.length > 0) {
    result.push({ type: 'group', parts: currentGroup, startIndex: groupStartIndex })
  }

  return result
}

const ThinkingDots = () => (
  <div className="flex items-center gap-1 px-1 py-0.5">
    <span className="dark:bg-spaire-400 h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
    <span className="dark:bg-spaire-400 h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
    <span className="dark:bg-spaire-400 h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
  </div>
)

export const AssistantStep = ({
  onEjectToManual,
  onFinished,
}: {
  onEjectToManual: () => void
  onFinished: () => void
}) => {
  const { organization } = useContext(OrganizationContext)
  const { trackStepCompleted } = useOnboardingTracking()
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const conversationId = useMemo(() => nanoid(), [])

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `/dashboard/${organization.slug}/onboarding/assistant/chat`,
      credentials: 'include',
      body: { organizationId: organization.id, conversationId },
    }),
  })

  const hasRedirectedToManualSetup = useMemo(() =>
    messages.some((m) =>
      m.parts.some(
        (p) =>
          p.type === 'tool-redirectToManualSetup' &&
          (p.state === 'input-available' || p.state === 'output-available'),
      ),
    ), [messages])

  const isFinished = useMemo(() =>
    messages.some((m) =>
      m.parts.some(
        (p) =>
          p.type === 'tool-markAsDone' &&
          (p.state === 'input-available' || p.state === 'output-available'),
      ),
    ), [messages])

  useEffect(() => {
    if (isFinished) {
      trackStepCompleted('product', organization.id)
      onFinished()
    }
  }, [isFinished, onFinished, trackStepCompleted, organization.id])

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
    if (input.trim() && status === 'ready') {
      sendMessage({ text: input })
      setInput('')
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const isStreaming = status === 'submitted' || status === 'streaming'

  return (
    <div className="flex flex-col gap-y-3">
      {/* Chat window */}
      <div className="dark:bg-spaire-900 dark:border-spaire-700 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-y-4 px-6 py-12 text-center">
            <div className="dark:bg-spaire-800 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <LogoIcon size={22} />
            </div>
            <div className="flex flex-col gap-y-1.5">
              <p className="text-sm font-medium">Tell me what you&apos;re selling</p>
              <p className="dark:text-spaire-500 max-w-xs text-sm text-gray-400">
                Describe your product and pricing and I&apos;ll configure everything for you.
              </p>
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.length > 0 && (
          <div className="flex max-h-[500px] flex-col gap-y-6 overflow-y-auto p-5">
            {messages.map((message) => (
              <div
                key={message.id}
                className={twMerge(
                  'flex gap-x-3',
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row',
                )}
              >
                {/* Avatar */}
                {message.role === 'assistant' && (
                  <div className="dark:bg-spaire-800 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <LogoIcon size={16} />
                  </div>
                )}

                {/* Content */}
                <div
                  className={twMerge(
                    'flex max-w-[85%] flex-col gap-y-2',
                    message.role === 'user' ? 'items-end' : 'items-start',
                  )}
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
                      if (message.role === 'user') {
                        return (
                          <div
                            key={`${message.id}-${index}`}
                            className="dark:bg-spaire-700 rounded-2xl rounded-tr-sm bg-gray-100 px-4 py-2.5 text-sm leading-relaxed"
                          >
                            {part.text as string}
                          </div>
                        )
                      }
                      return (
                        <div
                          key={`${message.id}-${index}`}
                          className="prose dark:prose-invert prose-sm max-w-none"
                        >
                          <MemoizedMarkdown content={part.text as string} />
                        </div>
                      )
                    }

                    if (part.type === 'reasoning' && part.state === 'streaming') {
                      return (
                        <p
                          key={`${message.id}-${index}`}
                          className="dark:text-spaire-500 animate-pulse text-xs text-gray-400 italic"
                        >
                          Thinking…
                        </p>
                      )
                    }

                    if (part.type === 'tool-redirectToManualSetup') {
                      if (part.state !== 'input-available' && part.state !== 'output-available') return null
                      const reason = (part.input as { reason: string }).reason
                      return (
                        <div
                          key={`${message.id}-${index}`}
                          className="dark:bg-spaire-800 dark:border-spaire-700 flex flex-col gap-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4"
                        >
                          <p className="dark:text-spaire-400 text-sm text-gray-500">
                            {reason === 'unsupported_benefit_type'
                              ? 'This configuration needs manual input.'
                              : reason === 'tool_call_error'
                                ? 'Something went wrong on my end.'
                                : 'Let\'s continue with manual setup instead.'}
                          </p>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-fit rounded-full"
                            onClick={onEjectToManual}
                          >
                            Set up manually
                          </Button>
                        </div>
                      )
                    }

                    if (part.type === 'tool-markAsDone') {
                      if (part.state !== 'input-available' && part.state !== 'output-available') return null
                      const productIds = ((part.input as { productIds: string[] }).productIds || []).join(',')
                      const nextStep = `/dashboard/${organization.slug}/onboarding/integrate?productId=${productIds}`
                      return (
                        <div
                          key={`${message.id}-${index}`}
                          className="dark:bg-spaire-800 dark:border-spaire-700 flex flex-col gap-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4"
                        >
                          <p className="text-sm font-medium">Your product is ready.</p>
                          <p className="dark:text-spaire-400 text-sm text-gray-500">
                            Now connect it to your checkout flow.
                          </p>
                          <Link href={nextStep}>
                            <Button size="sm" className="w-fit rounded-full">
                              Continue to checkout setup
                            </Button>
                          </Link>
                        </div>
                      )
                    }

                    return null
                  })}
                </div>
              </div>
            ))}

            {/* Streaming indicator */}
            {isStreaming && (
              <div className="flex gap-x-3">
                <div className="dark:bg-spaire-800 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100">
                  <LogoIcon size={16} />
                </div>
                <ThinkingDots />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input */}
        {!hasRedirectedToManualSetup && !isFinished && (
          <form
            onSubmit={handleSubmit}
            className={twMerge(
              'dark:border-spaire-700 flex items-end gap-x-2 border-t border-gray-200 px-4 py-3',
              messages.length === 0 && 'border-t',
            )}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              placeholder={messages.length === 0 ? 'e.g. A $29/month developer tool subscription…' : 'Reply…'}
              rows={1}
              className="dark:text-spaire-100 dark:placeholder-spaire-600 w-full resize-none bg-transparent py-1.5 text-sm leading-relaxed text-gray-900 placeholder-gray-400 focus:outline-none disabled:opacity-40"
              style={{ maxHeight: '160px', overflowY: 'auto' }}
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className={twMerge(
                'mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all',
                input.trim() && !isStreaming
                  ? 'bg-gray-900 text-white hover:bg-gray-700 dark:bg-white dark:text-black dark:hover:bg-gray-100'
                  : 'dark:bg-spaire-700 bg-gray-200 text-gray-400 dark:text-gray-500',
              )}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 12V2M7 2L2.5 6.5M7 2L11.5 6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        )}
      </div>

      {/* Manual fallback — subtle, below the chat */}
      {!hasRedirectedToManualSetup && !isFinished && (
        <div className="flex items-center justify-center">
          <button
            onClick={onEjectToManual}
            className="dark:text-spaire-500 dark:hover:text-spaire-300 cursor-pointer text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Prefer to set up manually?
          </button>
        </div>
      )}
    </div>
  )
}
