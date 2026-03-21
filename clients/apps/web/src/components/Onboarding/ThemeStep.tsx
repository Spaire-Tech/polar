'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface ThemeOptionProps {
  id: 'dark' | 'light'
  label: string
  description: string
  selected: boolean
  onSelect: () => void
}

const ThemeOption = ({ id, label, description, selected, onSelect }: ThemeOptionProps) => {
  const isDark = id === 'dark'

  return (
    <button
      type="button"
      onClick={onSelect}
      className={twMerge(
        'group relative flex flex-col rounded-2xl border-2 transition-all duration-200 text-left',
        selected
          ? 'border-blue-500 shadow-lg shadow-blue-500/20'
          : 'border-gray-200 dark:border-spaire-700 hover:border-gray-300 dark:hover:border-spaire-500',
      )}
    >
      {/* Preview window */}
      <div
        className={twMerge(
          'relative h-44 w-full overflow-hidden rounded-t-[14px]',
          isDark ? 'bg-black' : 'bg-gray-50',
        )}
      >
        {/* Simulated sidebar */}
        <div className={twMerge(
          'absolute left-0 top-0 h-full w-16 flex flex-col gap-2 p-2',
          isDark ? 'bg-spaire-900' : 'bg-white border-r border-gray-200',
        )}>
          <div className={twMerge('mt-2 h-6 w-6 rounded-md', isDark ? 'bg-spaire-700' : 'bg-gray-200')} />
          <div className="mt-4 flex flex-col gap-1.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={twMerge(
                'h-4 rounded-md',
                i === 1
                  ? isDark ? 'bg-blue-600 w-10' : 'bg-blue-500 w-10'
                  : isDark ? 'bg-spaire-700 w-8' : 'bg-gray-200 w-8',
              )} />
            ))}
          </div>
        </div>

        {/* Simulated main content */}
        <div className="absolute left-16 top-0 right-0 bottom-0 p-3">
          {/* Top bar */}
          <div className={twMerge(
            'mb-3 h-7 rounded-lg',
            isDark ? 'bg-spaire-800' : 'bg-white border border-gray-200',
          )} />
          {/* Cards */}
          <div className="grid grid-cols-2 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={twMerge(
                'rounded-xl p-2',
                isDark ? 'bg-spaire-800' : 'bg-white border border-gray-200',
              )}>
                <div className={twMerge('mb-1.5 h-3 w-3/4 rounded', isDark ? 'bg-spaire-600' : 'bg-gray-200')} />
                <div className={twMerge('h-2 w-1/2 rounded', isDark ? 'bg-spaire-700' : 'bg-gray-100')} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Label */}
      <div className={twMerge(
        'flex flex-row items-center justify-between px-5 py-4 rounded-b-[14px]',
        isDark ? 'bg-spaire-900 text-white' : 'bg-white text-gray-900',
      )}>
        <div>
          <p className="text-base font-semibold">{label}</p>
          <p className={twMerge('text-sm', isDark ? 'text-spaire-400' : 'text-gray-500')}>{description}</p>
        </div>
        <div className={twMerge(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all',
          selected
            ? 'border-blue-500 bg-blue-500'
            : isDark ? 'border-spaire-500' : 'border-gray-300',
        )}>
          {selected && (
            <div className="h-2 w-2 rounded-full bg-white" />
          )}
        </div>
      </div>
    </button>
  )
}

interface ThemeStepProps {
  onContinue: () => void
}

export const ThemeStep = ({ onContinue }: ThemeStepProps) => {
  const { theme, setTheme } = useTheme()
  const [selected, setSelected] = useState<'dark' | 'light'>('dark')

  // Sync with current theme
  useEffect(() => {
    if (theme === 'light') setSelected('light')
    else setSelected('dark')
  }, [theme])

  const handleSelect = (value: 'dark' | 'light') => {
    setSelected(value)
    setTheme(value)
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-10">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ThemeOption
          id="dark"
          label="Dark"
          description="Easy on the eyes"
          selected={selected === 'dark'}
          onSelect={() => handleSelect('dark')}
        />
        <ThemeOption
          id="light"
          label="Light"
          description="Bright and clean"
          selected={selected === 'light'}
          onSelect={() => handleSelect('light')}
        />
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-xl bg-blue-500 px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Continue with {selected === 'dark' ? 'Dark' : 'Light'} mode
        </button>
      </div>
    </div>
  )
}
