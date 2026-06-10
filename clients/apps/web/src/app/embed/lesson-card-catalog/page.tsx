import CatalogLessonCardEmbed from '@/components/Courses/editor/CatalogLessonCardEmbed'

// Bare, centered preview of the existing "Catalog" lesson card, used as the
// live preview source for the lesson-card picker's Catalog option.
export default function LessonCardCatalogPreviewPage() {
  return (
    <main
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#fff',
      }}
    >
      <CatalogLessonCardEmbed />
    </main>
  )
}
