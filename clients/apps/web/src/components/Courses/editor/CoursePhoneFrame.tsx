'use client'

// iPhone chrome specifically for the course landing preview. Same shell as
// `MobilePreviewFrame` (bezel + dynamic island + home indicator), but the
// inner scroll has zero padding so the mobile landing components (which
// already manage their own gutters) render edge-to-edge inside the screen.
//
// The screen is ALWAYS iPhone 14 logical size (390 × 844) so an iframe
// inside sees a real phone viewport — then the whole phone is scaled down
// as one unit to fit the available space. Scaling (instead of clamping
// width/height independently) keeps the proportions of a real phone; the
// old max-height clamp squashed it into a squat rectangle on short
// windows.

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

const SCREEN_W = 390
const SCREEN_H = 844
const BEZEL = 11
const FRAME_W = SCREEN_W + BEZEL * 2
const FRAME_H = SCREEN_H + BEZEL * 2

export function CoursePhoneFrame({ children }: { children: ReactNode }) {
  const holderRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = holderRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return
      setScale(Math.min(1, r.width / FRAME_W, r.height / FRAME_H))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={holderRef} className="course-phone-holder">
      <div
        className="course-phone-frame"
        style={{ transform: `scale(${scale})` }}
        aria-label="Mobile preview (iPhone)"
      >
        <div className="course-phone-frame__island" aria-hidden />
        <div className="course-phone-frame__screen">
          <div className="course-phone-frame__scroll">{children}</div>
        </div>
        <div className="course-phone-frame__home" aria-hidden />
      </div>
      <style jsx>{`
        .course-phone-holder {
          width: 100%;
          height: 100%;
          /* Flex centering (not grid place-items): the frame's LAYOUT box is
             the full 412×866 even when scaled down, and a grid auto-track
             hugs that box start-aligned — flex centers the overflow both
             ways so the scaled phone sits in the middle. */
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .course-phone-frame {
          position: relative;
          width: ${FRAME_W}px;
          height: ${FRAME_H}px;
          flex-shrink: 0;
          transform-origin: center;
          background: #0c0c14;
          border-radius: 56px;
          padding: ${BEZEL}px;
          box-shadow:
            0 30px 60px -20px rgba(12, 12, 20, 0.45),
            0 8px 20px -8px rgba(12, 12, 20, 0.3),
            inset 0 0 0 1.5px #2a2a35;
        }
        .course-phone-frame__island {
          position: absolute;
          left: 50%;
          top: 18px;
          transform: translateX(-50%);
          width: 110px;
          height: 30px;
          background: #0c0c14;
          border-radius: 999px;
          z-index: 2;
          pointer-events: none;
        }
        .course-phone-frame__home {
          position: absolute;
          left: 50%;
          bottom: 8px;
          transform: translateX(-50%);
          width: 130px;
          height: 4px;
          background: rgba(255, 255, 255, 0.55);
          border-radius: 2px;
          z-index: 2;
          pointer-events: none;
        }
        .course-phone-frame__screen {
          position: relative;
          width: ${SCREEN_W}px;
          height: ${SCREEN_H}px;
          background: white;
          border-radius: 46px;
          overflow: hidden;
          isolation: isolate;
        }
        .course-phone-frame__scroll {
          width: 100%;
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .course-phone-frame__scroll::-webkit-scrollbar {
          width: 0;
          height: 0;
        }
      `}</style>
    </div>
  )
}
