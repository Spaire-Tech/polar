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
    <div className="w-full bg-black" style={{ paddingTop: 64, paddingBottom: 56 }}>
      <div style={{ paddingLeft: 88, paddingRight: 88, maxWidth: 1080 }}>
        <p
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '-0.01em',
            marginBottom: 28,
          }}
        >
          Class Instructors
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {instructors.map((instructor) => (
            <div
              key={instructor.name}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  flexShrink: 0,
                  background: '#1a1a1a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {instructor.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={instructor.avatarUrl}
                    alt={instructor.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: 17,
                      fontWeight: 600,
                      color: '#fff',
                    }}
                  >
                    {instructor.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div style={{ paddingTop: 4 }}>
                <p
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#fff',
                    lineHeight: 1.2,
                  }}
                >
                  {instructor.name}
                </p>
                {instructor.bio && (
                  <p
                    style={{
                      marginTop: 4,
                      fontSize: 14,
                      fontWeight: 400,
                      color: 'rgba(255,255,255,0.6)',
                      lineHeight: 1.5,
                      maxWidth: 560,
                    }}
                  >
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
