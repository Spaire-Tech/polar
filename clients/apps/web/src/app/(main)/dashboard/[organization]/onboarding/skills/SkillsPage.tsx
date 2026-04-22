'use client'

import { OnboardingProgressBar } from '@/components/Onboarding/OnboardingProgressBar'
import { useUpdateOrganization } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@spaire/ui/components/atoms/Select'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useContext, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const PROFILE_TITLE_OPTIONS = [
  'Designer', '3D Artist', 'Illustrator', 'Photographer', 'Animator',
  'Video Editor', 'Developer', 'Writer', 'Creator', 'Music Producer',
  'Game Developer', 'UI/UX Designer', 'Graphic Designer', 'Motion Designer',
]

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

      <div className="flex gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
          placeholder={`Add custom ${label.toLowerCase()}…`}
          className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-xs outline-none transition-all focus:z-10 focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100"
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

  const [profileTitle, setProfileTitle] = useState<string>(
    (organization.storefront_settings as { profile_title?: string } | undefined)
      ?.profile_title ?? '',
  )
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
            profile_title: profileTitle || null,
            skills,
            languages,
          } as any,
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
    <div className="flex h-full w-full flex-col items-center overflow-y-auto bg-white px-4 py-12">
      <div className="mb-12 w-full max-w-lg">
        <OnboardingProgressBar currentStep={2} totalSteps={3} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex w-full max-w-lg flex-col gap-8"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Set up card
          </h1>
          <p className="text-sm text-gray-500">
            Tell people what you do and how you work.
          </p>
        </div>

        <div className="flex flex-col gap-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          {/* Profile title — dropdown, no default */}
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-900">Profile Title</p>
              <p className="text-xs text-gray-400">What do people know you as?</p>
            </div>
            <Select
              value={profileTitle || undefined}
              onValueChange={(v) => setProfileTitle(v)}
            >
              <SelectTrigger className="h-[42px] rounded-xl">
                <SelectValue placeholder="eg. Designer" />
              </SelectTrigger>
              <SelectContent>
                {PROFILE_TITLE_OPTIONS.map((title) => (
                  <SelectItem key={title} value={title}>
                    {title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="h-px bg-gray-100" />

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
