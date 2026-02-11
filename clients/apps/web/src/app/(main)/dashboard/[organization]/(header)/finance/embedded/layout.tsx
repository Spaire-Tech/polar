import { DashboardBody } from '@/components/Layout/DashboardLayout'

export default function EmbeddedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardBody>{children}</DashboardBody>
}
