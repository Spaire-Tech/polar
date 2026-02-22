# Sales-Assisted Billing — Scoping Document

## 1. Current Architecture Validation

### Your Assumptions — Confirmed

| Assumption | Status | Evidence |
|---|---|---|
| Stripe-first in checkout/payment paths | **Confirmed** | `PaymentProcessor` enum has only `stripe`. `checkout/service.py` hardcodes `PaymentProcessor.stripe` at creation. |
| Payment processor enum is Stripe-only | **Confirmed** | `server/polar/enums.py:12-13` — single value enum. |
| Checkout link schema only supports Stripe | **Confirmed** | `CheckoutConfirmStripe` schema requires `confirmation_token_id`. Every `if checkout.payment_processor == PaymentProcessor.stripe:` branch has no else. |
| Existing invoice generation requires paid order | **Confirmed** | `invoice/service.py` checks `order.paid` (status in `{paid, refunded, partially_refunded}`). PDFs are receipt-style, generated post-payment. |
| Stripe invoice linkage on orders | **Confirmed** | `Order.stripe_invoice_id` (unique column) used for Stripe Billing tax delegation and refund handling. |

### Additional Key Findings

- **No "draft" concept exists anywhere.** Orders are born as `paid` (one-time checkout) or `pending` (subscription cycle awaiting auto-charge). There is no editable pre-finalization state.
- **`AccountType.manual` exists but is payout-only.** It's for paying out to creators, not accepting customer payments.
- **`Processor.manual` in transactions** is similarly payout-settlement only.
- **Subscription creation is checkout-gated.** Paid subscriptions *must* go through checkout. The direct `POST /v1/subscriptions` API only allows free products (`amount == 0`).
- **Benefits are granted after payment**, async via Dramatiq jobs. Grace period revocation exists for `past_due` subscriptions.
- **Dramatiq** is the background job framework (not Celery). Redis-backed, with priority queues.
- **Backoffice** is HTMX + Tagflow (Python HTML builder) + DaisyUI. Existing manual tools: refunds, subscription cancel/uncancel, event replay. No manual order/invoice creation.

---

## 2. Difficulty Estimate

**Size: L (Large) — 6-8 engineering weeks**

Breakdown:
- New domain model + migrations: 1-1.5 weeks
- Backend service layer + endpoints: 2-2.5 weeks
- Subscription provisioning changes: 1 week
- Backoffice UI (draft editor, issue action, status timeline): 1-1.5 weeks
- Webhook/event infrastructure + reconciliation: 0.5-1 week
- Testing + edge cases: 0.5-1 week

This is "L" not "XL" because:
- The core order/payment infrastructure is mature and well-factored
- We can reuse significant existing logic (tax calculation, invoice generation, billing entries, benefit grants)
- We don't need to build a new payment processor abstraction for MVP

---

## 3. Recommended Architecture

### Decision: Introduce a new `ManualInvoice` domain model (Option B)

#### Why NOT extend Order directly (Option A):

1. **Semantic mismatch.** The `Order` model represents a *financial record of a completed (or in-progress) transaction*. It's born from checkout or subscription cycle — never from manual creation. Adding draft/editable semantics would muddy its invariants.
2. **Status collision.** `OrderStatus.pending` already means "awaiting auto-charge on a subscription cycle with a saved payment method." Draft semantics are fundamentally different — the item list itself is mutable.
3. **Invoice number assignment timing.** Currently, invoice numbers are assigned at order creation (immutable). A draft shouldn't consume an invoice number until finalization.
4. **Tight coupling risk.** Order is referenced by payments, transactions, refunds, benefit grants, webhooks. Making it editable pre-finalization would require guards everywhere.

#### Why a new ManualInvoice model (Option B):

1. **Clean lifecycle.** `draft → ready → billed → completed` maps to Paddle semantics without polluting existing Order lifecycle.
2. **Editable items.** Draft invoices need mutable line items, customer assignment, and notes — none of which Order supports.
3. **Clear finalization boundary.** "Issue" is an explicit action that creates an Order (financial record) + optionally a Subscription. This mirrors how Paddle's "issue invoice" works.
4. **Backwards compatible.** Zero changes to existing checkout, subscription cycle, or payment flows.

### Model Relationship

```
ManualInvoice (draft → ready → billed → completed)
    │
    ├── ManualInvoiceItem[] (mutable line items)
    ├── Customer (assignable)
    ├── Organization (owner)
    │
    └── on "issue" action:
        ├── Creates Order (status=pending, billing_reason=manual_invoice)
        ├── Creates Subscription (if any line item is recurring)
        └── Sends notification to customer with payment link
```

---

## 4. Backend Impact

### 4.1 New Models / Migrations

#### `ManualInvoice` model
```
Table: manual_invoices
────────────────────────────────────────────────────────
id                          UUID PK
status                      ManualInvoiceStatus (draft | ready | billed | completed | voided)
collection_method           CollectionMethod (send_invoice | checkout_link)

# Customer
customer_id                 UUID FK → customers (nullable in draft, required for ready)

# Organization
organization_id             UUID FK → organizations

# Financial summary (computed on finalize)
subtotal_amount             int (nullable in draft)
discount_amount             int default 0
tax_amount                  int (nullable in draft)
total_amount                int (nullable in draft)
currency                    str(3)

# Billing details
billing_name                str (nullable)
billing_address             Address (nullable)
tax_id                      TaxID (nullable)
due_date                    datetime (nullable — for send_invoice collection)
notes                       text (nullable — freeform notes on invoice)
memo                        text (nullable — internal memo, not on PDF)

# Payment
payment_url                 str (nullable — checkout link URL when issued)

# References created on issue
order_id                    UUID FK → orders (nullable, set on issue)
subscription_id             UUID FK → subscriptions (nullable, set on issue if recurring)

# Lifecycle timestamps
issued_at                   datetime (nullable)
completed_at                datetime (nullable)
voided_at                   datetime (nullable)

# Standard
created_at, updated_at, deleted_at
user_metadata               JSONB
```

#### `ManualInvoiceItem` model
```
Table: manual_invoice_items
────────────────────────────────────────────────────────
id                          UUID PK
manual_invoice_id           UUID FK → manual_invoices

# Line item details
label                       str (description)
product_id                  UUID FK → products (nullable — can be ad-hoc)
product_price_id            UUID FK → product_prices (nullable)
quantity                    int default 1
unit_amount                 int (amount in cents per unit)
amount                      int (quantity * unit_amount)
is_recurring                bool default false
recurring_interval          SubscriptionRecurringInterval (nullable)
recurring_interval_count    int (nullable)

# Ordering
sort_order                  int

created_at, updated_at
```

#### New Enums

```python
class ManualInvoiceStatus(StrEnum):
    draft = "draft"
    ready = "ready"         # All fields valid, ready to issue
    billed = "billed"       # Issued — Order created, awaiting payment
    completed = "completed" # Payment received
    voided = "voided"       # Cancelled before payment

class CollectionMethod(StrEnum):
    send_invoice = "send_invoice"     # Bank transfer / manual payment
    checkout_link = "checkout_link"   # Pay via Polar checkout
```

#### `OrderBillingReasonInternal` extension

```python
class OrderBillingReasonInternal(StrEnum):
    purchase = "purchase"
    subscription_create = "subscription_create"
    subscription_cycle = "subscription_cycle"
    subscription_cycle_after_trial = "subscription_cycle_after_trial"
    subscription_update = "subscription_update"
    manual_invoice = "manual_invoice"  # NEW
```

### 4.2 New Module: `server/polar/manual_invoice/`

```
manual_invoice/
├── __init__.py
├── endpoints.py        # CRUD + issue/void/complete actions
├── service.py          # Business logic
├── repository.py       # Database queries
├── schemas.py          # Pydantic models (create, update, issue, response)
├── tasks.py            # Background jobs (payment reconciliation, reminders)
└── sorting.py          # Sort options
```

#### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/manual-invoices/` | Create draft invoice |
| `GET` | `/v1/manual-invoices/` | List manual invoices (filter by status, customer, org) |
| `GET` | `/v1/manual-invoices/{id}` | Get manual invoice details |
| `PATCH` | `/v1/manual-invoices/{id}` | Update draft (items, customer, notes, due date) |
| `DELETE` | `/v1/manual-invoices/{id}` | Delete draft (only in draft status) |
| `POST` | `/v1/manual-invoices/{id}/ready` | Validate and mark as ready |
| `POST` | `/v1/manual-invoices/{id}/issue` | Issue invoice (→ billed) |
| `POST` | `/v1/manual-invoices/{id}/complete` | Mark payment received (→ completed) |
| `POST` | `/v1/manual-invoices/{id}/void` | Void invoice (→ voided) |

#### Key Service Methods

```python
class ManualInvoiceService:
    async def create(session, org, data) -> ManualInvoice
    async def update(session, invoice, data) -> ManualInvoice     # draft only
    async def mark_ready(session, invoice) -> ManualInvoice        # validate all fields
    async def issue(session, invoice) -> ManualInvoice             # create Order + optional Subscription
    async def complete(session, invoice) -> ManualInvoice          # mark payment received
    async def void(session, invoice) -> ManualInvoice              # cancel before payment
    async def handle_checkout_completed(session, invoice) -> None  # webhook callback
```

### 4.3 Subscription Provisioning Changes

**Current flow:** Checkout → payment → `create_or_update_from_checkout()` → Subscription + Order

**New flow for manual invoices with recurring items:**

```
ManualInvoice.issue()
    │
    ├─ Creates Subscription (status=active, payment_method=None)
    │   └─ collection_method stored on subscription (new field)
    │   └─ Benefits granted at issue time (not payment time)
    │
    ├─ Creates Order (status=pending, billing_reason=manual_invoice)
    │   └─ For checkout_link collection: generates checkout URL
    │   └─ For send_invoice collection: marks as awaiting manual payment
    │
    └─ Sends customer notification with payment instructions
```

**Subscription model changes needed:**
```python
# New field on Subscription model
collection_method: Mapped[str | None]  # "automatic" | "manual" | None (default=automatic)
```

**Renewal behavior for manual-collection subscriptions:**
```
subscription.cycle()
    │
    ├─ if collection_method == "manual":
    │   ├─ Create ManualInvoice (auto-generated, status=billed)
    │   ├─ Create Order (status=pending)
    │   ├─ Send invoice to customer
    │   └─ Do NOT attempt auto-charge
    │
    └─ if collection_method == "automatic" (existing flow):
        └─ Create Order → trigger_payment() → Stripe charge
```

### 4.4 Worker/Webhook Handling

#### New Dramatiq Tasks

```python
# manual_invoice/tasks.py

@actor("manual_invoice.issue")
async def issue_invoice(manual_invoice_id: UUID) -> None:
    """Create Order, optionally Subscription, send notification."""

@actor("manual_invoice.reconcile_checkout")
async def reconcile_checkout(manual_invoice_id: UUID, checkout_id: UUID) -> None:
    """Handle checkout completion for checkout_link collection."""

@actor("manual_invoice.send_reminder")
async def send_reminder(manual_invoice_id: UUID) -> None:
    """Send payment reminder for overdue invoices."""

@actor("manual_invoice.auto_cycle")
async def auto_cycle(subscription_id: UUID) -> None:
    """Generate next manual invoice for manual-collection subscription."""
```

#### New Webhook Events

```python
# webhook/webhooks.py additions
class WebhookEventType(StrEnum):
    ...
    manual_invoice_created = "manual_invoice.created"
    manual_invoice_updated = "manual_invoice.updated"
    manual_invoice_issued = "manual_invoice.issued"
    manual_invoice_completed = "manual_invoice.completed"
    manual_invoice_voided = "manual_invoice.voided"
```

---

## 5. Frontend / Backoffice Impact

### 5.1 Backoffice — HTMX + Tagflow (Primary UI for MVP)

#### New Pages

| Route | Description |
|-------|-------------|
| `/backoffice/manual-invoices/` | List all manual invoices with status filters |
| `/backoffice/manual-invoices/create` | Create new draft invoice |
| `/backoffice/manual-invoices/{id}` | Invoice detail with status timeline |
| `/backoffice/manual-invoices/{id}/edit` | Edit draft (items, customer, details) |

#### Draft Editor
- Customer selector (search existing customers or create inline)
- Line items table (add/remove/edit rows)
  - Product selector (optional — link to existing product/price, or ad-hoc)
  - Label, quantity, unit price
  - Recurring toggle (interval selector when enabled)
- Currency selector
- Due date picker
- Notes field (appears on PDF)
- Internal memo field
- Collection method selector (send_invoice vs checkout_link)

#### Issue Action
- Validation summary before issuing
- Confirmation dialog with impact summary:
  - "This will create an order for $X and a monthly subscription for Customer Y"
- Tax preview (if billing address provided)

#### Status Timeline
- Visual timeline component showing: `draft → ready → billed → completed`
- Each state shows timestamp and actor
- Links to related Order and Subscription when created

### 5.2 Customer Portal

- Customer sees issued invoices in their portal
- Payment link (for checkout_link collection)
- Invoice PDF download
- Bank transfer instructions (for send_invoice collection)

### 5.3 API Dashboard (Future — not MVP)

- Organization-facing manual invoice management
- React components in `clients/apps/web/`

---

## 6. Integration Approach

### Recommendation: Provider-agnostic model, Stripe-first implementation

The `ManualInvoice` model itself should be **payment-processor agnostic**:
- The `collection_method` field determines payment flow, not a processor field
- `checkout_link` collection uses the existing Polar checkout (which happens to use Stripe)
- `send_invoice` collection is inherently processor-agnostic (bank transfer, wire, etc.)

**No new payment processor abstraction needed for MVP.** The manual invoice layer sits *above* the payment processor:

```
ManualInvoice (processor-agnostic)
    │
    ├── send_invoice → Customer pays manually → Admin marks complete
    │
    └── checkout_link → Existing Checkout flow → Stripe processes payment
                                                → Webhook reconciles
```

This means:
- Zero changes to `PaymentProcessor` enum
- Zero changes to Stripe integration layer
- Checkout link reuses existing `Checkout` creation
- Future: adding Paddle/other processors only affects the checkout_link path

---

## 7. Risks & Mitigations

### 7.1 Async State Reconciliation

**Risk:** When using `checkout_link` collection, the checkout completion webhook must update both the ManualInvoice and the Order atomically.

**Mitigation:**
- The `ManualInvoice.order_id` FK creates a clear join point
- On checkout completion, the existing `create_from_checkout_one_time` or subscription flow creates the payment record
- A new `manual_invoice.reconcile_checkout` task listens for order payment and transitions ManualInvoice → completed
- Idempotency: reconciliation checks `manual_invoice.status` before transitioning

### 7.2 Entitlement Timing (Issue vs Paid)

**Risk:** For manual-collection subscriptions, should benefits be granted at issue time (before payment) or at payment time?

**Recommendation:** Make this configurable per invoice, default to **issue time**.

Rationale:
- Sales-assisted billing implies trust — the seller is choosing to extend service before payment
- Paddle grants entitlements at issue time for manually-collected transactions
- A `grant_benefits_at` field (`issue | payment`) on ManualInvoice provides flexibility
- For `checkout_link` collection, benefits are granted at payment (since it's near-instant)

**Mitigation for non-payment:**
- Overdue tracking with configurable reminder emails
- Void action revokes benefits
- `past_due` handling on subscription already has grace period logic we can reuse

### 7.3 Retry / Idempotency / Webhook Ordering

**Risk:** Multiple issue attempts, duplicate checkout completions, out-of-order webhooks.

**Mitigations:**
- **Issue idempotency:** `ManualInvoice.issued_at` is set atomically with status transition. Status guard prevents double-issue.
- **Checkout reconciliation:** Existing `ExternalEvent` deduplication handles Stripe webhook replays. ManualInvoice reconciliation checks current status before transitioning.
- **Ordering:** ManualInvoice status machine enforces valid transitions. Invalid transitions are logged and ignored (not errored).

### 7.4 Invoice Number Sequencing

**Risk:** Draft invoices shouldn't consume invoice numbers. But the number must be assigned at issue time, and the sequence must be gap-free per org/customer.

**Mitigation:** Invoice numbers are assigned during `issue()`, not during draft creation. The existing `organization_service.get_next_invoice_number()` is called at finalization time.

### 7.5 Tax Calculation Timing

**Risk:** Tax should be calculated at issue time (when billing address is known), not at draft time.

**Mitigation:** Draft stores raw amounts. `issue()` calls the existing tax calculation pipeline with the customer's billing address. Tax preview is available via a dedicated endpoint for the draft editor.

---

## 8. MVP Cut — Smallest Shippable Version

### MVP Scope (Phase 1 — ~3 weeks)

**What's in:**
- `ManualInvoice` + `ManualInvoiceItem` models + migration
- `OrderBillingReasonInternal.manual_invoice` enum value
- `POST/GET/PATCH/DELETE` CRUD endpoints for manual invoices
- `POST /issue` endpoint: creates Order (status=pending), assigns invoice number
- `POST /complete` endpoint: marks payment received, transitions Order → paid, grants benefits
- `POST /void` endpoint: cancels draft or billed invoice
- Backoffice: list, create draft, edit draft, issue, complete, void
- Invoice PDF generation for issued manual invoices (reuse existing `invoice/` module)
- `send_invoice` collection method only (no checkout link yet)
- One-time items only (no recurring/subscription creation)
- Webhook events for manual invoice lifecycle

**What's deferred:**
- `checkout_link` collection method
- Recurring line items → subscription creation
- Manual-collection subscription renewals
- Customer portal invoice view
- Payment reminders / overdue tracking
- API dashboard UI
- Tax preview in draft editor

### MVP Acceptance Criteria

1. Admin can create a draft invoice in backoffice with line items and customer
2. Admin can edit draft invoice (add/remove/modify items, change customer)
3. Admin can issue invoice → Order created with `pending` status + invoice number assigned
4. Admin can mark invoice as paid → Order transitions to `paid`, benefits granted
5. Admin can void an unpaid invoice → Order voided/cancelled
6. Invoice PDF can be generated and downloaded for issued invoices
7. Webhook events fire for each state transition
8. All CRUD operations available via API

---

## 9. Phased Implementation Plan

### Phase 1: MVP — Manual One-Time Invoices (3 weeks)

**Milestone:** Admin can create, edit, issue, complete, and void manual invoices via backoffice and API.

| Week | Deliverable | Acceptance Criteria |
|------|-------------|---------------------|
| 1 | Models + migration + CRUD endpoints | `ManualInvoice` and `ManualInvoiceItem` models created. CRUD API works. Unit tests pass. |
| 2 | Issue/complete/void service logic + Order creation | `issue()` creates Order. `complete()` marks paid + grants benefits. `void()` cancels. Integration tests pass. |
| 3 | Backoffice UI + webhook events + PDF generation | Full backoffice flow works end-to-end. Webhook events fire. Invoice PDF downloadable. |

### Phase 2: Checkout Link Collection (1.5 weeks)

**Milestone:** Issued invoices can include a checkout link for online payment, with automatic reconciliation.

| Deliverable | Acceptance Criteria |
|-------------|---------------------|
| `checkout_link` collection method | Issue creates a Checkout with pre-filled customer/amount. Checkout URL stored on ManualInvoice. |
| Automatic reconciliation | On checkout completion, ManualInvoice auto-transitions to `completed`. Order auto-transitions to `paid`. |
| Customer notification | Email sent with payment link on issue. |

### Phase 3: Recurring Items + Subscription Provisioning (2 weeks)

**Milestone:** Manual invoices can contain recurring line items. Issuing creates a Subscription with manual collection.

| Deliverable | Acceptance Criteria |
|-------------|---------------------|
| Recurring line items in draft editor | Items can be marked as recurring with interval config. |
| Subscription creation on issue | `issue()` creates Subscription (active, collection_method=manual). Benefits granted. |
| `Subscription.collection_method` field | New migration. Existing subscriptions default to "automatic". |
| Manual-collection subscription cycle | Renewal generates new ManualInvoice (billed) instead of auto-charging. |

### Phase 4: Polish + Customer Portal (1.5 weeks)

**Milestone:** Full customer-facing invoice experience and operational tooling.

| Deliverable | Acceptance Criteria |
|-------------|---------------------|
| Customer portal invoice list | Customers see issued invoices with payment status. |
| Payment reminders | Configurable reminder emails for overdue invoices. |
| Overdue tracking | Backoffice shows overdue invoices with aging. |
| Tax preview in draft editor | Preview tax calculation before issuing. |

---

## 10. Open Questions

1. **Should manually-collected subscriptions downgrade/revoke on non-payment?** If so, what's the grace period? Reuse existing `benefit_revocation_grace_period` from org settings?

2. **Should we support partial payments?** E.g., customer pays 50% now, 50% later. MVP says no — full payment or nothing.

3. **Who can create manual invoices?** Only backoffice admins? Or also organization members via API? MVP: backoffice + API (with org ownership auth).

4. **Should voiding an issued invoice create a credit note / negative Order?** MVP says no — void simply cancels. Proper credit notes are a future feature.

5. **What email template for invoice notifications?** New template needed with payment instructions (bank transfer details are org-specific configuration).
