# Issuing Instant Spend (After Risk Clearance) — End-to-End Execution Plan

This is the implementation guide for building Stripe Issuing + Connect instant spend in Polar's Merchant of Record model.

Use this document as an instruction manual for an engineer taking over the work.

---

## 1) Objective and non-negotiables

Build a merchant experience where card spend feels instant **after** risk clearance, while preserving Polar's MoR constraints and auditability.

### Product objective

- Merchant receives subscription/payment revenue into Polar MoR flow.
- Funds move through controlled lifecycle (`pending -> available -> reserve/spendable`).
- Cleared funds are automatically made spendable via Stripe Issuing balances.
- Merchant can use issued cards without manual payout friction.

### Non-negotiables

- Do not bypass MoR accounting: customer funds are first collected under Polar's MoR flow.
- Keep immutable money movement records (ledger-first, snapshots second).
- Every state transition must be idempotent and attributable to an event/reason.
- Stripe capability restrictions must immediately gate funding/spending transitions.

---

## 2) Where we started (baseline)

The repository already contains the initial scaffolding:

- Stripe webhook setup guidance now covers core, Connect, and v2 recipient capability endpoints in local development docs.
- Organization payment status response includes `issuing_onboarding_state` and `money_state` fields.
- Stripe v2 account normalization derives issuing onboarding/money state from capability signals.
- Issuing risk-clearance service and tasks exist with bulk and targeted execution paths.
- Stripe account sync enqueues targeted risk-clearance recalculation.
- Config flags exist for instant spend enablement, pending window days, and reserve floor bps.

These changes are useful but still rely heavily on `account.data` projection fields, so the system is not yet ledger-grade.

---

## 3) End state definition (what "finished" means)

The implementation is complete when all of the following are true:

1. **Money state is ledger-driven**
   - Balance states are derived from immutable entries, not only mutable JSON fields.

2. **Risk clearance is deterministic and event-driven**
   - Pending windows, reserve rules, and restriction rules are consistently applied on every relevant event.

3. **Funding to Issuing is automatic and safe**
   - Auto-funding runs behind feature flags and per-account eligibility.
   - Transfer/funding retries and idempotency are production-safe.

4. **Capability changes enforce immediate controls**
   - `card_issuing` or requirements issues can freeze funding and mark account restricted.

5. **Reconciliation exists and fails loudly**
   - Scheduled jobs compare ledger, projections, and Stripe-side amounts; mismatches create actionable exceptions.

6. **Operational control plane exists**
   - Admin controls for hold/release/freeze and audited manual adjustments.

7. **Merchant UX is complete**
   - Clear onboarding and money-state messaging, including restriction reasons.

---

## 4) Stripe architecture decisions (must follow)

### 4.1 Connect account model

- Use Connect accounts compatible with Issuing workflows.
- Request capabilities:
  - `transfers`
  - `card_issuing`
- Treat capability lifecycle as dynamic; active now does not guarantee active later.

### 4.2 Accounts API compatibility

- Issuing/Treasury workflows should use Accounts v1-compatible endpoints as needed.
- Do not assume Accounts v2-only flows can cover Issuing lifecycle.

### 4.3 Funding model

- Issuing balance is separate from main balance.
- Implement explicit funding allocation from cleared funds.
- Never spend from pending funds.

### 4.4 Required webhook categories

Maintain all three ingress paths:

1. Core Stripe webhook endpoint
   - payment success/failure
   - refunds
   - disputes

2. Connect webhook endpoint
   - account updates
   - payout updates (if payout rail still active)

3. Stripe v2 capability endpoint
   - recipient/capability status updates

All webhook handlers must be idempotent and enqueue internal recalculation jobs rather than doing heavy inline processing.

---

## 5) Domain model to implement (authoritative)

Implement these core concepts in backend domain code:

- `IssuingLedgerEntry`
  - immutable records
  - signed amount (or debit/credit columns)
  - type, source_event_id, idempotency_key, account_id

- `IssuingBalanceProjection` (optional table or computed cache)
  - denormalized current totals:
    - pending
    - available
    - reserve
    - spendable
  - last_recomputed_at

- `IssuingFundingTransfer`
  - status machine (`queued`, `processing`, `succeeded`, `failed`, `retrying`)
  - request/response IDs to Stripe
  - idempotency key

- `IssuingRestriction`
  - reason code (e.g. `account_under_review`, `capability_inactive`, `requirements_past_due`)
  - activated_at / released_at

- `IssuingReconciliationRun` + `IssuingReconciliationException`
  - aggregates and mismatch records

Do not treat `account.data` as source of truth after this phase; use it only as externally consumed projection/cache.

---

## 6) Implementation phases and exact execution order

### Phase 0 — Inventory and hardening prep (1–2 days)

1. Audit current issuing-related code paths:
   - `server/polar/issuing/service.py`
   - `server/polar/issuing/tasks.py`
   - `server/polar/account/service.py`
   - `server/polar/integrations/stripe/service.py`
   - `server/polar/organization/service.py`

2. List all fields currently written into `account.data` for issuing state.
3. Define migration mapping from those fields into new ledger/projection structures.
4. Add temporary metrics counters around current risk-clearance updates.

**Exit criteria:** written migration map and event-to-transition map approved.

---

### Phase 1 — Ledger foundation (3–5 days)

1. Add DB models + migration(s) for:
   - `issuing_ledger_entries`
   - `issuing_funding_transfers`
   - (optional) `issuing_balance_projections`
   - `issuing_reconciliation_runs`
   - `issuing_reconciliation_exceptions`

2. Implement repository methods for:
   - append entry (idempotent)
   - list by account/date/type
   - aggregate balances

3. Implement ledger service with explicit transition methods:
   - `record_pending_credit`
   - `release_pending_to_available`
   - `allocate_available_to_reserve`
   - `allocate_available_to_spendable`
   - `record_refund_or_dispute_debit`
   - `record_manual_adjustment`

4. Enforce invariants in service layer:
   - no mutation of historical entries
   - no double-post for same idempotency key

**Exit criteria:** unit tests prove transition accounting and idempotency behavior.

---

### Phase 2 — Risk-clearance engine v2 (3–4 days)

1. Refactor current risk-clearance logic to read from ledger and write ledger entries.
2. Keep `ISSUING_INSTANT_SPEND_ENABLED`, pending window, reserve bps as policy inputs.
3. Apply policy in strict order:
   1. If restricted (internal review or Stripe capability issue):
      - force restricted onboarding state
      - move eligible available/spendable back to reserve if policy requires
      - block funding actions
   2. If pending window not elapsed:
      - keep funds in pending
   3. If elapsed:
      - release pending -> available
      - compute reserve floor
      - move remainder to spendable-eligible pool

4. Keep reason codes for every transition.

**Exit criteria:** deterministic recalculation tests across all state combinations.

---

### Phase 3 — Event ingestion and orchestration (3–5 days)

1. Expand webhook handlers to generate internal domain events:
   - payment captured/succeeded
   - refund created
   - dispute opened/closed
   - account capability changed
   - requirements changed/past due

2. For each event, enqueue lightweight jobs:
   - `issuing.recalculate_account`
   - `issuing.apply_refund_dispute_adjustments`
   - `issuing.sync_capability_restrictions`

3. Add idempotency table or shared dedupe mechanism keyed by Stripe event ID.

4. Ensure task fan-out is retry-safe.

**Exit criteria:** replaying same webhook payload does not change balances twice.

---

### Phase 4 — Funding execution (4–6 days)

1. Implement funding command handler:
   - input: account_id + amount + reason
   - validates eligibility and restriction state

2. Integrate Stripe call path for Issuing balance funding for connected accounts.
3. Persist `IssuingFundingTransfer` lifecycle transitions.
4. Add retry/backoff strategy:
   - transient API/network errors => retry
   - capability/requirements errors => mark blocked + create exception

5. Add per-account caps and minimum transfer thresholds.

**Exit criteria:** successful and failed Stripe funding flows are fully persisted and observable.

---

### Phase 5 — Reconciliation and exception management (3–5 days)

1. Create scheduled reconciliation actor:
   - compare ledger totals vs cached projections
   - compare internal expected transfer/funding totals vs Stripe-side observable state

2. On mismatch:
   - write `IssuingReconciliationException`
   - emit alert/notification
   - optionally enqueue auto-recompute

3. Add operator commands:
   - acknowledge exception
   - resolve with adjustment entry

**Exit criteria:** daily reconciliation runs produce report with zero silent failures.

---

### Phase 6 — API and UX completion (3–5 days)

1. Extend API responses (organization/account status endpoints) with:
   - precise state reason codes
   - amounts per bucket (pending/available/reserve/spendable)
   - restriction metadata

2. Frontend states to support:
   - Onboarding required
   - Onboarding in progress
   - Issuing active
   - Temporarily restricted

3. Display funding readiness and blocked reasons.

4. Keep payout rail visible as fallback until GA criteria met.

**Exit criteria:** merchant sees accurate state and next action without support intervention.

---

### Phase 7 — Rollout, controls, and GA gate (ongoing)

1. Feature-flag rollout by cohort (low-risk first).
2. Define SLOs/SLIs:
   - time-to-spendable
   - funding success rate
   - reconciliation mismatch rate
   - restriction false-positive rate

3. Incident runbooks:
   - webhook outage
   - Stripe capability mass-inactivation
   - reconciliation drift spike

4. GA checklist:
   - all critical alerts wired
   - operator playbooks signed off
   - backfill and migration completed

**Exit criteria:** GA approved, controlled expansion enabled.

---

## 7) Concrete Stripe API integration checklist

Use this checklist while implementing:

1. Connected account readiness
   - verify account controller/capability shape supports Issuing requirements
   - ensure `transfers` and `card_issuing` are requested

2. Onboarding
   - create account links for hosted onboarding
   - track onboarding completion and requirements arrays

3. Capability monitoring
   - parse status and requirement changes from account updates and v2 capability events
   - map to internal restriction reasons immediately

4. Card issuing primitives
   - create cardholders/cards only when capability active and not restricted

5. Funding
   - execute funding operations with idempotency keys
   - persist external IDs and statuses

6. Error handling
   - categorize Stripe errors as retryable vs terminal
   - terminal requirement errors should set restricted state and notify merchant

---

## 8) Risk policy v1 (implement exactly)

1. Pending window
   - configurable in days (`ISSUING_PENDING_WINDOW_DAYS`)
   - applies to newly credited pending funds

2. Reserve floor
   - configurable bps (`ISSUING_RESERVE_FLOOR_BASIS_POINTS`)
   - reserve applies before any spendable allocation

3. Restriction gates
   - internal account under review/denied => restricted
   - Stripe `card_issuing` inactive or requirements past due => restricted

4. Restricted behavior
   - freeze new funding
   - expose `temporarily_restricted` onboarding state
   - keep/shift balance into reserve according to policy

---

## 9) Testing strategy (must be implemented)

### Unit tests

- Ledger entry posting and aggregation correctness.
- Risk policy transitions across all combinations.
- Idempotency behavior (same event, same idempotency key).

### Integration tests

- Stripe webhook payload -> task enqueue -> state update path.
- Capability inactive/past_due transitions to restricted.
- Funding transfer success/failure lifecycle persistence.

### E2E-like tests (existing backend test style)

- Organization payment status reflects state and amount buckets accurately.
- Restriction conditions block spendable and funding transitions.

### Regression tests

- Missing timestamp/backfill edge cases.
- Non-pending accounts should not execute pending-window logic.

---

## 10) Operational instructions for engineers during implementation

1. Always run Python commands with `uv run`.
2. Keep migrations and models synchronized.
3. Keep imports at module top.
4. Avoid direct `session.commit()` in business logic; rely on request/task lifecycle patterns.
5. For new repository methods, return updated objects and use keyword-only `flush: bool = False` when needed.
6. Keep background tasks idempotent and small; delegate business logic to services.

---

## 11) Deliverables checklist by repository area

### Backend code (`server/polar`)

- `issuing/` module
  - ledger service, funding service, reconciliation service, tasks
- `integrations/stripe/`
  - event normalization and funding adapters
- `organization/` + `account/`
  - projections for API/UI consumption
- `config.py`
  - rollout and policy flags

### Migrations (`server/migrations`)

- tables for ledger, transfers, reconciliation, restrictions

### Tests (`server/tests`)

- issuing service tests
- stripe integration tests
- organization/account state projection tests

### Docs (`DEVELOPMENT.md` + implementation docs)

- local webhook setup
- runbooks and operational notes

---

## 12) Suggested schedule (practical)

- Week 1: Phase 0 + Phase 1
- Week 2: Phase 2 + Phase 3
- Week 3: Phase 4
- Week 4: Phase 5 + Phase 6
- Week 5+: Phase 7 cohort rollout and hardening

If team capacity is limited, split by ownership:

- Engineer A: Ledger + risk engine
- Engineer B: Stripe eventing + funding adapter
- Engineer C: API/UX + reconciliation console

---

## 13) Final instruction to implementer

Do not treat this as a "single big merge". Ship in stacked PRs with each phase gated by tests and observability. The order in this document is intentional: first make balances trustworthy, then automate funding, then scale with reconciliation and controls.

