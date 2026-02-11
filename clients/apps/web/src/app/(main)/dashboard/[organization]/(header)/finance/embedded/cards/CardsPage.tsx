'use client'

import StripeConnectProvider from '@/components/Finance/Embedded/StripeConnectProvider'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import {
  CreditCard,
  Eye,
  Lock,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  Snowflake,
} from 'lucide-react'

export default function CardsPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  return (
    <DashboardBody>
      <div className="space-y-6 p-4 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="dark:text-white text-xl font-bold text-gray-900">
              Cards
            </h2>
            <p className="dark:text-polar-400 mt-1 text-sm text-gray-500">
              Issue virtual and physical cards for your team. Set spending
              limits and track transactions.
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Issue Card
          </Button>
        </div>

        {/* Card Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="dark:border-polar-700 dark:bg-polar-900 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-500" />
              <span className="dark:text-polar-400 text-xs font-medium text-gray-500">
                Active Cards
              </span>
            </div>
            <p className="dark:text-white mt-1 text-2xl font-semibold text-gray-900">
              0
            </p>
          </div>
          <div className="dark:border-polar-700 dark:bg-polar-900 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Snowflake className="h-4 w-4 text-amber-500" />
              <span className="dark:text-polar-400 text-xs font-medium text-gray-500">
                Frozen
              </span>
            </div>
            <p className="dark:text-white mt-1 text-2xl font-semibold text-gray-900">
              0
            </p>
          </div>
          <div className="dark:border-polar-700 dark:bg-polar-900 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span className="dark:text-polar-400 text-xs font-medium text-gray-500">
                Total Spent
              </span>
            </div>
            <p className="dark:text-white mt-1 text-2xl font-semibold text-gray-900">
              $0.00
            </p>
          </div>
        </div>

        {/* Cards List */}
        <StripeConnectProvider organizationId={organization.id}>
          <ShadowBoxOnMd>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <h3 className="dark:text-white text-sm font-semibold text-gray-900">
                  Your Cards
                </h3>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    View All
                  </Button>
                </div>
              </div>

              {/* Empty State */}
              <div className="dark:border-polar-700 mt-4 flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-gray-200">
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10">
                    <CreditCard className="h-6 w-6 text-blue-500" />
                  </div>
                  <h4 className="dark:text-white mt-3 text-sm font-semibold text-gray-900">
                    No cards issued yet
                  </h4>
                  <p className="dark:text-polar-400 mt-1 max-w-xs text-xs text-gray-500">
                    Issue your first virtual card to start making purchases.
                    Cards can be created instantly with custom spending limits.
                  </p>
                  <Button size="sm" className="mt-4 gap-2">
                    <Plus className="h-3.5 w-3.5" />
                    Issue Your First Card
                  </Button>
                </div>
              </div>
            </div>
          </ShadowBoxOnMd>

          {/* Card Actions Reference */}
          <ShadowBoxOnMd>
            <div className="p-6">
              <h3 className="dark:text-white mb-4 text-sm font-semibold text-gray-900">
                Card Actions
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="dark:border-polar-700 dark:bg-polar-800 flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <Lock className="h-4 w-4 text-amber-500" />
                  <div>
                    <p className="dark:text-white text-xs font-medium text-gray-900">
                      Freeze Card
                    </p>
                    <p className="dark:text-polar-500 text-[11px] text-gray-400">
                      Temporarily disable spending
                    </p>
                  </div>
                </div>
                <div className="dark:border-polar-700 dark:bg-polar-800 flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <Eye className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="dark:text-white text-xs font-medium text-gray-900">
                      View Details
                    </p>
                    <p className="dark:text-polar-500 text-[11px] text-gray-400">
                      See card number and CVV
                    </p>
                  </div>
                </div>
                <div className="dark:border-polar-700 dark:bg-polar-800 flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <MoreHorizontal className="h-4 w-4 text-purple-500" />
                  <div>
                    <p className="dark:text-white text-xs font-medium text-gray-900">
                      Set Limits
                    </p>
                    <p className="dark:text-polar-500 text-[11px] text-gray-400">
                      Configure spending controls
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ShadowBoxOnMd>
        </StripeConnectProvider>
      </div>
    </DashboardBody>
  )
}
