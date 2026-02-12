import { setValidationErrors } from '@/utils/api/errors'
import { api } from '@/utils/client'
import { enums, isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import CountryPicker from '@polar-sh/ui/components/atoms/CountryPicker'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useCallback, useState } from 'react'
import { useForm, useFormContext } from 'react-hook-form'

const AccountCreateModal = ({
  forOrganizationId,
  onAccountCreated,
}: {
  forOrganizationId: string
  onAccountCreated?: () => void
}) => {
  const form = useForm<schemas['AccountCreateForOrganization']>({
    defaultValues: {
      country: 'US',
    },
  })

  const {
    handleSubmit,
    setError,
    formState: { errors },
  } = form

  const [loading, setLoading] = useState(false)

  const onSubmit = useCallback(
    async (data: schemas['AccountCreateForOrganization']) => {
      setLoading(true)

      const { error } = await api.POST('/v1/accounts', {
        body: {
          account_type: 'stripe',
          country: data.country,
          organization_id: forOrganizationId,
        },
      })

      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, setError)
        } else {
          setError('root', { message: error.detail })
        }
        setLoading(false)
        return
      }

      setLoading(false)
      onAccountCreated?.()
    },
    [setLoading, forOrganizationId, onAccountCreated, setError],
  )

  return (
    <>
      <div className="flex flex-col gap-y-6 overflow-auto p-8">
        <h2>Setup payout account</h2>

        <Form {...form}>
          <form
            className="flex flex-col gap-y-4"
            onSubmit={handleSubmit(onSubmit)}
          >
            <AccountCountry />
            {errors.root && (
              <p className="text-destructive-foreground text-sm">
                {errors.root.message}
              </p>
            )}
            <Button
              className="self-start"
              type="submit"
              loading={loading}
              disabled={loading}
            >
              Set up account
            </Button>
          </form>
        </Form>
      </div>
    </>
  )
}

export const AccountCountry = () => {
  const { control } = useFormContext<schemas['AccountCreateForOrganization']>()

  return (
    <>
      <FormField
        control={control}
        name="country"
        render={({ field }) => {
          return (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <FormControl>
                <CountryPicker
                  value={field.value || undefined}
                  onChange={field.onChange}
                  allowedCountries={enums.stripeAccountCountryValues}
                />
              </FormControl>
              <FormMessage />
              <FormDescription>
                If this is a personal account, please select your country of
                residence. If this is an organization or business, select the
                country of tax residency.
              </FormDescription>
            </FormItem>
          )
        }}
      />
    </>
  )
}

export default AccountCreateModal
