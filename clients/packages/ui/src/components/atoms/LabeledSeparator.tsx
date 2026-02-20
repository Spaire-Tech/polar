interface LabeledSeparatorProps {
  label: string
}

const LabeledSeparator: React.FC<LabeledSeparatorProps> = ({ label }) => {
  return (
    <div className="flex w-full flex-row items-center gap-6">
      <div className="grow border-t border-white/[0.06]"></div>
      <div className="text-sm text-polar-500">{label}</div>
      <div className="grow border-t border-white/[0.06]"></div>
    </div>
  )
}

export default LabeledSeparator
