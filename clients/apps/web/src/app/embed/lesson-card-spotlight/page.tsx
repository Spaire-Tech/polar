import SpotlightLessonCard from '@/components/Courses/editor/SpotlightLessonCard'

// Bare preview of the Spotlight lesson card, centered on a white page, for
// reviewing the design in isolation before it's wired into the course editor.
export default function SpotlightLessonCardPreviewPage() {
  return (
    <main
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '100vh',
        background: '#fff',
      }}
    >
      <SpotlightLessonCard imageUrl="/assets/onboarding/sample-lesson.jpg" />
    </main>
  )
}
