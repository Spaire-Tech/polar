// Spaire Title Styles — the curated "movie title" typefaces a creator can
// pick for their course title (hero headline on the landing page + the
// course title in the customer portal hero). Every face is an open-licensed
// Google Font, self-hosted by next/font at build time (no runtime requests),
// one weight each to keep the payload small.
//
// The names are OURS — the picker never surfaces the underlying font name.
// "Classic" (key null/absent) is the design's default typography.

import {
  Abril_Fatface,
  Alfa_Slab_One,
  Anton,
  Bebas_Neue,
  Cinzel,
  Monoton,
  Orbitron,
  Playfair_Display,
  Righteous,
  Special_Elite,
} from 'next/font/google'

const marquee = Bebas_Neue({ weight: '400', subsets: ['latin'], display: 'swap' })
const blockbuster = Anton({ weight: '400', subsets: ['latin'], display: 'swap' })
const premiere = Playfair_Display({
  weight: '700',
  subsets: ['latin'],
  display: 'swap',
})
const epic = Cinzel({ weight: '700', subsets: ['latin'], display: 'swap' })
const matinee = Abril_Fatface({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
})
const dossier = Special_Elite({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
})
const orbit = Orbitron({ weight: '700', subsets: ['latin'], display: 'swap' })
const neon = Monoton({ weight: '400', subsets: ['latin'], display: 'swap' })
const retro = Righteous({ weight: '400', subsets: ['latin'], display: 'swap' })
const frontier = Alfa_Slab_One({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
})

export type TitleFont = {
  key: string
  /** The Spaire-brand name shown in the picker. */
  label: string
  /** One-word mood hint shown under the label. */
  mood: string
  fontFamily: string
}

export const TITLE_FONTS: TitleFont[] = [
  { key: 'marquee', label: 'Marquee', mood: 'Poster', fontFamily: marquee.style.fontFamily },
  { key: 'blockbuster', label: 'Blockbuster', mood: 'Bold', fontFamily: blockbuster.style.fontFamily },
  { key: 'premiere', label: 'Premiere', mood: 'Elegant', fontFamily: premiere.style.fontFamily },
  { key: 'epic', label: 'Epic', mood: 'Monumental', fontFamily: epic.style.fontFamily },
  { key: 'matinee', label: 'Matinée', mood: 'Editorial', fontFamily: matinee.style.fontFamily },
  { key: 'dossier', label: 'Dossier', mood: 'Typewritten', fontFamily: dossier.style.fontFamily },
  { key: 'orbit', label: 'Orbit', mood: 'Sci-fi', fontFamily: orbit.style.fontFamily },
  { key: 'neon', label: 'Neon', mood: 'Retro glow', fontFamily: neon.style.fontFamily },
  { key: 'retro', label: 'Retro', mood: 'Seventies', fontFamily: retro.style.fontFamily },
  { key: 'frontier', label: 'Frontier', mood: 'Slab', fontFamily: frontier.style.fontFamily },
]

/** CSS font-family for a stored title-style key; undefined for Classic /
 *  unknown keys (the design default wins). */
export function titleFontFamily(
  key: string | null | undefined,
): string | undefined {
  if (!key) return undefined
  return TITLE_FONTS.find((f) => f.key === key)?.fontFamily
}
