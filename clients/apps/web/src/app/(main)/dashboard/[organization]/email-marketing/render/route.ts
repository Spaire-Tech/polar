import { NextRequest, NextResponse } from 'next/server'
import { renderDocToHtml } from '../_components/reactEmail/renderDoc'

// Renders a ContentDoc to email HTML server-side via React Email. Running it
// in Node (not the client) guarantees React Email's renderer works and means
// the stored/sent content_html is produced by the SAME path as the preview —
// preview === sent === stored.
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const doc = body?.doc
    if (!doc || typeof doc !== 'object' || !Array.isArray(doc.blocks)) {
      return NextResponse.json({ error: 'invalid doc' }, { status: 400 })
    }
    const html = await renderDocToHtml(doc)
    return NextResponse.json({ html })
  } catch {
    return NextResponse.json({ error: 'render failed' }, { status: 500 })
  }
}
