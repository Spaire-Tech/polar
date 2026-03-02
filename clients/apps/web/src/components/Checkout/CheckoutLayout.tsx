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
      <div className="dark md:bg-spaire-950 bg-spaire-900 h-full text-white">
        <PublicLayout className="gap-y-0 py-6 md:py-12" wide footer={false}>
          {children}
        </PublicLayout>
      </div>
    </PolarThemeProvider>
  )
}

export default CheckoutLayout
