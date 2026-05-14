'use client'

// iPhone chrome specifically for the course landing preview. Same shell as
// `MobilePreviewFrame` (bezel + dynamic island + home indicator), but the
// inner scroll has zero padding so the mobile landing components (which
// already manage their own gutters) render edge-to-edge inside the screen.
//
// Sized at iPhone 14 logical dimensions (390 × 844) so the contents see
// roughly the same width as a real phone.

import type { ReactNode } from 'react'

export function CoursePhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="course-phone-frame" aria-label="Mobile preview (iPhone)">
      <div className="course-phone-frame__island" aria-hidden />
      <div className="course-phone-frame__screen">
        <div className="course-phone-frame__scroll">{children}</div>
      </div>
      <div className="course-phone-frame__home" aria-hidden />
      <style jsx>{`
        .course-phone-frame {
          position: relative;
          width: clamp(320px, 90vw, 390px);
          aspect-ratio: 390 / 844;
          max-height: calc(100vh - 160px);
          background: #0c0c14;
          border-radius: 56px;
          padding: 11px;
          box-shadow:
            0 30px 60px -20px rgba(12, 12, 20, 0.45),
            0 8px 20px -8px rgba(12, 12, 20, 0.3),
            inset 0 0 0 1.5px #2a2a35;
          flex-shrink: 0;
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
          width: 100%;
          height: 100%;
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
