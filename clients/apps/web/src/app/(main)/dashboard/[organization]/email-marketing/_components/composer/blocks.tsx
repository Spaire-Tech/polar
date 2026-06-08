'use client'

// Compose-time block engine: contentEditable wrapper, block body, bubble
// menu, +Insert popover, and the document container that hosts them.
// Ported 1:1 from the design's email-blocks.jsx with React/TS idioms.

import React, {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as RDragEvent,
  type ReactNode,
} from 'react'

import { ColorPicker } from './ColorPicker'
import { Icon, type IconName } from './Icon'
import {
  CROP_AR,
  TEXTLIKE,
  defaultBlock,
  readFileAsDataURL,
  type Align,
  type Block,
  type BlockType,
} from './types'

// ---------------------------------------------------------------------------
// Editable (contentEditable wrapper)
// ---------------------------------------------------------------------------

function Editable({
  tag = 'div',
  html,
  onChange,
  onFocus,
  className,
  style,
  placeholder,
  readOnly,
}: {
  tag?: string
  html: string
  onChange?: (next: string) => void
  onFocus?: () => void
  className?: string
  style?: CSSProperties
  placeholder?: string
  readOnly?: boolean
}) {
  const ref = useRef<HTMLElement>(null)

  // Sync html → DOM after every render (not just when `html` changes).
  // When the block type changes, React swaps the DOM element (tag p →
  // h1) but the `html` prop hasn't changed — so a useEffect with
  // [html] deps wouldn't re-fire and the new element would mount empty,
  // wiping the user's text. Running every render with a guard (skip
  // when the element is focused or already matches) keeps the caret
  // stable during typing and forces a resync on tag swap.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (document.activeElement === el) return
    const next = html || ''
    if (el.innerHTML !== next) el.innerHTML = next
  })

  if (readOnly) {
    return React.createElement(tag, {
      className,
      style,
      dangerouslySetInnerHTML: { __html: html || '' },
    })
  }

  // React doesn't type contentEditable on every element; using
  // createElement to stay loose like the source does.
  return React.createElement(tag, {
    ref,
    className,
    style,
    contentEditable: true,
    suppressContentEditableWarning: true,
    spellCheck: false,
    'data-ph': placeholder,
    onFocus,
    onInput: (e: React.FormEvent<HTMLElement>) =>
      onChange?.(e.currentTarget.innerHTML),
  })
}

// ---------------------------------------------------------------------------
// Block body — renders one block type
// ---------------------------------------------------------------------------

const PH: Partial<Record<BlockType, string>> = {
  text: 'Write your message…',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  quote: 'Quote',
}

export function BlockBody({
  b,
  update,
  readOnly,
  pickImage,
}: {
  b: Block
  update?: (patch: Partial<Block>) => void
  readOnly?: boolean
  pickImage?: () => void
}) {
  switch (b.type) {
    case 'text':
    case 'h1':
    case 'h2':
    case 'h3':
    case 'quote': {
      const tag =
        b.type === 'text'
          ? 'p'
          : b.type === 'quote'
            ? 'blockquote'
            : b.type
      const cls = 'b-' + b.type
      const ta: CSSProperties = { textAlign: b.talign || 'left' }
      return (
        <Editable
          tag={tag}
          className={cls}
          style={ta}
          html={b.html}
          placeholder={PH[b.type]}
          readOnly={readOnly}
          onChange={(html) =>
            update?.({ html } as Partial<Block>)
          }
        />
      )
    }
    case 'bullet':
    case 'numbered': {
      const Tag = b.type === 'bullet' ? 'ul' : 'ol'
      const ta: CSSProperties = { textAlign: b.talign || 'left' }
      return (
        <Tag className="b-list" style={ta}>
          {(b.items || []).map((t, i) => (
            <Editable
              key={i}
              tag="li"
              html={t}
              readOnly={readOnly}
              onChange={(h) =>
                update?.({
                  items: b.items.map((it, j) => (j === i ? h : it)),
                } as Partial<Block>)
              }
            />
          ))}
        </Tag>
      )
    }
    case 'image': {
      const ar = CROP_AR[b.crop || 'orig']
      const media = b.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="b-img-real"
          src={b.src}
          alt={b.alt || ''}
          style={ar ? { aspectRatio: ar, objectFit: 'cover' } : undefined}
        />
      ) : (
        <div
          className="b-img-ph"
          style={ar ? { aspectRatio: ar } : undefined}
          onClick={
            readOnly
              ? undefined
              : (e) => {
                  e.stopPropagation()
                  pickImage?.()
                }
          }
        >
          <Icon name="imageFill" size={38} />
          <span>Click to upload an image</span>
        </div>
      )
      const wrapped =
        b.link && readOnly ? (
          <a href={b.link} target="_blank" rel="noreferrer">
            {media}
          </a>
        ) : (
          media
        )
      return (
        <div className={'b-img a-' + (b.align || 'center')}>
          {wrapped}
          {b.caption && <div className="b-cap">{b.caption}</div>}
        </div>
      )
    }
    case 'divider':
      return (
        <div className="b-divider">
          <hr />
        </div>
      )
    case 'button': {
      const btnStyle = {
        background: b.bg || '#000000',
        color: b.color || '#ffffff',
      }
      return (
        <div className={'b-button a-' + (b.align || 'left')}>
          {b.link && readOnly ? (
            <a
              className="b-btn"
              href={b.link}
              target="_blank"
              rel="noreferrer"
              style={btnStyle}
            >
              {b.text || 'Open link'}
            </a>
          ) : (
            <span className="b-btn" style={btnStyle}>
              {b.text || 'View the doc'}
            </span>
          )}
        </div>
      )
    }
    case 'file':
      return (
        <div className="b-file">
          <span className="b-file-icon">
            <Icon name="file" size={22} />
          </span>
          <span className="b-file-meta">
            <b>{b.name}</b>
            <span>{b.size}</span>
          </span>
        </div>
      )
  }
}

// ---------------------------------------------------------------------------
// Bubble menu (text-block formatting)
// ---------------------------------------------------------------------------

type TextBlock = Extract<Block, { type: 'text' | 'h1' | 'h2' | 'h3' | 'quote' | 'bullet' | 'numbered' }>

const NODES: { t: BlockType; label: string }[] = [
  { t: 'text', label: 'Normal text' },
  { t: 'h1', label: 'Heading 1' },
  { t: 'h2', label: 'Heading 2' },
  { t: 'h3', label: 'Heading 3' },
  { t: 'quote', label: 'Quote' },
  { t: 'bullet', label: 'Bulleted list' },
  { t: 'numbered', label: 'Numbered list' },
]

function Bubble({
  b,
  update,
  changeType,
  onDuplicate,
  onDelete,
}: {
  b: TextBlock
  update: (patch: Partial<Block>) => void
  changeType: (next: BlockType) => void
  onDuplicate?: () => void
  onDelete?: () => void
}) {
  const [pop, setPop] = useState<'n' | 'l' | 'c' | null>(null)
  const [linkValue, setLinkValue] = useState('')
  const [textColor, setTextColor] = useState('#000000')
  const [active, setActive] = useState<Record<string, boolean>>({})

  const recompute = useCallback(() => {
    try {
      setActive({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
      })
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', recompute)
    recompute()
    return () => document.removeEventListener('selectionchange', recompute)
  }, [recompute])

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val)
    recompute()
  }

  const ta = b.talign || 'left'

  const F = (k: string, cmd: string, node: ReactNode) => (
    <button
      className={'bm' + (active[k] ? ' on' : '')}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => exec(cmd)}
    >
      {node}
    </button>
  )

  const A = (a: Align, ic: IconName) => (
    <button
      className={'bm' + (ta === a ? ' on' : '')}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => update({ talign: a } as Partial<Block>)}
    >
      <Icon name={ic} size={18} />
    </button>
  )

  return (
    <div
      className="bubble"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ position: 'relative' }}>
        <button
          className="bm bm-aa"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setPop(pop === 'n' ? null : 'n')}
        >
          AA
          <Icon name="chevronDown" size={13} />
        </button>
        {pop === 'n' && (
          <div className="bm-pop">
            {NODES.map((n) => (
              <button
                key={n.t}
                className={n.t === b.type ? 'on' : ''}
                onClick={() => {
                  changeType(n.t)
                  setPop(null)
                }}
              >
                {n.label}
                {n.t === b.type && (
                  <span className="chk">
                    <Icon name="check" size={16} />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <span className="bm-sep"></span>
      {F('bold', 'bold', <b>B</b>)}
      {F('italic', 'italic', <span className="it">I</span>)}
      {F('underline', 'underline', <span className="un">U</span>)}
      {F('strike', 'strikeThrough', <span className="st">S</span>)}
      <span className="bm-sep"></span>
      <button
        className={'bm' + (b.type === 'bullet' ? ' on' : '')}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => changeType(b.type === 'bullet' ? 'text' : 'bullet')}
      >
        <Icon name="bullet" size={18} />
      </button>
      <button
        className={'bm' + (b.type === 'numbered' ? ' on' : '')}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => changeType(b.type === 'numbered' ? 'text' : 'numbered')}
      >
        <Icon name="numbered" size={18} />
      </button>
      <span className="bm-sep"></span>
      {A('left', 'alignLeft')}
      {A('center', 'alignCenter')}
      <span className="bm-sep"></span>
      <div style={{ position: 'relative' }}>
        <button
          className="bm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setPop(pop === 'l' ? null : 'l')}
        >
          <Icon name="link" size={17} />
        </button>
        {pop === 'l' && (
          <div className="bm-pop right">
            <div className="bm-link">
              <input
                autoFocus
                placeholder="Paste a link, then press Done"
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && linkValue) {
                    exec('createLink', linkValue)
                    setPop(null)
                    setLinkValue('')
                  }
                }}
              />
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (linkValue) exec('createLink', linkValue)
                  setPop(null)
                  setLinkValue('')
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
      <span className="bm-sep"></span>
      <div style={{ position: 'relative' }}>
        <button
          className="bm"
          title="Text colour"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setPop(pop === 'c' ? null : 'c')}
        >
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 16,
              height: 16,
              borderRadius: 4,
              background: textColor,
              border: '1px solid rgba(0,0,0,.18)',
            }}
          />
        </button>
        {pop === 'c' && (
          <div className="bm-color-pop">
            <ColorPicker
              value={textColor}
              onChange={(c) => {
                setTextColor(c)
                exec('foreColor', c)
              }}
              label="Text colour"
            />
          </div>
        )}
      </div>
      <span className="bm-sep"></span>
      <button
        className="bm"
        title="Duplicate section"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onDuplicate}
      >
        <Icon name="duplicate" size={17} />
      </button>
      <button
        className="bm danger"
        title="Delete section"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onDelete}
      >
        <Icon name="trash" size={17} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inserter (+ popover with the block library)
// ---------------------------------------------------------------------------

// The + popover only carries blocks that aren't reachable from the
// floating bubble menu. Text styles (Text / H1 / H2 / H3) live on the
// bubble's "AA" dropdown — duplicating them here would just clutter
// the popover.
const INSERTER_GROUPS: {
  label: string
  items: { type: BlockType; label: string; icon: IconName }[]
}[] = [
  {
    label: 'Blocks',
    items: [
      { type: 'image', label: 'Image', icon: 'imageFill' },
      { type: 'button', label: 'Button', icon: 'buttonFill' },
      { type: 'quote', label: 'Quote', icon: 'quote' },
      { type: 'divider', label: 'Divider', icon: 'dividerLine' },
      { type: 'file', label: 'Attach file', icon: 'paperclip' },
    ],
  },
]

function InserterPreview({ type }: { type: BlockType }) {
  switch (type) {
    case 'text':
      return (
        <p className="b-text" style={{ margin: 0 }}>
          Body text — the normal paragraph style for everything you write.
        </p>
      )
    case 'h1':
      return <h1 className="b-h1" style={{ margin: 0, padding: 0 }}>Heading 1</h1>
    case 'h2':
      return <h2 className="b-h2" style={{ margin: 0, padding: 0 }}>Heading 2</h2>
    case 'h3':
      return <h3 className="b-h3" style={{ margin: 0, padding: 0 }}>Heading 3</h3>
    case 'image':
      return (
        <div className="pv-img">
          <Icon name="imageFill" size={40} />
        </div>
      )
    case 'button':
      return <button className="pv-btn">View the doc</button>
    case 'divider':
      return <div style={{ width: '100%', borderTop: '1px solid var(--c-line-2)' }}></div>
    case 'quote':
      return (
        <blockquote className="b-quote" style={{ margin: 0 }}>
          A short, highlighted line your reader won't miss.
        </blockquote>
      )
    case 'file':
      return (
        <div className="b-file" style={{ width: '100%' }}>
          <span className="b-file-icon">
            <Icon name="file" size={22} />
          </span>
          <span className="b-file-meta">
            <b>document.pdf</b>
            <span>1.2 MB</span>
          </span>
        </div>
      )
    default:
      return null
  }
}

function Inserter({
  pos,
  onPick,
  onClose,
}: {
  pos: { top: number; left: number }
  onPick: (type: BlockType) => void
  onClose: () => void
}) {
  const [hover, setHover] = useState<BlockType>('image')
  return (
    <Fragment>
      <div className="inserter-backdrop" onClick={onClose}></div>
      <div
        className="inserter"
        style={{ top: pos.top, left: pos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ins-list">
          {INSERTER_GROUPS.map((g, gi) => (
            <Fragment key={g.label}>
              <div className={'ins-label' + (gi > 0 ? ' mt' : '')}>{g.label}</div>
              {g.items.map((it) => (
                <button
                  key={it.type}
                  className={'ins-item' + (hover === it.type ? ' on' : '')}
                  onMouseEnter={() => setHover(it.type)}
                  onClick={() => onPick(it.type)}
                >
                  <span className="iic">
                    <Icon name={it.icon} size={20} />
                  </span>
                  {it.label}
                </button>
              ))}
            </Fragment>
          ))}
        </div>
        <div className="ins-preview">
          <InserterPreview type={hover} />
        </div>
      </div>
    </Fragment>
  )
}

// ---------------------------------------------------------------------------
// Block wrapper (drag handle + Add button + selected outline + bubble)
// ---------------------------------------------------------------------------

function BlockShell({
  b,
  selected,
  dragging,
  onSelect,
  onDragStart,
  onDragEnd,
  onDragOver,
  update,
  changeType,
  onDuplicate,
  onDelete,
  pickImage,
}: {
  b: Block
  selected: boolean
  dragging: boolean
  onSelect: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (e: RDragEvent<HTMLDivElement>) => void
  update: (patch: Partial<Block>) => void
  changeType: (t: BlockType) => void
  onDuplicate?: () => void
  onDelete?: () => void
  pickImage?: () => void
}) {
  const isText = TEXTLIKE.includes(b.type)

  // The bubble is a *selection* toolbar — it shows only while there's a
  // non-collapsed text selection anchored inside this block, never just
  // because the block was clicked.
  const innerRef = useRef<HTMLDivElement>(null)
  const [hasSelection, setHasSelection] = useState(false)
  useEffect(() => {
    if (!isText) return
    const onSel = () => {
      const s = document.getSelection()
      if (!s || s.isCollapsed || s.rangeCount === 0) {
        setHasSelection(false)
        return
      }
      const node = innerRef.current
      setHasSelection(
        !!node && node.contains(s.getRangeAt(0).commonAncestorContainer),
      )
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [isText])

  return (
    <div
      className={
        'blk' +
        // Only media blocks (image / button / divider) get the selected
        // box outline. Text is just text — selecting it must not wrap it
        // in a box; its bubble menu appears on text selection instead.
        (selected && !isText ? ' sel' : '') +
        (dragging ? ' dragging' : '')
      }
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onDragOver={onDragOver}
    >
      {/* Per-block hover + is gone — the document owns a single floating +
          that follows the user's last click. addOpen / onAdd are kept on
          the prop type only so the parent can still drive the API. */}
      <span
        className="blk-drag"
        draggable
        onDragStart={(e) => {
          const w = (e.currentTarget as HTMLElement).closest('.blk')
          if (w) e.dataTransfer.setDragImage(w as HTMLElement, 20, 14)
          e.dataTransfer.effectAllowed = 'move'
          onDragStart()
        }}
        onDragEnd={onDragEnd}
      >
        <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
          <circle cx="2.5" cy="3" r="1.4" />
          <circle cx="7.5" cy="3" r="1.4" />
          <circle cx="2.5" cy="8" r="1.4" />
          <circle cx="7.5" cy="8" r="1.4" />
          <circle cx="2.5" cy="13" r="1.4" />
          <circle cx="7.5" cy="13" r="1.4" />
        </svg>
      </span>
      <div className="blk-inner" ref={innerRef}>
        {isText && hasSelection && (
          <Bubble
            b={b as TextBlock}
            update={update}
            changeType={changeType}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        )}
        <BlockBody b={b} update={update} pickImage={pickImage} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function MailDocument({
  header,
  blocks,
  selId,
  onSelect,
  update,
  changeType,
  addBlock,
  pickImageFor,
  drag,
  dropIdx,
  setDropIdx,
  onDragStart,
  onDragEnd,
  onDrop,
  onDuplicate,
  onDelete,
}: {
  header: ReactNode
  blocks: Block[]
  selId: string | null
  onSelect: (id: string | null) => void
  update: (id: string, patch: Partial<Block>) => void
  changeType: (id: string, t: BlockType) => void
  addBlock: (type: BlockType, at?: number) => void
  pickImageFor: (id: string) => void
  drag: string | null
  dropIdx: number | null
  setDropIdx: (i: number | null) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDrop: () => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}) {
  // Single floating + button driven by the last click anywhere inside
  // the document. `pos` is where the + is drawn (relative to the
  // scrollable doc-col); `index` is the insertion index in the blocks
  // array that the inserter will use when something is picked.
  const [plus, setPlus] = useState<{
    top: number
    left: number
    index: number
  } | null>(null)
  const [showInserter, setShowInserter] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Compute "what index does this click correspond to?" by walking the
  // rendered blocks and finding the one whose midpoint is just below
  // the click Y. Inserts go AFTER that block; clicks above everything
  // insert at index 0.
  const indexForClick = (clientY: number): number => {
    const body = bodyRef.current
    if (!body) return blocks.length
    const children = Array.from(
      body.querySelectorAll<HTMLDivElement>(':scope > .blk'),
    )
    for (let i = 0; i < children.length; i++) {
      const r = children[i].getBoundingClientRect()
      if (clientY < r.top + r.height / 2) return i
    }
    return children.length
  }

  const handleDocClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Clicks inside the inserter popover shouldn't reposition the +.
    if ((e.target as HTMLElement).closest('.inserter')) return
    onSelect(null)
    const host = scrollRef.current
    if (!host) return
    const hr = host.getBoundingClientRect()
    const composeCol = (e.target as HTMLElement).closest('.compose')
    const left = composeCol
      ? composeCol.getBoundingClientRect().left - hr.left + host.scrollLeft - 46
      : 8
    setPlus({
      top: e.clientY - hr.top + host.scrollTop - 12,
      left,
      index: indexForClick(e.clientY),
    })
    setShowInserter(false)
  }

  const pick = (type: BlockType) => {
    if (!plus) return
    addBlock(type, plus.index)
    setShowInserter(false)
    setPlus(null)
  }

  // Clicking in the blank area below the last block (or between blocks)
  // inserts a paragraph at the closest position and focuses it. Mirrors
  // Gmail / Substack / Notion-style click-to-write affordance.
  const handleBodyClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onSelect(null)
    const body = bodyRef.current
    if (!body) return
    // Ignore clicks that landed on an actual block.
    if ((e.target as HTMLElement).closest('.blk')) return
    const y = e.clientY
    const children = Array.from(body.querySelectorAll<HTMLDivElement>(':scope > .blk'))
    let insertAt = children.length
    for (let i = 0; i < children.length; i++) {
      const r = children[i].getBoundingClientRect()
      if (y < r.top + r.height / 2) {
        insertAt = i
        break
      }
    }
    addBlock('text', insertAt)
  }

  return (
    <div
      className="doc-col"
      ref={scrollRef}
      onClick={handleDocClick}
      onDragOver={(e) => {
        if (drag) e.preventDefault()
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop()
      }}
    >
      <div className="compose">
        {header}
        <div className="doc-col-body" ref={bodyRef}>
          {blocks.map((b, i) => (
            <Fragment key={b.id}>
              {dropIdx === i && <div className="drop-line"></div>}
              <BlockShell
                b={b}
                selected={selId === b.id}
                dragging={drag === b.id}
                onSelect={() => onSelect(b.id)}
                onDragStart={() => onDragStart(b.id)}
                onDragEnd={onDragEnd}
                onDragOver={(e) => {
                  if (!drag) return
                  e.preventDefault()
                  const k = blocks.findIndex((x) => x.id === b.id)
                  const rr = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  setDropIdx(e.clientY > rr.top + rr.height / 2 ? k + 1 : k)
                }}
                update={(patch) => update(b.id, patch)}
                changeType={(t) => changeType(b.id, t)}
                onDuplicate={() => onDuplicate(b.id)}
                onDelete={() => onDelete(b.id)}
                pickImage={() => pickImageFor(b.id)}
              />
            </Fragment>
          ))}
          {dropIdx === blocks.length && <div className="drop-line"></div>}
        </div>
      </div>
      {plus && (
        <button
          className={'blk-add floating' + (showInserter ? ' spin' : '')}
          style={{ top: plus.top, left: plus.left }}
          onClick={(e) => {
            e.stopPropagation()
            setShowInserter((v) => !v)
          }}
        >
          <Icon name="plus" size={17} />
        </button>
      )}
      {plus && showInserter && (
        <Inserter
          pos={{ top: plus.top + 38, left: plus.left }}
          onPick={pick}
          onClose={() => setShowInserter(false)}
        />
      )}
    </div>
  )
}

export { defaultBlock, readFileAsDataURL }
