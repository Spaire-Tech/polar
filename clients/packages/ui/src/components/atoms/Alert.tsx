import { useMemo } from 'react'

interface AlertProps {
  color: 'blue' | 'gray' | 'red' | 'green'
}

const Alert: React.FC<React.PropsWithChildren<AlertProps>> = ({
  children,
  color,
}) => {
  const colorClasses = useMemo(() => {
    switch (color) {
      case 'blue':
        return 'bg-blue-950 border border-blue-900 text-blue-400'
      case 'gray':
        return 'bg-white/[0.04] border border-white/[0.06] text-polar-400'
      case 'red':
        return 'bg-red-950 border border-red-900 text-red-400'
      case 'green':
        return 'bg-green-950 border border-green-900 text-green-400'
    }
  }, [color])

  return <div className={`rounded-lg p-2 ${colorClasses}`}>{children}</div>
}

export default Alert
