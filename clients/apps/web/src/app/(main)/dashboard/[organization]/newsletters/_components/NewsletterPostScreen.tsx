'use client'

import { useUploadEmailImage } from '@/hooks/queries/emailMarketing'
import {
  useNewsletter,
  useNewsletterPost,
  useTestSendNewsletterPost,
  useUpdateNewsletter,
  useUpdateNewsletterPost,
} from '@/hooks/queries/newsletters'
import { useAuth } from '@/hooks'
import { schemas } from '@spaire/client'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../../email-marketing/_components/Icon'
import { useAutosave } from '../../email-marketing/_components/blockEditor/useAutosave'
import { useDocHistory } from '../../email-marketing/_components/blockEditor/useDocHistory'
import {
  Block,
  ContentDoc,
} from '../../email-marketing/_components/blockEditor/types'
import { Theme } from '../../email-marketing/_components/blockEditor/render'
import { AIPopover } from './AIPopover'
import { CommandPalette, Command } from './CommandPalette'
import { LeftRail } from './LeftRail'
import { PostEditor, PostMeta, TextSelectionAnchor } from './PostEditor'
import { StyleView } from './StyleView'
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
  newsletterId,
  postId,
}: {
  organization: schemas['Organization']
  newsletterId: string
  postId: string
}) {
  const router = useRouter()
  const { data: post, isLoading, error } = useNewsletterPost(postId)
  const { data: newsletter } = useNewsletter(post?.newsletter_id)
  const updateMutation = useUpdateNewsletterPost()
  const updateNewsletter = useUpdateNewsletter()
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
  // Two theme scopes the Style view edits independently:
  //
  //   brandTheme    — Newsletter.theme. Applies to every post in
  //                   this newsletter. Saved via useUpdateNewsletter
  //                   on a separate autosave debouncer.
  //   postOverrides — NewsletterPost.theme_overrides. Sparse;
  //                   overrides specific keys for THIS post only.
  //                   Saved via useUpdateNewsletterPost alongside
  //                   meta + doc.
  //
  // The Style view merges them via resolveTheme for the preview and
  // surfaces a Scope toggle so the user always knows which one they
  // are editing.
  const [brandTheme, setBrandTheme] = useState<Theme>({})
  const [postOverrides, setPostOverrides] = useState<Theme>({})
  const [styleScope, setStyleScope] = useState<'post' | 'brand'>('post')
  const history = useDocHistory(doc, setDocRaw)

  useEffect(() => {
    if (hydrated || !post) return
    // Server → local state handoff on first fetch. The lint rule below
    // disallows setState in effects in general, but this is the legit
    // hydration pattern: the editor takes ownership of an async-loaded
    // document so typing is instant and autosave debounces locally.
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
    if (post.theme_overrides && typeof post.theme_overrides === 'object') {
      setPostOverrides(post.theme_overrides as Theme)
    }
    setHydrated(true)
  }, [post, hydrated])

  // Hydrate brand theme separately when the newsletter arrives. Lives
  // on a different fetch lifecycle than the post; once seeded it's
  // user-driven from here on.
  const [brandHydrated, setBrandHydrated] = useState(false)
  useEffect(() => {
    if (brandHydrated || !newsletter) return
    if (newsletter.theme && typeof newsletter.theme === 'object') {
      setBrandTheme(newsletter.theme as Theme)
    }
    setBrandHydrated(true)
  }, [newsletter, brandHydrated])

  // ── Uploads ─────────────────────────────────────────────────────

  const uploadImage = useCallback(
    async (file: File): Promise<string> => {
      const result = await uploadMutation.mutateAsync(file)
      return result.url
    },
    [uploadMutation],
  )

  // Surfaced in the Style view's preview pill. Prompts the user for
  // an inbox; on confirm, hits the same backend test-send the Publish
  // screen uses. window.prompt is intentionally minimal — Phase 7e
  // polish leaves the heavier inline-flow to the Publish footer where
  // it already lives.
  const testSend = useTestSendNewsletterPost()
  const onSendTestFromStyle = useCallback(async () => {
    if (!post) return
    const email = window.prompt('Send a test of this post to which inbox?')
    if (!email) return
    try {
      await testSend.mutateAsync({ postId: post.id, email })
      window.alert('Test sent.')
    } catch {
      window.alert('Failed to send test.')
    }
  }, [post, testSend])

  // ── Persistence (autosave) ──────────────────────────────────────
  // Skip while we haven't hydrated yet (avoids overwriting the fetched
  // post with the BLANK_DOC fallback during the first paint).
  const save = useCallback(
    async (snapshot: {
      meta: PostMeta
      doc: ContentDoc
      overrides: Theme
    }) => {
      if (!post) return
      // theme_overrides is sparse — only send when the user has
      // actually customised something. An empty {} means "inherit
      // everything from the newsletter default", which we still want
      // to clear on the server when the user resets.
      await updateMutation.mutateAsync({
        postId: post.id,
        body: {
          title: snapshot.meta.title,
          subtitle: snapshot.meta.subtitle || null,
          cover_url: snapshot.meta.cover_url,
          cover_visible: snapshot.meta.cover_visible,
          tags: snapshot.meta.tags,
          content_json: snapshot.doc as unknown as Record<string, unknown>,
          theme_overrides: Object.keys(snapshot.overrides).length
            ? (snapshot.overrides as unknown as Record<string, unknown>)
            : null,
        },
      })
    },
    [post, updateMutation],
  )
  const status = useAutosave(
    { meta, doc, overrides: postOverrides },
    save,
    { enabled: hydrated },
  )

  // Separate autosave for brand-level theme edits. Fires only when the
  // newsletter is loaded AND the user has actually mutated brandTheme
  // (we don't want hydration to round-trip back to the server). Surfaces
  // its status to the Style view's Scope banner.
  const [brandSaveStatus, setBrandSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')
  const saveBrand = useCallback(
    async (snapshot: { brand: Theme }) => {
      if (!newsletter) return
      setBrandSaveStatus('saving')
      try {
        await updateNewsletter.mutateAsync({
          newsletterId: newsletter.id,
          body: {
            theme: snapshot.brand as unknown as Record<string, unknown>,
          },
        })
        setBrandSaveStatus('saved')
        window.setTimeout(() => setBrandSaveStatus('idle'), 1800)
      } catch {
        setBrandSaveStatus('error')
      }
    },
    [newsletter, updateNewsletter],
  )
  useAutosave({ brand: brandTheme }, saveBrand, {
    enabled: brandHydrated,
  })

  // ── Mode / palette / AI ─────────────────────────────────────────

  const [mode, setMode] = useState<EditorMode>('write')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [railOpen, setRailOpen] = useState(true)
  // saveThemeAsDefault is gone. The old single-theme model needed a
  // promote-to-default action; the new two-scope model lets the user
  // edit Newsletter.theme directly via the Style view's Scope toggle
  // and autosaves it through saveBrand.
  const [aiAnchor, setAiAnchor] = useState<TextSelectionAnchor | null>(null)
  // The Range captured at the moment the selection was reported. We
  // keep it in a ref because the popover renders synchronously, but
  // when the user clicks Apply we splice the AI result back at the
  // ORIGINAL selection (not whatever's selected now — they may have
  // clicked into the popover).
  const aiRangeRef = useRef<Range | null>(null)
  const handleTextSelection = useCallback(
    (anchor: TextSelectionAnchor | null) => {
      if (anchor) {
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
          aiRangeRef.current = sel.getRangeAt(0).cloneRange()
        }
        setAiAnchor(anchor)
      } else {
        aiRangeRef.current = null
        setAiAnchor(null)
      }
    },
    [],
  )
  const applyAITransform = useCallback((next: string) => {
    const range = aiRangeRef.current
    aiRangeRef.current = null
    setAiAnchor(null)
    if (!range) return
    // Splice the new text into the contentEditable that owned the
    // selection. We dispatch an `input` event afterwards so
    // EditableText's listener re-reads the DOM and pushes the new
    // value up to React state — same path a regular keystroke takes.
    try {
      range.deleteContents()
      range.insertNode(document.createTextNode(next))
      const container =
        range.startContainer.nodeType === Node.ELEMENT_NODE
          ? (range.startContainer as Element)
          : range.startContainer.parentElement
      const editable = container?.closest('[contenteditable="true"]')
      if (editable) {
        editable.dispatchEvent(new Event('input', { bubbles: true }))
      }
    } catch {
      // Range invalidated (e.g. block deleted between trigger and
      // apply). Swallow — the popover is already closed, and the
      // user can retry.
    }
  }, [])

  // ── Actions (declared before keyboard listener so it can capture them) ──

  // The Publish CTA navigates to the review screen rather than firing
  // the publish endpoint directly. The actual send happens from the
  // sticky footer in PublishPostScreen once the author has reviewed
  // audience / schedule / pre-flight.
  const publish = useCallback(() => {
    if (!post) return
    router.push(
      `/dashboard/${organization.slug}/newsletters/${newsletterId}/posts/${post.id}/publish`,
    )
  }, [post, router, organization.slug, newsletterId])

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
        save({ meta, doc, overrides: postOverrides })
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
  }, [meta, doc, postOverrides, save, publish])

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
        onSave: () => save({ meta, doc, overrides: postOverrides }),
        onPublish: publish,
        onInsert: insertBlockType,
      }),
    [save, publish, meta, doc, postOverrides, insertBlockType],
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
        onSave={() => save({ meta, doc, overrides: postOverrides })}
        onOpenPalette={() => setPaletteOpen(true)}
        onPublish={publish}
        userInitials={userInitials}
        railOpen={railOpen}
        setRailOpen={setRailOpen}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: railOpen && mode === 'write' ? '220px 1fr' : '1fr',
          minHeight: 'calc(100vh - 56px)',
        }}
      >
        {railOpen && mode === 'write' && (
          <LeftRail
            organizationSlug={organization.slug}
            currentPostId={postId}
            newsletterId={post.newsletter_id}
            doc={doc}
            wordCount={wordCount}
          />
        )}
        {mode === 'write' ? (
          <PostEditor
            meta={meta}
            setMeta={setMeta}
            doc={doc}
            setDoc={history.set}
            uploadImage={uploadImage}
            accent={doc.accent}
            onTextSelection={handleTextSelection}
          />
        ) : (
          <StyleView
            meta={meta}
            doc={doc}
            brandTheme={brandTheme}
            postOverrides={postOverrides}
            mode={styleScope}
            setMode={setStyleScope}
            setBrandTheme={setBrandTheme}
            setPostOverrides={setPostOverrides}
            onSendTest={onSendTestFromStyle}
            brandSaveStatus={brandSaveStatus}
          />
        )}
      </div>

      {paletteOpen && (
        <CommandPalette
          commands={commands}
          onClose={() => setPaletteOpen(false)}
        />
      )}

      {aiAnchor && mode === 'write' && (
        <AIPopover
          postId={postId}
          anchor={aiAnchor}
          onApply={applyAITransform}
          onClose={() => {
            aiRangeRef.current = null
            setAiAnchor(null)
          }}
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
}: {
  setMode: (m: EditorMode) => void
  onSave: () => void
  onPublish: () => void
  onInsert: () => void
}): Command[] {
  // Insert / Tools groups were stubbed in earlier phases and never
  // actually dispatched a real action — audit fixes #7 (palette
  // inserts) and #9 (Find / Version history). Until the slash-menu
  // pubsub lands, ship only commands that actually do something.
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

