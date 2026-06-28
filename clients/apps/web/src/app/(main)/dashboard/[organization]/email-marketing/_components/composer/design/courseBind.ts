// Auto-bind a freshly-loaded template's blocks to the REAL course, in place,
// while keeping every field editable (we only seed initial props). The creator
// designed each lifecycle email's voice; binding swaps the placeholder course
// (Southern Cooking) for the live one: lessons, cover image/title, course
// facts, instructor and trailer. Lifecycle copy (notes, CTAs, hero phrases) is
// left untouched — that's the template's job.

import type { CourseData } from '../v3/courseData'
import type { Block } from './emailEngine'

const PLACEHOLDER_TITLE = 'Southern Cooking'
const PLACEHOLDER_INSTRUCTOR = 'Adaeze Bello'

/** Swap the design's placeholder course name for the real one, anywhere it
 *  appears (e.g. "Southern Cooking, all twelve lessons"). */
const swapCourseName = (s: string, title: string): string =>
  String(s ?? '').split(PLACEHOLDER_TITLE).join(title)

export function bindCourse(
  blocks: Block[],
  course: CourseData | undefined,
  creatorName?: string,
): Block[] {
  if (!course) return blocks
  const hasLessons = course.lessons.length > 0
  const lessonCount = course.lessons.length
  const inst = course.instructor
  // The name every block signs with: the course's instructor if set, otherwise
  // the creator/organization. NEVER the design's placeholder ("Adaeze Bello").
  const instructorName = (inst.name || creatorName || '').trim()
  const instructorRole = (inst.role || 'Instructor').trim()
  const instructorBio = (inst.bio || '').trim()
  // Replace the placeholder name wherever it signs a block.
  const swapInstructor = (s: string): string => {
    const v = String(s ?? '')
    if (!instructorName) return v
    return v.split(PLACEHOLDER_INSTRUCTOR).join(instructorName)
  }

  for (const b of blocks) {
    const p = b.props
    switch (b.type) {
      case 'coverHero': {
        if (course.heroImage) p.img = course.heroImage
        // The cover title is the course-name slot only when the template used
        // the placeholder course name; lifecycle phrases ("A good start.") stay.
        if (p.title) p.title = swapCourseName(p.title, course.title)
        // Hero subtitle: "Taught by X" / "with X" → real instructor; a bare
        // course-name subtitle → the real course name.
        if (/^(taught by|with)\b/i.test(String(p.instructor || ''))) {
          if (instructorName)
            p.instructor = (String(p.instructor).match(/^taught by/i) ? 'Taught by ' : 'with ') + instructorName
        } else if (p.instructor) {
          p.instructor = swapCourseName(swapInstructor(p.instructor), course.title)
        }
        break
      }
      case 'meta': {
        p.items = [
          { v: `${lessonCount || 12} lessons` },
          { v: course.totalDuration || '—' },
          { v: course.level || 'All levels' },
        ]
        break
      }
      case 'lessons': {
        if (hasLessons) {
          const isStillToCome = String(p.heading || '').toLowerCase().includes('still to come')
          const src = isStillToCome ? course.lessons.slice(Math.ceil(course.lessons.length / 2)) : course.lessons
          const list = src.length ? src : course.lessons
          p.items = list.map((l) => ({ title: l.title, meta: l.duration }))
        }
        break
      }
      case 'progress': {
        // Re-base the lifecycle ratio onto the real lesson count so "halfway"
        // stays ~50% (e.g. 6/12 → 3/6) instead of breaking to 6/6.
        const newTotal = course.progress.total || lessonCount
        if (newTotal) {
          const oldTotal = Math.max(1, Number(p.total) || newTotal)
          const ratio = (Number(p.value) || 0) / oldTotal
          p.total = newTotal
          p.value = Math.round(ratio * newTotal)
        }
        break
      }
      case 'instructor': {
        if (instructorName) p.name = instructorName
        p.role = instructorRole
        // Real bio if the course has one; otherwise a neutral factual line —
        // never the placeholder's fabricated "Adaeze runs a Charleston kitchen".
        p.bio =
          instructorBio ||
          (instructorName
            ? `Meet ${instructorName}, your instructor for ${course.title}.`
            : `Your instructor for ${course.title}.`)
        if (course.instructor.avatar) p.img = course.instructor.avatar
        else if (course.heroImage) p.img = course.heroImage
        break
      }
      case 'trailer': {
        if (course.trailerImage) p.img = course.trailerImage
        else if (course.heroImage) p.img = course.heroImage
        // Mux playback id → the editor can stream the real trailer inline.
        if (course.trailerPlaybackId) p.playbackId = course.trailerPlaybackId
        break
      }
      case 'note': {
        // The instructor signs every lifecycle note — bind it to the real one
        // (or the creator), never the placeholder.
        if (instructorName) p.sign = swapInstructor(p.sign)
        p.signRole = instructorRole
        break
      }
      case 'quote': {
        if (instructorName) p.by = swapInstructor(p.by)
        break
      }
    }
  }
  return blocks
}

/* A neutral, theme-agnostic placeholder for any design asset key that has no
   real course media behind it — avoids broken <img> in the canvas. */
export function placeholderAsset(): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='420'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#26282e'/><stop offset='1' stop-color='#15161a'/>
    </linearGradient></defs>
    <rect width='640' height='420' fill='url(#g)'/>
  </svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg.replace(/\n\s*/g, ''))
}

/** Build the asset resolver passed to the engine: real course media for the
 *  known design keys, neutral placeholder otherwise. Real URLs pass through. */
export function makeAssetResolver(course: CourseData | undefined): (key: string) => string {
  const ph = placeholderAsset()
  return (key: string) => {
    if (!key) return ph
    if (/^(https?:|data:|blob:)/.test(key)) return key
    if (key.startsWith('assets/')) {
      // Map each design asset key to its real counterpart rather than collapsing
      // every key to the cover — otherwise the instructor portrait and trailer
      // poster both render as the cover image.
      if (/chef|instructor|portrait|avatar/i.test(key))
        return course?.instructor?.avatar || course?.heroImage || ph
      if (/trailer|video|poster/i.test(key))
        return course?.trailerImage || course?.heroImage || ph
      return course?.heroImage || ph
    }
    return key
  }
}
