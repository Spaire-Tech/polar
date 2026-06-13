'use client'

// Portal theme — the customer can flip dark/light from the top bar; their
// choice is remembered per org. With no explicit choice we fall back to the
// creator's landing theme (dark landing → dark portal). Both the shell and
// the top-bar toggle read this hook, kept in sync via a window event.

import { useCustomerCourses } from '@/hooks/queries/courses'
import { useCallback, useEffect, useState } from 'react'

const prefKey = (slug: string) => `sp_theme_pref:${slug}`
const cacheKey = (slug: string) => `sp_theme:${slug}`
const EVENT = 'sp-theme-change'

type Pref = 'dark' | 'light' | null

function readPref(slug: string): Pref {
  try {
    const v = window.localStorage.getItem(prefKey(slug))
    return v === 'dark' || v === 'light' ? v : null
  } catch {
    return null
  }
}

export function usePortalTheme(slug: string, token: string) {
  const { data: enrollments } = useCustomerCourses(token || null)
  const [pref, setPref] = useState<Pref>(null)
  const [derived, setDerived] = useState(false)

  // Hydrate the explicit preference + last-known derived theme synchronously
  // from cache so there's no light flash before the courses query resolves.
  useEffect(() => {
    setPref(readPref(slug))
    try {
      setDerived(window.localStorage.getItem(cacheKey(slug)) === 'dark')
    } catch {
      /* ignore */
    }
  }, [slug])

  // Listen for toggles from the other instance (shell ↔ top bar).
  useEffect(() => {
    const onChange = () => setPref(readPref(slug))
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [slug])

  // Derive from enrolled courses' landing theme.
  useEffect(() => {
    if (!enrollments) return
    const isDark = enrollments.some((e) => e.course.theme_mode === 'dark')
    setDerived(isDark)
    try {
      window.localStorage.setItem(cacheKey(slug), isDark ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }, [enrollments, slug])

  const dark = pref != null ? pref === 'dark' : derived

  const toggle = useCallback(() => {
    const next: Pref = dark ? 'light' : 'dark'
    try {
      window.localStorage.setItem(prefKey(slug), next)
    } catch {
      /* ignore */
    }
    setPref(next)
    window.dispatchEvent(new Event(EVENT))
  }, [dark, slug])

  return { dark, toggle }
}
