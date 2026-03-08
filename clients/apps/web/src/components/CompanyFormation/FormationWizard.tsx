'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import StepIndicator from './StepIndicator'
import FounderIntentStep from './steps/FounderIntentStep'
import CompanyDetailsStep from './steps/CompanyDetailsStep'
import ReviewRedirectStep from './steps/ReviewRedirectStep'
import type { RecommendationInput, RecommendationOutput } from './recommendation'
import {
  INITIAL_WIZARD_DATA,
  STORAGE_KEY,
  type CompanyDetailsData,
  type FounderIntentData,
  type WizardFormData,
} from './types'

export default function FormationWizard() {
  const [currentStep, setCurrentStep] = useState(1)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
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

  // Persist draft on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData))
  }, [formData])

  const handleStep1Next = useCallback((data: FounderIntentData) => {
    setFormData((prev) => ({
      ...prev,
      ...data,
    }))
    setDirection('forward')
    setCurrentStep(2)
  }, [])

  const handleStep2Next = useCallback(
    (data: CompanyDetailsData, recommendation: RecommendationOutput) => {
      setFormData((prev) => ({
        ...prev,
        ...data,
        recommendation,
      }))
      setDirection('forward')
      setCurrentStep(3)
    },
    [],
  )

  const handleBack = useCallback(() => {
    setDirection('back')
    setCurrentStep((prev) => Math.max(1, prev - 1))
  }, [])

  const intentData: RecommendationInput = {
    product_type: formData.product_type as RecommendationInput['product_type'],
    founder_location: formData.founder_location as RecommendationInput['founder_location'],
    founder_state: formData.founder_state,
    planning_to_raise_vc: formData.planning_to_raise_vc as RecommendationInput['planning_to_raise_vc'],
    number_of_founders: formData.number_of_founders as RecommendationInput['number_of_founders'],
    equity_plans: formData.equity_plans as RecommendationInput['equity_plans'],
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      <StepIndicator currentStep={currentStep} />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{
            opacity: 0,
            x: direction === 'forward' ? 20 : -20,
          }}
          animate={{ opacity: 1, x: 0 }}
          exit={{
            opacity: 0,
            x: direction === 'forward' ? -20 : 20,
          }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          {currentStep === 1 && (
            <FounderIntentStep
              data={formData}
              onNext={handleStep1Next}
            />
          )}
          {currentStep === 2 && (
            <CompanyDetailsStep
              intentData={intentData}
              data={formData}
              onNext={handleStep2Next}
              onBack={handleBack}
            />
          )}
          {currentStep === 3 && (
            <ReviewRedirectStep data={formData} onBack={handleBack} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
