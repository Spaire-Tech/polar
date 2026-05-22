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
          /* The editor wrapper renders for the full page height. Paint
             a solid darkest-black band over just its top region (≈ hero
             height) so the area behind / around the hero is dark, while
             everything below the hero stays light. Hard step at 720px
             — no blend on the wrapper itself; the hero image carries
             its own faint top vignette so the image-side transition is
             where the gradient happens, not here. */
          [data-spaire-editor] {
            background: linear-gradient(
              180deg,
              #000 0px,
              #000 720px,
              var(--bg-0, #fff) 720px
            ) !important;
          }
        }
      `}</style>
      {children}
    </>
  )
}
