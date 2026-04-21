import OpenInNew from '@mui/icons-material/OpenInNew'
import { LinksBlockSettings } from '../types'

export const LinksBlock = ({ settings }: { settings: LinksBlockSettings }) => {
  const items = settings.items ?? []
  if (items.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      {settings.heading && (
        <h2 className="text-sm font-semibold text-gray-900">
          {settings.heading}
        </h2>
      )}
      <div className="flex flex-col">
        {items.map((item, idx) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex flex-row items-center gap-4 px-4 py-4 transition-colors hover:bg-gray-50 ${
              idx === 0 ? 'border-t' : ''
            } border-b border-gray-200`}
          >
            {item.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.logo_url}
                alt=""
                className="h-10 w-10 shrink-0 rounded-md border border-gray-200 object-cover"
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-semibold text-gray-900">
                {item.label}
              </span>
              {item.subtitle && (
                <span className="truncate text-[13px] text-gray-500">
                  {item.subtitle}
                </span>
              )}
            </div>
            <OpenInNew className="h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-gray-900" />
          </a>
        ))}
      </div>
    </section>
  )
}
