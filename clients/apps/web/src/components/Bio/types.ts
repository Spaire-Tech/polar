export type BioBlockType =
  | 'profile_header'
  | 'links'
  | 'product'
  | 'product_grid'
  | 'video'
  | 'gallery'
  | 'text'
  | 'divider'
  | 'newsletter'
  | 'booking'

export interface BioSocial {
  platform: string
  url: string
}

export interface BioOrganizationLite {
  id: string
  slug: string
  name: string
  avatar_url: string | null
  socials: BioSocial[]
  bio_settings: {
    enabled?: boolean
    display_title?: string | null
    short_bio?: string | null
    avatar_shape?: 'circle' | 'rounded'
    show_powered_by?: boolean
    newsletter_enabled?: boolean
    newsletter_heading?: string | null
    newsletter_description?: string | null
  }
}

export interface BioBlock {
  id: string
  organization_id: string
  type: BioBlockType | string
  order: number
  enabled: boolean
  settings: Record<string, unknown>
}

export interface LinksBlockItem {
  id: string
  label: string
  url: string
  subtitle?: string | null
  logo_url?: string | null
  logo_file_id?: string | null
  cta?: string | null
}

export interface LinksBlockSettings {
  heading?: string | null
  items?: LinksBlockItem[]
}

export interface ProductBlockSettings {
  product_id: string
  layout?: 'row' | 'card'
}

export interface ProfileHeaderBlockSettings {
  heading?: string | null
  show_socials?: boolean
}
