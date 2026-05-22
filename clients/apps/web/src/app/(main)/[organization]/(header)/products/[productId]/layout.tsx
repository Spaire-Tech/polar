import type { Viewport } from 'next'
import React from 'react'

// Apple-TV-app-style hero needs two iOS Safari knobs that can't be set
// from the page component itself:
//
//   1. viewportFit: 'cover' — lets page content draw behind the status
//      bar.
//   2. themeColor: black — Safari's status-bar background uses
//      themeColor. Without this the status bar area renders light, which
//      shows a white strip above the cover artwork.
//
// We DO NOT blacken the page wrappers — the rest of the page is light
// and stays light. The only dark surface is the <html> element, so iOS
// rubber-band overscroll at the very top reveals black instead of
// white. The hero's own top vignette handles the linear blend into the
// image so the transition is gradient, not a line.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000',
}

export default function ProductDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <style>{`
        [data-profile-card] { display: none !important; }
        @media (max-width: 767px) {
          /* iOS rubber-band overscroll at the top exposes html's
             background. Black here so a pull-down reveals dark, not
             white — without changing the rest of the page. */
          html { background: #000; }
        }
      `}</style>
      {children}
    </>
  )
}
