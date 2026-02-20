const ShadowListGroup: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="w-full overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.08]">
    {children}
  </div>
)

const ShadowListGroupItem: React.FC<React.PropsWithChildren> = ({
  children,
}) => (
  <div className="border-t border-white/[0.06] p-5 first:border-t-0">
    {children}
  </div>
)

export default Object.assign(ShadowListGroup, {
  Item: ShadowListGroupItem,
})
