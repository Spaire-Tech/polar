import type { Viewport } from 'next'
import React from 'react'

// iOS Safari knobs for letting the hero draw behind the status bar:
//   - viewportFit: 'cover' tells Safari to allow page content into the
//     safe-area regions.
//   - themeColor: black sets the tint backdrop Safari uses for the
//     status bar icons; without it the status-bar area renders light.
// The <html> background is set dark on mobile so iOS rubber-band
// overscroll at the very top doesn't expose white.
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
          html { background: #000; }
        }
      `}</style>
      {children}
    </>
  )
}
