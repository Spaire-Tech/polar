import { PolarThemeProvider } from '@/app/providers'
import type { CheckoutPublic } from '@spaire/sdk/models/components/checkoutpublic'
import PublicLayout from '../Layout/PublicLayout'
import CheckoutEmbedLayout from './Embed/CheckoutEmbedLayout'

interface CheckoutLayoutProps {
  checkout: CheckoutPublic
  embed: boolean
  theme?: 'light' | 'dark'
}

const CheckoutLayout: React.FC<
  React.PropsWithChildren<CheckoutLayoutProps>
> = ({ children, checkout, embed, theme }) => {
  if (embed) {
    return (
      <CheckoutEmbedLayout checkout={checkout} theme={theme}>
        {children}
      </CheckoutEmbedLayout>
    )
  }

  return (
    <PolarThemeProvider>
      <div className="dark md:dark:bg-polar-950 dark:bg-polar-900 relative h-full overflow-hidden bg-white md:bg-gray-50 dark:text-white">
        {/* Decorative gradient orbs */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-blue-400/[0.07] blur-3xl dark:bg-blue-500/20" />
        <div className="pointer-events-none absolute -right-24 top-1/3 h-[400px] w-[400px] rounded-full bg-blue-300/[0.06] blur-3xl dark:bg-blue-400/15" />
        <div className="pointer-events-none absolute -bottom-40 left-1/4 h-[450px] w-[450px] rounded-full bg-blue-500/[0.05] blur-3xl dark:bg-blue-600/10" />

        {/* Glass reflection strip */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/30 to-transparent dark:via-blue-400/40" />

        <PublicLayout className="relative z-10 gap-y-0 py-6 md:py-12" wide footer={false}>
          {children}
        </PublicLayout>
      </div>
    </PolarThemeProvider>
  )
}

export default CheckoutLayout
