'use client'

import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import { ToolCallGroup } from '@/components/Onboarding/ToolCallGroup'
import { useChat } from '@ai-sdk/react'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import TextArea from '@spaire/ui/components/atoms/TextArea'
import { DefaultChatTransport, DynamicToolUIPart } from 'ai'
import { nanoid } from 'nanoid'
import Link from 'next/link'
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

export const StudioPage = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const conversationId = useMemo(() => nanoid(), [])

  const { messages, sendMessage, status, error } = useChat({
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
    return null
  }, [messages])

  const isFinished = publishedProductId !== null

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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-8">
      {messages.length === 0 && (
        <div className="flex flex-col gap-6 pt-8">
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
              proposes a price, and publishes it as a real product in{' '}
              <span className="font-medium text-gray-900 dark:text-white">
                {organization.name}
              </span>
              .
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
    </div>
  )
}
