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
    <div className="flex w-full flex-col gap-8 pb-16">
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
          className="w-full max-w-2xl"
        >
          {currentStep === 1 && (
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
          )}
          {currentStep === 2 && (
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
          )}
          {currentStep === 3 && (
            <ReviewRedirectStep data={formData} onBack={handleBack} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
