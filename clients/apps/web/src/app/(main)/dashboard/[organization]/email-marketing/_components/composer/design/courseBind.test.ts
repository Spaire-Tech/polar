import { describe, expect, it } from 'vitest'

import type { CourseData } from '../v3/courseData'
import { bindCourse, makeAssetResolver } from './courseBind'
import { REG, THEMES, TEMPLATES } from './emailData'
import type { Block } from './emailEngine'

// Build a real template's blocks the way the engine does (defaults + template props).
function blocksFor(triggerKey: string, themeKey = 'studio'): Block[] {
  const t = THEMES[themeKey]
  return TEMPLATES[triggerKey].blocks.map((s, i) => ({
    id: 'b' + i,
    type: s.type,
    props: Object.assign({}, REG[s.type].defaults(t), s.props),
  }))
}

const course: CourseData = {
  title: 'Italian Home Cooking',
  eyebrow: 'A Spaire Series',
  tagline: 'Pasta from scratch.',
  heroImage: 'https://cdn/hero.jpg',
  trailerImage: 'https://cdn/trailer.jpg',
  instructor: { name: 'Marco Rossi', role: 'Head Chef', bio: 'Bologna-trained.', avatar: null },
  lessons: [
    { title: 'Fresh Pasta', duration: '18 min' },
    { title: 'Mother Sauces', duration: '24 min' },
    { title: 'Sunday Ragù', duration: '33 min' },
    { title: 'Risotto', duration: '21 min' },
    { title: 'Tiramisù', duration: '16 min' },
    { title: 'Plating', duration: '12 min' },
  ],
  level: 'All levels',
  totalDuration: '2h 04m',
  progress: { completed: 0, total: 6 },
  welcome: [],
  ctaText: 'Start',
  ctaHref: '#',
}

describe('bindCourse', () => {
  it('binds the enrolment template to the real course', () => {
    const blocks = bindCourse(blocksFor('enrolment'), course)
    const cover = blocks.find((b) => b.type === 'coverHero')!
    expect(cover.props.title).toBe('Italian Home Cooking')
    expect(cover.props.instructor).toBe('Taught by Marco Rossi')
    expect(cover.props.img).toBe('https://cdn/hero.jpg')

    const lessons = blocks.find((b) => b.type === 'lessons')!
    expect(lessons.props.items.map((i: { title: string }) => i.title)).toEqual([
      'Fresh Pasta', 'Mother Sauces', 'Sunday Ragù', 'Risotto', 'Tiramisù', 'Plating',
    ])

    const meta = blocks.find((b) => b.type === 'meta')!
    expect(meta.props.items.map((i: { v: string }) => i.v)).toEqual(['6 lessons', '2h 04m', 'All levels'])

    const instructor = blocks.find((b) => b.type === 'instructor')!
    expect(instructor.props.name).toBe('Marco Rossi')
    expect(instructor.props.role).toBe('Head Chef')

    const note = blocks.find((b) => b.type === 'note')!
    expect(note.props.sign).toBe('Marco Rossi')
    expect(note.props.signRole).toBe('Head Chef')
  })

  it('re-bases the halfway progress ratio onto the real lesson count', () => {
    const blocks = bindCourse(blocksFor('halfway'), course)
    const progress = blocks.find((b) => b.type === 'progress')!
    // template was 6/12 (50%) → 3/6 against a 6-lesson course
    expect(progress.props.total).toBe(6)
    expect(progress.props.value).toBe(3)
    // a bare course-name hero subtitle is swapped for the real course
    const cover = blocks.find((b) => b.type === 'coverHero')!
    expect(cover.props.instructor).toBe('Italian Home Cooking')
  })

  it('leaves blocks untouched when no course is provided', () => {
    const before = blocksFor('enrolment')
    const after = bindCourse(blocksFor('enrolment'), undefined)
    expect(after[0].props.title).toBe(before[0].props.title)
  })
})

describe('makeAssetResolver', () => {
  it('maps design asset keys to course media, passes real URLs through', () => {
    const r = makeAssetResolver(course)
    expect(r('assets/southern-cooking.jpg')).toBe('https://cdn/hero.jpg')
    expect(r('https://x/y.png')).toBe('https://x/y.png')
  })
  it('falls back to a neutral placeholder when there is no course media', () => {
    const r = makeAssetResolver(undefined)
    expect(r('assets/southern-cooking.jpg')).toContain('data:image/svg+xml')
  })
})
