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
    <div className="w-full bg-black pt-16 md:pt-24">
      <div className="mx-auto max-w-3xl px-6 md:px-8">
        <h2 className="mb-8 text-2xl font-bold text-white md:text-3xl">
          Class Instructors
        </h2>

        <div className="flex flex-col gap-6 pb-12">
          {instructors.map((instructor) => (
            <div key={instructor.name} className="flex items-center gap-4">
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-gray-800">
                {instructor.avatarUrl ? (
                  <img
                    src={instructor.avatarUrl}
                    alt={instructor.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                    {instructor.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <p className="text-base font-bold text-white">
                  {instructor.name}
                </p>
                {instructor.bio && (
                  <p className="text-sm text-white/70">{instructor.bio}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
