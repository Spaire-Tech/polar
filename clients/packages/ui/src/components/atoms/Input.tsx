import { Input as ShadInput } from '@/components/ui/input'
import { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'

export type InputProps = ComponentProps<typeof ShadInput> & {
  preSlot?: React.ReactNode
  postSlot?: React.ReactNode
}

const Input = ({ ref, preSlot, postSlot, className, ...props }: InputProps) => {
  return (
    <div className="relative flex flex-1 flex-row rounded-full">
      <ShadInput
        className={twMerge(
          'h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-base text-white shadow-xs outline-none placeholder:text-polar-500 focus:z-10 focus:border-blue-600 focus:ring-[3px] focus:ring-blue-700/40 focus-visible:ring-blue-700/40 md:text-sm ring-offset-transparent',
          preSlot ? 'pl-10' : '',
          postSlot ? 'pr-10' : '',
          className,
        )}
        ref={ref}
        {...props}
      />
      {preSlot && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3 text-polar-400">
          {preSlot}
        </div>
      )}
      {postSlot && (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center pr-4 text-polar-400">
          {postSlot}
        </div>
      )}
    </div>
  )
}

Input.displayName = 'Input'

export default Input
