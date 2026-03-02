'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { FEATURED_PERKS, OTHER_PERKS, type Perk } from '@/constants/perksData'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import Button from '@spaire/ui/components/atoms/Button'
import { useState } from 'react'
import PerkDetailModalContent from './PerkDetailModalContent'

const FeaturedPerkCard = ({
  perk,
  onLearnMore,
}: {
  perk: Perk
  onLearnMore: (perk: Perk) => void
}) => {
  return (
    <div className="dark:border-spaire-700 dark:hover:border-spaire-600 group flex flex-col gap-y-5 rounded-2xl border border-gray-200 p-6 transition-all hover:border-gray-300 hover:shadow-md dark:hover:shadow-none">
      <div className="flex flex-row items-start gap-x-4">
        <img
          src={perk.logo}
          alt={perk.name}
          className="h-14 w-14 shrink-0 rounded-xl object-cover"
        />
        <div className="flex flex-col gap-y-1">
          <h3 className="text-base font-medium dark:text-white">{perk.name}</h3>
          <span className="text-sm font-medium text-emerald-500">
            {perk.incentive}
          </span>
        </div>
      </div>

      <p className="dark:text-spaire-400 text-sm leading-relaxed text-gray-500">
        {perk.description}
      </p>

      <Button
        fullWidth
        onClick={() => onLearnMore(perk)}
      >
        <span>Learn More</span>
        <ArrowOutwardOutlined className="ml-1 h-4 w-4" fontSize="inherit" />
      </Button>
    </div>
  )
}

const OtherPerkCard = ({ perk }: { perk: Perk }) => {
  return (
    <div className="dark:border-spaire-700 flex flex-col gap-y-4 rounded-2xl border border-gray-200 p-6 opacity-50 grayscale">
      <div className="flex flex-row items-start gap-x-4">
        <img
          src={perk.logo}
          alt={perk.name}
          className="h-12 w-12 shrink-0 rounded-xl object-cover"
        />
        <div className="flex flex-col gap-y-1">
          <h3 className="text-base font-medium dark:text-white">{perk.name}</h3>
          <span className="text-sm font-medium text-emerald-500">
            {perk.incentive}
          </span>
        </div>
      </div>
      <p className="dark:text-spaire-400 line-clamp-2 text-sm leading-relaxed text-gray-500">
        {perk.description}
      </p>
    </div>
  )
}

export default function StartupStackPage() {
  const { isShown, show, hide } = useModal(false)
  const [selectedPerk, setSelectedPerk] = useState<Perk | null>(null)

  const handleLearnMore = (perk: Perk) => {
    setSelectedPerk(perk)
    show()
  }

  const handleHide = () => {
    hide()
  }

  return (
    <DashboardBody title="Startup Stack">
      <div className="flex flex-col gap-y-2">
        <p className="dark:text-spaire-500 text-sm text-gray-500">
          Optimize your burn from day zero. Access $150k+ in verified credits
          and preferred terms from the companies that power the world&apos;s
          fastest-growing startups.
        </p>
      </div>

      {/* Featured partners */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {FEATURED_PERKS.map((perk) => (
          <FeaturedPerkCard
            key={perk.name}
            perk={perk}
            onLearnMore={handleLearnMore}
          />
        ))}
      </div>

      {/* Other partners */}
      {OTHER_PERKS.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {OTHER_PERKS.map((perk) => (
            <OtherPerkCard key={perk.name} perk={perk} />
          ))}
        </div>
      )}

      <InlineModal
        isShown={isShown}
        hide={handleHide}
        modalContent={
          selectedPerk ? (
            <PerkDetailModalContent perk={selectedPerk} hideModal={handleHide} />
          ) : (
            <></>
          )
        }
      />
    </DashboardBody>
  )
}
