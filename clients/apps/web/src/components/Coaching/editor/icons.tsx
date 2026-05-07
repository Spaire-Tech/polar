// Icons for the coaching editor — ported verbatim from the design handoff
// (icons.jsx). Stroked, 24x24 viewBox, currentColor.

import type { CSSProperties, ReactNode } from 'react'

type IconProps = {
  size?: number
  // Numeric stroke-width that the wrapper hands to <svg strokeWidth>.
  // Renamed locally so it doesn't collide with SVG's `stroke` attribute
  // (string) when callers pass it through the wrapper.
  stroke?: number
  style?: CSSProperties
  className?: string
}

function SvgWrap({
  size = 16,
  stroke = 1.6,
  fill = 'none',
  children,
  style,
  className,
}: IconProps & { fill?: string; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
    >
      {children}
    </svg>
  )
}

function FilledSvg({
  size = 16,
  style,
  className,
  children,
}: {
  size?: number
  style?: CSSProperties
  className?: string
  children: ReactNode
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={style}
      className={className}
    >
      {children}
    </svg>
  )
}

export const Ic = {
  Plus: (p: IconProps) => (
    <SvgWrap {...p}>
      <path d="M12 5v14M5 12h14" />
    </SvgWrap>
  ),
  Check: (p: IconProps) => (
    <SvgWrap {...p} stroke={p.stroke ?? 2.4}>
      <path d="M5 12.5l4 4L19 7" />
    </SvgWrap>
  ),
  Chevron: (p: IconProps) => (
    <SvgWrap {...p}>
      <path d="M9 6l6 6-6 6" />
    </SvgWrap>
  ),
  ChevronDown: (p: IconProps) => (
    <SvgWrap {...p}>
      <path d="M6 9l6 6 6-6" />
    </SvgWrap>
  ),
  Search: (p: IconProps) => (
    <SvgWrap {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </SvgWrap>
  ),
  More: (p: IconProps) => (
    <FilledSvg {...p}>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </FilledSvg>
  ),
  Drag: (p: IconProps) => (
    <FilledSvg {...p}>
      <circle cx="9" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" />
      <circle cx="15" cy="6" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="15" cy="18" r="1.4" />
    </FilledSvg>
  ),
  Calendar: (p: IconProps) => (
    <SvgWrap {...p}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </SvgWrap>
  ),
  Clock: (p: IconProps) => (
    <SvgWrap {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </SvgWrap>
  ),
  Link: (p: IconProps) => (
    <SvgWrap {...p}>
      <path d="M10 14a4 4 0 015.66 0l3-3a4 4 0 10-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 01-5.66 0l-3 3a4 4 0 005.66 5.66l1-1" />
    </SvgWrap>
  ),
  Video: (p: IconProps) => (
    <SvgWrap {...p}>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10l5-3v10l-5-3z" />
    </SvgWrap>
  ),
  Upload: (p: IconProps) => (
    <SvgWrap {...p}>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 17v3h16v-3" />
    </SvgWrap>
  ),
  File: (p: IconProps) => (
    <SvgWrap {...p}>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5" />
    </SvgWrap>
  ),
  Pin: (p: IconProps) => (
    <SvgWrap {...p}>
      <path d="M12 17v5" />
      <path d="M9 3h6l-1 5 4 4H6l4-4z" />
    </SvgWrap>
  ),
  Eye: (p: IconProps) => (
    <SvgWrap {...p}>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </SvgWrap>
  ),
  Hide: (p: IconProps) => (
    <SvgWrap {...p}>
      <path d="M3 3l18 18" />
      <path d="M10.5 6.3A10.7 10.7 0 0112 6c6 0 10 6 10 6a17.7 17.7 0 01-3.2 3.8M6.5 6.5A17.7 17.7 0 002 12s4 6 10 6c1.1 0 2.2-.2 3.2-.6" />
    </SvgWrap>
  ),
  Users: (p: IconProps) => (
    <SvgWrap {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 19c.7-3 3.4-5 6.5-5s5.8 2 6.5 5" />
      <circle cx="17" cy="9" r="2.8" />
      <path d="M21.5 18.5c-.5-2.2-2.4-3.7-4.5-3.8" />
    </SvgWrap>
  ),
  Reply: (p: IconProps) => (
    <SvgWrap {...p}>
      <path d="M9 14L4 9l5-5M4 9h10a6 6 0 016 6v5" />
    </SvgWrap>
  ),
  Heart: (p: IconProps) => (
    <SvgWrap {...p}>
      <path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z" />
    </SvgWrap>
  ),
  Settings: (p: IconProps) => (
    <SvgWrap {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </SvgWrap>
  ),
  Edit: (p: IconProps) => (
    <SvgWrap {...p}>
      <path d="M14 4l6 6L8 22H2v-6z" />
    </SvgWrap>
  ),
  Trash: (p: IconProps) => (
    <SvgWrap {...p}>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M5 7l1 13a2 2 0 002 2h8a2 2 0 002-2l1-13M9 7V4h6v3" />
    </SvgWrap>
  ),
  External: (p: IconProps) => (
    <SvgWrap {...p}>
      <path d="M14 4h6v6" />
      <path d="M20 4l-8 8" />
      <path d="M16 14v6H4V8h6" />
    </SvgWrap>
  ),
  Mail: (p: IconProps) => (
    <SvgWrap {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 7 9-7" />
    </SvgWrap>
  ),
  Bell: (p: IconProps) => (
    <SvgWrap {...p}>
      <path d="M6 8a6 6 0 1112 0c0 6 3 6 3 9H3c0-3 3-3 3-9z" />
      <path d="M10 21a2 2 0 004 0" />
    </SvgWrap>
  ),
  Sparkles: (p: IconProps) => (
    <SvgWrap {...p}>
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
      <path d="M19 14l.7 1.8L21.5 16l-1.8.7L19 18.5l-.7-1.8L16.5 16l1.8-.5z" />
    </SvgWrap>
  ),
  Filter: (p: IconProps) => (
    <SvgWrap {...p}>
      <path d="M3 5h18l-7 8v6l-4-2v-4z" />
    </SvgWrap>
  ),
  Lock: (p: IconProps) => (
    <SvgWrap {...p}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </SvgWrap>
  ),
  ArrowLeft: (p: IconProps) => (
    <SvgWrap {...p}>
      <path d="M19 12H5" />
      <path d="M12 5l-7 7 7 7" />
    </SvgWrap>
  ),
}
