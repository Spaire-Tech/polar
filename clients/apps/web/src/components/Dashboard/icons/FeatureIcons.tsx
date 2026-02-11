import { twMerge } from 'tailwind-merge'
import { ReactNode } from 'react'

export type DashboardFeatureIconProps = {
  className?: string
}

const IconShell = ({
  className,
  children,
}: DashboardFeatureIconProps & { children: ReactNode }) => {
  return (
    <svg
      className={twMerge('h-4 w-4', className)}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      {children}
    </svg>
  )
}

export const OverviewFeatureIcon = ({ className }: DashboardFeatureIconProps) => {
  return (
    <IconShell className={className}>
      <rect x="1" y="1" width="14" height="14" rx="4" fill="#EEF2FF" />
      <rect x="3" y="3" width="4" height="4" rx="1.4" fill="#818CF8" />
      <rect x="9" y="3" width="4" height="6" rx="1.4" fill="#60A5FA" />
      <rect x="3" y="9" width="10" height="4" rx="1.4" fill="#34D399" />
    </IconShell>
  )
}

export const CatalogFeatureIcon = ({ className }: DashboardFeatureIconProps) => {
  return (
    <IconShell className={className}>
      <rect x="1" y="1" width="14" height="14" rx="4" fill="#ECFEFF" />
      <rect x="3" y="3" width="10" height="3.2" rx="1" fill="#22D3EE" />
      <rect x="3" y="7.5" width="4.5" height="5.5" rx="1" fill="#06B6D4" />
      <rect x="8.5" y="7.5" width="4.5" height="5.5" rx="1" fill="#67E8F9" />
    </IconShell>
  )
}

export const CustomersFeatureIcon = ({
  className,
}: DashboardFeatureIconProps) => {
  return (
    <IconShell className={className}>
      <rect x="1" y="1" width="14" height="14" rx="4" fill="#FFF7ED" />
      <circle cx="5.8" cy="6" r="1.7" fill="#F59E0B" />
      <circle cx="10.4" cy="6.8" r="1.4" fill="#FB7185" />
      <path d="M3.6 12C3.6 10.7 4.6 9.7 5.9 9.7H6.8C8.1 9.7 9.1 10.7 9.1 12V13H3.6V12Z" fill="#F97316" />
      <path d="M8.8 13V12.2C8.8 11.2 9.6 10.4 10.6 10.4C11.6 10.4 12.4 11.2 12.4 12.2V13H8.8Z" fill="#E11D48" />
    </IconShell>
  )
}

export const AnalyticsFeatureIcon = ({
  className,
}: DashboardFeatureIconProps) => {
  return (
    <IconShell className={className}>
      <rect x="1" y="1" width="14" height="14" rx="4" fill="#EFF6FF" />
      <path d="M3.2 10L5.8 7.4L7.8 9.2L12.2 4.8" stroke="#2563EB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12.2" cy="4.8" r="1.1" fill="#60A5FA" />
    </IconShell>
  )
}

export const RevenueFeatureIcon = ({ className }: DashboardFeatureIconProps) => {
  return (
    <IconShell className={className}>
      <rect x="1" y="1" width="14" height="14" rx="4" fill="#ECFDF5" />
      <rect x="3.3" y="8.4" width="2" height="4.6" rx="0.8" fill="#34D399" />
      <rect x="6.9" y="6.6" width="2" height="6.4" rx="0.8" fill="#10B981" />
      <rect x="10.5" y="4.4" width="2" height="8.6" rx="0.8" fill="#059669" />
    </IconShell>
  )
}

export const StartupStackFeatureIcon = ({
  className,
}: DashboardFeatureIconProps) => {
  return (
    <IconShell className={className}>
      <rect x="1" y="1" width="14" height="14" rx="4" fill="#FAF5FF" />
      <path
        d="M8 2.9L9.5 5.6L12.5 6L10.3 8.1L10.8 11L8 9.6L5.2 11L5.7 8.1L3.5 6L6.5 5.6L8 2.9Z"
        fill="#A855F7"
      />
      <path d="M8 4.6L9 6.2L10.8 6.5L9.4 7.8L9.7 9.5L8 8.6L6.3 9.5L6.6 7.8L5.2 6.5L7 6.2L8 4.6Z" fill="#E9D5FF" />
    </IconShell>
  )
}
