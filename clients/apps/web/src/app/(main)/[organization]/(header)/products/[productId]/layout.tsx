import type { Viewport } from 'next'
import React from 'react'

// viewportFit=cover so iOS Safari lets the mobile hero extend behind the
// status bar — matches Apple TV's edge-to-edge cover artwork. The page's
// own wrapper padding gets broken out of via viewport-relative margins on
// the MobileHero section.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
      `}</style>
      {children}
    </>
  )
}
