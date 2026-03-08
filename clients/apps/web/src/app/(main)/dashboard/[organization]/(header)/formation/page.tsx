import { Metadata } from 'next'
import FormationLandingPage from '@/components/CompanyFormation/FormationLandingPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Start a Company',
  }
}

export default function Page() {
  return <FormationLandingPage />
}
