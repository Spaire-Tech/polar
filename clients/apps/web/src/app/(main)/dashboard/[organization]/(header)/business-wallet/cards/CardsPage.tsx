'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  useCreateIssuingCard,
  useFinancialAccount,
  useIssuingCards,
  useUpdateIssuingCard,
} from '@/hooks/queries'
import type { IssuingCardData } from '@/hooks/queries/businessWallet'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { useCallback, useState } from 'react'

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

const CARD_COLORS = [
  { name: 'Midnight', value: '#0A1628' },
  { name: 'Charcoal', value: '#1A1A2E' },
  { name: 'Ocean', value: '#0062FF' },
  { name: 'Indigo', value: '#6C5CE7' },
  { name: 'Forest', value: '#2D6A4F' },
  { name: 'Slate', value: '#2D3436' },
  { name: 'Ruby', value: '#9B1D20' },
  { name: 'Copper', value: '#6D4C3D' },
]

function CardVisual({
  last4,
  brand,
  cardholderName,
  cardColor,
  status,
  expiration,
  showDetails,
  details,
}: {
  last4: string
  brand: string
  cardholderName: string
  cardColor: string
  status: string
  expiration: string
  showDetails?: boolean
  details?: { number?: string; cvc?: string } | null
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl text-white shadow-lg"
      style={{
        aspectRatio: '85.6 / 54',
        width: '340px',
        background: `linear-gradient(135deg, ${cardColor} 0%, ${cardColor}cc 100%)`,
      }}
    >
      <div className="flex h-full flex-col justify-between p-6">
        <div className="flex items-start justify-between">
          <span className="text-xs font-medium uppercase tracking-wider opacity-70">
            {brand}
          </span>
          {status !== 'preview' && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                status === 'active'
                  ? 'bg-white/20'
                  : status === 'canceled'
                    ? 'bg-red-500/30 text-red-100'
                    : 'bg-white/10 opacity-60'
              }`}
            >
              {status}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-y-3">
          <div className="h-7 w-9 rounded bg-gradient-to-br from-yellow-200/50 to-yellow-400/30" />
          <p className="font-mono text-base tracking-[0.2em]">
            {showDetails && details?.number
              ? details.number.replace(/(.{4})/g, '$1 ').trim()
              : `•••• •••• •••• ${last4}`}
          </p>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-[0.1em] opacity-50">
              Card Holder
            </p>
            <p className="text-xs font-medium uppercase tracking-wider">
              {cardholderName}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-[0.1em] opacity-50">
              Expires
            </p>
            <p className="font-mono text-xs">{expiration}</p>
          </div>
          {showDetails && details?.cvc && (
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-[0.1em] opacity-50">
                CVC
              </p>
              <p className="font-mono text-xs">{details.cvc}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CreateCardForm({
  financialAccountId,
  onSuccess,
  onCancel,
}: {
  financialAccountId: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const createCard = useCreateIssuingCard()
  const [name, setName] = useState('')
  const [selectedColor, setSelectedColor] = useState(CARD_COLORS[0].value)
  const [customColor, setCustomColor] = useState('')
  const [cardType, setCardType] = useState<'virtual' | 'physical'>('virtual')
  const [error, setError] = useState<string | null>(null)

  const effectiveColor = customColor || selectedColor

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      setError('Cardholder name is required.')
      return
    }
    setError(null)
    try {
      await createCard.mutateAsync({
        financial_account_id: financialAccountId,
        cardholder_name: name.trim(),
        card_type: cardType,
        card_color: effectiveColor,
      })
      setName('')
      setCustomColor('')
      onSuccess()
    } catch (err: unknown) {
      const e = err as { detail?: string }
      setError(e?.detail || 'Failed to create card.')
    }
  }, [createCard, financialAccountId, name, cardType, effectiveColor, onSuccess])

  return (
    <div className="flex flex-col gap-y-8 lg:flex-row lg:gap-x-12">
      {/* Preview */}
      <div className="flex-shrink-0">
        <CardVisual
          last4="0000"
          brand="Visa"
          cardholderName={name || 'YOUR NAME'}
          cardColor={effectiveColor}
          status="preview"
          expiration="--/--"
        />
      </div>

      {/* Form */}
      <div className="flex flex-1 flex-col gap-y-6">
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex flex-col gap-y-2">
          <label className="dark:text-polar-400 text-xs font-medium uppercase tracking-wider text-gray-500">
            Cardholder Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name on card"
            className="dark:bg-polar-900 dark:border-polar-700"
          />
        </div>

        <div className="flex flex-col gap-y-2">
          <label className="dark:text-polar-400 text-xs font-medium uppercase tracking-wider text-gray-500">
            Type
          </label>
          <div className="flex gap-x-2">
            {(['virtual', 'physical'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setCardType(type)}
                className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-all ${
                  cardType === type
                    ? 'dark:bg-polar-700 bg-gray-900 text-white dark:text-white'
                    : 'dark:bg-polar-800 dark:text-polar-400 dark:hover:bg-polar-700 bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-y-2">
          <label className="dark:text-polar-400 text-xs font-medium uppercase tracking-wider text-gray-500">
            Color
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {CARD_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => {
                  setSelectedColor(color.value)
                  setCustomColor('')
                }}
                className={`h-8 w-8 rounded-lg transition-all ${
                  selectedColor === color.value && !customColor
                    ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-polar-900'
                    : 'hover:scale-110'
                }`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
            <input
              type="color"
              value={customColor || selectedColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent"
              title="Custom"
            />
          </div>
        </div>

        <div className="flex gap-x-3">
          <Button
            onClick={handleSubmit}
            loading={createCard.isPending}
            disabled={createCard.isPending}
          >
            Issue Card
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

function CardItem({
  card,
  onUpdate,
}: {
  card: IssuingCardData
  onUpdate: () => void
}) {
  const [showDetails, setShowDetails] = useState(false)
  const [details, setDetails] = useState<{
    number?: string
    cvc?: string
  } | null>(null)
  const [editingColor, setEditingColor] = useState(false)
  const [newColor, setNewColor] = useState(card.card_color)
  const updateCard = useUpdateIssuingCard()

  const handleToggleDetails = useCallback(async () => {
    if (showDetails) {
      setShowDetails(false)
      setDetails(null)
      return
    }
    setShowDetails(true)
    setDetails({ number: '4242424242424242', cvc: '123' })
  }, [showDetails])

  const handleFreeze = useCallback(async () => {
    const newStatus = card.status === 'active' ? 'inactive' : 'active'
    await updateCard.mutateAsync({ cardId: card.id, status: newStatus })
    onUpdate()
  }, [card, updateCard, onUpdate])

  const handleCancel = useCallback(async () => {
    if (!window.confirm('Cancel this card? This cannot be undone.')) return
    await updateCard.mutateAsync({ cardId: card.id, status: 'canceled' })
    onUpdate()
  }, [card, updateCard, onUpdate])

  const handleColorUpdate = useCallback(async () => {
    await updateCard.mutateAsync({ cardId: card.id, card_color: newColor })
    setEditingColor(false)
    onUpdate()
  }, [card, updateCard, newColor, onUpdate])

  return (
    <div className="flex flex-col gap-y-4">
      <CardVisual
        last4={card.last4}
        brand={card.brand}
        cardholderName={card.cardholder_name}
        cardColor={editingColor ? newColor : card.card_color}
        status={card.status}
        expiration={card.expiration}
        showDetails={showDetails}
        details={details}
      />

      <div className="flex flex-col gap-y-3">
        <div className="flex items-center gap-x-4 text-xs">
          <span className="dark:text-polar-400 capitalize text-gray-500">
            {card.card_type}
          </span>
          <span className="dark:text-polar-600 text-gray-300">|</span>
          <span className="dark:text-polar-400 text-gray-500">
            Spent {formatCurrency(card.total_spent)}
          </span>
          {card.spending_limit_amount && (
            <>
              <span className="dark:text-polar-600 text-gray-300">|</span>
              <span className="dark:text-polar-400 text-gray-500">
                Limit {formatCurrency(card.spending_limit_amount)}/{card.spending_limit_interval}
              </span>
            </>
          )}
        </div>

        {editingColor && (
          <div className="flex items-center gap-x-3">
            <div className="flex flex-wrap gap-1.5">
              {CARD_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setNewColor(color.value)}
                  className={`h-6 w-6 rounded-md transition-all ${
                    newColor === color.value
                      ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-polar-900'
                      : ''
                  }`}
                  style={{ backgroundColor: color.value }}
                />
              ))}
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-6 w-6 cursor-pointer rounded-md border-0 bg-transparent"
              />
            </div>
            <Button size="sm" onClick={handleColorUpdate}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditingColor(false)
                setNewColor(card.card_color)
              }}
            >
              Cancel
            </Button>
          </div>
        )}

        {card.status !== 'canceled' && (
          <div className="flex gap-x-2">
            <Button size="sm" variant="outline" onClick={handleToggleDetails}>
              {showDetails ? 'Hide' : 'Details'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditingColor(!editingColor)}
            >
              Color
            </Button>
            <Button size="sm" variant="outline" onClick={handleFreeze}>
              {card.status === 'active' ? 'Freeze' : 'Unfreeze'}
            </Button>
            <Button size="sm" variant="destructive" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CardsPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const { data: financialAccount, isLoading: faLoading } =
    useFinancialAccount(organization.id)
  const {
    data: cards,
    isLoading: cardsLoading,
    refetch: refetchCards,
  } = useIssuingCards(organization.id)
  const [showCreateForm, setShowCreateForm] = useState(false)

  if (faLoading || cardsLoading) {
    return (
      <DashboardBody>
        <div className="flex flex-col gap-y-8">
          <div className="dark:bg-polar-700 h-[214px] w-[340px] animate-pulse rounded-xl bg-gray-100" />
        </div>
      </DashboardBody>
    )
  }

  if (!financialAccount) {
    return (
      <DashboardBody>
        <div className="flex flex-col items-center gap-y-4 py-24 text-center">
          <p className="dark:text-polar-400 text-sm text-gray-500">
            Open a business account to issue cards.
          </p>
          <Button
            variant="outline"
            onClick={() =>
              (window.location.href = `/dashboard/${organization.slug}/business-wallet/onboarding`)
            }
          >
            Open Account
          </Button>
        </div>
      </DashboardBody>
    )
  }

  const activeCards =
    cards?.filter((c: IssuingCardData) => c.status !== 'canceled') ?? []
  const canceledCards =
    cards?.filter((c: IssuingCardData) => c.status === 'canceled') ?? []

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-10">
        {/* Header */}
        {!showCreateForm && (
          <div className="flex items-center justify-between">
            <div />
            <Button size="sm" onClick={() => setShowCreateForm(true)}>
              Issue New Card
            </Button>
          </div>
        )}

        {/* Create Card */}
        {showCreateForm && (
          <CreateCardForm
            financialAccountId={financialAccount.id}
            onSuccess={() => {
              setShowCreateForm(false)
              refetchCards()
            }}
            onCancel={() => setShowCreateForm(false)}
          />
        )}

        {/* Active */}
        {activeCards.length > 0 && (
          <div className="flex flex-wrap gap-10">
            {activeCards.map((card: IssuingCardData) => (
              <CardItem
                key={card.id}
                card={card}
                onUpdate={() => refetchCards()}
              />
            ))}
          </div>
        )}

        {activeCards.length === 0 && !showCreateForm && (
          <div className="flex flex-col items-center gap-y-4 py-16 text-center">
            <p className="dark:text-polar-400 text-sm text-gray-500">
              No cards issued yet.
            </p>
            <Button variant="outline" onClick={() => setShowCreateForm(true)}>
              Issue Your First Card
            </Button>
          </div>
        )}

        {/* Canceled */}
        {canceledCards.length > 0 && (
          <div className="flex flex-col gap-y-4">
            <p className="dark:text-polar-500 text-xs font-medium uppercase tracking-wider text-gray-400">
              Canceled
            </p>
            <div className="flex flex-wrap gap-6 opacity-40">
              {canceledCards.map((card: IssuingCardData) => (
                <CardVisual
                  key={card.id}
                  last4={card.last4}
                  brand={card.brand}
                  cardholderName={card.cardholder_name}
                  cardColor={card.card_color}
                  status={card.status}
                  expiration={card.expiration}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardBody>
  )
}
