import { render } from '@react-email/components'
import * as React from 'react'
import { ContentDoc } from '../blockEditor/types'
import { DocBody } from './EmailBlocks'

// Canonical render: ContentDoc -> email-safe inner HTML, via React Email.
//
// This is the single source of truth for what a broadcast looks like — used
// for the live preview AND for the content_html persisted/sent, so preview
// === sent === stored. Returns just the block markup (no <html>/<body>); the
// server's MarketingEmailWrapper supplies the shell.
export const renderDocToHtml = async (
  doc: ContentDoc | null | undefined,
): Promise<string> => {
  if (!doc || !doc.blocks?.length) return ''
  const html = await render(<DocBody doc={doc} />, { pretty: false })
  // React Email may prepend a doctype when a full document is detected; we
  // only ever render a fragment, but strip defensively so the contract
  // (inner HTML only) is guaranteed.
  return html.replace(/^<!DOCTYPE[^>]*>/i, '').trim()
}
