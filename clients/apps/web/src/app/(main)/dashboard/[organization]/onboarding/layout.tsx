export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="dark:bg-spaire-950 flex h-full flex-row">{children}</div>
  )
}
