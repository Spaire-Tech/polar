// Pure conversions between our compact RichText runs and TipTap/ProseMirror
// JSON. Kept free of any TipTap import so it runs (and is tested) in plain
// Node — the editor component is a thin wrapper over these.

import { Inline, RichText } from './types'

type PMMark = { type: string; attrs?: Record<string, unknown> }
type PMNode = {
  type: string
  text?: string
  marks?: PMMark[]
  content?: PMNode[]
}

const marksToRun = (text: string, marks: PMMark[] | undefined): Inline => {
  const run: Inline = { t: text }
  for (const m of marks ?? []) {
    if (m.type === 'bold' || m.type === 'strong') run.b = true
    else if (m.type === 'italic' || m.type === 'em') run.i = true
    else if (m.type === 'underline') run.u = true
    else if (m.type === 'link') {
      const href = m.attrs?.href
      if (typeof href === 'string' && href) run.href = href
    }
  }
  return run
}

const runToMarks = (run: Inline): PMMark[] => {
  const marks: PMMark[] = []
  if (run.b) marks.push({ type: 'bold' })
  if (run.i) marks.push({ type: 'italic' })
  if (run.u) marks.push({ type: 'underline' })
  if (run.href) marks.push({ type: 'link', attrs: { href: run.href } })
  return marks
}

// Walk every text node in the doc (across paragraphs, in order) into runs.
// We model one block as a single line, so multiple paragraphs are flattened.
export const pmDocToRuns = (doc: PMNode | null | undefined): RichText => {
  const runs: RichText = []
  const walk = (node: PMNode | undefined) => {
    if (!node) return
    if (node.type === 'text' && typeof node.text === 'string') {
      if (node.text.length > 0) runs.push(marksToRun(node.text, node.marks))
      return
    }
    for (const child of node.content ?? []) walk(child)
  }
  walk(doc ?? undefined)
  return mergeAdjacent(runs)
}

// Coalesce neighbouring runs with identical marks so the stored doc is compact
// and round-trips stably (TipTap can split a styled span into two text nodes).
export const mergeAdjacent = (runs: RichText): RichText => {
  const out: RichText = []
  for (const run of runs) {
    const prev = out[out.length - 1]
    if (
      prev &&
      !!prev.b === !!run.b &&
      !!prev.i === !!run.i &&
      !!prev.u === !!run.u &&
      prev.href === run.href
    ) {
      prev.t += run.t
    } else {
      out.push({ ...run })
    }
  }
  return out
}

// RichText -> a single-paragraph ProseMirror doc for TipTap to load.
export const runsToPMDoc = (runs: RichText | undefined): PMNode => {
  const content: PMNode[] = (runs ?? [])
    .filter((r) => r.t.length > 0)
    .map((run) => {
      const marks = runToMarks(run)
      const node: PMNode = { type: 'text', text: run.t }
      if (marks.length) node.marks = marks
      return node
    })
  const paragraph: PMNode = { type: 'paragraph' }
  if (content.length) paragraph.content = content
  return { type: 'doc', content: [paragraph] }
}
