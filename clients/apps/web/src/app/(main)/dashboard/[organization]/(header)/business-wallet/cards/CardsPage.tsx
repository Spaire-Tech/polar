'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  useCreateIssuingCard,
  useFinancialAccount,
  useIssuingCards,
  useUpdateIssuingCard,
} from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Card,
  CardContent,
  CardHeader,
} from '@polar-sh/ui/components/atoms/Card'
import Input from '@polar-sh/ui/components/atoms/Input'
import { useCallback, useState } from 'react'

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

const CARD_COLORS = [
  { name: 'Blue', value: '#0062FF' },
  { name: 'Black', value: '#1A1A2E' },
  { name: 'Purple', value: '#6C5CE7' },
  { name: 'Teal', value: '#00B894' },
  { name: 'Red', value: '#E74C3C' },
  { name: 'Dark Green', value: '#2D6A4F' },
  { name: 'Navy', value: '#0A1628' },
  { name: 'Charcoal', value: '#2D3436' },
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
      className="relative h-52 w-[340px] overflow-hidden rounded-2xl p-6 text-white shadow-lg transition-all"
      style={{ backgroundColor: cardColor }}
    >
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <p className="text-sm font-semibold tracking-wider opacity-90">
            {brand}
          </p>
          <div
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              status === 'active'
                ? 'bg-white/25 text-white'
                : status === 'canceled'
                  ? 'bg-red-500/30 text-red-100'
                  : 'bg-white/10 text-white/60'
            }`}
          >
            {status}
          </div>
        </div>

        <div className="flex flex-col gap-y-1">
          {/* Card chip */}
          <div className="mb-2 h-8 w-10 rounded-md bg-gradient-to-br from-yellow-200/60 to-yellow-400/40" />
          <p className="font-mono text-lg tracking-[0.2em]">
            {showDetails && details?.number
              ? details.number.replace(/(.{4})/g, '$1 ').trim()
              : `**** **** **** ${last4}`}
          </p>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider opacity-60">
              Card Holder
            </p>
            <p className="text-sm font-medium">{cardholderName}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider opacity-60">
              Expires
            </p>
            <p className="text-sm font-medium">{expiration}</p>
          </div>
          {showDetails && details?.cvc && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider opacity-60">
                CVC
              </p>
              <p className="font-mono text-sm font-medium">{details.cvc}</p>
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
}: {
  financialAccountId: string
  onSuccess: () => void
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
    } catch (err: any) {
      setError(err?.detail || 'Failed to create card.')
    }
  }, [createCard, financialAccountId, name, cardType, effectiveColor, onSuccess])

  return (
    <Card className="dark:bg-polar-800 dark:border-polar-700 border-gray-200 bg-white">
      <CardHeader>
        <h3 className="text-sm font-medium dark:text-white text-gray-900">
          Issue New Card
        </h3>
      </CardHeader>
      <CardContent className="flex flex-col gap-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Live Preview */}
        <div className="flex justify-center">
          <CardVisual
            last4="0000"
            brand="Visa"
            cardholderName={name || 'YOUR NAME'}
            cardColor={effectiveColor}
            status="preview"
            expiration="--/--"
          />
        </div>

        {/* Name */}
        <div className="flex flex-col gap-y-2">
          <label className="text-sm font-medium dark:text-white text-gray-700">
            Cardholder Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter name as it will appear on the card"
            className="dark:bg-polar-900 dark:border-polar-700"
          />
        </div>

        {/* Card Type */}
        <div className="flex flex-col gap-y-2">
          <label className="text-sm font-medium dark:text-white text-gray-700">
            Card Type
          </label>
          <div className="flex gap-x-3">
            {(['virtual', 'physical'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setCardType(type)}
                className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-all ${
                  cardType === type
                    ? 'bg-blue-500 text-white'
                    : 'dark:bg-polar-700 dark:text-polar-300 bg-gray-100 text-gray-600 hover:bg-gray-200 dark:hover:bg-polar-600'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Color Picker */}
        <div className="flex flex-col gap-y-2">
          <label className="text-sm font-medium dark:text-white text-gray-700">
            Card Color
          </label>
          <div className="flex flex-wrap gap-3">
            {CARD_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => {
                  setSelectedColor(color.value)
                  setCustomColor('')
                }}
                className={`h-10 w-10 rounded-xl transition-all ${
                  selectedColor === color.value && !customColor
                    ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-polar-800'
                    : ''
                }`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
            <div className="flex items-center gap-x-2">
              <input
                type="color"
                value={customColor || selectedColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="h-10 w-10 cursor-pointer rounded-xl border-0 bg-transparent"
                title="Custom color"
              />
              <span className="dark:text-polar-400 text-xs text-gray-500">
                Custom
              </span>
            </div>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          loading={createCard.isPending}
          disabled={createCard.isPending}
        >
          {createCard.isPending ? 'Creating Card...' : 'Issue Card'}
        </Button>
      </CardContent>
    </Card>
  )
}

function CardItem({
  card,
  onUpdate,
}: {
  card: any
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
    // In a real implementation, this would call the details endpoint
    setShowDetails(true)
    setDetails({ number: '4242424242424242', cvc: '123' })
  }, [showDetails])

  const handleFreeze = useCallback(async () => {
    const newStatus = card.status === 'active' ? 'inactive' : 'active'
    await updateCard.mutateAsync({
      cardId: card.id,
      status: newStatus,
    })
    onUpdate()
  }, [card, updateCard, onUpdate])

  const handleCancel = useCallback(async () => {
    if (
      !window.confirm(
        'Are you sure you want to cancel this card? This cannot be undone.',
      )
    ) {
      return
    }
    await updateCard.mutateAsync({
      cardId: card.id,
      status: 'canceled',
    })
    onUpdate()
  }, [card, updateCard, onUpdate])

  const handleColorUpdate = useCallback(async () => {
    await updateCard.mutateAsync({
      cardId: card.id,
      card_color: newColor,
    })
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

      <div className="flex flex-col gap-y-2">
        <div className="flex items-center gap-x-2 text-sm">
          <span className="dark:text-polar-400 text-gray-500">
            {card.card_type} card
          </span>
          <span className="dark:text-polar-600 text-gray-300">|</span>
          <span className="dark:text-polar-400 text-gray-500">
            Spent: {formatCurrency(card.total_spent)}
          </span>
          {card.spending_limit_amount && (
            <>
              <span className="dark:text-polar-600 text-gray-300">|</span>
              <span className="dark:text-polar-400 text-gray-500">
                Limit: {formatCurrency(card.spending_limit_amount)}{' '}
                {card.spending_limit_interval}
              </span>
            </>
          )}
        </div>

        {/* Color editor */}
        {editingColor && (
          <div className="flex items-center gap-x-3">
            <div className="flex flex-wrap gap-2">
              {CARD_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setNewColor(color.value)}
                  className={`h-8 w-8 rounded-lg transition-all ${
                    newColor === color.value
                      ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-polar-800'
                      : ''
                  }`}
                  style={{ backgroundColor: color.value }}
                />
              ))}
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent"
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
              {showDetails ? 'Hide Details' : 'Show Details'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditingColor(!editingColor)}
            >
              Change Color
            </Button>
            <Button size="sm" variant="outline" onClick={handleFreeze}>
              {card.status === 'active' ? 'Freeze' : 'Unfreeze'}
            </Button>
            <Button size="sm" variant="destructive" onClick={handleCancel}>
              Cancel Card
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
          <h2 className="text-lg font-medium dark:text-white text-gray-900">
            Cards
          </h2>
          <div className="dark:bg-polar-700 h-52 w-[340px] animate-pulse rounded-2xl bg-gray-100" />
        </div>
      </DashboardBody>
    )
  }

  if (!financialAccount) {
    return (
      <DashboardBody>
        <div className="flex flex-col gap-y-8">
          <h2 className="text-lg font-medium dark:text-white text-gray-900">
            Cards
          </h2>
          <Card className="dark:bg-polar-800 dark:border-polar-700 border-gray-200 bg-white">
            <CardContent className="flex flex-col items-center gap-y-4 py-12 text-center">
              <p className="dark:text-polar-400 text-sm text-gray-500">
                You need to open a Financial Business Account before issuing
                cards.
              </p>
              <Button
                variant="outline"
                onClick={() =>
                  (window.location.href = `/dashboard/${organization.slug}/business-wallet/onboarding`)
                }
              >
                Open Account
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardBody>
    )
  }

  const activeCards =
    cards?.filter((c: any) => c.status !== 'canceled') ?? []
  const canceledCards =
    cards?.filter((c: any) => c.status === 'canceled') ?? []

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium dark:text-white text-gray-900">
            Cards
          </h2>
          {!showCreateForm && (
            <Button onClick={() => setShowCreateForm(true)}>
              Issue New Card
            </Button>
          )}
        </div>

        {/* Create Card Form */}
        {showCreateForm && (
          <CreateCardForm
            financialAccountId={financialAccount.id}
            onSuccess={() => {
              setShowCreateForm(false)
              refetchCards()
            }}
          />
        )}

        {/* Active Cards */}
        {activeCards.length > 0 && (
          <div className="flex flex-col gap-y-4">
            <h3 className="text-sm font-medium dark:text-white text-gray-900">
              Active Cards ({activeCards.length})
            </h3>
            <div className="flex flex-wrap gap-8">
              {activeCards.map((card: any) => (
                <CardItem
                  key={card.id}
                  card={card}
                  onUpdate={() => refetchCards()}
                />
              ))}
            </div>
          </div>
        )}

        {activeCards.length === 0 && !showCreateForm && (
          <Card className="dark:bg-polar-800 dark:border-polar-700 border-gray-200 bg-white">
            <CardContent className="flex flex-col items-center gap-y-4 py-12 text-center">
              <p className="dark:text-polar-400 text-sm text-gray-500">
                No active cards. Issue a card to start spending your balance.
              </p>
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(true)}
              >
                Issue Your First Card
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Canceled Cards */}
        {canceledCards.length > 0 && (
          <div className="flex flex-col gap-y-4">
            <h3 className="dark:text-polar-400 text-sm font-medium text-gray-500">
              Canceled Cards ({canceledCards.length})
            </h3>
            <div className="flex flex-wrap gap-8 opacity-50">
              {canceledCards.map((card: any) => (
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
