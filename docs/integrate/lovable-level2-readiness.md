# Spaire Level 2 (Lovable) Integration Review

## Executive Verdict

**Readiness score: 5/10.**

Current Spaire APIs are functionally close, but not yet cleanly shaped for external app-builder integrations. The major blockers are boundary clarity, SDK-first ergonomics, and public hardening of auth/idempotency/webhook contracts.

## 1. Repository Scan Findings

### Billing-related endpoints

- Checkout sessions are exposed on `/v1/checkouts` with create/update/get/list and client-secret flows (`/client/*`).
- Subscriptions are exposed on `/v1/subscriptions` with list/get/create/update/revoke.
- Customer sessions (used to access customer portal) are exposed on `/v1/customer-sessions`.
- Webhook endpoint management exists under `/v1/webhooks/endpoints` and `/v1/webhooks/deliveries`.

### Subscription models

- `Subscription` stores status lifecycle, billing periods, cancellation fields, linked product/customer/payment method, and grants relationship.
- Status enum includes `trialing`, `active`, `past_due`, `canceled`, etc.

### Entitlement logic

- Entitlements are represented through **benefit grants** and surfaced in `CustomerState` as `granted_benefits` plus `active_subscriptions` and `active_meters`.
- `GET /v1/customers/{id}/state` and `/v1/customers/external/{external_id}/state` are the closest current “entitlements API”.

### Webhook handling

- Outbound merchant webhooks are configured via webhook endpoints and delivered asynchronously.
- Payloads are signed with `webhook-id`, `webhook-timestamp`, and `webhook-signature` using Standard Webhooks signing.
- Incoming Stripe webhooks are handled in `/v1/integrations/stripe/webhook*` and enqueued into external event processing.

### Authentication model

- Auth supports users, organizations, customers, members, and anonymous subjects.
- Token resolution order is: bearer token classes (member session, customer session, organization access token, OAuth2 token, PAT) then cookie user session, else anonymous.
- Endpoint access is scope-driven with `Authenticator` dependencies.

### Stripe abstraction layer

- Stripe is integrated in `polar/integrations/stripe/*` with service/tasks/endpoints.
- Checkout and customer portal services call into Stripe service modules rather than direct endpoint-level Stripe logic.

### Public vs internal APIs

- All main APIs are mounted under `/v1`; legacy `/api/v1` is rewritten.
- Visibility is tag-driven (`APITag.public`, `APITag.private`) and private endpoints are hidden from schema outside development.
- Backoffice has a separate mounted app at `/backoffice`, but core `/v1` still mixes external-facing and dashboard-oriented operations.

### API documentation state

- OpenAPI generation is centralized and wired for Speakeasy metadata/grouping.
- Docs are present in `docs/api-reference/*`, but “public” currently means broad platform API, not a minimal integration-safe billing surface.

## 2. Suitability for External SDK Integration

### What is good already

- You already have composable primitives needed for Level 2:
  - checkout creation,
  - customer state/subscription lookup,
  - sessionized customer portal access,
  - outbound webhooks,
  - granular scoped tokens.
- OpenAPI + Speakeasy conventions make SDK generation realistic.

### Why this is not yet “public billing API clean”

- Current endpoints are object-rich and Polar-native; they are not optimized around the simple developer jobs Lovable apps need.
- Entitlements are discoverable but indirectly modeled (`customer state`, `benefit grants`) and not packaged as a stable “billing status contract”.
- Authentication is powerful but too flexible for no-code/AI-generated app adoption without opinionated defaults.

## 3. Tight Coupling and Break Risks

### Tight coupling to internal/admin assumptions

1. **Scope complexity leaks into integrator UX**
   - Existing scopes are broad and numerous. Lovable integrations need 3–5 simple scopes or role presets.

2. **Portal access is session-token centric, not link-contract centric**
   - Current customer portal access depends on creating customer/member sessions and handling those tokens.

3. **Entity-first API shape over task-first API shape**
   - Integrators want “create checkout for external_customer_id and return URL”. Existing schemas expose many optional internal toggles.

4. **Entitlements are tied to internal benefit model vocabulary**
   - External apps need yes/no + feature map; today they must interpret grants, products, and meters.

### Assumptions likely to break external integration

- Assuming integrators can safely store and route bearer tokens for customer/member sessions.
- Assuming every client can reason about product/price/discount internals.
- Assuming webhook consumers will correctly implement Standard Webhooks verification without SDK helpers.

### Missing public-safe endpoints

- Missing direct `GET /v1/customers/{id}/subscription` shortcut.
- Missing direct `GET /v1/entitlements/{customer_id}` normalized contract.
- Missing opinionated `GET /v1/customer-portal` session-to-URL endpoint for backend-only usage.

### Security risks if exposed as-is

- Over-broad tokens could be used by client-side code if integrators misunderstand backend-only usage.
- Current endpoint set allows many write operations unrelated to billing for external apps if token scopes are too permissive.
- No explicit, documented idempotency contract on “public billing” checkout create path can lead to duplicate billing attempts in retry-heavy environments.

## 4. Minimal Spaire Public Billing API (Level 2)

Create a dedicated surface: **`/v1/public/billing/*` now**, aliasable to `/v1/*` later if desired.

### Authentication

- Use **Organization-scoped API keys** (server-side only), mapped to a fixed scope set:
  - `billing:checkout:write`
  - `billing:subscription:read`
  - `billing:portal:write`
  - `billing:entitlements:read`
  - `billing:webhook:read`
- Key format: `spaire_pk_live_...` / `spaire_pk_test_...`.
- Header: `Authorization: Bearer <key>`.
- Reject from browser origins unless explicitly configured for public key mode later.

### Idempotency

- Required for POST create operations.
- Header: `Idempotency-Key` (max 255 chars).
- Scope: per organization + method + path + semantic target (`external_customer_id` + product/price).
- Response headers:
  - `Idempotency-Replayed: true|false`
  - `Idempotency-Key: <value>`

### Error format

```json
{
  "error": {
    "type": "invalid_request",
    "code": "missing_required_field",
    "message": "external_customer_id is required",
    "request_id": "req_123",
    "details": [{"field": "external_customer_id", "message": "Required"}]
  }
}
```

Error `type` examples: `invalid_request`, `authentication_error`, `authorization_error`, `not_found`, `conflict`, `rate_limited`, `internal_error`.

### Endpoint contracts

#### `POST /v1/checkout/sessions`

Request:

```json
{
  "customer": {
    "external_customer_id": "cus_42",
    "email": "alice@example.com",
    "name": "Alice"
  },
  "line_items": [
    {
      "product_id": "prod_x",
      "price_id": "price_monthly"
    }
  ],
  "success_url": "https://app.example.com/billing/success",
  "cancel_url": "https://app.example.com/billing/cancel",
  "metadata": {"workspace_id": "w_123"}
}
```

Response:

```json
{
  "id": "chk_123",
  "status": "open",
  "url": "https://checkout.spairehq.com/c/chk_123",
  "expires_at": "2026-01-01T00:00:00Z"
}
```

#### `GET /v1/subscriptions/{id}`

Response:

```json
{
  "id": "sub_123",
  "status": "active",
  "customer_id": "cus_123",
  "external_customer_id": "cus_ext_42",
  "product_id": "prod_x",
  "current_period_start": "2026-01-01T00:00:00Z",
  "current_period_end": "2026-02-01T00:00:00Z",
  "cancel_at_period_end": false
}
```

#### `GET /v1/customers/{id}/subscription`

- Returns primary active/trialing subscription for customer (or `null` object with 200 if none).

#### `GET /v1/customer-portal`

Query params:
- `customer_id` or `external_customer_id` (one required)
- `return_url` optional

Response:

```json
{
  "url": "https://spairehq.com/org/acme/portal?token=...",
  "expires_at": "2026-01-01T01:00:00Z"
}
```

#### `POST /v1/webhooks/spaire`

- This is an inbound endpoint example for Lovable apps (consumer side). In Spaire docs, define event envelope + verification helper, not necessarily host this route in Spaire core.

Event envelope:

```json
{
  "id": "evt_123",
  "type": "subscription.updated",
  "created_at": "2026-01-01T00:00:00Z",
  "data": {"subscription_id": "sub_123", "status": "active"}
}
```

Signature headers:
- `webhook-id`
- `webhook-timestamp`
- `webhook-signature`

Verification:
- HMAC/Standard Webhooks verification with replay window (5 min default).

#### `GET /v1/entitlements/{customer_id}`

Response:

```json
{
  "customer_id": "cus_123",
  "active": true,
  "entitlements": {
    "pro": true,
    "seats": 5,
    "meter.api_calls.remaining": 1200
  },
  "source": {
    "subscription_ids": ["sub_123"],
    "benefit_grant_ids": ["bg_123"]
  },
  "checked_at": "2026-01-01T00:00:00Z"
}
```

## 5. Internal vs Public API Separation Plan

### Router separation

- Keep existing modules intact.
- Add `server/polar/public_billing/` with:
  - `endpoints.py`
  - `schemas.py`
  - `service.py`
  - `auth.py`
- Mount with explicit group/tag:
  - `router.include_router(public_billing_router)` in `server/polar/api.py`.

### Service isolation

- Public billing services should call domain services (`checkout_service`, `subscription_service`, `customer_session_service`, `customer_service`) but return a reduced stable schema.
- Do not leak internal schemas directly from public billing endpoints.

### Folder and boundary conventions

- Internal dashboard/admin keeps current modules.
- Public billing module owns:
  - DTO translation layer,
  - idempotency policy,
  - webhook docs/examples for external consumers,
  - stricter auth policy.

## 6. Minimal `@spaire/sdk` (Node/TypeScript)

### Suggested structure

```text
sdk/spaire-js/
  src/
    client.ts
    types.ts
    errors.ts
    resources/
      checkout.ts
      subscriptions.ts
      portal.ts
      entitlements.ts
      webhooks.ts
    index.ts
```

### Public API

- `createCheckout(input)`
- `getSubscription(id)`
- `getCustomerPortal(params)`
- `verifyWebhook({headers, rawBody, secret})`
- `getEntitlements(customerId)`

### Example usage

```ts
import { Spaire } from "@spaire/sdk";

const spaire = new Spaire({
  apiKey: process.env.SPAIRE_API_KEY!,
});

const checkout = await spaire.createCheckout({
  customer: { externalCustomerId: "cus_42", email: "alice@example.com" },
  lineItems: [{ productId: "prod_x", priceId: "price_monthly" }],
  successUrl: "https://app.example.com/billing/success",
  cancelUrl: "https://app.example.com/billing/cancel",
});
```

## 7. Minimal Lovable App Integration (Level 2)

### Flow

1. User logs in to Lovable app.
2. Backend resolves app user -> `external_customer_id`.
3. “Upgrade” button calls backend route that invokes `createCheckout()`.
4. Frontend redirects to returned checkout URL.
5. After checkout success, frontend hits backend `/api/billing/status`.
6. Backend checks `getEntitlements(customerId)` and gates features.
7. Webhook receiver updates local entitlement cache on `subscription.*` / `customer_state_changed`.

### Minimal backend endpoints in Lovable app

- `POST /api/billing/checkout`
- `GET /api/billing/entitlements`
- `POST /api/billing/webhook` (raw body + signature verification)

## 8. Production Blockers to Reach 8+/10

1. **No dedicated public billing namespace and reduced schemas**.
2. **No explicit idempotency contract on checkout create for external retries**.
3. **Entitlements not exposed as first-class normalized response**.
4. **Token model too broad for no-code ecosystem without opinionated API-key presets**.
5. **Public docs still endpoint-complete rather than integration-opinionated quickstart**.
6. **No official `@spaire/sdk` package with webhook verification helper and typed errors**.

## 9. Recommended next implementation sequence

1. Add `public_billing` module with the six Level 2 endpoints.
2. Introduce API-key auth preset and scope minimization.
3. Implement idempotency middleware/service for POST endpoints.
4. Add normalized entitlements adapter over customer state + benefit grants.
5. Ship `@spaire/sdk` with verifyWebhook utility.
6. Publish a Lovable-focused quickstart with copy/paste templates.
