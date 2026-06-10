import MarqueeHero from '@/components/Courses/editor/MarqueeHero'

// Bare full-bleed preview of the Marquee hero. Lives under embed/ so it
// inherits only the root layout (fonts/providers) with no dashboard chrome —
// letting the 100vw/100vh hero render at its true proportions for review.
export default function HeroPreviewPage() {
  return (
    <main style={{ margin: 0, overflow: 'hidden' }}>
      <MarqueeHero imageUrl="/assets/onboarding/sample-hero.jpg" />
    </main>
  )
}
