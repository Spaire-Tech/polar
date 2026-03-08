import { Metadata } from 'next'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import FormationWizard from '@/components/CompanyFormation/FormationWizard'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Incorporate',
  }
}

export default function Page() {
  return (
    <DashboardBody
      title="Incorporate your startup"
      wrapperClassName="max-w-(--breakpoint-md)!"
      className="gap-y-16"
    >
      <FormationWizard />
    </DashboardBody>
  )
}
