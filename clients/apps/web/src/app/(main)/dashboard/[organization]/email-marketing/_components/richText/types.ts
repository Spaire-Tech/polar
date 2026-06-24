// Inline rich-text model for text-like blocks.
//
// A block's text is an array of "runs": a string with optional marks. This is
// the minimal representation that supports per-SELECTION formatting (the thing
// the old editor couldn't do — it only had whole-block styles). It is
// deliberately tiny and email-safe: only bold / italic / underline / link,
// because those are the marks every inbox renders reliably.
//
// Backward compatible: blocks still carry a plain `text` string (kept in sync
// via runsToText) so the legacy renderer, search, and the server fallback keep
// working even though the canonical React Email renderer reads `rich`.

export type Inline = {
  t: string
  b?: true // bold
  i?: true // italic
  u?: true // underline
  href?: string // link (http/https/mailto only — validated at render time)
}

export type RichText = Inline[]

export const runsToText = (runs: RichText | undefined): string =>
  (runs ?? []).map((r) => r.t).join('')

export const textToRuns = (text: string | undefined): RichText =>
  text ? [{ t: text }] : []

export const isEmptyRuns = (runs: RichText | undefined): boolean =>
  !runs || runs.every((r) => r.t.length === 0)
