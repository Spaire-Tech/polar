'use client'

import { useCustomerCourses } from '@/hooks/queries/courses'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import styles from './community.module.css'
import { IconChat } from './icons'

type Props = {
  organizationSlug: string
  customerSessionToken: string
}

export function CommunityPicker({
  organizationSlug,
  customerSessionToken,
}: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: enrollments, isLoading } = useCustomerCourses(
    customerSessionToken,
  )

  const qs = useMemo(() => searchParams.toString(), [searchParams])
  const courseHref = (courseId: string) => {
    const path = `/${organizationSlug}/portal/courses/${courseId}/community`
    return qs ? `${path}?${qs}` : path
  }

  // Auto-redirect when the customer has exactly one enrolled course —
  // no point making them click through a single-item picker.
  useEffect(() => {
    if (!enrollments) return
    if (enrollments.length === 1) {
      router.replace(courseHref(enrollments[0].course.id))
    }
    // courseHref depends on qs which is stable per render; enrollments
    // is the only signal we care about here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollments, router])

  if (isLoading) {
    return (
      <div className={styles.root}>
        <main className={styles.main}>
          <div
            style={{
              height: 240,
              borderRadius: 20,
              background: 'var(--c-panel)',
            }}
          />
        </main>
      </div>
    )
  }

  if (!enrollments || enrollments.length === 0) {
    return (
      <div className={styles.root}>
        <main className={styles.main}>
          <header className={styles.feedHeader}>
            <div className={styles.feedEyebrow}>Community</div>
            <h1 className={styles.feedTitle}>No communities yet</h1>
          </header>
          <p
            className={styles.empty}
            style={{ marginTop: 20, padding: '40px 0' }}
          >
            Enroll in a course to join its community.
          </p>
        </main>
      </div>
    )
  }

  if (enrollments.length === 1) {
    // Redirecting — render an empty shell while the navigation lands.
    return <div className={styles.root} />
  }

  return (
    <div className={styles.root}>
      <main className={styles.main}>
        <header className={styles.feedHeader}>
          <div className={styles.feedEyebrow}>Community</div>
          <h1 className={styles.feedTitle}>Pick a community</h1>
        </header>
        <p
          style={{
            marginTop: 12,
            color: 'var(--c-muted)',
            fontSize: 14,
          }}
        >
          You&apos;re enrolled in {enrollments.length} courses. Open the
          community for any of them.
        </p>

        <div
          style={{
            marginTop: 36,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20,
          }}
        >
          {enrollments.map((e) => (
            <Link
              key={e.course.id}
              href={courseHref(e.course.id)}
              style={{
                display: 'block',
                borderRadius: 18,
                background: 'var(--c-bg)',
                border: '1px solid var(--c-hair)',
                overflow: 'hidden',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'border-color 0.12s ease, transform 0.12s ease',
              }}
            >
              <div
                style={{
                  aspectRatio: '16 / 9',
                  background: e.course.thumbnail_url
                    ? `url(${e.course.thumbnail_url}) center / cover`
                    : 'linear-gradient(135deg, #0A84FF, #0056B3)',
                }}
              />
              <div style={{ padding: '16px 18px' }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    letterSpacing: '-0.012em',
                    color: 'var(--c-ink)',
                  }}
                >
                  {e.course.title ?? 'Untitled course'}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12.5,
                    color: 'var(--c-muted)',
                  }}
                >
                  <IconChat size={13} /> Open community
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
