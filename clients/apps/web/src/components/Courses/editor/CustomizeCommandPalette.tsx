'use client'

// ⌘K command palette for the course landing editor. Aggregates every action
// the user can take from the top bar (and a few that aren't surfaced anywhere
// else) into a single searchable list. Built on the existing shadcn cmdk
// wrapper so it inherits the project's command-palette styling.
//
// Why it lives here (not in a global app palette):
//   * commands are scoped to the editor — Save / Discard / Restore /
//     section navigation only make sense while you're on the customize tab
//   * the palette closes after most actions, but state mutations (theme,
//     visibility, order) propagate through the EditorProvider so the open
//     palette would otherwise re-render mid-keystroke
//
// Open via ⌘K (Cmd+K on Mac, Ctrl+K elsewhere). Close via Escape or by
// running a command. The listener is mount-scoped, so it tears down when the
// user navigates off the customize tab.

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@spaire/ui/components/ui/command'
import { useEffect, useMemo, useState } from 'react'
import {
  ADDABLE_SECTION_IDS,
  SECTION_LABELS,
  useEditor,
  type ResolvedOverrides,
} from './EditorContext'

type Props = {
  // Snapshot loaded when the editor mounted — re-applied by the Discard
  // command. Same value the top-bar Discard button uses.
  initialSnapshot: ResolvedOverrides
  // Mirror of the save-button state from the parent so the palette can
  // gate the Save / Discard commands on it.
  dirty: boolean
  saving: boolean
  onSave: () => void
  previewHref: string
  onDiscarded: () => void
}

export function CustomizeCommandPalette({
  initialSnapshot,
  dirty,
  saving,
  onSave,
  previewHref,
  onDiscarded,
}: Props) {
  const ed = useEditor()
  const [open, setOpen] = useState(false)

  // ⌘K / Ctrl+K toggle. The handler reads `setOpen` directly from the
  // closure (stable identity from useState's setter) so we don't re-bind on
  // every render.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key.toLowerCase() !== 'k') return
      e.preventDefault()
      setOpen((v) => !v)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Helper that wraps an action so the palette closes immediately. Without
  // this, mutations re-render the palette mid-frame, which fights with
  // Radix Dialog's focus restore and can leave focus stuck in the input.
  const run = (action: () => void) => () => {
    setOpen(false)
    // Defer the action one tick so the close transition starts before any
    // state thrash from the action. This isn't strictly necessary but feels
    // noticeably smoother in practice.
    queueMicrotask(action)
  }

  // Scroll a rendered section into view by hitting the data-attribute the
  // EditBlock already sets on its root. Smooth scroll, top-aligned. Falls
  // back gracefully if the id no longer exists (e.g. section was deleted
  // since the palette opened).
  const scrollToSection = (id: string) => {
    const el = document.querySelector<HTMLElement>(
      `[data-spaire-edit-block="${id}"]`,
    )
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const renderedIds = useMemo(
    () => ed.overrides.order.filter((id) => SECTION_LABELS[id]),
    [ed.overrides.order],
  )

  const missingSectionIds = useMemo(() => {
    const inOrder = new Set(ed.overrides.order)
    return ADDABLE_SECTION_IDS.filter((id) => !inOrder.has(id))
  }, [ed.overrides.order])

  const hiddenIds = useMemo(
    () =>
      Object.keys(ed.overrides.visible).filter(
        (id) => ed.overrides.visible[id] === false,
      ),
    [ed.overrides.visible],
  )

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search actions — sections, design, history…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        <CommandGroup heading="Navigate">
          {renderedIds.map((id) => (
            <CommandItem
              key={`nav-${id}`}
              // value drives cmdk's search ranking — include both "go to" and
              // the label so typing either still surfaces the command.
              value={`go to ${SECTION_LABELS[id] ?? id}`}
              onSelect={run(() => scrollToSection(id))}
            >
              <span>Go to {SECTION_LABELS[id] ?? id}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {missingSectionIds.length > 0 || hiddenIds.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Sections">
              {missingSectionIds.map((id) => (
                <CommandItem
                  key={`add-${id}`}
                  value={`add ${SECTION_LABELS[id] ?? id}`}
                  onSelect={run(() => ed.insertSection(id))}
                >
                  <span>Add {SECTION_LABELS[id] ?? id}</span>
                </CommandItem>
              ))}
              {hiddenIds.length > 0 ? (
                <CommandItem
                  value="show all hidden sections"
                  onSelect={run(() => {
                    for (const id of hiddenIds) ed.setVisible(id, true)
                  })}
                >
                  <span>Show all hidden sections ({hiddenIds.length})</span>
                </CommandItem>
              ) : null}
            </CommandGroup>
          </>
        ) : null}

        <CommandSeparator />
        <CommandGroup heading="History">
          <CommandItem
            value="undo"
            disabled={!ed.canUndo}
            onSelect={run(() => ed.undo())}
          >
            <span>Undo</span>
            <CommandShortcut>⌘Z</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="redo"
            disabled={!ed.canRedo}
            onSelect={run(() => ed.redo())}
          >
            <span>Redo</span>
            <CommandShortcut>⌘⇧Z</CommandShortcut>
          </CommandItem>
          {dirty ? (
            <CommandItem
              value="discard unsaved changes"
              onSelect={run(() => {
                ed.restore(initialSnapshot)
                onDiscarded()
              })}
            >
              <span>Discard unsaved changes</span>
            </CommandItem>
          ) : null}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="View">
          <CommandItem
            value="desktop preview"
            onSelect={run(() => ed.setDevice('desktop'))}
          >
            <span>Switch to desktop</span>
            {ed.device !== 'mobile' ? (
              <CommandShortcut>current</CommandShortcut>
            ) : null}
          </CommandItem>
          <CommandItem
            value="mobile preview"
            onSelect={run(() => ed.setDevice('mobile'))}
          >
            <span>Switch to mobile</span>
            {ed.device === 'mobile' ? (
              <CommandShortcut>current</CommandShortcut>
            ) : null}
          </CommandItem>
          <CommandItem
            value="open public preview"
            onSelect={run(() => {
              // window.open returns the new tab; we don't track it. opener
              // is nulled so the public page can't reach back into this one.
              window.open(previewHref, '_blank', 'noopener,noreferrer')
            })}
          >
            <span>Open public preview ↗</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Save">
          <CommandItem
            value="save and publish"
            disabled={saving || !dirty}
            onSelect={run(() => onSave())}
          >
            <span>{dirty ? 'Save & publish' : 'Republish'}</span>
            <CommandShortcut>⏎</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
