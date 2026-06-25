// Generator (not a real assertion test): renders BroadcastEditorV3 to static
// HTML and writes a self-contained harness file the Playwright screenshot
// script loads. Lets us verify pixel-fidelity against the uploaded design in a
// real browser. Run: vitest run _harness.gen.test.tsx
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it } from 'vitest'

import { BroadcastEditorV3 } from './BroadcastEditorV3'

describe('v3 harness generator', () => {
  it('writes harness.html', () => {
    const body = renderToStaticMarkup(<BroadcastEditorV3 />)
    const css = readFileSync(join(__dirname, 'editor.css'), 'utf8')
    const page = (cls: string) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<style>html,body{margin:0;height:100%}${css}</style></head><body>${body.replace('class="bem"', `class="${cls}"`)}</body></html>`
    const OUT = '/tmp/claude-0/-home-user-polar/0876f8ca-cda2-5d32-a80c-eba2372f3569/scratchpad/render'
    writeFileSync(join(OUT, 'harness-light.html'), page('bem'))
    writeFileSync(join(OUT, 'harness-dark.html'), page('bem dark'))
  })
})
