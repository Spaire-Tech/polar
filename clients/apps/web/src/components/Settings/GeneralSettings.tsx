'use client'

import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlined from '@mui/icons-material/LightModeOutlined'
import { useTheme } from 'next-themes'
import { twMerge } from 'tailwind-merge'

const GeneralSettings: React.FC = () => {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-2">
        <span className="text-sm font-medium">Theme</span>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Choose how the dashboard looks for you.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-xs">
        <ThemeButton
          themeKey="dark"
          label="Dark"
          active={theme !== 'light'}
          onSelect={() => setTheme('dark')}
        />
        <ThemeButton
          themeKey="light"
          label="Light"
          active={theme === 'light'}
          onSelect={() => setTheme('light')}
        />
      </div>
    </div>
  )
}

interface ThemeButtonProps {
  themeKey: 'dark' | 'light'
  label: string
  active: boolean
  onSelect: () => void
}

const ThemeButton = ({
  themeKey,
  label,
  active,
  onSelect,
}: ThemeButtonProps) => {
  const isDark = themeKey === 'dark'

  return (
    <button
      onClick={onSelect}
      className={twMerge(
        'flex flex-col items-center gap-y-2 rounded-xl border-2 p-4 transition-all duration-200',
        active
          ? 'border-blue-500 dark:border-blue-400'
          : 'dark:bg-polar-900 dark:border-polar-700 border-gray-200 bg-white hover:border-gray-300 dark:hover:border-polar-600',
      )}
    >
      <div
        className={twMerge(
          'flex h-8 w-8 items-center justify-center rounded-full',
          isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700',
        )}
      >
        {isDark ? (
          <DarkModeOutlined sx={{ fontSize: 16 }} />
        ) : (
          <LightModeOutlined sx={{ fontSize: 16 }} />
        )}
      </div>
      <span
        className={twMerge(
          'text-xs font-medium',
          active
            ? 'text-blue-600 dark:text-blue-400'
            : 'dark:text-polar-400 text-gray-600',
        )}
      >
        {label}
      </span>
    </button>
  )
}

export default GeneralSettings
