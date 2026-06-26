import { describe, expect, it } from 'vitest'

import { mapCourse } from './courseMap'

// Minimal CourseRead-shaped fixture (only the fields mapCourse reads).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const course: any = {
  title: 'Knife Skills',
  slug: 'knife-skills',
  description: 'Sharp fundamentals.',
  thumbnail_url: 'https://cdn/hero.jpg',
  trailer_url: 'https://cdn/trailer.mp4',
  instructor_name: 'Marco Pierre',
  instructor_bio: 'Twenty years at the pass.',
  format: 'course',
  modules: [
    {
      lessons: [
        { title: 'Holding the Blade', duration_seconds: 7 * 60 },
        { title: 'The Rock Chop', duration_seconds: 11 * 60 },
      ],
    },
    { lessons: [{ title: 'Julienne', duration_seconds: 90 * 60 }] },
  ],
}

describe('mapCourse', () => {
  it('flattens modules→lessons and formats durations', () => {
    const c = mapCourse(course)
    expect(c.title).toBe('Knife Skills')
    expect(c.heroImage).toBe('https://cdn/hero.jpg')
    expect(c.trailerImage).toBe('https://cdn/trailer.mp4')
    expect(c.instructor.name).toBe('Marco Pierre')
    expect(c.lessons).toHaveLength(3)
    expect(c.lessons[0]).toEqual({ title: 'Holding the Blade', duration: '7 min' })
    expect(c.lessons[2].duration).toBe('1h 30m')
    // total 7+11+90 = 108 min = 1h 48m
    expect(c.totalDuration).toBe('1h 48m')
    expect(c.progress).toEqual({ completed: 0, total: 3 })
    expect(c.welcome).toEqual(['Sharp fundamentals.'])
  })

  it('tolerates null fields', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bare: any = {
      title: null,
      description: null,
      thumbnail_url: null,
      trailer_url: null,
      instructor_name: null,
      instructor_bio: null,
      format: 'series',
      modules: [],
    }
    const c = mapCourse(bare)
    expect(c.title).toBe('Untitled course')
    expect(c.eyebrow).toBe('A Spaire Series')
    expect(c.lessons).toEqual([])
    expect(c.welcome).toEqual([])
    expect(c.totalDuration).toBe('0m')
  })
})
