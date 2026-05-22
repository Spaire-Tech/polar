import type { Viewport } from 'next'
import React from 'react'

// Apple-TV-app-style hero needs three things that can't be set from the
// page component itself:
//
//   1. viewportFit: 'cover' — without this iOS Safari refuses to extend
//      page content under the status bar, so any "edge-to-edge" attempt
//      stops at the safe-area boundary regardless of CSS.
//   2. themeColor: black — Safari's status-bar background uses themeColor
//      when the page scrolls under it. Without this the status bar
//      stays light, leaving a white strip even when the image is drawn
//      behind it.
//   3. A global CSS escape that turns every white-background wrapper
//      between <body> and the hero section dark. (main)/layout and
//      (header)/layout both set `bg-white` on outer divs, and
//      EditableCourseLandingView's own wrapper falls back to white via
//      `var(--bg-0, #fff)`. Without overriding all of these the white
//      cast shows around the hero, especially in the rubber-band region
//      revealed by scroll-up overscroll on iOS.
//
// These rules only apply on this route so other pages keep their light
// theme.
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
          html, body { background: #000 !important; }
          /* (main)/layout's wrapper */
          body .h-full.bg-white { background: #000 !important; }
          /* (header)/layout's wrapper */
          body .min-h-screen.bg-white { background: #000 !important; }
          /* EditableCourseLandingView's own wrapper */
          [data-spaire-editor] { background: #000 !important; }
        }
      `}</style>
      {children}
    </>
  )
}
