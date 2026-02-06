export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="dark:bg-spaire-900 flex h-full flex-col">{children}</div>
  )
}
