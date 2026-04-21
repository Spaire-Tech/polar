export default function WelcomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-16">
      {children}
    </div>
  )
}
