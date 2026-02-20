import { InfoIcon } from 'lucide-react'
import { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

const SettingsCheckbox = ({
  id,
  title,
  isChecked,
  onChange,
  type = 'checkbox',
  description = undefined,
  name = undefined,
  disabled,
}: {
  id: string
  title: string | ReactNode
  description?: string
  name?: string
  type?: 'checkbox' | 'radio'
  isChecked: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
}) => {
  name = name || id

  return (
    <div className="relative flex items-start">
      <div className="flex h-6 items-center">
        <input
          id={id}
          aria-describedby={`${id}-description`}
          name={name}
          type={type}
          onChange={onChange}
          checked={isChecked}
          disabled={!!disabled}
          className={twMerge(
            type === 'radio' ? 'rounded-full' : 'rounded',
            'h-4 w-4 bg-white/[0.06] border-white/[0.1] p-2 text-blue-400 focus:ring-blue-500 checked:border-blue-600! checked:bg-blue-500! focus:ring-offset-transparent',
          )}
        />
      </div>
      <div className="ml-2.5 inline-flex items-center space-x-4 text-sm leading-6">
        <label htmlFor={id}>{title}</label>{' '}
        {description && (
          <span
            id={`${id}-description`}
            className="inline-flex items-center space-x-1 text-polar-400"
          >
            <InfoIcon className="h-6 w-6" />
            <span>{description}</span>
          </span>
        )}
      </div>
    </div>
  )
}

export default SettingsCheckbox
