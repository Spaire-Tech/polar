'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { FadeUp } from '@/components/Animated/FadeUp'
import StepIndicator from './StepIndicator'
import FounderIntentStep from './steps/FounderIntentStep'
import CompanyDetailsStep from './steps/CompanyDetailsStep'
import type { RecommendationInput, RecommendationOutput } from './recommendation'
import {
  INITIAL_WIZARD_DATA,
  STORAGE_KEY,
  type CompanyDetailsData,
  type FounderIntentData,
  type WizardFormData,
} from './types'

export default function FormationWizard() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<WizardFormData>(() => {
    if (typeof window === 'undefined') return INITIAL_WIZARD_DATA
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        return { ...INITIAL_WIZARD_DATA, ...JSON.parse(saved) }
      } catch {
        return INITIAL_WIZARD_DATA
      }
    }
    return INITIAL_WIZARD_DATA
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData))
  }, [formData])

  const handleStep1Next = useCallback((data: FounderIntentData) => {
    setFormData((prev) => ({ ...prev, ...data }))
    setCurrentStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleStep2Next = useCallback(
    (data: CompanyDetailsData, recommendation: RecommendationOutput) => {
      setFormData((prev) => ({ ...prev, ...data, recommendation }))
      localStorage.removeItem(STORAGE_KEY)
      router.push('formation')
    },
    [router],
  )

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(1, prev - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const intentData: RecommendationInput = {
    product_type: formData.product_type as RecommendationInput['product_type'],
    founder_location: formData.founder_location as RecommendationInput['founder_location'],
    founder_state: formData.founder_state,
    planning_to_raise_vc: formData.planning_to_raise_vc as RecommendationInput['planning_to_raise_vc'],
    number_of_founders: formData.number_of_founders as RecommendationInput['number_of_founders'],
    equity_plans: formData.equity_plans as RecommendationInput['equity_plans'],
  }

  const stepTitles: Record<number, { title: string; description: string }> = {
    1: {
      title: 'Tell us about your startup',
      description: 'A few quick questions to recommend the best company structure for you.',
    },
    2: {
      title: 'Company details',
      description: 'Confirm your company name, entity, and founders.',
    },
  }

  const { title, description } = stepTitles[currentStep]

  return (
    <DashboardBody title={null}>
      <div className="flex w-full flex-col items-center pb-24">
        <motion.div
          initial="hidden"
          animate="visible"
          transition={{ duration: 1, staggerChildren: 0.2 }}
          className="flex w-full max-w-2xl flex-col gap-16 pt-8"
        >
          {/* Step indicator */}
          <StepIndicator currentStep={currentStep} />

          {/* Header */}
          <div className="flex flex-col gap-y-3">
            <h1 className="text-2xl font-medium tracking-tight md:text-3xl">
              {title}
            </h1>
            <p className="dark:text-spaire-400 max-w-md text-base text-gray-500">
              {description}
            </p>
          </div>

          {/* Step content */}
          {currentStep === 1 && (
            <FadeUp>
              <FounderIntentStep
                data={{
                  product_type: formData.product_type as FounderIntentData['product_type'],
                  founder_location: formData.founder_location as FounderIntentData['founder_location'],
                  founder_state: formData.founder_state,
                  planning_to_raise_vc: formData.planning_to_raise_vc as FounderIntentData['planning_to_raise_vc'],
                  number_of_founders: formData.number_of_founders as FounderIntentData['number_of_founders'],
                  equity_plans: formData.equity_plans as FounderIntentData['equity_plans'],
                }}
                onNext={handleStep1Next}
              />
            </FadeUp>
          )}
          {currentStep === 2 && (
            <FadeUp>
              <CompanyDetailsStep
                intentData={intentData}
                data={{
                  legal_name: formData.legal_name,
                  entity_type: formData.entity_type,
                  formation_state: formData.formation_state,
                  founders: formData.founders,
                }}
                onNext={handleStep2Next}
                onBack={handleBack}
              />
            </FadeUp>
          )}
        </motion.div>
      </div>
    </DashboardBody>
  )
}
