const Tabs = ({ children }: { children: React.ReactElement<any> }) => {
  return (
    <div className="flex w-full justify-between space-x-1.5 rounded-lg bg-white/[0.06] p-1.5">
      {children}
    </div>
  )
}
export default Tabs
