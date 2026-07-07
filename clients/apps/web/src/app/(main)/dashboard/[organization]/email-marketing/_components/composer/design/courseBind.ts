// Auto-bind a freshly-loaded template's blocks to the REAL course, in place,
// while keeping every field editable (we only seed initial props). The templates
// carry NO course-specific example copy any more — they leave the course-driven
// fields as empty "slots" (cover title / byline / tagline, welcome-note heading &
// signature, lessons, instructor, facts). This fills those slots from the live
// course: title, description, lessons, instructor and trailer. The remaining
// lifecycle copy (moment headings, CTAs) is course-agnostic and stays as-is.
//
// The `trigger` (the lifecycle moment) decides what each cover/note slot means —
// e.g. the enrolment byline is "Taught by <instructor>", the first-lesson byline
// is the first lesson's title, the halfway byline is the course name.

import type { CourseData } from '../v3/courseData'
import type { Block } from './emailEngine'

// Legacy placeholder name — older saved emails / hand-edited blocks may still
// carry it, so we defensively swap it out wherever it signs a block.
const LEGACY_INSTRUCTOR = 'Adaeze Bello'
const LEGACY_TITLE = 'Southern Cooking'

/** A representative "pivotal" lesson for the specific-lesson email: roughly a
 *  third of the way in, clamped to the real curriculum. */
const pivotalLessonIndex = (n: number): number =>
  Math.min(Math.max(0, n - 1), Math.max(0, Math.floor(n / 3)))

export function bindCourse(
  blocks: Block[],
  course: CourseData | undefined,
  creatorName?: string,
  trigger?: string,
): Block[] {
  if (!course) return blocks
  const hasLessons = course.lessons.length > 0
  const lessonCount = course.lessons.length
  const inst = course.instructor
  // The name every block signs with: the course's instructor if set, otherwise
  // the creator/organization. NEVER a design placeholder.
  const instructorName = (inst.name || creatorName || '').trim()
  const instructorRole = (inst.role || 'Instructor').trim()
  const instructorBio = (inst.bio || '').trim()
  const courseTagline = (course.tagline || '').trim()
  const swapLegacy = (s: string): string => {
    let v = String(s ?? '')
    if (instructorName) v = v.split(LEGACY_INSTRUCTOR).join(instructorName)
    v = v.split(LEGACY_TITLE).join(course.title)
    return v
  }

  // The cover byline (small subtitle under the title) means something different
  // per moment. Returns the string to use, or null to leave the template's value.
  const coverByline = (): string | null => {
    switch (trigger) {
      case 'firstLesson':
        return hasLessons ? course.lessons[0].title : null
      case 'specificLesson':
        return hasLessons ? course.lessons[pivotalLessonIndex(lessonCount)].title : null
      case 'enrolment':
        return instructorName ? `Taught by ${instructorName}` : course.title
      case 'halfway':
      case 'courseComplete':
        return course.title
      default:
        return null
    }
  }

  for (const b of blocks) {
    const p = b.props
    switch (b.type) {
      case 'coverHero': {
        if (course.heroImage) p.img = course.heroImage
        // Title slot → the course name; a moment phrase ("A good start.") stays.
        if (!p.title) p.title = course.title
        else p.title = swapLegacy(p.title)
        // Byline slot → the moment-appropriate subtitle (see coverByline).
        const byline = coverByline()
        if (byline != null) {
          p.instructor = byline
        } else if (/^(taught by|with)\b/i.test(String(p.instructor || ''))) {
          if (instructorName)
            p.instructor = (String(p.instructor).match(/^taught by/i) ? 'Taught by ' : 'with ') + instructorName
        } else if (p.instructor) {
          p.instructor = swapLegacy(p.instructor)
        } else if (instructorName) {
          p.instructor = `Taught by ${instructorName}`
        }
        // Tagline slot → the course description; a moment tagline stays.
        if (!p.tagline && courseTagline) p.tagline = courseTagline
        break
      }
      case 'meta': {
        p.items = [
          { v: `${lessonCount || 0} lesson${lessonCount === 1 ? '' : 's'}` },
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
        // never a fabricated placeholder bio.
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
        // The enrolment welcome-note headline is a course slot; other moments
        // keep their (course-agnostic) headline.
        if (trigger === 'enrolment' && course.title)
          p.heading = `Welcome to ${course.title}.`
        // The instructor signs every lifecycle note — bind it to the real one
        // (or the creator), never a placeholder.
        if (instructorName) p.sign = instructorName
        else if (p.sign) p.sign = swapLegacy(p.sign)
        p.signRole = instructorRole
        break
      }
      case 'quote': {
        if (instructorName) p.by = instructorName
        else if (p.by) p.by = swapLegacy(p.by)
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
