import { describe, expect, it } from 'vitest'
import { mergeAdjacent, pmDocToRuns, runsToPMDoc } from './convert'
import { RichText } from './types'

describe('richText convert', () => {
  it('round-trips runs -> PM doc -> runs', () => {
    const runs: RichText = [
      { t: 'Hello ' },
      { t: 'bold', b: true },
      { t: ' and ' },
      { t: 'link', href: 'https://x.test' },
    ]
    expect(pmDocToRuns(runsToPMDoc(runs))).toEqual(runs)
  })

  it('maps strong/em aliases and link attrs from a PM doc', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'a', marks: [{ type: 'strong' }] },
            { type: 'text', text: 'b', marks: [{ type: 'em' }] },
            {
              type: 'text',
              text: 'c',
              marks: [{ type: 'link', attrs: { href: 'https://y.test' } }],
            },
          ],
        },
      ],
    }
    expect(pmDocToRuns(doc)).toEqual([
      { t: 'a', b: true },
      { t: 'b', i: true },
      { t: 'c', href: 'https://y.test' },
    ])
  })

  it('merges adjacent identical-mark runs', () => {
    expect(
      mergeAdjacent([
        { t: 'foo', b: true },
        { t: 'bar', b: true },
        { t: 'baz' },
      ]),
    ).toEqual([{ t: 'foobar', b: true }, { t: 'baz' }])
  })

  it('drops empty text nodes and tolerates an empty paragraph', () => {
    expect(pmDocToRuns({ type: 'doc', content: [{ type: 'paragraph' }] })).toEqual(
      [],
    )
    expect(runsToPMDoc([])).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    })
  })
})
