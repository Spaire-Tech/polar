'use client'

import { useUploadEmailImage } from '@/hooks/queries/emailMarketing'
import {
  useNewsletter,
  useNewsletterPost,
  useUpdateNewsletterPost,
} from '@/hooks/queries/newsletters'
import { useAuth } from '@/hooks'
import { schemas } from '@spaire/client'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '../../email-marketing/_components/Icon'
import { useAutosave } from '../../email-marketing/_components/blockEditor/useAutosave'
import { useDocHistory } from '../../email-marketing/_components/blockEditor/useDocHistory'
import {
  Block,
  ContentDoc,
} from '../../email-marketing/_components/blockEditor/types'
import { CommandPalette, Command } from './CommandPalette'
import { PostEditor, PostMeta } from './PostEditor'
import { EditorMode, TopBar } from './TopBar'

// Fallback document used while the server response is loading or when
// a fresh post comes back with an empty body. Keeps the editor mounted
// instead of flickering between skeleton and content.
const BLANK_DOC: ContentDoc = {
  version: 1,
  accent: '#4f46e5',
  blocks: [],
}

const BLANK_META: PostMeta = {
  title: '',
  subtitle: '',
  cover_url: null,
  cover_visible: true,
  tags: [],
}

export function NewsletterPostScreen({
  organization,
  postId,
}: {
  organization: schemas['Organization']
  postId: string
}) {
  const router = useRouter()
  const { data: post, isLoading, error } = useNewsletterPost(postId)
  const { data: newsletter } = useNewsletter(post?.newsletter_id)
  const updateMutation = useUpdateNewsletterPost()
  const uploadMutation = useUploadEmailImage(organization.id)
  const { currentUser } = useAuth()

  // ── Editor state ────────────────────────────────────────────────
  // We hydrate from the fetched post once, then own the state locally
  // so typing is instant and autosave debounces against the API.
  // `hydrated` lives in state (not a ref) so changes participate in
  // render correctly — autosave's `enabled` depends on it.
  const [hydrated, setHydrated] = useState(false)
  const [meta, setMeta] = useState<PostMeta>(BLANK_META)
  const [doc, setDocRaw] = useState<ContentDoc>(BLANK_DOC)
  const history = useDocHistory(doc, setDocRaw)

  useEffect(() => {
    if (hydrated || !post) return
    // Server → local state handoff on first fetch. The lint rule below
    // disallows setState in effects in general, but this is the legit
    // hydration pattern: the editor takes ownership of an async-loaded
    // document so typing is instant and autosave debounces locally.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMeta({
      title: post.title ?? '',
      subtitle: post.subtitle ?? '',
      cover_url: post.cover_url,
      cover_visible: post.cover_visible,
      tags: post.tags ?? [],
    })
    if (post.content_json && isContentDoc(post.content_json)) {
      setDocRaw(post.content_json)
    }
    setHydrated(true)
  }, [post, hydrated])

  // ── Uploads ─────────────────────────────────────────────────────

  const uploadImage = useCallback(
    async (file: File): Promise<string> => {
      const result = await uploadMutation.mutateAsync(file)
      return result.url
    },
    [uploadMutation],
  )

  // ── Persistence (autosave) ──────────────────────────────────────
  // Skip while we haven't hydrated yet (avoids overwriting the fetched
  // post with the BLANK_DOC fallback during the first paint).
  const save = useCallback(
    async (snapshot: { meta: PostMeta; doc: ContentDoc }) => {
      if (!post) return
      await updateMutation.mutateAsync({
        postId: post.id,
        body: {
          title: snapshot.meta.title,
          subtitle: snapshot.meta.subtitle || null,
          cover_url: snapshot.meta.cover_url,
          cover_visible: snapshot.meta.cover_visible,
          tags: snapshot.meta.tags,
          content_json: snapshot.doc as unknown as Record<string, unknown>,
        },
      })
    },
    [post, updateMutation],
  )
  const status = useAutosave({ meta, doc }, save, { enabled: hydrated })

  // ── Mode / palette ──────────────────────────────────────────────

  const [mode, setMode] = useState<EditorMode>('write')
  const [paletteOpen, setPaletteOpen] = useState(false)

  // ── Actions (declared before keyboard listener so it can capture them) ──

  // The Publish CTA navigates to the review screen rather than firing
  // the publish endpoint directly. The actual send happens from the
  // sticky footer in PublishPostScreen once the author has reviewed
  // audience / schedule / pre-flight.
  const publish = useCallback(() => {
    if (!post) return
    router.push(
      `/dashboard/${organization.slug}/newsletter/${post.id}/publish`,
    )
  }, [post, router, organization.slug])

  const insertBlockType = useCallback(() => {
    // Palette inserts route through the PostEditor's slash menu in V1;
    // wiring a direct insert from here would race with the editor's
    // selection state. Track for V2: pubsub event to push a block at
    // the end of the doc.
    setPaletteOpen(false)
  }, [])

  // ⌘K, ⌘S, ⌘1/⌘2, ⌘↵ keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const key = e.key.toLowerCase()
      if (key === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      } else if (key === 's') {
        e.preventDefault()
        save({ meta, doc })
      } else if (key === '1') {
        e.preventDefault()
        setMode('write')
      } else if (key === '2') {
        e.preventDefault()
        setMode('style')
      } else if (key === 'enter') {
        e.preventDefault()
        publish()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [meta, doc, save, publish])

  // ── Derived ─────────────────────────────────────────────────────

  const wordCount = useMemo(() => countWords(meta, doc), [meta, doc])

  const userInitials = useMemo(() => {
    const email = currentUser?.email ?? ''
    if (!email) return ''
    const local = email.split('@')[0] ?? ''
    return local.slice(0, 2).toUpperCase()
  }, [currentUser])

  const commands: Command[] = useMemo(
    () =>
      buildCommands({
        setMode,
        onSave: () => save({ meta, doc }),
        onPublish: publish,
        onInsert: insertBlockType,
      }),
    [save, publish, meta, doc, insertBlockType],
  )

  // ── Render ──────────────────────────────────────────────────────

  if (isLoading) {
    return <LoadingShell />
  }
  if (error || !post) {
    return <ErrorShell message={error instanceof Error ? error.message : 'Post not found'} />
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      <TopBar
        organizationName={organization.name}
        newsletterName={newsletter?.name ?? null}
        title={meta.title}
        status={status}
        wordCount={wordCount}
        mode={mode}
        setMode={setMode}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={history.undo}
        onRedo={history.redo}
        onSave={() => save({ meta, doc })}
        onOpenPalette={() => setPaletteOpen(true)}
        onPublish={publish}
        userInitials={userInitials}
      />

      {mode === 'write' ? (
        <PostEditor
          meta={meta}
          setMeta={setMeta}
          doc={doc}
          setDoc={history.set}
          uploadImage={uploadImage}
          accent={doc.accent}
        />
      ) : (
        <StylePlaceholder />
      )}

      {paletteOpen && (
        <CommandPalette
          commands={commands}
          onClose={() => setPaletteOpen(false)}
        />
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────

function isContentDoc(v: unknown): v is ContentDoc {
  if (typeof v !== 'object' || v === null) return false
  const o = v as { version?: unknown; blocks?: unknown }
  return o.version === 1 && Array.isArray(o.blocks)
}

function countWords(meta: PostMeta, doc: ContentDoc): number {
  // Source of truth is `text` fields on whatever blocks carry them;
  // list items / column cells / etc. add their own words too. Keep
  // this dumb (split on whitespace) — readability scoring is its own
  // phase.
  const fromBlocks = doc.blocks.reduce((sum, b) => sum + blockWords(b), 0)
  const titleWords = countString(meta.title) + countString(meta.subtitle)
  return fromBlocks + titleWords
}

function blockWords(block: Block): number {
  const counts: number[] = []
  const o = block as unknown as Record<string, unknown>
  if (typeof o.text === 'string') counts.push(countString(o.text))
  if (typeof o.caption === 'string') counts.push(countString(o.caption))
  if (typeof o.body === 'string') counts.push(countString(o.body))
  if (typeof o.headline === 'string') counts.push(countString(o.headline))
  if (typeof o.title === 'string') counts.push(countString(o.title))
  if (typeof o.question === 'string') counts.push(countString(o.question))
  if (Array.isArray(o.items)) {
    for (const it of o.items) {
      const cell = it as Record<string, unknown>
      if (cell && typeof cell === 'object') {
        if (typeof cell.text === 'string') counts.push(countString(cell.text))
        if (typeof cell.title === 'string') counts.push(countString(cell.title))
        if (typeof cell.body === 'string') counts.push(countString(cell.body))
      } else if (typeof it === 'string') {
        counts.push(countString(it))
      }
    }
  }
  if (Array.isArray(o.options)) {
    for (const op of o.options) {
      const cell = op as Record<string, unknown>
      if (typeof cell?.text === 'string') counts.push(countString(cell.text))
    }
  }
  if (Array.isArray(o.images)) {
    for (const im of o.images) {
      const cell = im as Record<string, unknown>
      if (typeof cell?.caption === 'string') counts.push(countString(cell.caption))
    }
  }
  return counts.reduce((a, b) => a + b, 0)
}

function countString(s: string | undefined | null): number {
  if (!s) return 0
  return s.trim().split(/\s+/).filter(Boolean).length
}

function buildCommands({
  setMode,
  onSave,
  onPublish,
  onInsert,
}: {
  setMode: (m: EditorMode) => void
  onSave: () => void
  onPublish: () => void
  onInsert: () => void
}): Command[] {
  return [
    {
      id: 'mode-write',
      group: 'View',
      name: 'Switch to Write mode',
      icon: 'edit',
      shortcut: '⌘1',
      run: () => setMode('write'),
    },
    {
      id: 'mode-style',
      group: 'View',
      name: 'Switch to Style mode',
      icon: 'zap',
      shortcut: '⌘2',
      run: () => setMode('style'),
    },
    {
      id: 'publish',
      group: 'Actions',
      name: 'Publish post',
      icon: 'send',
      shortcut: '⌘↵',
      run: onPublish,
    },
    {
      id: 'save',
      group: 'Actions',
      name: 'Save now',
      icon: 'download',
      shortcut: '⌘S',
      run: onSave,
    },
    {
      id: 'send-test',
      group: 'Actions',
      name: 'Send test email (coming soon)',
      icon: 'flask',
      run: () => {},
    },
    {
      id: 'insert-image',
      group: 'Insert',
      name: 'Insert image',
      icon: 'image',
      insertType: 'image',
      run: onInsert,
    },
    {
      id: 'insert-divider',
      group: 'Insert',
      name: 'Insert divider',
      icon: 'divider',
      insertType: 'divider',
      run: onInsert,
    },
    {
      id: 'insert-button',
      group: 'Insert',
      name: 'Insert button',
      icon: 'button-icon',
      insertType: 'button',
      run: onInsert,
    },
    {
      id: 'insert-poll',
      group: 'Insert',
      name: 'Insert poll',
      icon: 'list',
      insertType: 'poll',
      run: onInsert,
    },
    {
      id: 'insert-paywall',
      group: 'Insert',
      name: 'Add paywall',
      icon: 'lock',
      insertType: 'paywall',
      run: onInsert,
    },
    {
      id: 'find',
      group: 'Tools',
      name: 'Find in document (coming soon)',
      icon: 'search',
      run: () => {},
    },
    {
      id: 'history',
      group: 'Tools',
      name: 'Version history (coming soon)',
      icon: 'rotate',
      run: () => {},
    },
  ]
}

function LoadingShell() {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '100vh',
        background: '#fff',
        color: '#86868b',
        fontSize: 13,
      }}
    >
      Loading post…
    </div>
  )
}

function ErrorShell({ message }: { message: string }) {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '100vh',
        background: '#fff',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <div>
        <Icon name="x-circle" size={28} />
        <div style={{ marginTop: 10, fontSize: 14, color: '#1d1d1f' }}>
          {message}
        </div>
      </div>
    </div>
  )
}

function StylePlaceholder() {
  return (
    <div
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '120px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: '#1d1d1f',
          marginBottom: 8,
        }}
      >
        Style view
      </div>
      <div style={{ fontSize: 13, color: '#86868b', lineHeight: 1.6 }}>
        Theme tokens (colours, typography, spacing) and the per-element
        inspector land in Phase 4. For now switch back to Write mode to
        keep editing.
      </div>
    </div>
  )
}
