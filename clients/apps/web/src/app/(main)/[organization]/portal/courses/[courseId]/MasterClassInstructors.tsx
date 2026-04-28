'use client'

interface Instructor {
  name: string
  avatarUrl: string | null
  bio: string | null
}

interface MasterClassInstructorsProps {
  instructors: Instructor[]
}

export const MasterClassInstructors = ({
  instructors,
}: MasterClassInstructorsProps) => {
  if (instructors.length === 0) return null

  return (
    <div className="w-full bg-black pt-24 md:pt-32">
      <div className="mx-auto max-w-5xl px-6 md:px-8">
        <h2 className="mb-12 text-3xl font-bold text-white md:text-5xl">
          Class Instructors
        </h2>

        <div className="flex flex-col gap-10 pb-12">
          {instructors.map((instructor) => (
            <div key={instructor.name} className="flex items-start gap-5">
              <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-gray-800 md:h-16 md:w-16">
                {instructor.avatarUrl ? (
                  <img
                    src={instructor.avatarUrl}
                    alt={instructor.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-base font-semibold text-white">
                    {instructor.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex flex-col pt-1">
                <p className="text-lg font-bold text-white md:text-xl">
                  {instructor.name}
                </p>
                {instructor.bio && (
                  <p className="mt-1 text-sm leading-relaxed text-white/70 md:text-base">
                    {instructor.bio}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
