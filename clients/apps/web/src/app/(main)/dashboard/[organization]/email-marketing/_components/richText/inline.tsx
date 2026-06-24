import * as React from 'react'
import { Fragment } from 'react'
import { safeUrl } from '../reactEmail/util'
import { RichText } from './types'

// Render RichText runs into email-safe inline React nodes for the canonical
// React Email renderer. Marks nest as <strong>/<em>/<u> and links become a
// validated <a>. React escapes the text content, so there's no injection path.
export const renderInline = (
  runs: RichText | undefined,
  linkColor: string,
): React.ReactNode => {
  if (!runs || runs.length === 0) return null
  return runs.map((run, i) => {
    let node: React.ReactNode = run.t
    if (run.b) node = <strong>{node}</strong>
    if (run.i) node = <em>{node}</em>
    if (run.u) node = <u>{node}</u>
    const href = safeUrl(run.href)
    if (href) {
      node = (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          style={{ color: linkColor, textDecoration: 'underline' }}
        >
          {node}
        </a>
      )
    }
    return <Fragment key={i}>{node}</Fragment>
  })
}

// True when runs carry any real text — used to decide rich vs. plain fallback.
export const hasRich = (runs: RichText | undefined): boolean =>
  !!runs && runs.some((r) => r.t.length > 0)
