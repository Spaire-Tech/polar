import { Metadata } from 'next'
import { EditorPreviewScreen } from '../_components/screens/EditorPreviewScreen'

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Editor preview · Email Marketing' }
}

export default function Page() {
  return <EditorPreviewScreen />
}
