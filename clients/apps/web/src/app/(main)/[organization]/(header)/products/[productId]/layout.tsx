import type { Viewport } from 'next'
import React from 'react'

// Apple-TV-app-style hero needs three things that can't be set from the
// page component itself:
//
//   1. viewportFit: 'cover' — lets page content draw behind the status
//      bar.
//   2. themeColor: black — Safari's status-bar background uses
//      themeColor. Without this the status bar area renders light.
//   3. A bulletproof black banner over the safe-area-inset-top region.
//      Even with the two viewport hints above, real-world Safari
//      installs sometimes still render a white strip at the top — the
//      banner below is a guaranteed fallback so the area behind the
//      status bar / battery indicator is ALWAYS black on mobile.
//
// We DO NOT blacken the page wrappers — the rest of the page stays
// light.
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
          /* iOS rubber-band overscroll exposes html's background.
             Black so a pull-down reveals dark, not white. */
          html { background: #000; }
        }
      `}</style>
      {/* Hardcoded black banner over the status-bar safe area on mobile.
          The lower edge fades to transparent so the transition into the
          hero image is a linear gradient, not a hard line. Tall enough
          to cover both the safe-area inset and the soft fade zone. */}
      <div
        aria-hidden
        className="md:hidden"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 'calc(max(env(safe-area-inset-top, 0px), 47px) + 24px)',
          background:
            'linear-gradient(180deg, #000 0%, #000 60%, rgba(0,0,0,0.85) 78%, rgba(0,0,0,0.5) 90%, rgba(0,0,0,0) 100%)',
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      />
      {children}
    </>
  )
}
