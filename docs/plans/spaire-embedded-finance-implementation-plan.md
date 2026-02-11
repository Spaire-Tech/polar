# Spaire Embedded Finance — Implementation Plan

## Executive Summary

This plan details how to evolve Spaire from "MoR + payouts" into a full business finance operating layer by integrating Stripe Treasury (Financial Accounts for platforms) and Stripe Issuing into the existing Polar codebase. Merchants will be able to hold funds in FDIC pass-through eligible accounts, spend via issued cards, and move money to vendors/contractors through ACH and wire transfers.

---

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [Critical Blocker: Connect Account Migration](#2-critical-blocker-connect-account-migration)
3. [Target Architecture](#3-target-architecture)
4. [Implementation Phases](#4-implementation-phases)
   - Phase 0: Connect Account Migration
   - Phase 1: Treasury Foundation (Financial Accounts + Balances)
   - Phase 2: Card Issuing
   - Phase 3: Money Movement (ACH / Wire / Checks)
   - Phase 4: Frontend Embedded Components
   - Phase 5: Rewards & Cash Back
5. [Database Schema Changes](#5-database-schema-changes)
6. [API Design](#6-api-design)
7. [Webhook Handling](#7-webhook-handling)
8. [Risk, Compliance & Controls](#8-risk-compliance--controls)
9. [Testing Strategy](#9-testing-strategy)
10. [Migration Strategy for Existing Merchants](#10-migration-strategy-for-existing-merchants)
11. [Open Questions & Decisions](#11-open-questions--decisions)

---

## 1. Current Architecture Analysis

### What exists today

| Layer | Current State |
|---|---|
| **Connect accounts** | Stripe v2 Express accounts (`dashboard: "express"`) with `recipient` + `merchant` configurations |
| **Capabilities** | `card_payments` (merchant), `stripe_transfers` + `payouts` (recipient) |
| **Fund flow** | Customer pays Polar → Polar transfers to merchant's Connect account → Merchant receives payout to bank |
| **Transaction ledger** | Rich `Transaction` model with types: `payment`, `processor_fee`, `refund`, `dispute`, `balance`, `payout` |
| **Payout flow** | Two-step: (1) `stripe.Transfer` from Polar to merchant Connect account, (2) `stripe.Payout` from merchant account to bank |
| **Account model** | `Account` table with `stripe_id`, status lifecycle (`CREATED → ONBOARDING_STARTED → UNDER_REVIEW → ACTIVE`), fee configuration |
| **Risk controls** | `HeldBalance` system, account review thresholds, identity verification |
| **API version** | `2026-01-28.clover`, using `stripe_client` (StripeClient) for v2 and `stripe_lib` for v1 |

### Key files

- `server/polar/account/service.py` — Account lifecycle (create, onboard, update)
- `server/polar/integrations/stripe/service.py` — Stripe API wrapper (v2 accounts, v1 payments/transfers/payouts)
- `server/polar/integrations/stripe/tasks.py` — Webhook handlers
- `server/polar/payout/service.py` — Two-step payout orchestration
- `server/polar/models/account.py` — Account model (Express Connect)
- `server/polar/models/transaction.py` — Ledger (payment, balance, payout, fees)
- `server/polar/models/payout.py` — Payout records
- `server/polar/models/payment.py` — Payment records

---

## 2. Critical Blocker: Connect Account Migration

### The problem

**Stripe Treasury and Issuing require Custom connected accounts.** The current codebase uses Express accounts (v2 API with `dashboard: "express"`). There is no in-place migration path from Express to Custom. Additionally, the Accounts v2 API does not support Treasury and Issuing workflows — v1 must be used for `treasury` and `card_issuing` capabilities.

### What Custom accounts require

```python
# Custom account creation (v1 API)
stripe.Account.create(
    type="custom",
    country="US",
    capabilities={
        "card_payments": {"requested": True},
        "transfers": {"requested": True},
        "treasury": {"requested": True},
        "card_issuing": {"requested": True},
        "us_bank_account_ach_payments": {"requested": True},
    },
    controller={
        "stripe_dashboard": {"type": "none"},
        "fees": {"payer": "application"},
        "losses": {"payments": "application"},
        "requirement_collection": "application",
    },
)
```

### Key differences: Express vs Custom

| Aspect | Express (current) | Custom (required) |
|---|---|---|
| Dashboard | Stripe-hosted | None (platform provides UI) |
| KYC collection | Stripe handles | Platform must collect & submit |
| Loss liability | Shared | Platform bears full liability |
| Requirement collection | Stripe handles | Platform handles |
| Treasury/Issuing | Not supported | Supported |
| API | v2 Accounts API | v1 Accounts API (for treasury/issuing capabilities) |

### Migration approach

This is the single most consequential architectural decision. There are two options:

**Option A: Dual-track accounts (Recommended)**
- Keep existing Express accounts for merchants who don't opt into embedded finance
- Create new Custom accounts for merchants who opt into embedded finance
- Run both paths in parallel; Express merchants continue with the current payout flow
- Pros: Non-disruptive to existing merchants, incremental rollout
- Cons: Two code paths for account management, more complexity

**Option B: Full migration to Custom**
- Migrate all merchants to Custom accounts over time
- Replace the Express onboarding flow with a custom onboarding flow
- Pros: Single code path long-term
- Cons: High-risk, requires re-onboarding all existing merchants, breaks Stripe-hosted dashboard

**Recommendation: Option A (dual-track)** — Start with dual-track so embedded finance can ship to new/opt-in merchants without disrupting existing ones. Plan a long-term migration to Custom for all merchants as a separate initiative.

---

## 3. Target Architecture

### Fund flow after embedded finance

```
                        ┌──────────────────────────────────────────┐
                        │              Spaire Platform             │
                        │         (Merchant of Record)             │
                        └──────────┬───────────────────────────────┘
                                   │
                     Customer pays │ (Stripe Charge on platform account)
                                   │
                      ┌────────────▼────────────────┐
                      │   MoR Compliance & Risk     │
                      │   (hold period, review,     │
                      │    fraud checks, tax)       │
                      └────────────┬────────────────┘
                                   │
                       Funds clear  │
                                   │
              ┌────────────────────▼────────────────────┐
              │                                         │
     ┌────────▼──────────┐               ┌──────────────▼──────────┐
     │  Legacy Payout    │               │  Treasury Financial     │
     │  (Express accts)  │               │  Account (Custom accts) │
     │                   │               │                         │
     │  Transfer → Bank  │               │  ┌─────────────────┐   │
     └───────────────────┘               │  │ Spendable       │   │
                                         │  │ Balance         │   │
                                         │  │ (FDIC eligible) │   │
                                         │  └──┬──┬──┬──┬─────┘   │
                                         │     │  │  │  │         │
                                         └─────┼──┼──┼──┼─────────┘
                                               │  │  │  │
                          ┌────────────────────┘  │  │  └──────────────────┐
                          │                       │  │                     │
                   ┌──────▼──────┐     ┌──────────▼──▼───────┐    ┌───────▼───────┐
                   │  Issued     │     │  OutboundPayment    │    │  Outbound     │
                   │  Cards      │     │  (ACH/Wire to       │    │  Transfer     │
                   │  (virtual   │     │   vendors/          │    │  (to own      │
                   │  + physical)│     │   contractors)      │    │   bank acct)  │
                   └─────────────┘     └─────────────────────┘    └───────────────┘
```

### Key architectural principles

1. **MoR compliance stays first-class** — Funds only flow to Treasury after clearing all MoR holds, risk checks, and policy controls. Treasury is downstream of compliance, not a bypass.
2. **Treasury replaces "payout queue"** — Instead of funds sitting in a payout queue waiting for withdrawal, cleared funds move to the merchant's Financial Account where they become operating cash.
3. **Cards spend from Financial Account balance** — Issued cards draw from the Treasury Financial Account balance, not from the Stripe Connect balance.
4. **Existing ledger extended, not replaced** — New `TransactionType` values added for treasury movements; existing ledger stays intact.
5. **Feature-gated** — Embedded finance is opt-in per merchant via a feature flag / account upgrade flow.

---

## 4. Implementation Phases

### Phase 0: Connect Account Foundation (Custom Accounts)

**Goal:** Create the infrastructure for Custom connected accounts alongside existing Express accounts.

#### Backend tasks

1. **Add `AccountMode` enum to Account model**
   - Values: `express` (default, current), `custom` (embedded finance)
   - Existing accounts default to `express`

2. **Create `StripeService.create_custom_account()` method**
   - Uses v1 Accounts API (`stripe.Account.create(type="custom", ...)`)
   - Requests capabilities: `transfers`, `treasury`, `card_issuing`, `us_bank_account_ach_payments`
   - Sets controller: `stripe_dashboard.type=none`, `fees.payer=application`, `losses.payments=application`, `requirement_collection=application`

3. **Build custom onboarding flow**
   - Stripe provides three onboarding options for Custom accounts:
     - **Stripe-hosted onboarding** (Account Links) — least code, Stripe collects KYC
     - **Embedded onboarding components** — middle ground, embed Stripe's onboarding UI
     - **API-based onboarding** — most control, platform collects & submits KYC
   - **Recommendation:** Use **embedded onboarding components** (Connect embedded components with `account_onboarding` component type). This gives branded onboarding without building KYC collection from scratch.

4. **Add `stripe_v1_id` field to Account model** (or repurpose `stripe_id`)
   - Custom accounts use v1 Account IDs (`acct_xxx`)
   - Existing Express accounts use v2 Account IDs
   - May need both or a unified field with a type discriminator

5. **Webhook handling for Custom account events**
   - `account.updated` — capability status changes
   - `capability.updated` — individual capability activation
   - New requirement: handle `treasury` and `card_issuing` capability status

6. **Account Link generation for Custom accounts**
   - `stripe.AccountLink.create(account=acct_id, type="account_onboarding", ...)` (v1)
   - Or use embedded Account Onboarding component

#### Database migration
```sql
ALTER TABLE accounts ADD COLUMN account_mode VARCHAR(10) DEFAULT 'express' NOT NULL;
ALTER TABLE accounts ADD COLUMN treasury_enabled BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE accounts ADD COLUMN issuing_enabled BOOLEAN DEFAULT FALSE NOT NULL;
```

---

### Phase 1: Treasury Foundation (Financial Accounts + Balances)

**Goal:** Merchants with Custom accounts can have a Financial Account that holds their cleared earnings as operating cash.

#### Backend tasks

1. **New module: `server/polar/treasury/`**
   ```
   treasury/
   ├── __init__.py
   ├── endpoints.py      # FastAPI routes
   ├── service.py         # Business logic
   ├── repository.py      # Database queries
   ├── schemas.py         # Pydantic models
   └── tasks.py           # Background jobs + webhooks
   ```

2. **Create Financial Account for Custom merchants**
   ```python
   stripe.treasury.FinancialAccount.create(
       supported_currencies=["usd"],
       features={
           "card_issuing": {"requested": True},
           "deposit_insurance": {"requested": True},
           "financial_addresses": {"aba": {"requested": True}},
           "inbound_transfers": {"ach": {"requested": True}},
           "intra_stripe_flows": {"requested": True},
           "outbound_payments": {
               "ach": {"requested": True},
               "us_domestic_wire": {"requested": True},
           },
           "outbound_transfers": {
               "ach": {"requested": True},
               "us_domestic_wire": {"requested": True},
           },
       },
       stripe_account=connected_account_id,
   )
   ```

3. **New database model: `FinancialAccount`**
   - `id` (UUID, PK)
   - `account_id` (FK → accounts)
   - `stripe_financial_account_id` (string, Stripe FA ID `fa_xxx`)
   - `status` (`open`, `closed`)
   - `supported_currencies` (JSON array)
   - `aba_routing_number` (string, populated when `financial_addresses.aba` activates)
   - `aba_account_number` (string, encrypted)
   - `features_status` (JSONB — tracks which features are active/pending/restricted)
   - `balance_cash` (integer, cents — cached from Stripe)
   - `balance_inbound_pending` (integer, cents — cached)
   - `balance_outbound_pending` (integer, cents — cached)
   - `created_at`, `updated_at`

4. **Modify payout flow for treasury-enabled accounts**
   - When a merchant has `treasury_enabled=True` and a Financial Account:
     - Instead of the two-step payout (Transfer → Payout to bank), do:
     - **Transfer from Polar platform → Merchant's Financial Account** using `stripe.treasury.ReceivedCredit` flow (via `IntraStripeFlows` or by creating a Transfer that lands in the FA)
     - The funds become immediately available as operating cash
   - The existing `payout_service.transfer_stripe()` method needs a conditional branch:
     - Express account → existing Transfer + Payout flow
     - Custom account with FA → Transfer that routes to Financial Account

5. **Balance sync service**
   - Periodically sync Financial Account balances from Stripe
   - React to `treasury.financial_account.balance_updated` webhook
   - Cache balances locally for fast dashboard reads

6. **Transaction integration**
   - Add new `TransactionType` values:
     - `treasury_inflow` — funds moved into Financial Account
     - `treasury_outflow` — funds moved out of Financial Account (card spend, ACH, wire)
   - Link Treasury transactions to existing ledger entries

#### Key Stripe API calls
- `stripe.treasury.FinancialAccount.create()` — Create FA
- `stripe.treasury.FinancialAccount.retrieve()` — Get FA + balance
- `stripe.treasury.Transaction.list()` — List transactions in FA
- `stripe.treasury.TransactionEntry.list()` — Detailed entries

---

### Phase 2: Card Issuing

**Goal:** Merchants can create virtual and physical cards that spend from their Financial Account balance.

#### Backend tasks

1. **New module: `server/polar/issuing/`**
   ```
   issuing/
   ├── __init__.py
   ├── endpoints.py       # Card & cardholder management routes
   ├── service.py          # Business logic
   ├── repository.py       # Database queries
   ├── schemas.py          # Pydantic models
   └── tasks.py            # Webhooks + background jobs
   ```

2. **Cardholder management**
   ```python
   stripe.issuing.Cardholder.create(
       name="Jane Doe",
       email="jane@merchant.com",
       phone_number="+15551234567",
       type="individual",  # or "company"
       billing={
           "address": { ... }
       },
       stripe_account=connected_account_id,
   )
   ```

3. **Card creation**
   ```python
   stripe.issuing.Card.create(
       cardholder=cardholder_id,
       currency="usd",
       type="virtual",  # or "physical"
       status="active",
       spending_controls={
           "spending_limits": [
               {"amount": 500000, "interval": "monthly"},  # $5,000/month
           ],
           "allowed_categories": [...],
           "blocked_categories": [...],
       },
       financial_account=financial_account_id,  # Fund from Treasury FA
       stripe_account=connected_account_id,
   )
   ```

4. **New database models**

   **`Cardholder`**
   - `id` (UUID, PK)
   - `account_id` (FK → accounts)
   - `stripe_cardholder_id` (string)
   - `name`, `email`, `phone`
   - `type` (`individual`, `company`)
   - `status` (`active`, `inactive`, `blocked`)
   - `billing_address` (JSONB)

   **`IssuedCard`**
   - `id` (UUID, PK)
   - `cardholder_id` (FK → cardholders)
   - `financial_account_id` (FK → financial_accounts)
   - `stripe_card_id` (string)
   - `type` (`virtual`, `physical`)
   - `status` (`active`, `inactive`, `canceled`)
   - `last4` (string)
   - `exp_month`, `exp_year` (integer)
   - `spending_controls` (JSONB)
   - `shipping_status` (string, for physical cards)

5. **Authorization handling**
   - `issuing_authorization.request` webhook → real-time approve/decline
   - Apply Spaire-level controls on top of Stripe spending controls:
     - Account risk status check
     - MoR compliance holds (if funds haven't fully cleared)
     - Custom merchant-configured limits
   - Return `approved: true/false` within Stripe's webhook timeout

6. **Transaction recording**
   - `issuing_transaction.created` webhook → record card spend in ledger
   - Link to existing `Transaction` model with type `treasury_outflow` and a new `IssuingTransaction` reference

---

### Phase 3: Money Movement (ACH / Wire / Checks)

**Goal:** Merchants can pay vendors, contractors, and others from their Financial Account via ACH, domestic wire, or check (where supported).

#### Backend tasks

1. **New module: `server/polar/money_movement/`** (or extend `server/polar/treasury/`)
   ```
   money_movement/
   ├── __init__.py
   ├── endpoints.py         # Payment creation/management routes
   ├── service.py            # Business logic
   ├── schemas.py            # Pydantic models
   ├── repository.py         # Database queries
   └── tasks.py              # Webhooks + async job handlers
   ```

2. **Recipient management**
   - Merchants create "recipients" (payees) with bank account details
   - Use Stripe `PaymentMethod` or `BankAccount` objects attached to the FA
   - Store locally for quick reference:

   **`PaymentRecipient`** model
   - `id` (UUID, PK)
   - `account_id` (FK → accounts)
   - `name`, `email`
   - `type` (`individual`, `company`)
   - `stripe_payment_method_id` (string — the bank account PM)
   - `bank_name`, `last4`, `routing_number_last4` (display fields)
   - `billing_address` (JSONB — required for wire)

3. **OutboundPayment (ACH/Wire to third parties)**
   ```python
   stripe.treasury.OutboundPayment.create(
       financial_account=fa_id,
       amount=50000,  # $500.00
       currency="usd",
       destination_payment_method=payment_method_id,
       description="Invoice #1234 - Contractor payment",
       statement_descriptor="SPAIRE PAY",
       stripe_account=connected_account_id,
   )
   ```

4. **OutboundTransfer (to merchant's own bank account)**
   ```python
   stripe.treasury.OutboundTransfer.create(
       financial_account=fa_id,
       amount=100000,  # $1,000.00
       currency="usd",
       destination_payment_method=payment_method_id,
       description="Withdrawal to operating account",
       stripe_account=connected_account_id,
   )
   ```

5. **New database models**

   **`OutboundPaymentRecord`**
   - `id` (UUID, PK)
   - `account_id` (FK → accounts)
   - `financial_account_id` (FK → financial_accounts)
   - `recipient_id` (FK → payment_recipients)
   - `stripe_outbound_payment_id` (string)
   - `amount`, `currency`
   - `method` (`ach`, `us_domestic_wire`)
   - `status` (`processing`, `posted`, `failed`, `canceled`, `returned`)
   - `description`, `statement_descriptor`
   - `expected_arrival_date` (date)
   - `failure_reason` (string, nullable)
   - `transaction_id` (FK → transactions)

   **`OutboundTransferRecord`** (similar schema for own-bank withdrawals)

6. **Checks (future/dependent on partner capabilities)**
   - Check receiving is handled by the ABA routing number + account number on the Financial Account
   - Incoming checks arrive as `ReceivedCredit` objects with `network: "ach"` or via check processing partner
   - This is largely automatic once `financial_addresses.aba` is active
   - Outbound check writing may require additional Stripe partner capabilities or a third-party check printing service (e.g., Lob, Checkbook.io)

7. **Transaction recording**
   - All outbound movements create `Transaction` records with appropriate types
   - Link to `OutboundPaymentRecord` or `OutboundTransferRecord`

---

### Phase 4: Frontend Embedded Components

**Goal:** Merchants see their Financial Account, cards, transactions, and money movement controls in the Spaire dashboard.

#### Stripe Connect Embedded Components

Stripe provides pre-built, PCI-compliant embedded components that dramatically reduce frontend work:

| Component | Purpose | Priority |
|---|---|---|
| `notification-banner` | Risk/compliance alerts from Stripe | **Must have** (Stripe requires this) |
| `account-onboarding` | KYC collection for Custom accounts | **Must have** |
| `financial-account` | Show FA balance, account details, ABA info | **Must have** |
| `financial-account-transactions` | Transaction history for FA | **Must have** |
| `issuing-cards-list` | List, create, manage cards | **Must have** |
| `issuing-card` | Individual card details, spend controls, PAN reveal | **Must have** |
| `account-management` | Manage account details, requirements | **Should have** |

#### Integration approach

1. **Backend: Account Session creation**
   ```python
   # New endpoint: POST /v1/integrations/stripe/account-session
   stripe.AccountSession.create(
       account=connected_account_id,
       components={
           "notification_banner": {"enabled": True},
           "financial_account": {
               "enabled": True,
               "features": {"external_account_collection": True},
           },
           "financial_account_transactions": {"enabled": True},
           "issuing_cards_list": {
               "enabled": True,
               "features": {
                   "card_management": True,
                   "cardholder_management": True,
                   "card_spend_dispute_management": True,
                   "spend_control_management": True,
               },
           },
           "issuing_card": {
               "enabled": True,
               "features": {
                   "card_management": True,
                   "card_spend_dispute_management": True,
                   "spend_control_management": True,
               },
           },
       },
   )
   ```

2. **Frontend: New dashboard pages** (in `clients/apps/web/`)

   **New routes:**
   - `/dashboard/{org}/finance` — Overview (FA balance, recent transactions, card summary)
   - `/dashboard/{org}/finance/accounts` — Financial Account details (embedded `financial-account` + `financial-account-transactions`)
   - `/dashboard/{org}/finance/cards` — Card management (embedded `issuing-cards-list`)
   - `/dashboard/{org}/finance/cards/{id}` — Individual card (embedded `issuing-card`)
   - `/dashboard/{org}/finance/payments` — Outbound payments (custom UI for ACH/wire)
   - `/dashboard/{org}/finance/recipients` — Manage payment recipients

3. **Stripe.js Connect embedded component integration**
   ```tsx
   // Install @stripe/connect-js
   import { loadConnectAndInitialize } from "@stripe/connect-js";

   const stripeConnectInstance = loadConnectAndInitialize({
     publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
     fetchClientSecret: async () => {
       // Call backend to create AccountSession
       const response = await api.createAccountSession();
       return response.client_secret;
     },
   });

   // Render components
   <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
     <ConnectNotificationBanner />
     <ConnectFinancialAccount financialAccount={faId} />
     <ConnectIssuingCardsList />
   </ConnectComponentsProvider>
   ```

4. **Custom UI for money movement**
   - Stripe doesn't provide embedded components for OutboundPayment/OutboundTransfer creation
   - Build custom forms:
     - "Pay a vendor" flow (select recipient → enter amount → choose ACH or wire → confirm)
     - "Transfer to bank" flow (select bank account → enter amount → confirm)
   - Use Polar's existing design system (`clients/packages/ui/`)

5. **Finance overview dashboard**
   - Current balance (cash + pending inbound - pending outbound)
   - Recent transactions (pulled from Treasury API or local cache)
   - Active cards summary
   - Quick actions (issue card, pay vendor, transfer to bank)

---

### Phase 5: Rewards & Cash Back

**Goal:** Offer card rewards/cash back as a program feature where supported by the issuing program.

#### Considerations

- Stripe Issuing supports **rewards programs** through partner bank arrangements
- This is typically configured at the **program level** with Stripe, not per-card
- Implementation depends on what the Stripe partnership agreement allows
- Cash back is typically credited to the Financial Account balance automatically

#### Tasks (once program terms are established)

1. **Display rewards in dashboard**
   - Show accrued rewards balance
   - Show rewards earned per transaction
   - Allow redemption (typically auto-credited)

2. **Rewards tracking in ledger**
   - New `TransactionType`: `reward_credit`
   - Record reward payouts as income to the Financial Account

3. **Reward notifications**
   - Webhook-driven notifications when rewards are credited

> **Note:** This phase depends heavily on the Stripe issuing program terms negotiated separately. The technical implementation is relatively simple once the business terms are settled.

---

## 5. Database Schema Changes

### New tables

```sql
-- Financial accounts (Stripe Treasury)
CREATE TABLE financial_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    modified_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    account_id UUID NOT NULL REFERENCES accounts(id),
    stripe_financial_account_id VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    supported_currencies JSONB NOT NULL DEFAULT '["usd"]',
    aba_routing_number VARCHAR(20),
    aba_account_number_encrypted TEXT,  -- Encrypted at rest
    features_status JSONB NOT NULL DEFAULT '{}',
    balance_cash BIGINT NOT NULL DEFAULT 0,
    balance_inbound_pending BIGINT NOT NULL DEFAULT 0,
    balance_outbound_pending BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_financial_account_account FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- Cardholders (Stripe Issuing)
CREATE TABLE cardholders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    modified_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    account_id UUID NOT NULL REFERENCES accounts(id),
    stripe_cardholder_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(254),
    phone VARCHAR(20),
    type VARCHAR(20) NOT NULL DEFAULT 'individual',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    billing_address JSONB
);

-- Issued cards (Stripe Issuing)
CREATE TABLE issued_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    modified_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    cardholder_id UUID NOT NULL REFERENCES cardholders(id),
    financial_account_id UUID NOT NULL REFERENCES financial_accounts(id),
    stripe_card_id VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL,  -- 'virtual' or 'physical'
    status VARCHAR(20) NOT NULL DEFAULT 'inactive',
    last4 VARCHAR(4),
    exp_month INTEGER,
    exp_year INTEGER,
    spending_controls JSONB DEFAULT '{}',
    shipping_status VARCHAR(50),
    shipping_tracking_number VARCHAR(255),
    canceled_reason VARCHAR(100)
);

-- Payment recipients (for outbound payments)
CREATE TABLE payment_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    modified_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    account_id UUID NOT NULL REFERENCES accounts(id),
    stripe_payment_method_id VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(254),
    type VARCHAR(20) NOT NULL DEFAULT 'individual',
    bank_name VARCHAR(255),
    last4 VARCHAR(4),
    routing_number_last4 VARCHAR(4),
    billing_address JSONB
);

-- Outbound payment records
CREATE TABLE outbound_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    modified_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    account_id UUID NOT NULL REFERENCES accounts(id),
    financial_account_id UUID NOT NULL REFERENCES financial_accounts(id),
    recipient_id UUID REFERENCES payment_recipients(id),
    stripe_outbound_payment_id VARCHAR(100) UNIQUE,
    amount BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'usd',
    method VARCHAR(30) NOT NULL,  -- 'ach', 'us_domestic_wire'
    status VARCHAR(30) NOT NULL DEFAULT 'processing',
    description TEXT,
    statement_descriptor VARCHAR(100),
    expected_arrival_date DATE,
    failure_reason VARCHAR(255),
    transaction_id UUID REFERENCES transactions(id)
);

-- Outbound transfer records (to merchant's own bank)
CREATE TABLE outbound_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    modified_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    account_id UUID NOT NULL REFERENCES accounts(id),
    financial_account_id UUID NOT NULL REFERENCES financial_accounts(id),
    stripe_outbound_transfer_id VARCHAR(100) UNIQUE,
    amount BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'usd',
    method VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'processing',
    description TEXT,
    expected_arrival_date DATE,
    failure_reason VARCHAR(255),
    transaction_id UUID REFERENCES transactions(id)
);
```

### Modified tables

```sql
-- accounts table additions
ALTER TABLE accounts ADD COLUMN account_mode VARCHAR(10) NOT NULL DEFAULT 'express';
ALTER TABLE accounts ADD COLUMN treasury_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE accounts ADD COLUMN issuing_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- transactions table: extend TransactionType enum
-- Add: 'treasury_inflow', 'treasury_outflow', 'card_spend', 'reward_credit'
-- Add new FK columns:
ALTER TABLE transactions ADD COLUMN financial_account_id UUID REFERENCES financial_accounts(id);
ALTER TABLE transactions ADD COLUMN outbound_payment_id UUID REFERENCES outbound_payments(id);
ALTER TABLE transactions ADD COLUMN outbound_transfer_id UUID REFERENCES outbound_transfers(id);
ALTER TABLE transactions ADD COLUMN issuing_transaction_id VARCHAR(100);
```

---

## 6. API Design

### New endpoints

Following the existing Polar pattern (`{module}/endpoints.py`):

```
# Treasury / Financial Accounts
GET    /v1/financial-accounts                          # List merchant's FAs
POST   /v1/financial-accounts                          # Create FA (triggers Stripe creation)
GET    /v1/financial-accounts/{id}                     # Get FA details + balance
GET    /v1/financial-accounts/{id}/transactions        # List FA transactions

# Card Issuing
GET    /v1/cardholders                                 # List cardholders
POST   /v1/cardholders                                 # Create cardholder
PATCH  /v1/cardholders/{id}                            # Update cardholder
GET    /v1/issued-cards                                # List cards
POST   /v1/issued-cards                                # Create card
PATCH  /v1/issued-cards/{id}                           # Update card (status, spending controls)
GET    /v1/issued-cards/{id}                           # Get card details

# Money Movement
GET    /v1/payment-recipients                          # List recipients
POST   /v1/payment-recipients                          # Create recipient
PATCH  /v1/payment-recipients/{id}                     # Update recipient
DELETE /v1/payment-recipients/{id}                     # Delete recipient
POST   /v1/outbound-payments                           # Send ACH/wire to recipient
GET    /v1/outbound-payments                           # List outbound payments
GET    /v1/outbound-payments/{id}                      # Get payment details
POST   /v1/outbound-payments/{id}/cancel               # Cancel (if still processing)
POST   /v1/outbound-transfers                          # Transfer to own bank
GET    /v1/outbound-transfers                          # List transfers
GET    /v1/outbound-transfers/{id}                     # Get transfer details

# Stripe Connect Embedded Components
POST   /v1/integrations/stripe/account-session         # Create AccountSession for embedded components
```

### Authorization model

- All endpoints scoped to authenticated user + organization
- Financial Account operations require `treasury_enabled` on the account
- Card operations require `issuing_enabled` on the account
- Outbound payments may require additional authorization (e.g., 2FA for large amounts)

---

## 7. Webhook Handling

### New webhook events to handle

Add to `server/polar/integrations/stripe/tasks.py`:

```python
# Treasury webhooks
"treasury.financial_account.created"
"treasury.financial_account.closed"
"treasury.financial_account.features_status_updated"   # Feature activation
"treasury.inbound_transfer.created"
"treasury.inbound_transfer.succeeded"
"treasury.inbound_transfer.failed"
"treasury.outbound_payment.created"
"treasury.outbound_payment.posted"
"treasury.outbound_payment.failed"
"treasury.outbound_payment.canceled"
"treasury.outbound_payment.returned"
"treasury.outbound_transfer.created"
"treasury.outbound_transfer.posted"
"treasury.outbound_transfer.failed"
"treasury.outbound_transfer.canceled"
"treasury.outbound_transfer.returned"
"treasury.received_credit.created"                     # Incoming ACH/wire/check
"treasury.received_credit.succeeded"
"treasury.received_credit.failed"
"treasury.received_debit.created"                      # Debit from FA

# Issuing webhooks
"issuing_authorization.request"                        # REAL-TIME: approve/decline card spend
"issuing_authorization.created"
"issuing_authorization.updated"
"issuing_transaction.created"                          # Card transaction settled
"issuing_transaction.updated"
"issuing_card.created"
"issuing_card.updated"
"issuing_cardholder.created"
"issuing_cardholder.updated"
"issuing_dispute.created"
"issuing_dispute.updated"
"issuing_dispute.closed"
```

### Critical: Real-time authorization

The `issuing_authorization.request` webhook is **synchronous** — Stripe expects an approve/decline response within seconds. This must be handled with a dedicated, fast endpoint:

```python
@router.post("/webhooks/stripe/issuing-authorization")
async def handle_issuing_authorization(request: Request):
    event = stripe.Webhook.construct_event(...)
    authorization = event.data.object

    # Fast checks:
    # 1. Account active and not suspended?
    # 2. Financial Account has sufficient balance?
    # 3. Spending controls pass?
    # 4. No MoR compliance holds blocking spend?

    approved = await issuing_service.evaluate_authorization(authorization)

    return stripe.issuing.Authorization.approve(authorization.id)
    # or stripe.issuing.Authorization.decline(authorization.id)
```

---

## 8. Risk, Compliance & Controls

### MoR compliance integration

1. **Funds only move to Treasury after MoR clearance**
   - The existing `HeldBalance` system continues to gate when funds become "available"
   - Only released/cleared funds flow into the Financial Account
   - MoR holds, tax withholding, and compliance flags take precedence

2. **Account-level controls**
   - `Account.status` must be `ACTIVE` for any Treasury/Issuing operations
   - Account review system (`next_review_threshold`) extended to cover Treasury activity
   - Ability to freeze Financial Account if compliance issue detected

3. **Transaction monitoring**
   - All Treasury and Issuing transactions logged in the existing ledger
   - Anomaly detection on outbound payment patterns
   - Velocity checks on card spend and outbound payments

### Stripe-required compliance

1. **Notification Banner** — Must be integrated (Stripe requirement for all Treasury/Issuing platforms)
2. **KYB/KYC** — Custom accounts require platform to collect and submit identity verification
3. **Terms of Service** — Platform must communicate Stripe's ToS updates to connected accounts
4. **Negative Balance Liability** — Platform is responsible for restoring negative Financial Account balances (e.g., ACH returns, disputes)

### Platform-level risk controls

- Maximum single outbound payment amount (configurable per account tier)
- Daily/monthly outbound payment limits
- Mandatory review for wire transfers above threshold
- IP-based and device-based anomaly detection for high-value operations
- Optional 2FA requirement for outbound payments

---

## 9. Testing Strategy

### Stripe sandbox testing

All Treasury and Issuing APIs are fully testable in Stripe's sandbox environment:

- Financial Account creation and feature activation
- Card creation and authorization simulation
- OutboundPayment/OutboundTransfer lifecycle simulation
- ReceivedCredit simulation (test incoming ACH/wire)
- Use Stripe's test clock feature for time-sensitive flows

### Test categories

1. **Unit tests** — Service-layer logic (authorization evaluation, balance checks, fee calculations)
2. **Integration tests** — Stripe API interaction with mocked responses (existing pattern in codebase)
3. **Webhook tests** — Simulated webhook event processing
4. **E2E tests** — Full flow from account creation → FA creation → card issuance → authorization → settlement

### Key test scenarios

- Account upgrade from Express to Custom (dual-track validation)
- Financial Account creation with all features
- Card issuance and real-time authorization (approve + decline paths)
- OutboundPayment lifecycle (ACH: processing → posted; wire: processing → posted)
- OutboundPayment failure and return handling
- Negative balance recovery
- MoR hold preventing Treasury fund flow
- Account suspension freezing all Treasury/Issuing operations
- Concurrent authorization requests

---

## 10. Migration Strategy for Existing Merchants

### Approach: Opt-in upgrade

1. **No automatic migration** — Existing Express account merchants continue as-is
2. **Upgrade flow:**
   - Merchant opts in via dashboard ("Upgrade to Spaire Finance")
   - New Custom account created on Stripe (separate from Express account)
   - Merchant completes additional KYB requirements via embedded onboarding
   - Once Custom account capabilities are active, Financial Account is provisioned
   - Merchant can then choose to route future earnings to Financial Account
3. **Transition period:**
   - Both Express (legacy payout) and Custom (Treasury) accounts can coexist for the same merchant
   - Merchant chooses which flow to use for each payout
   - Eventually, full migration to Custom account once confident

### Data considerations

- Existing `stripe_id` (Express v2) preserved
- New `stripe_v1_custom_id` field (or repurpose if fully migrated)
- Transaction history stays in existing ledger — no migration needed
- Payout history preserved as-is

---

## 11. Open Questions & Decisions

### Must decide before implementation

| # | Question | Options | Impact |
|---|---|---|---|
| 1 | **Account strategy** | Dual-track (Express + Custom) vs. full Custom migration | Architecture, timeline, risk |
| 2 | **Onboarding UX** | Stripe-hosted vs. embedded components vs. API-based | Frontend effort, UX quality |
| 3 | **US-only or international?** | Treasury is currently US-only for commercial businesses | Market scope |
| 4 | **Auto-sweep vs. manual** | Should cleared MoR funds auto-flow to FA, or should merchant manually pull? | UX, risk |
| 5 | **Outbound payment approval flow** | Self-serve vs. maker-checker vs. configurable | Risk, compliance |
| 6 | **Stripe program approval** | Have you applied for Treasury + Issuing access with Stripe? | Blocker for go-live |

### Must clarify with Stripe

| # | Question | Why it matters |
|---|---|---|
| 1 | Can v2 Express accounts coexist with v1 Custom accounts for the same business? | Dual-track viability |
| 2 | What are the specific KYB fields required for `treasury` + `card_issuing` capabilities? | Onboarding flow design |
| 3 | Is check receiving available in the current Treasury program? | Feature scope for Phase 3 |
| 4 | What rewards/cash back program options are available? | Phase 5 feasibility |
| 5 | What is the timeline for Same-Day ACH availability? | OutboundPayment SLA |
| 6 | Platform-level exposure limits for negative FA balances? | Risk modeling |

---

## Summary: Implementation Order

```
Phase 0 ─── Connect Account Foundation (Custom accounts + onboarding)
  │         ↓ Prerequisite for everything else
  │
Phase 1 ─── Treasury Foundation (Financial Accounts + fund routing)
  │         ↓ Enables "funds as operating cash"
  │
Phase 2 ─── Card Issuing (Cardholders + cards + authorization)
  │         ↓ Enables "spend with cards"
  │         ↓ Can run in parallel with Phase 3
  │
Phase 3 ─── Money Movement (ACH + Wire + Checks)
  │         ↓ Enables "pay vendors/contractors"
  │
Phase 4 ─── Frontend (Embedded components + custom UI)
  │         ↓ Can start as early as Phase 1 and iterate
  │
Phase 5 ─── Rewards & Cash Back (program-dependent)
            ↓ Depends on Stripe program terms
```

**Phase 4 (Frontend) should be developed incrementally alongside Phases 1–3**, not sequentially after. Each backend phase should ship with its corresponding UI.

---

## Appendix: Key Stripe Documentation References

- [Stripe Treasury (Financial Accounts for platforms)](https://docs.stripe.com/treasury)
- [Embedded Finance Integration Guide](https://docs.stripe.com/baas/start-integration/integration-guides/embedded-finance)
- [Stripe Issuing](https://docs.stripe.com/issuing)
- [Issuing + Connect Setup](https://docs.stripe.com/issuing/connect)
- [Financial Account Features](https://docs.stripe.com/financial-accounts/connect/account-management/financial-account-features)
- [Connected Accounts for Treasury](https://docs.stripe.com/financial-accounts/connect/account-management/connected-accounts)
- [OutboundPayments (ACH/Wire)](https://docs.stripe.com/treasury/moving-money/financial-accounts/out-of/outbound-payments)
- [OutboundTransfers](https://docs.stripe.com/treasury/moving-money/financial-accounts/out-of/outbound-transfers)
- [ReceivedCredits](https://docs.stripe.com/treasury/moving-money/financial-accounts/into/received-credits)
- [Issuing Spending Controls](https://docs.stripe.com/issuing/controls/spending-controls)
- [Connect Embedded Components](https://docs.stripe.com/connect/supported-embedded-components)
- [Issuing Embedded Components](https://docs.stripe.com/issuing/connect/embedded-components)
- [Stripe Issuing + Treasury Samples (GitHub)](https://github.com/stripe-samples/issuing-treasury)
