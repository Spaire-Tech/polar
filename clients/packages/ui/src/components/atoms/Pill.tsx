import { twMerge } from 'tailwind-merge'

const Pill = ({
  children,
  color,
  className,
}: {
  children: React.ReactNode
  color: 'gray' | 'blue' | 'purple' | 'yellow' | 'red' | 'green'
  className?: string
}) => {
  return (
    <span
      className={twMerge(
        'inline-flex items-center space-x-1 rounded-full px-1.5 py-0.5 text-xs font-medium whitespace-nowrap transition-all duration-200',

        color === 'blue'
          ? 'bg-blue-900 text-blue-200'
          : '',
        color === 'gray'
          ? 'bg-white/[0.06] text-polar-300'
          : '',
        color === 'purple'
          ? 'bg-purple-900 text-purple-300'
          : '',
        color === 'yellow'
          ? 'bg-yellow-950 text-yellow-500'
          : '',
        color === 'red'
          ? 'bg-red-950 text-red-400'
          : '',
        color === 'green'
          ? 'bg-emerald-900 text-emerald-300'
          : '',
        className,
      )}
    >
      {children}
    </span>
  )
}

export default Pill
