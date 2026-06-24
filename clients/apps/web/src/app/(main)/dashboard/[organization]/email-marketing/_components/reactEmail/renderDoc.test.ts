import { describe, expect, it } from 'vitest'
import { ContentDoc } from '../blockEditor/types'
import { renderDocToHtml } from './renderDoc'

const doc = (blocks: ContentDoc['blocks'], accent?: string): ContentDoc => ({
  version: 1,
  accent,
  blocks,
})

describe('renderDocToHtml (canonical React Email renderer)', () => {
  it('returns empty string for empty/missing docs', async () => {
    expect(await renderDocToHtml(null)).toBe('')
    expect(await renderDocToHtml(undefined)).toBe('')
    expect(await renderDocToHtml(doc([]))).toBe('')
  })

  it('is deterministic — same input renders identically', async () => {
    const d = doc([
      { id: 'a', type: 'heading', level: 1, text: 'Hello' },
      { id: 'b', type: 'paragraph', text: 'One\nTwo' },
    ])
    const [x, y] = await Promise.all([renderDocToHtml(d), renderDocToHtml(d)])
    expect(x).toBe(y)
  })

  it('renders headings, paragraphs (with line breaks) and lists', async () => {
    const html = await renderDocToHtml(
      doc([
        { id: 'h', type: 'heading', level: 2, text: 'Title' },
        { id: 'p', type: 'paragraph', text: 'Line A\nLine B' },
        {
          id: 'l',
          type: 'list',
          ordered: true,
          items: [
            { id: 'i1', text: 'First' },
            { id: 'i2', text: 'Second' },
          ],
        },
      ]),
    )
    expect(html).toContain('Title')
    expect(html).toContain('Line A')
    expect(html).toContain('<br')
    expect(html).toContain('Line B')
    expect(html).toMatch(/<ol[\s>]/)
    expect(html).toContain('First')
    expect(html).toContain('Second')
  })

  it('escapes user text — no raw HTML injection', async () => {
    const html = await renderDocToHtml(
      doc([{ id: 'x', type: 'paragraph', text: '<script>alert(1)</script>' }]),
    )
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('never emits <video> or <iframe> for video blocks', async () => {
    const html = await renderDocToHtml(
      doc([
        {
          id: 'v',
          type: 'video',
          embed_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        },
      ]),
    )
    expect(html).not.toMatch(/<video[\s>]/i)
    expect(html).not.toMatch(/<iframe[\s>]/i)
  })

  it('derives a YouTube poster thumbnail (never the page URL as <img>)', async () => {
    const html = await renderDocToHtml(
      doc([
        {
          id: 'v',
          type: 'video',
          embed_url: 'https://youtu.be/dQw4w9WgXcQ',
        },
      ]),
    )
    // Poster image points at YouTube's thumbnail CDN, linked to the watch page.
    expect(html).toContain('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
    expect(html).toContain('youtu.be/dQw4w9WgXcQ')
    // The page URL must NOT be used as an <img src> (the legacy broken-image bug).
    expect(html).not.toMatch(/<img[^>]+src="https:\/\/youtu\.be/i)
  })

  it('falls back to a text "watch" card when no thumbnail can be derived', async () => {
    const html = await renderDocToHtml(
      doc([{ id: 'v', type: 'video', embed_url: 'https://vimeo.com/123456789' }]),
    )
    expect(html).not.toMatch(/<img/i) // no broken poster image
    expect(html.toLowerCase()).toContain('watch the video')
    expect(html).toContain('vimeo.com/123456789')
  })

  it('drops video blocks whose only URL is a blob:/data: (never resolves in an inbox)', async () => {
    const html = await renderDocToHtml(
      doc([{ id: 'v', type: 'video', src: 'blob:https://app/abc-123' }]),
    )
    expect(html).not.toContain('blob:')
    expect(html).not.toMatch(/<img/i)
  })

  it('rejects unsafe image/button/link URLs', async () => {
    const html = await renderDocToHtml(
      doc([
        { id: 'i', type: 'image', src: 'javascript:alert(1)', alt: 'x' },
        { id: 'b', type: 'button', text: 'Go', url: 'data:text/html,evil' },
      ]),
    )
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('data:text/html')
  })

  it('applies the doc accent to accent-colored blocks', async () => {
    const html = await renderDocToHtml(
      doc(
        [{ id: 'e', type: 'eyebrow', text: 'NEWS' }],
        '#0066cc',
      ),
    )
    expect(html.toLowerCase()).toContain('#0066cc')
  })

  it('exercises every block type without throwing', async () => {
    const html = await renderDocToHtml(
      doc([
        { id: '1', type: 'eyebrow', text: 'Eyebrow' },
        { id: '2', type: 'heading', level: 1, text: 'H1' },
        { id: '3', type: 'heading', level: 2, text: 'Big', huge: true },
        { id: '4', type: 'subheading', text: 'Sub' },
        { id: '5', type: 'paragraph', text: 'Para' },
        { id: '6', type: 'badge', text: 'New' },
        { id: '7', type: 'image', src: 'https://x.test/a.png', alt: 'A' },
        { id: '8', type: 'button', text: 'Click', url: 'https://x.test' },
        { id: '9', type: 'divider' },
        { id: '10', type: 'list', items: [{ id: 'a', text: 'x' }] },
        { id: '11', type: 'quote', text: 'Q', cite: 'C' },
        {
          id: '12',
          type: 'columns',
          cols: [{ id: 'c1', title: 'T', value: 'V' }],
        },
        {
          id: '13',
          type: 'checklist',
          items: [{ id: 'k1', title: 'Step', body: 'do it' }],
        },
        { id: '14', type: 'event-card', date: '12', day: 'JUN', title: 'Ev', meta: 'm' },
        {
          id: '15',
          type: 'receipt',
          items: [{ id: 'r1', name: 'Item', price: '$9' }],
          total: '$9',
        },
        { id: '16', type: 'digest-item', num: '1', title: 'D', meta: 'm', body: 'b' },
      ]),
    )
    expect(html).toContain('Eyebrow')
    expect(html).toContain('H1')
    expect(html).toContain('Total')
    expect(html.length).toBeGreaterThan(200)
  })
})
