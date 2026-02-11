import { DashboardBody } from '@/components/Layout/DashboardLayout'

export default function BankingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardBody>{children}</DashboardBody>
}
