import { describe, expect, it } from 'vitest'
import { ContentDoc } from '../blockEditor/types'
import { isComposerV3, migrateComposerV3, stripHtml } from './migrate'

describe('composer.v3 migration', () => {
  it('detects composer.v3 by marker and by block vocabulary', () => {
    expect(isComposerV3({ v: 'composer.v3', blocks: [] })).toBe(true)
    expect(isComposerV3({ blocks: [{ type: 'h1', html: 'x' }] })).toBe(true)
    expect(isComposerV3({ version: 1, blocks: [{ type: 'heading' }] })).toBe(false)
    expect(isComposerV3(null)).toBe(false)
    expect(isComposerV3('nope')).toBe(false)
  })

  it('strips contentEditable HTML to clean text and drops font/size styling', () => {
    expect(
      stripHtml('<span style="font-size:11pt">Hi</span> <b>there</b>'),
    ).toBe('Hi there')
    expect(stripHtml('a<br>b')).toBe('a\nb')
    expect(stripHtml('<font color="#f00">x</font>&amp;y')).toBe('x&y')
    expect(stripHtml(undefined)).toBe('')
  })

  it('maps every v3 block type to a ContentDoc block', () => {
    const doc = migrateComposerV3({
      v: 'composer.v3',
      blocks: [
        { id: '1', type: 'text', html: '<b>Hello</b> world' },
        { id: '2', type: 'h1', html: 'Title' },
        { id: '3', type: 'h2', html: 'Sub' },
        { id: '4', type: 'h3', html: 'Small' },
        { id: '5', type: 'quote', html: 'Quoted' },
        { id: '6', type: 'bullet', items: ['one', '<i>two</i>'] },
        { id: '7', type: 'numbered', items: ['first'] },
        { id: '8', type: 'image', src: 'https://x.test/a.png', alt: '', caption: 'cap', link: 'https://x.test' },
        { id: '9', type: 'button', text: 'Go', link: 'https://x.test' },
        { id: '10', type: 'divider' },
        { id: '11', type: 'file', name: 'doc.pdf', size: '1 MB', url: 'https://x.test/doc.pdf' },
        { id: '12', type: 'file', name: 'no-url', size: '0 KB' },
      ],
    }) as ContentDoc

    const types = doc.blocks.map((b) => b.type)
    // file without a URL is dropped; everything else maps.
    expect(types).toEqual([
      'paragraph',
      'heading',
      'heading',
      'heading',
      'quote',
      'list',
      'list',
      'image',
      'button',
      'divider',
      'button',
    ])
    expect(doc.blocks[0]).toMatchObject({ type: 'paragraph', text: 'Hello world' })
    expect(doc.blocks[1]).toMatchObject({ type: 'heading', level: 1, text: 'Title' })
    expect(doc.blocks[5]).toMatchObject({ type: 'list', ordered: false })
    expect(doc.blocks[6]).toMatchObject({ type: 'list', ordered: true })
    expect(doc.blocks[7]).toMatchObject({ type: 'image', alt: 'cap', href: 'https://x.test' })
    expect(doc.blocks[10]).toMatchObject({ type: 'button', text: 'Download doc.pdf', url: 'https://x.test/doc.pdf' })
  })

  it('returns null for non-v3 input', () => {
    expect(migrateComposerV3({ version: 1, blocks: [] })).toBeNull()
    expect(migrateComposerV3(null)).toBeNull()
  })
})
