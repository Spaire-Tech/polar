'use client'

import { useEffect } from 'react'

/**
 * Force light mode by removing the 'dark' class from <html>.
 * Restores the original state when unmounted.
 */
export function ForceLightMode() {
  useEffect(() => {
    const html = document.documentElement
    const wasDark = html.classList.contains('dark')
    html.classList.remove('dark')

    // Also override localStorage theme while on this page
    const stored = localStorage.getItem('theme')

    return () => {
      // Restore dark mode if it was active before
      if (wasDark || stored === 'dark') {
        html.classList.add('dark')
      }
    }
  }, [])

  return null
}
