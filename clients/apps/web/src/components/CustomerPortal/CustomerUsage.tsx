'use client'

import { useCustomerCustomerMeters } from '@/hooks/queries'
import Search from '@mui/icons-material/Search'
import { Client } from '@spaire/client'
import { DataTable } from '@spaire/ui/components/atoms/DataTable'
import Input from '@spaire/ui/components/atoms/Input'
import { Tabs, TabsContent } from '@spaire/ui/components/atoms/Tabs'
import { useMemo, useState } from 'react'
import FormattedUnits from '../Meter/FormattedUnits'
export interface CustomerUsageProps {
  api: Client
}

export const CustomerUsage = ({ api }: CustomerUsageProps) => {
  const [query, setQuery] = useState<string | null>(null)
  const { data, isLoading } = useCustomerCustomerMeters(api, { query })
  const customerMeters = useMemo(() => data?.items ?? [], [data])

  return (
    <div className="flex flex-col">
      <Tabs defaultValue="meters">
        <div className="flex flex-row items-center justify-between gap-x-12">
          <h3 className="text-2xl">Usage</h3>
        </div>
        <TabsContent className="flex flex-col gap-y-12 pt-4" value="meters">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-4 lg:flex-row">
              <div className="w-full lg:w-1/3">
                <Input
                  className="w-full bg-white shadow-xs"
                  preSlot={<Search fontSize="inherit" />}
                  placeholder="Search Usage Meter"
                  value={query || ''}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <h3 className="text-xl">Overview</h3>
            <DataTable
              isLoading={isLoading}
              columns={[
                {
                  header: 'Name',
                  accessorKey: 'meter_name',
                  cell: ({
                    row: {
                      original: { meter, consumed_units, credited_units },
                    },
                  }) => {
                    // Bind the ring to how much of the credited allowance has
                    // been consumed. It previously rendered a fixed full ring
                    // (rotate(-90deg) over a full-rectangle clip) regardless of
                    // the meter's actual usage.
                    const ratio =
                      credited_units > 0
                        ? Math.max(
                            0,
                            Math.min(1, consumed_units / credited_units),
                          )
                        : 0
                    const deg = Math.round(ratio * 360)
                    return (
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          title={`${Math.round(ratio * 100)}% of credited units consumed`}
                          style={{
                            background: `conic-gradient(#3b82f6 ${deg}deg, var(--sp-line, #e5e7eb) ${deg}deg)`,
                            transition: 'all 0.3s ease',
                          }}
                        />
                        <span>{meter.name}</span>
                      </div>
                    )
                  },
                },
                {
                  header: 'Consumed',
                  accessorKey: 'consumed_units',
                  cell: ({
                    row: {
                      original: { consumed_units },
                    },
                  }) => {
                    return <FormattedUnits value={consumed_units} />
                  },
                },
                {
                  header: 'Credited',
                  accessorKey: 'credited_units',
                  cell: ({
                    row: {
                      original: { credited_units },
                    },
                  }) => {
                    return <FormattedUnits value={credited_units} />
                  },
                },
                {
                  header: 'Balance',
                  accessorKey: 'balance',
                  cell: ({
                    row: {
                      original: { balance },
                    },
                  }) => {
                    return <FormattedUnits value={balance} />
                  },
                },
              ]}
              data={customerMeters}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
