'use client'

import { useUpdateOrganization } from '@/hooks/queries'
import { useAutoSave } from '@/hooks/useAutoSave'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@spaire/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@spaire/ui/components/atoms/Select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@spaire/ui/components/ui/form'
import React from 'react'
import { useForm } from 'react-hook-form'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'

type PresentmentCurrency = schemas['PresentmentCurrency']

const CURRENCIES: { code: PresentmentCurrency; flag: string; label: string }[] =
  [
    { code: 'usd', flag: '🇺🇸', label: 'USD' },
    { code: 'eur', flag: '🇪🇺', label: 'EUR' },
    { code: 'gbp', flag: '🇬🇧', label: 'GBP' },
    { code: 'cad', flag: '🇨🇦', label: 'CAD' },
    { code: 'aud', flag: '🇦🇺', label: 'AUD' },
    { code: 'chf', flag: '🇨🇭', label: 'CHF' },
    { code: 'jpy', flag: '🇯🇵', label: 'JPY' },
    { code: 'sek', flag: '🇸🇪', label: 'SEK' },
    { code: 'inr', flag: '🇮🇳', label: 'INR' },
    { code: 'brl', flag: '🇧🇷', label: 'BRL' },
    { code: 'aed', flag: '🇦🇪', label: 'AED' },
    { code: 'ars', flag: '🇦🇷', label: 'ARS' },
    { code: 'clp', flag: '🇨🇱', label: 'CLP' },
    { code: 'cny', flag: '🇨🇳', label: 'CNY' },
    { code: 'cop', flag: '🇨🇴', label: 'COP' },
    { code: 'czk', flag: '🇨🇿', label: 'CZK' },
    { code: 'dkk', flag: '🇩🇰', label: 'DKK' },
    { code: 'hkd', flag: '🇭🇰', label: 'HKD' },
    { code: 'huf', flag: '🇭🇺', label: 'HUF' },
    { code: 'idr', flag: '🇮🇩', label: 'IDR' },
    { code: 'ils', flag: '🇮🇱', label: 'ILS' },
    { code: 'krw', flag: '🇰🇷', label: 'KRW' },
    { code: 'mxn', flag: '🇲🇽', label: 'MXN' },
    { code: 'myr', flag: '🇲🇾', label: 'MYR' },
    { code: 'nok', flag: '🇳🇴', label: 'NOK' },
    { code: 'nzd', flag: '🇳🇿', label: 'NZD' },
    { code: 'pen', flag: '🇵🇪', label: 'PEN' },
    { code: 'php', flag: '🇵🇭', label: 'PHP' },
    { code: 'pln', flag: '🇵🇱', label: 'PLN' },
    { code: 'ron', flag: '🇷🇴', label: 'RON' },
    { code: 'sar', flag: '🇸🇦', label: 'SAR' },
    { code: 'sgd', flag: '🇸🇬', label: 'SGD' },
    { code: 'thb', flag: '🇹🇭', label: 'THB' },
    { code: 'try', flag: '🇹🇷', label: 'TRY' },
    { code: 'twd', flag: '🇹🇼', label: 'TWD' },
    { code: 'zar', flag: '🇿🇦', label: 'ZAR' },
  ]

interface OrganizationCurrencySettingsProps {
  organization: schemas['Organization']
}

type FormSchema = Pick<
  schemas['OrganizationUpdate'],
  'default_presentment_currency'
>

const OrganizationCurrencySettings: React.FC<
  OrganizationCurrencySettingsProps
> = ({ organization }) => {
  const form = useForm<FormSchema>({
    defaultValues: {
      default_presentment_currency:
        (organization.default_presentment_currency as PresentmentCurrency) ??
        'usd',
    },
  })
  const { control, setError, reset } = form

  const updateOrganization = useUpdateOrganization()
  const onSave = async (body: FormSchema) => {
    const { data, error } = await updateOrganization.mutateAsync({
      id: organization.id,
      body,
    })

    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, setError)
      } else {
        setError('root', { message: error.detail })
      }
      return
    }

    reset({
      ...data,
      default_presentment_currency:
        data.default_presentment_currency as PresentmentCurrency,
    })
  }

  useAutoSave({
    form,
    onSave,
    delay: 200,
  })

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()}>
        <SettingsGroup>
          <SettingsGroupItem
            title="Default payment currency"
            description="The default currency for products and checkout. Used as fallback if the customer's local currency is not available or defined on a product."
          >
            <FormField
              control={control}
              name="default_presentment_currency"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Select
                      value={field.value ?? 'usd'}
                      onValueChange={(v) =>
                        field.onChange(v as PresentmentCurrency)
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue>
                          {(() => {
                            const c = CURRENCIES.find(
                              (c) => c.code === field.value,
                            )
                            return c
                              ? `${c.flag} ${c.label}`
                              : (field.value ?? 'usd').toUpperCase()
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.flag} {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsGroupItem>
        </SettingsGroup>
      </form>
    </Form>
  )
}

export default OrganizationCurrencySettings
