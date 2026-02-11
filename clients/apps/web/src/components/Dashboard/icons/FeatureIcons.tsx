export type DashboardFeatureIconProps = {
  className?: string
}

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 20 20',
  xmlns: 'http://www.w3.org/2000/svg',
  fill: 'none',
}

export const OverviewFeatureIcon = ({
  className,
}: DashboardFeatureIconProps) => {
  return (
    <svg {...iconProps} className={className}>
      <rect x="2" y="2" width="7" height="7" rx="2" fill="#8B5CF6" />
      <rect x="11" y="2" width="7" height="11" rx="2" fill="#3B82F6" />
      <rect x="2" y="11" width="16" height="7" rx="2" fill="#22C55E" />
    </svg>
  )
}

export const CatalogFeatureIcon = ({ className }: DashboardFeatureIconProps) => {
  return (
    <svg {...iconProps} className={className}>
      <rect x="2" y="3" width="16" height="14" rx="3" fill="#0EA5E9" />
      <rect x="4.5" y="5.5" width="11" height="4" rx="1.5" fill="#BAE6FD" />
      <rect x="4.5" y="11" width="5" height="4" rx="1.2" fill="#0369A1" />
      <rect x="10.5" y="11" width="5" height="4" rx="1.2" fill="#7DD3FC" />
    </svg>
  )
}

export const CustomersFeatureIcon = ({
  className,
}: DashboardFeatureIconProps) => {
  return (
    <svg {...iconProps} className={className}>
      <circle cx="7" cy="7" r="3" fill="#F59E0B" />
      <circle cx="13.5" cy="8" r="2.5" fill="#FB7185" />
      <path
        d="M3.5 16C3.5 13.8 5.3 12 7.5 12H8.5C10.7 12 12.5 13.8 12.5 16V17H3.5V16Z"
        fill="#F97316"
      />
      <path
        d="M10.5 17V15.8C10.5 14.1 11.9 12.7 13.6 12.7C15.3 12.7 16.7 14.1 16.7 15.8V17H10.5Z"
        fill="#E11D48"
      />
    </svg>
  )
}

export const AnalyticsFeatureIcon = ({
  className,
}: DashboardFeatureIconProps) => {
  return (
    <svg {...iconProps} className={className}>
      <rect x="2" y="2" width="16" height="16" rx="4" fill="#1D4ED8" />
      <path d="M5 13L8.5 9.5L11 12L15 7" stroke="#DBEAFE" strokeWidth="2" />
      <circle cx="15" cy="7" r="1.5" fill="#93C5FD" />
    </svg>
  )
}

export const RevenueFeatureIcon = ({ className }: DashboardFeatureIconProps) => {
  return (
    <svg {...iconProps} className={className}>
      <rect x="2" y="2" width="16" height="16" rx="4" fill="#0F766E" />
      <rect x="5" y="11" width="2.5" height="4" rx="1" fill="#99F6E4" />
      <rect x="8.75" y="8" width="2.5" height="7" rx="1" fill="#5EEAD4" />
      <rect x="12.5" y="5" width="2.5" height="10" rx="1" fill="#14B8A6" />
    </svg>
  )
}

export const StartupStackFeatureIcon = ({
  className,
}: DashboardFeatureIconProps) => {
  return (
    <svg {...iconProps} className={className}>
      <path
        d="M10 2L13.3 7.4L18 8.1L14.6 11.8L15.5 17L10 14.1L4.5 17L5.4 11.8L2 8.1L6.7 7.4L10 2Z"
        fill="#A855F7"
      />
      <path d="M10 5.5L11.8 8.5L14.6 9L12.6 11.2L13 14.1L10 12.5L7 14.1L7.4 11.2L5.4 9L8.2 8.5L10 5.5Z" fill="#E9D5FF" />
    </svg>
  )
}
