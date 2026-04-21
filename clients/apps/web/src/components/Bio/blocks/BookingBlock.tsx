import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined'
import OpenInNew from '@mui/icons-material/OpenInNew'

interface BookingBlockSettings {
  heading?: string | null
  subtitle?: string | null
  url?: string | null
  cta?: string | null
}

export const BookingBlock = ({
  settings,
}: {
  settings: BookingBlockSettings
}) => {
  if (!settings.url) return null
  return (
    <a
      href={settings.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-row items-center gap-4 border-b border-t border-gray-200 px-4 py-4 transition-colors hover:bg-gray-50"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-gray-200">
        <CalendarMonthOutlined className="h-5 w-5 text-gray-900" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold text-gray-900">
          {settings.heading || settings.cta || 'Book a call'}
        </span>
        {settings.subtitle && (
          <span className="truncate text-[13px] text-gray-500">
            {settings.subtitle}
          </span>
        )}
      </div>
      <OpenInNew className="h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-gray-900" />
    </a>
  )
}
