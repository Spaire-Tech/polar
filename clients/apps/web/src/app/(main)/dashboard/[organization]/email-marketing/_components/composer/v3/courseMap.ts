// Brick 15 — map a real Polar course (CourseRead) onto the editor's CourseData.
// Pure (type-only import of CourseRead) so it's unit-testable in isolation.

import type { CourseRead } from '@/hooks/queries/courses'

import {
  formatDuration,
  totalDurationOf,
  type CourseData,
} from './courseData'

export function mapCourse(c: CourseRead): CourseData {
  const lessons = c.modules.flatMap((m) => m.lessons)
  const seconds = lessons.map((l) => l.duration_seconds ?? 0)
  return {
    title: c.title ?? 'Untitled course',
    eyebrow: c.format === 'series' ? 'A Spaire Series' : 'A Spaire Course',
    tagline: c.description ?? '',
    heroImage: c.thumbnail_url,
    trailerImage: c.trailer_url,
    instructor: {
      name: c.instructor_name ?? '',
      role: 'Instructor',
      bio: c.instructor_bio ?? '',
      avatar: null,
    },
    lessons: lessons.map((l) => ({
      title: l.title,
      duration: l.duration_seconds ? formatDuration(l.duration_seconds) : '',
    })),
    level: 'All levels',
    totalDuration: totalDurationOf(seconds),
    // Progress is per-subscriber; at edit time we preview the full course.
    progress: { completed: 0, total: lessons.length },
    welcome: c.description ? [c.description] : [],
    ctaText: 'Start the course',
    ctaHref: '#',
  }
}
