interface TextBlockSettings {
  heading?: string | null
  body?: string | null
  align?: 'left' | 'center'
}

export const TextBlock = ({ settings }: { settings: TextBlockSettings }) => {
  const align = settings.align ?? 'left'
  const alignClass = align === 'center' ? 'text-center' : 'text-left'
  if (!settings.heading && !settings.body) return null
  return (
    <section className={`flex flex-col gap-2 ${alignClass}`}>
      {settings.heading && (
        <h2 className="text-base font-semibold text-gray-900">
          {settings.heading}
        </h2>
      )}
      {settings.body && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
          {settings.body}
        </p>
      )}
    </section>
  )
}
