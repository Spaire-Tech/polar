'use client'

import { useCallback } from 'react'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import Button from '@spaire/ui/components/atoms/Button'
import { Card, CardContent, CardHeader } from '@spaire/ui/components/atoms/Card'
import { motion } from 'framer-motion'
import { US_STATE_NAMES } from '../recommendation'
import {
  DOOLA_AFFILIATE_URL,
  FORMATION_STARTED_KEY,
  STORAGE_KEY,
  type WizardFormData,
  type FormationStartedData,
} from '../types'

interface ReviewRedirectStepProps {
  data: WizardFormData
  onBack: () => void
}

const PARTNER_BENEFITS = [
  '10% founder discount via Spaire',
  'Company formation & state filings',
  'Registered agent (1 year included)',
  'EIN (tax ID) assistance',
  'Access to startup perks & banking',
] as const

export default function ReviewRedirectStep({
  data,
  onBack,
}: ReviewRedirectStepProps) {
  const entityLabel =
    data.entity_type === 'C_CORP' ? 'C-Corporation' : 'LLC'
  const stateLabel =
    US_STATE_NAMES[data.formation_state] ?? data.formation_state

  const handleRedirect = useCallback(() => {
    // Store formation started flag for return card
    const formationData: FormationStartedData = {
      startedAt: new Date().toISOString(),
      companyName: data.legal_name,
      entityType: data.entity_type,
      formationState: data.formation_state,
    }
    localStorage.setItem(
      FORMATION_STARTED_KEY,
      JSON.stringify(formationData),
    )

    // Clear wizard draft
    localStorage.removeItem(STORAGE_KEY)

    // Same-tab redirect
    window.location.href = DOOLA_AFFILIATE_URL
  }, [data])

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-6">
        <h2 className="text-xl font-semibold dark:text-white">
          Review & Continue
        </h2>
      </div>

      {/* Company summary */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <h3 className="text-base font-semibold dark:text-white">
            Company Summary
          </h3>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="dark:text-polar-400 text-gray-500">
                Company name
              </dt>
              <dd className="font-medium dark:text-white">{data.legal_name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="dark:text-polar-400 text-gray-500">Entity type</dt>
              <dd className="font-medium dark:text-white">
                {stateLabel} {entityLabel}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="dark:text-polar-400 text-gray-500">
                Formation state
              </dt>
              <dd className="font-medium dark:text-white">{stateLabel}</dd>
            </div>
          </dl>

          {data.founders.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-sm font-medium dark:text-white">
                Founders
              </p>
              <ul className="space-y-1">
                {data.founders.map((founder, i) => (
                  <li
                    key={i}
                    className="dark:text-polar-400 text-sm text-gray-500"
                  >
                    {founder.name} ({founder.email})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Partner handoff card */}
      <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
        <CardHeader className="pb-2">
          <h3 className="text-base font-semibold dark:text-white">
            Complete Formation with doola
          </h3>
          <p className="dark:text-polar-400 text-sm text-gray-600">
            You will complete company formation with our partner doola. This
            usually takes about 10 minutes.
          </p>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-sm font-medium dark:text-white">
            What&apos;s included:
          </p>
          <ul className="space-y-1.5">
            {PARTNER_BENEFITS.map((benefit) => (
              <li
                key={benefit}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
              >
                <CheckCircleOutlined
                  className="shrink-0 text-green-500"
                  style={{ fontSize: 16 }}
                />
                {benefit}
              </li>
            ))}
          </ul>

          <motion.div
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="mt-5"
          >
            <Button
              fullWidth
              size="lg"
              onClick={handleRedirect}
            >
              Start Formation with doola
              <ArrowForwardOutlined
                className="ml-2"
                style={{ fontSize: 18 }}
              />
            </Button>
          </motion.div>

          <p className="dark:text-polar-500 mt-3 text-center text-xs text-gray-400">
            You&apos;ll be taken to doola.com to complete formation and
            payment.
          </p>
        </CardContent>
      </Card>

      <div className="mt-4 flex justify-start">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  )
}
