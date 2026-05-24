// Minimal stroke-icon set used by the Community surface.
// Kept local (instead of pulling MUI) so the bundle stays small for the
// customer-portal route and the iconography matches the Apple-monochrome
// look exactly.

import type { SVGProps } from 'react'

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

type Props = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number }

const withSize = ({ size, ...rest }: Props) =>
  size != null
    ? { ...base, ...rest, width: size, height: size }
    : { ...base, ...rest }

export const IconBook = (p: Props = {}) => (
  <svg {...withSize(p)}>
    <path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5z" />
    <path d="M4 19a2 2 0 012-2h13" />
  </svg>
)

export const IconChat = (p: Props = {}) => (
  <svg {...withSize(p)}>
    <path d="M21 12a8 8 0 01-12.7 6.5L3 20l1.5-5.3A8 8 0 1121 12z" />
  </svg>
)

export const IconShare = (p: Props = {}) => (
  <svg {...withSize(p)}>
    <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" />
  </svg>
)

export const IconDots = (p: Props = {}) => (
  <svg {...withSize(p)}>
    <circle cx="5" cy="12" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="19" cy="12" r="1.4" />
  </svg>
)

export const IconPlus = (p: Props = {}) => (
  <svg {...withSize(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IconPin = (p: Props = {}) => (
  <svg {...withSize(p)}>
    <path d="M12 17v5M7 4h10l-1 5 3 4H5l3-4-1-5z" />
  </svg>
)

export const IconFilter = (p: Props = {}) => (
  <svg {...withSize(p)}>
    <path d="M4 5h16l-6 8v6l-4-2v-4L4 5z" />
  </svg>
)

export const IconSort = (p: Props = {}) => (
  <svg {...withSize(p)}>
    <path d="M3 6h18M6 12h12M10 18h4" />
  </svg>
)

export const IconStar = (p: Props = {}) => (
  <svg {...withSize(p)}>
    <path d="M12 3l2.5 6.5L21 10l-5 4.5L17.5 21 12 17.5 6.5 21 8 14.5 3 10l6.5-.5L12 3z" />
  </svg>
)

export const IconImage = (p: Props = {}) => (
  <svg {...withSize(p)}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
)

export const IconTrash = (p: Props = {}) => (
  <svg {...withSize(p)}>
    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14" />
  </svg>
)

export const IconCheck = (p: Props = {}) => (
  <svg {...withSize(p)}>
    <path d="M4 12l5 5L20 6" />
  </svg>
)

export const IconX = (p: Props = {}) => (
  <svg {...withSize(p)}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)

export const IconVideo = (p: Props = {}) => (
  <svg {...withSize(p)}>
    <rect x="3" y="6" width="14" height="12" rx="2" />
    <path d="M17 10l4-2v8l-4-2z" />
  </svg>
)

export const IconPlay = (p: Props = {}) => (
  <svg {...withSize(p)} fill="currentColor" stroke="none">
    <path d="M8 5v14l11-7L8 5z" />
  </svg>
)
