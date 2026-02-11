# Embedded Finance Frontend PRD + Component Map

## Objective

Redesign Spaire finance dashboard UX from payout-centric flows to embedded finance flows while preserving existing visual system and route structure.

## Current route baseline

- `clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/finance/layout.tsx`
- `clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/finance/(wide)/income/IncomePage.tsx`
- `clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/finance/(wide)/payouts/PayoutsPage.tsx`
- `clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/finance/account/AccountPage.tsx`

## Updated information architecture

### Tabs (existing route-compatible)

1. `Overview` -> `/finance/income`
2. `Pay` -> `/finance/payouts`
3. `Account` -> `/finance/account`

## UX requirements

### Overview page (`/finance/income`)

- Keep account banner and transaction list.
- Add a finance lifecycle summary card above account balance:
    - `money_state`: pending, available, reserve, spendable.
    - `issuing_onboarding_state`: setup required, in progress, active, restricted.
- Explain state transitions in plain language.

### Pay page (`/finance/payouts`)

- Keep existing payout list table.
- Position this page as outgoing money operations rail.

### Account page (`/finance/account`)

- Update language from payout-only terms to finance-account terms.
- Keep existing step flow, but copy should be compatible with balances/cards/payments expansion.
- Modal must be responsive (no fixed mobile-breaking width).

## Component map

### Existing components kept

- `components/Finance/StreamlinedAccountReview.tsx`
- `components/Finance/Steps/AccountStep.tsx`
- `components/Finance/Steps/IdentityStep.tsx`
- `components/Payouts/AccountBalance.tsx`
- `components/Transactions/TransactionsList.tsx`

### New component

- `components/Finance/FundStateSummary.tsx`
    - Inputs: `organization`
    - Data source: `useOrganizationPaymentStatus`
    - Displays:
        - Current money state badge.
        - Four lifecycle state cards.
        - Onboarding status panel.
        - State explanation panel.

## Responsiveness requirements

- Finance tabs must support horizontal overflow and mobile interaction.
- Step progress should remain usable on narrow screens.
- Account setup modal must use max-width constraints, not fixed min-width.

## Naming / copy standards

Replace payout-only wording in shared setup UX:

- "Payout account" -> "Finance account"
- "ready to receive payouts" -> "ready to hold and move funds"
- Keep Stripe redirection mention explicit for compliance and trust.

## Stripe-aligned UX guardrails

- Always show account/action status before allowing money actions.
- For restricted states, show a clear status with next step.
- Do not imply funds are spendable unless state indicates spendable.

## Release criteria

1. Finance tabs remain functional on mobile without clipped navigation.
2. Overview shows lifecycle state and onboarding state.
3. Account setup copy is finance-oriented and consistent.
4. Modal and stepper remain usable on small viewport widths.
