import { twMerge } from 'tailwind-merge'

export const SettingsGroup: React.FC<
  React.PropsWithChildren<{ danger?: boolean }>
> = ({ children, danger = false }) => (
  <div
    className={twMerge(
      'w-full flex-col overflow-hidden rounded-2xl border',
      danger
        ? 'divide-y divide-red-100 border-red-200 bg-white dark:divide-red-950 dark:border-red-900/40 dark:bg-spaire-900'
        : 'divide-y divide-gray-100 border-gray-200 bg-white dark:divide-spaire-800 dark:border-spaire-800 dark:bg-spaire-900',
    )}
  >
    {children}
  </div>
)

export interface SettingsGroupItemProps {
  title: string
  description?: string
  vertical?: boolean
}

export const SettingsGroupItem: React.FC<
  React.PropsWithChildren<SettingsGroupItemProps>
> = ({ children, title, description, vertical }) => (
  <div
    className={twMerge(
      'flex gap-x-12 gap-y-4 p-5',
      vertical
        ? 'flex-col'
        : 'flex-col md:flex-row md:items-start md:justify-between',
    )}
  >
    <div className="flex w-full flex-col gap-y-0.5 md:max-w-1/2">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
        {title}
      </h3>
      {description && (
        <p className="dark:text-spaire-500 text-sm text-gray-500">
          {description}
        </p>
      )}
    </div>
    {children && (
      <div
        className={twMerge(
          'flex w-full flex-row gap-y-2 md:w-full',
          vertical ? '' : 'md:justify-end',
        )}
      >
        {children}
      </div>
    )}
  </div>
)

export const SettingsGroupActions: React.FC<React.PropsWithChildren> = ({
  children,
}) => (
  <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
    {children}
  </div>
)
