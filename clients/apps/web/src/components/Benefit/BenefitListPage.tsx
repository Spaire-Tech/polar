'use client'

import { BenefitDetailPanel } from '@/components/Benefit/BenefitDetailPanel'
import CreateBenefitModalContent from '@/components/Benefit/CreateBenefitModalContent'
import {
  benefitsDisplayNames,
  resolveBenefitIcon,
} from '@/components/Benefit/utils'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import Spinner from '@/components/Shared/Spinner'
import { useInfiniteBenefits } from '@/hooks/queries'
import { useInViewport } from '@/hooks/utils'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import Search from '@mui/icons-material/Search'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import Input from '@spaire/ui/components/atoms/Input'
import { ShadowBoxOnMd } from '@spaire/ui/components/atoms/ShadowBox'
import {
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useEffect, useMemo, useState } from 'react'

interface BenefitListPageProps {
  organization: schemas['Organization']
}

export const BenefitListPage = ({ organization }: BenefitListPageProps) => {
  const [sorting, setSorting] = useQueryState(
    'sorting',
    parseAsStringLiteral([
      '-created_at',
      'created_at',
      'description',
      '-description',
    ] as const).withDefault('-created_at'),
  )

  const [query, setQuery] = useQueryState('query', parseAsString)

  const [createBenefitQuerystring, setCreateBenefitQuerystring] = useQueryState(
    'create_benefit',
    parseAsBoolean.withDefault(false),
  )

  const { data, fetchNextPage, hasNextPage } = useInfiniteBenefits(
    organization.id,
    {
      query: query ?? undefined,
      sorting: [sorting],
    },
  )

  const benefits = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data?.pages],
  )

  const [selectedBenefitId, setSelectedBenefitId] = useState<string | null>(
    null,
  )

  const {
    isShown: isCreateModalShown,
    show: showCreateModal,
    hide: hideCreateModal,
  } = useModal()

  const { ref: loadingRef, inViewport } = useInViewport<HTMLDivElement>()

  useEffect(() => {
    if (inViewport && hasNextPage) fetchNextPage()
  }, [inViewport, hasNextPage, fetchNextPage])

  useEffect(() => {
    if (createBenefitQuerystring) {
      showCreateModal()
      setCreateBenefitQuerystring(null)
    }
  }, [createBenefitQuerystring, setCreateBenefitQuerystring, showCreateModal])

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-row items-center gap-3">
            <div className="relative w-full md:max-w-64">
              <Search className="dark:text-spaire-500 absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Search benefits"
                value={query ?? ''}
                onChange={(e) => setQuery(e.target.value || null)}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() =>
                setSorting(
                  sorting === '-created_at' ? 'created_at' : '-created_at',
                )
              }
            >
              {sorting === 'created_at' ? (
                <ArrowUpward fontSize="small" />
              ) : (
                <ArrowDownward fontSize="small" />
              )}
            </Button>
          </div>
          <Button onClick={showCreateModal}>
            <AddOutlined className="h-4 w-4" />
            <span>Create benefit</span>
          </Button>
        </div>

        {benefits.length > 0 ? (
          <div className="dark:border-spaire-700 dark:divide-spaire-700 flex flex-col divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200">
            {benefits.map((benefit) => (
              <button
                key={benefit.id}
                type="button"
                className="dark:hover:bg-spaire-800 flex flex-row items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-gray-50"
                onClick={() => setSelectedBenefitId(benefit.id)}
              >
                <span className="dark:bg-spaire-700 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:text-gray-300">
                  {resolveBenefitIcon(benefit.type, 'h-4 w-4')}
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {benefit.description}
                  </span>
                  <span className="dark:text-spaire-500 truncate text-xs text-gray-500">
                    {benefitsDisplayNames[benefit.type]}
                  </span>
                </div>
              </button>
            ))}
            {hasNextPage && (
              <div
                ref={loadingRef}
                className="flex w-full items-center justify-center py-6"
              >
                <Spinner />
              </div>
            )}
          </div>
        ) : (
          <ShadowBoxOnMd className="items-center justify-center gap-y-6 md:flex md:flex-col md:py-24">
            <div className="flex max-w-md flex-col items-center gap-y-6 text-center">
              <div className="flex flex-col items-center gap-y-2">
                <h3 className="text-xl font-medium">No benefits yet</h3>
                <p className="dark:text-spaire-500 text-gray-500">
                  Benefits are extras you attach to products — license keys,
                  usage credits, custom integrations, and more.
                </p>
              </div>
              <Button onClick={showCreateModal}>
                <AddOutlined className="h-4 w-4" />
                <span>Create benefit</span>
              </Button>
            </div>
          </ShadowBoxOnMd>
        )}
      </div>

      <InlineModal
        isShown={isCreateModalShown}
        hide={hideCreateModal}
        modalContent={
          <CreateBenefitModalContent
            organization={organization}
            hideModal={hideCreateModal}
            onSelectBenefit={(benefit) => {
              hideCreateModal()
              setSelectedBenefitId(benefit.id)
            }}
          />
        }
      />

      <InlineModal
        isShown={!!selectedBenefitId}
        hide={() => setSelectedBenefitId(null)}
        className="md:w-[640px]"
        modalContent={
          selectedBenefitId ? (
            <BenefitDetailPanel
              benefitId={selectedBenefitId}
              organization={organization}
              onClose={() => setSelectedBenefitId(null)}
            />
          ) : (
            <div />
          )
        }
      />
    </DashboardBody>
  )
}
