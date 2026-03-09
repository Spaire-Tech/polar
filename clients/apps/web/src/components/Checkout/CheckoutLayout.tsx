import { PolarThemeProvider } from '@/app/providers'
import type { CheckoutPublic } from '@spaire/sdk/models/components/checkoutpublic'
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
      <div className="dark:bg-spaire-950 flex h-full min-h-screen items-center justify-center bg-white dark:text-white md:bg-gray-50">
        {children}
      </div>
    </PolarThemeProvider>
  )
}

export default CheckoutLayout
