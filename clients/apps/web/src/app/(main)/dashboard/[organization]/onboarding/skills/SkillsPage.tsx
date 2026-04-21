'use client'

import { OnboardingProgressBar } from '@/components/Onboarding/OnboardingProgressBar'
import { useUpdateOrganization } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useContext, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const SKILL_OPTIONS = [
  '2D Design', '3D Design', '3D Modeling', '2D Animation', '3D Animation',
  'Game Art', 'Illustration', 'Digital Art', 'Graphic Design', 'UI/UX Design',
  'Motion Graphics', 'Video Editing', 'Photography', 'Ebook', 'Templates',
  'Fonts', 'Icons', 'Mockups', 'Textures', 'Audio', 'Music', 'Sound Effects',
  'Presets', 'LUTs', 'Brushes', 'Plugins', 'WordPress Themes', 'Notion Templates',
  'Figma', 'Adobe Photoshop', 'Adobe Illustrator', 'After Effects',
  'Blender', 'Cinema 4D', 'Unity', 'Unreal Engine',
]

const LANGUAGE_OPTIONS = [
  'English', 'French', 'Spanish', 'German', 'Portuguese', 'Italian',
  'Dutch', 'Russian', 'Arabic', 'Chinese', 'Japanese', 'Korean',
  'Hindi', 'Turkish', 'Polish', 'Swedish', 'Norwegian', 'Danish',
  'Finnish', 'Greek', 'Czech', 'Romanian', 'Hungarian', 'Thai',
  'Vietnamese', 'Indonesian', 'Malay', 'Filipino', 'Hebrew', 'Ukrainian',
]

function TagPicker({
  label,
  description,
  options,
  selected,
  onChange,
  maxSelected,
}: {
  label: string
  description: string
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
  maxSelected?: number
}) {
  const [customInput, setCustomInput] = useState('')

  const toggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option))
    } else if (!maxSelected || selected.length < maxSelected) {
      onChange([...selected, option])
    }
  }

  const addCustom = () => {
    const value = customInput.trim()
    if (!value || selected.includes(value)) return
    if (maxSelected && selected.length >= maxSelected) return
    onChange([...selected, value])
    setCustomInput('')
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>

      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className="flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
            >
              {tag}
              <CloseOutlined style={{ fontSize: 12 }} />
            </button>
          ))}
        </div>
      )}

      {/* Custom input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
          placeholder={`Add custom ${label.toLowerCase()}…`}
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!customInput.trim()}
          className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm transition-colors hover:bg-gray-50 disabled:opacity-40"
        >
          <AddOutlined style={{ fontSize: 16 }} />
          Add
        </button>
      </div>

      {/* Preset options */}
      <div className="flex flex-wrap gap-2">
        {options
          .filter((o) => !selected.includes(o))
          .map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              disabled={!!maxSelected && selected.length >= maxSelected}
              className={twMerge(
                'rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 transition-colors',
                maxSelected && selected.length >= maxSelected
                  ? 'cursor-not-allowed opacity-40'
                  : 'cursor-pointer hover:border-gray-400 hover:text-gray-900',
              )}
            >
              {option}
            </button>
          ))}
      </div>
    </div>
  )
}

export default function SkillsPage() {
  const { organization } = useContext(OrganizationContext)
  const router = useRouter()
  const updateOrganization = useUpdateOrganization()

  const [skills, setSkills] = useState<string[]>(
    organization.storefront_settings?.skills ?? [],
  )
  const [languages, setLanguages] = useState<string[]>(
    organization.storefront_settings?.languages ?? [],
  )
  const [saving, setSaving] = useState(false)

  const handleContinue = async () => {
    setSaving(true)
    try {
      await updateOrganization.mutateAsync({
        id: organization.id,
        body: {
          storefront_settings: {
            ...(organization.storefront_settings ?? {}),
            skills,
            languages,
          },
        },
      })
      router.push(`/dashboard/${organization.slug}/onboarding/review`)
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    router.push(`/dashboard/${organization.slug}/onboarding/review`)
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-white px-4 py-12">
      <div className="mb-12 w-full max-w-lg">
        <OnboardingProgressBar currentStep={3} totalSteps={4} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex w-full max-w-lg flex-col gap-8"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Skills & Languages
          </h1>
          <p className="text-sm text-gray-500">
            Help people discover your expertise and how you can work together.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-6">
            <TagPicker
              label="Skills"
              description="What do you create or specialize in?"
              options={SKILL_OPTIONS}
              selected={skills}
              onChange={setSkills}
              maxSelected={10}
            />

            <div className="h-px bg-gray-100" />

            <TagPicker
              label="Languages"
              description="Which languages do you speak or work in?"
              options={LANGUAGE_OPTIONS}
              selected={languages}
              onChange={setLanguages}
              maxSelected={5}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleContinue}
            disabled={saving}
            className="w-full rounded-full bg-blue-600 py-4 text-sm font-semibold text-white transition-all hover:bg-blue-700 disabled:bg-gray-300"
          >
            {saving ? 'Saving…' : 'Continue'}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="w-full rounded-full py-3 text-sm text-gray-400 transition-colors hover:text-gray-600"
          >
            Skip for now
          </button>
        </div>
      </motion.div>
    </div>
  )
}
