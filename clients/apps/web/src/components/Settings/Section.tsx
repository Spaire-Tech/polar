export const Section = ({
  id,
  children,
}: {
  id?: string
  children: React.ReactNode
}) => {
  return (
    <div className="relative flex flex-col gap-y-5" id={id}>
      {children}
    </div>
  )
}

export const SectionDescription = ({
  title,
  description,
}: {
  title: string
  description?: string
}) => {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">
        {title}
      </h2>
      {description && (
        <p className="dark:text-spaire-500 text-sm text-gray-500">
          {description}
        </p>
      )}
    </div>
  )
}
