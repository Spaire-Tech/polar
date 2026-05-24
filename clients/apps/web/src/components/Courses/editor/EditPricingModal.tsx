'use client'

// EditPricingModal — opens the StepPricingWizard from onboarding step 3
// inside a fullscreen overlay so changing the price of an existing course
// uses the exact same UI (with live checkout preview) the user originally
// configured pricing through. The wizard's "Generate outline" CTA is
// repurposed as "Save changes"; save patches the underlying product and
// closes back to the course Pricing tab.

import { useUpdateProduct } from '@/hooks/queries/products'
import { ProductEditOrCreateForm } from '@/utils/product'
import { schemas } from '@spaire/client'
import { Form } from '@spaire/ui/components/ui/form'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '../../Toast/use-toast'
import {
  SpaireOnboardingStyles,
  StepPricingWizard,
  type WizardPaywallState,
} from '../CourseWizard.steps'

export function EditPricingModal({
  organization,
  product,
  onClose,
}: {
  organization: schemas['Organization']
  product: schemas['Product']
  onClose: () => void
}) {
  const updateProduct = useUpdateProduct(organization)

  // Seed the wizard's form with the product's current pricing so the
  // live checkout preview opens already showing what's actually charged.
  // Spread `...price` so the existing price id rides along — the backend
  // treats that as ExistingProductPrice and keeps the row untouched if
  // it wasn't changed.
  const form = useForm<ProductEditOrCreateForm>({
    defaultValues: {
      ...product,
      medias: product.medias.map((m) => m.id),
      full_medias: product.medias,
      prices: product.prices.map((p) => ({ ...p })) as never,
      metadata: Object.entries(product.metadata).map(([key, value]) => ({
        key,
        value,
      })),
    },
  })

  // The paywall slider lives in the course editor's own Pricing tab — we
  // pass a no-op state down so the StepPricingWizard's signature is
  // satisfied without it surfacing the duplicate control.
  const [paywall, setPaywall] = useState<WizardPaywallState>({
    paywallEnabled: false,
    freePreviewLessons: 0,
  })

  const save = async () => {
    const values = form.getValues() as unknown as {
      prices: schemas['ProductUpdate']['prices']
      recurring_interval?: schemas['SubscriptionRecurringInterval'] | null
      recurring_interval_count?: number | null
      trial_interval?: schemas['TrialInterval'] | null
      trial_interval_count?: number | null
    }
    try {
      const result = await updateProduct.mutateAsync({
        id: product.id,
        body: {
          prices: values.prices,
          recurring_interval: values.recurring_interval ?? null,
          recurring_interval_count: values.recurring_interval_count ?? null,
          trial_interval: values.trial_interval ?? null,
          trial_interval_count: values.trial_interval_count ?? null,
        },
      })
      if (result.error) {
        toast({
          title: 'Failed to update price',
          description: JSON.stringify(result.error),
        })
        return
      }
      toast({ title: 'Pricing updated' })
      onClose()
    } catch (err) {
      toast({
        title: 'Failed to update price',
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => e.preventDefault()}
        className="spaire-onboarding"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: '#ffffff',
          overflowY: 'auto',
        }}
      >
        <SpaireOnboardingStyles />
        <div className="spaire-shell">
          <StepPricingWizard
            organization={organization}
            paywall={paywall}
            onPaywallChange={setPaywall}
            onNext={save}
            onBack={onClose}
            onClose={onClose}
            courseTitle={product.name}
            courseDesc={product.description ?? undefined}
            nextLabel={updateProduct.isPending ? 'Saving…' : 'Save changes'}
            backLabel="Cancel"
            hideProgress
            hideAccessSection
          />
        </div>
      </form>
    </Form>
  )
}
