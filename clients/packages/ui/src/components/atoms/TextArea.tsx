import { Textarea } from '@/components/ui/textarea'
import { twMerge } from 'tailwind-merge'

export interface TextAreaProps extends React.ComponentProps<'textarea'> {
  resizable?: boolean | undefined
}

const TextArea = ({
  ref,
  resizable = true,
  className,
  ...props
}: TextAreaProps) => {
  const classNames = twMerge(
    'border-white/[0.08] bg-white/[0.04] text-white shadow-xs placeholder:text-polar-500 min-h-[120px] rounded-2xl p-4 text-sm outline-none focus:z-10 focus:border-blue-600 focus:ring-[3px] focus:ring-blue-700/40 focus-visible:ring-blue-700/40 ring-offset-transparent',
    resizable ? '' : 'resize-none',
    className,
  )

  return <Textarea ref={ref} className={classNames} {...props} />
}

TextArea.displayName = 'TextArea'

export default TextArea
