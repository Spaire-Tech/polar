import CoverHeroEmbed from '@/components/Courses/editor/CoverHeroEmbed'

// Bare full-bleed preview of the existing "Cover" hero (read-only), used as the
// live thumbnail/preview source for the hero picker's Cover option.
export default function HeroPreviewCoverPage() {
  return (
    <main style={{ margin: 0 }}>
      <CoverHeroEmbed />
    </main>
  )
}
