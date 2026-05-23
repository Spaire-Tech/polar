'use client'

// Floating "+ Add section" button that lives at the bottom of the customize
// canvas. Renders nothing when every catalog section is already present in
// `order` — the dock is a recovery surface, not a permanent fixture. Clicking
// it opens a popover listing the sections currently missing from the page; a
// click on a row calls `ed.insertSection(id)` which appends the section and
// flips it visible in a single history frame.
//
// Why a bottom-center floating button (vs. between-section "+" gutters):
//   * the customize canvas is the same DOM that renders the public landing,
//     so adding inline insert affordances between sections risks layout
//     bleed-through into preview / publish. A floating dock stays scoped to
//     edit mode (ed.mode === 'edit') and won't ever render in preview.

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@spaire/ui/components/ui/popover'
import { useMemo } from 'react'
import { ADDABLE_SECTION_IDS, SECTION_LABELS, useEditor } from './EditorContext'

export function AddSectionDock({
  availableSectionIds,
}: {
  // Section ids that the current sectionMap can actually render — passed in
  // by the parent so the dock never offers something the canvas won't draw.
  availableSectionIds: string[]
}) {
  const ed = useEditor()

  const missing = useMemo(() => {
    const inOrder = new Set(ed.overrides.order)
    const renderable = new Set(availableSectionIds)
    return ADDABLE_SECTION_IDS.filter(
      (id) => renderable.has(id) && !inOrder.has(id),
    )
  }, [ed.overrides.order, availableSectionIds])

  if (missing.length === 0) return null

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 24,
        zIndex: 40,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        marginTop: 12,
      }}
    >
      <div style={{ pointerEvents: 'auto' }}>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-[12px] font-semibold text-white shadow-lg transition-colors hover:bg-gray-800"
            >
              <PlusIcon />
              <span>
                Add section
                <span className="ml-1 rounded-full bg-white/15 px-1.5 py-px text-[10px] font-medium tracking-wide">
                  {missing.length}
                </span>
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="center"
            side="top"
            sideOffset={8}
            className="w-72 p-2"
          >
            <div className="px-1.5 pb-1.5 text-[11px] font-medium tracking-wide text-gray-500 uppercase">
              Sections you removed
            </div>
            <ul className="flex flex-col gap-0.5">
              {missing.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => ed.insertSection(id)}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[12px] text-gray-700 transition-colors hover:bg-gray-100"
                  >
                    <span className="truncate">{SECTION_LABELS[id] ?? id}</span>
                    <span className="ml-3 text-[10.5px] font-medium tracking-wide text-gray-500 uppercase">
                      Add
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  )
}
