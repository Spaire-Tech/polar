'use client'

import { useState } from 'react'
import {
  type CommunityTagRead,
  useCreateCommunityPost,
} from '@/hooks/queries/community'
import { Avatar } from './Avatar'
import styles from './community.module.css'
import { IconPlus } from './icons'

type Props = {
  token: string
  courseId: string
  selfName?: string | null
  tags: CommunityTagRead[]
  modules: { id: string; label: string }[]
  defaultModuleId?: string | null
  // When the user clicks the top-right "+ New post" button.
  forceOpen?: boolean
  onOpenChange?: (open: boolean) => void
  onPosted?: () => void
}

export function Composer({
  token,
  courseId,
  selfName,
  tags,
  modules,
  defaultModuleId,
  forceOpen,
  onOpenChange,
  onPosted,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const isOpen = forceOpen ?? expanded
  const [body, setBody] = useState('')
  const [tagId, setTagId] = useState<string>('')
  const [lessonModuleId, setLessonModuleId] = useState<string>(
    defaultModuleId ?? '',
  )
  const create = useCreateCommunityPost(token, courseId)

  const reset = () => {
    setBody('')
    setTagId('')
    setLessonModuleId(defaultModuleId ?? '')
  }

  const close = () => {
    setExpanded(false)
    onOpenChange?.(false)
    reset()
  }

  const open = () => {
    setExpanded(true)
    onOpenChange?.(true)
  }

  const submit = async () => {
    const trimmed = body.trim()
    if (!trimmed) return
    try {
      await create.mutateAsync({
        body: trimmed,
        body_format: 'plain',
        tag_id: tagId || null,
      })
      reset()
      setExpanded(false)
      onOpenChange?.(false)
      onPosted?.()
    } catch {
      // Swallow — the mutation surfaces the error via .isError if the
      // parent wants to render it; for now we keep the composer open so
      // the user doesn't lose their draft.
    }
  }

  if (!isOpen) {
    return (
      <div className={styles.composer}>
        <div className={styles.composerRow}>
          <Avatar name={selfName ?? 'You'} size={36} />
          <button
            type="button"
            className={styles.composerInput}
            style={{
              textAlign: 'left',
              cursor: 'text',
              color: 'var(--c-muted)',
            }}
            onClick={open}
          >
            Start a post
          </button>
          <button
            type="button"
            className={styles.composerAdd}
            onClick={open}
            aria-label="New post"
          >
            <IconPlus size={17} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.composer}>
      <div className={styles.composerRow} style={{ alignItems: 'flex-start' }}>
        <Avatar name={selfName ?? 'You'} size={36} />
        <div className={styles.composerExpanded} style={{ flex: 1 }}>
          <textarea
            className={styles.composerTextarea}
            placeholder="What's on your mind?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                submit()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                close()
              }
            }}
          />
          <div className={styles.composerFoot}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {tags.length > 0 && (
                <select
                  className={styles.composerSelect}
                  value={tagId}
                  onChange={(e) => setTagId(e.target.value)}
                  aria-label="Tag"
                >
                  <option value="">No tag</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              )}
              {modules.length > 0 && (
                <select
                  className={styles.composerSelect}
                  value={lessonModuleId}
                  onChange={(e) => setLessonModuleId(e.target.value)}
                  aria-label="Module"
                >
                  <option value="">No module</option>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                className={styles.composerCancel}
                onClick={close}
                disabled={create.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.composerSubmit}
                onClick={submit}
                disabled={create.isPending || !body.trim()}
              >
                {create.isPending ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
