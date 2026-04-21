export default function WelcomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen overflow-y-auto bg-white">
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
        {children}
      </div>
    </div>
  )
}
