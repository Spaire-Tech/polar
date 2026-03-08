'use client'

import { useCallback, useState } from 'react'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import Button from '@spaire/ui/components/atoms/Button'
import { US_STATE_NAMES } from '../recommendation'
import {
  DOOLA_AFFILIATE_URL,
  FORMATION_STARTED_KEY,
  STORAGE_KEY,
  type WizardFormData,
  type FormationStartedData,
} from '../types'

const DISCOUNT_CODE = 'DOOLASPAIRE10'

interface ReviewRedirectStepProps {
  data: WizardFormData
  onBack: () => void
}

export default function ReviewRedirectStep({
  data,
  onBack,
}: ReviewRedirectStepProps) {
  const [copied, setCopied] = useState(false)
  const entityLabel =
    data.entity_type === 'C_CORP' ? 'C-Corporation' : 'LLC'
  const stateLabel =
    US_STATE_NAMES[data.formation_state] ?? data.formation_state

  const handleCopy = async () => {
    await navigator.clipboard.writeText(DISCOUNT_CODE)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRedirect = useCallback(() => {
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

    localStorage.removeItem(STORAGE_KEY)

    window.location.href = DOOLA_AFFILIATE_URL
  }, [data])

  return (
    <div className="w-full">
      <div className="mb-8">
        <h2 className="text-2xl font-medium tracking-tight dark:text-white">
          Review and continue
        </h2>
        <p className="dark:text-spaire-400 mt-2 text-base leading-relaxed text-gray-500">
          Confirm your details below, then complete formation with doola.
        </p>
      </div>

      {/* Company summary */}
      <div className="dark:bg-spaire-900 dark:border-spaire-800 mb-8 rounded-2xl border border-gray-200 bg-white p-6">
        <h3 className="dark:text-spaire-500 mb-4 text-sm font-medium uppercase tracking-wider text-gray-400">
          Company summary
        </h3>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="dark:text-spaire-400 text-gray-500">
              Company name
            </dt>
            <dd className="font-medium dark:text-white">{data.legal_name}</dd>
          </div>
          <div className="dark:border-spaire-800 border-t border-gray-100" />
          <div className="flex justify-between">
            <dt className="dark:text-spaire-400 text-gray-500">Entity type</dt>
            <dd className="font-medium dark:text-white">{entityLabel}</dd>
          </div>
          <div className="dark:border-spaire-800 border-t border-gray-100" />
          <div className="flex justify-between">
            <dt className="dark:text-spaire-400 text-gray-500">
              Formation state
            </dt>
            <dd className="font-medium dark:text-white">{stateLabel}</dd>
          </div>
          {data.founders.length > 0 && (
            <>
              <div className="dark:border-spaire-800 border-t border-gray-100" />
              <div className="flex justify-between">
                <dt className="dark:text-spaire-400 text-gray-500">
                  Founders
                </dt>
                <dd className="text-right font-medium dark:text-white">
                  {data.founders.map((f) => f.name).join(', ')}
                </dd>
              </div>
            </>
          )}
        </dl>
      </div>

      {/* Discount code */}
      <div className="dark:bg-spaire-900 dark:border-spaire-800 mb-8 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4">
        <div className="flex flex-col gap-y-1">
          <span className="dark:text-spaire-400 text-xs text-gray-500">
            Apply this code at checkout for 10% off
          </span>
          <span className="font-mono text-lg font-semibold tracking-wider dark:text-white">
            {DISCOUNT_CODE}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="dark:bg-spaire-800 dark:hover:bg-spaire-700 dark:text-spaire-300 flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-200"
        >
          {copied ? (
            <>
              <CheckOutlined style={{ fontSize: 16 }} />
              Copied
            </>
          ) : (
            <>
              <ContentCopyOutlined style={{ fontSize: 16 }} />
              Copy
            </>
          )}
        </button>
      </div>

      {/* CTA */}
      <Button
        fullWidth
        size="lg"
        onClick={handleRedirect}
      >
        Continue to doola
        <ArrowForwardOutlined
          className="ml-2"
          style={{ fontSize: 18 }}
        />
      </Button>

      <p className="dark:text-spaire-500 mt-3 text-center text-xs text-gray-400">
        You will be redirected to doola.com to complete formation and payment.
      </p>

      <div className="mt-6 flex justify-start">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  )
}
