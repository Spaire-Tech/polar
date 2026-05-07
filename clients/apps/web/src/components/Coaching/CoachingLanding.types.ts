export type CoachingLandingMediaType = 'image' | 'video'

export type CoachingLandingTitlePart = {
  text: string
  italic?: boolean
}

export type CoachingLandingHero = {
  titleParts: CoachingLandingTitlePart[]
  subtitle: string
  ctaPrimary: string
  ctaSecondary: string
  heroMediaUrl: string | null
  heroMediaType: CoachingLandingMediaType
  clientsPillText: string
  clientsAvatars: string[]
}

export type CoachingLandingStat = {
  label: string
  value: string
  barPercent: number
}

export type CoachingLandingCoreEvolution = {
  heading: string
  description: string
  resultsHeading: string
  stats: CoachingLandingStat[]
  cta: string
  mediaUrl: string | null
  mediaType: CoachingLandingMediaType
  caption: string
}

export type CoachingLandingLessonKind = 'D' | 'Q' | 'V' | 'C'

export type CoachingLandingLesson = {
  code: string
  text: string
  kind: CoachingLandingLessonKind
}

export type CoachingLandingModule = {
  title: string
  lessons: CoachingLandingLesson[]
}

export type CoachingLandingCourses = {
  heading: string
  lede: string
  formats: string[]
  modules: CoachingLandingModule[]
}

export type CoachingLandingFaqItem = {
  q: string
  a: string
}

export type CoachingLandingFaq = {
  heading: string
  lede: string
  cta: string
  items: CoachingLandingFaqItem[]
}

export type CoachingLandingMeta = {
  label: string
  value: string
}

export type CoachingLandingSection = {
  label: string
  body: string
}

export type CoachingLandingTestimonial = {
  quote: string
  author: string
  authorSub: string
}

export type CoachingLandingAtlas = {
  eyebrow: string
  title: string
  meta: CoachingLandingMeta[]
  orderCta: string
  sections: CoachingLandingSection[]
  testimonial: CoachingLandingTestimonial
  slides: string[]
}

export type CoachingLandingNav = {
  brand: string
}

export type CoachingLandingData = {
  nav: CoachingLandingNav
  hero: CoachingLandingHero
  coreEvolution: CoachingLandingCoreEvolution
  courses: CoachingLandingCourses
  faq: CoachingLandingFaq
  atlas: CoachingLandingAtlas
}
