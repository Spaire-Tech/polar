import { Metadata } from 'next'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import FormationWizard from '@/components/CompanyFormation/FormationWizard'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Start a Company',
  }
}

export default function Page() {
  return (
    <DashboardBody title="Start a Company">
      <FormationWizard />
    </DashboardBody>
  )
}
