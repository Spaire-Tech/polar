# Incorporation Feature — Implementation Plan

## US Company Formation via FileForms API

**Author:** Staff Engineering
**Date:** 2026-03-06
**Status:** Design Proposal

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Repository Analysis](#2-repository-analysis)
3. [Module Structure](#3-module-structure)
4. [FileForms API Lifecycle](#4-fileforms-api-lifecycle)
5. [Internal API Design](#5-internal-api-design)
6. [Database Schema](#6-database-schema)
7. [Checkout Integration](#7-checkout-integration)
8. [Provider Client](#8-provider-client)
9. [Webhook Handling](#9-webhook-handling)
10. [Document Storage](#10-document-storage)
11. [Frontend UX Plan](#11-frontend-ux-plan)
12. [Migration Strategy](#12-migration-strategy)
13. [Implementation Phases](#13-implementation-phases)
14. [Risk Analysis](#14-risk-analysis)
15. [Engineering Effort](#15-engineering-effort)

---

## 1. Executive Summary

This plan introduces a **US company formation feature** into the Spaire platform, allowing founders to incorporate directly from the Spaire dashboard. The integration uses **FileForms** as the backend fulfillment provider while Spaire owns the entire UX and payment flow.

**End-to-end flow:**

```
Founder opens dashboard
  → Starts incorporation wizard
  → Fills multi-step form (entity type, details, founders, ownership)
  → Pays via Spaire Checkout
  → Spaire submits formation to FileForms
  → FileForms files with state
  → Webhook updates status in real-time
  → Formation documents stored in Spaire S3
  → Founder downloads documents from Spaire dashboard
```

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    Spaire Dashboard (Next.js)                │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │ Incorp.     │  │ Spaire       │  │ Document            │ │
│  │ Wizard      │──│ Checkout     │  │ Viewer              │ │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼─────────────────────┼────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌──────────────────────────────────────────────────────────────┐
│                  Spaire API (FastAPI)                         │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │             polar/incorporation/                        │ │
│  │                                                         │ │
│  │  endpoints.py ──► service.py ──► repository.py          │ │
│  │                      │                                  │ │
│  │                      ▼                                  │ │
│  │               provider_client.py                        │ │
│  │                      │                                  │ │
│  │                      ▼                                  │ │
│  │              tasks.py (Dramatiq)                         │ │
│  └──────────┬───────────┼──────────────────────────────────┘ │
│             │           │                                    │
│        ┌────▼───┐  ┌────▼────┐  ┌───────────────┐           │
│        │Postgres│  │  Redis  │  │  S3 / Minio   │           │
│        └────────┘  └─────────┘  └───────────────┘           │
└──────────────────────────┼───────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │    FileForms API       │
              │                        │
              │  POST /users           │
              │  POST /companies       │
              │  POST /orders          │
              │  GET  /documents/{id}  │
              │                        │
              │  Webhooks ──────────►  │
              │  filing.status_changed │
              │  document.uploaded     │
              └────────────────────────┘
```

---

## 2. Repository Analysis

### Current Structure

The Spaire backend (`server/polar/`) contains **59 modules**, each following a consistent pattern:

```
polar/{module}/
├── __init__.py
├── auth.py           # Authenticator dependencies
├── endpoints.py      # FastAPI router
├── service.py        # Business logic (singleton)
├── repository.py     # SQLAlchemy queries
├── schemas.py        # Pydantic models
├── tasks.py          # Dramatiq background jobs
└── sorting.py        # Sort enums
```

### Relevant Existing Modules

| Module | Relevance |
|--------|-----------|
| `checkout/` | Payment flow — we'll trigger checkout before formation |
| `order/` | Order creation post-payment — pattern reference |
| `file/` | S3 file storage — we'll store formation documents here |
| `organization/` | Org context — incorporations are org-scoped |
| `integrations/stripe/` | External API integration pattern reference |
| `webhook/` | Webhook delivery infra — pattern reference for inbound webhooks |
| `integrations/chargeback_stop/` | Inbound webhook handling pattern reference |

### Decision: New Top-Level Module

The incorporation feature should be a **new top-level module** at `server/polar/incorporation/`. Rationale:

1. **Distinct domain** — incorporation is a separate business process, not a sub-feature of billing or checkout.
2. **Clean boundaries** — it has its own lifecycle (draft → payment → filing → completion), separate from subscriptions or orders.
3. **External provider** — FileForms integration is self-contained, similar to how Stripe lives under `integrations/`.
4. **Follows convention** — other domain features (checkout, subscription, order) each have their own module.

The FileForms client abstraction should live **inside** the incorporation module as `provider_client.py`, not under `integrations/`, because:
- It's specific to incorporation (unlike Stripe which is cross-cutting)
- Keeps the module self-contained
- Follows the principle of locality

---

## 3. Module Structure

### `server/polar/incorporation/`

```
polar/incorporation/
├── __init__.py              # Module initialization
├── auth.py                  # Auth dependencies (IncorporationsRead, IncorporationsWrite)
├── endpoints.py             # FastAPI routes: /v1/incorporations
├── service.py               # Business logic (IncorporationService singleton)
├── repository.py            # Database queries (IncorporationRepository, IncorporationDocumentRepository)
├── schemas.py               # Pydantic request/response models
├── tasks.py                 # Background jobs (submit_to_fileforms, download_document, etc.)
├── sorting.py               # Sort property enum
├── provider_client.py       # FileForms API client abstraction
└── webhook_endpoints.py     # POST /webhooks/fileforms handler
```

### File Responsibilities

| File | Purpose |
|------|---------|
| `auth.py` | Defines `IncorporationsRead` and `IncorporationsWrite` auth dependencies. Incorporations are scoped to organizations and only accessible by organization members. |
| `endpoints.py` | REST API routes for creating, reading, and managing incorporations. Mounts on `/v1/incorporations`. |
| `service.py` | Core orchestration: creates incorporations, triggers checkout, coordinates with FileForms after payment, handles status updates. Singleton instance: `incorporation = IncorporationService()`. |
| `repository.py` | SQLAlchemy queries for `Incorporation` and `IncorporationDocument` models. Auth-aware via `get_readable_statement()`. Extends `RepositoryBase`, `RepositorySoftDeletionMixin`. |
| `schemas.py` | Pydantic models for all API input/output. `IncorporationCreate`, `IncorporationRead`, `IncorporationUpdate`, `IncorporationDocumentRead`. |
| `tasks.py` | Dramatiq actors: `incorporation.submit_to_fileforms`, `incorporation.download_document`, `incorporation.sync_status`. |
| `sorting.py` | `IncorporationSortProperty` enum (e.g., `created_at`, `status`, `company_name`). |
| `provider_client.py` | Async HTTP client wrapping FileForms API. Handles auth, retries, error mapping. Never exposed to frontend. |
| `webhook_endpoints.py` | Separate router for `POST /webhooks/fileforms`. Validates webhook signatures, dispatches to service. |

---

## 4. FileForms API Lifecycle

### Sequence Diagram

```
Spaire Dashboard          Spaire API                FileForms
     │                        │                         │
     │  1. Create draft       │                         │
     │───────────────────────►│                         │
     │  POST /incorporations  │                         │
     │◄───────────────────────│                         │
     │  {id, status: draft}   │                         │
     │                        │                         │
     │  2. Checkout           │                         │
     │───────────────────────►│                         │
     │  POST /checkouts       │                         │
     │  (Stripe payment)      │                         │
     │◄───────────────────────│                         │
     │  {payment confirmed}   │                         │
     │                        │                         │
     │                        │  3. Create user         │
     │                        │────────────────────────►│
     │                        │  POST /users            │
     │                        │◄────────────────────────│
     │                        │  {fileforms_user_id}    │
     │                        │                         │
     │                        │  4. Create company      │
     │                        │────────────────────────►│
     │                        │  POST /companies        │
     │                        │◄────────────────────────│
     │                        │  {fileforms_company_id} │
     │                        │                         │
     │                        │  5. Create order        │
     │                        │────────────────────────►│
     │                        │  POST /orders           │
     │                        │◄────────────────────────│
     │                        │  {fileforms_order_id}   │
     │                        │                         │
     │                        │  6. Webhook: status     │
     │                        │◄────────────────────────│
     │                        │  filing.status_changed  │
     │                        │  (processing/completed) │
     │                        │                         │
     │                        │  7. Webhook: document   │
     │                        │◄────────────────────────│
     │                        │  document.uploaded      │
     │                        │                         │
     │                        │  8. Download document   │
     │                        │────────────────────────►│
     │                        │  GET /documents/{id}    │
     │                        │◄────────────────────────│
     │                        │  {binary content}       │
     │                        │                         │
     │                        │  9. Store in S3         │
     │                        │──────► S3               │
     │                        │                         │
     │  10. View documents    │                         │
     │───────────────────────►│                         │
     │  GET /incorporations/  │                         │
     │       {id}/documents   │                         │
     │◄───────────────────────│                         │
     │  [{document list}]     │                         │
```

### Service Lifecycle Methods

```python
# polar/incorporation/service.py

class IncorporationService:

    async def create_draft(self, session, auth_subject, create_schema):
        """Step 1: Create local draft incorporation record."""

    async def initiate_checkout(self, session, auth_subject, incorporation_id):
        """Step 2: Create Spaire checkout for incorporation fee."""

    async def on_payment_confirmed(self, session, incorporation_id):
        """Step 3: Called when checkout succeeds. Enqueues FileForms submission."""

    async def submit_to_fileforms(self, session, incorporation_id):
        """Steps 3-5 (background task): Create FileForms user → company → order."""

    async def handle_status_change(self, session, fileforms_order_id, new_status):
        """Step 6: Handle filing.status_changed webhook."""

    async def handle_document_uploaded(self, session, fileforms_document_id, metadata):
        """Step 7: Handle document.uploaded webhook. Enqueues download."""

    async def download_and_store_document(self, session, incorporation_id, document_id):
        """Steps 8-9 (background task): Download from FileForms, upload to S3."""
```

---

## 5. Internal API Design

### Endpoints

All endpoints are organization-scoped and require authenticated users who are members of the organization.

#### `POST /v1/incorporations`

Create a new draft incorporation.

**Request:**
```json
{
  "organization_id": "uuid",
  "entity_type": "llc",
  "state": "DE",
  "company_name": "Acme Inc.",
  "company_name_alt_1": "Acme LLC",
  "company_name_alt_2": "Acme Holdings LLC",
  "registered_agent": "standard",
  "management_type": "member_managed",
  "business_purpose": "Software development and consulting",
  "founders": [
    {
      "first_name": "Jane",
      "last_name": "Doe",
      "email": "jane@example.com",
      "title": "CEO",
      "ownership_percentage": 60,
      "address": {
        "line1": "123 Main St",
        "city": "San Francisco",
        "state": "CA",
        "postal_code": "94105",
        "country": "US"
      }
    }
  ],
  "principal_address": {
    "line1": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "postal_code": "94105",
    "country": "US"
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "organization_id": "uuid",
  "entity_type": "llc",
  "state": "DE",
  "company_name": "Acme Inc.",
  "status": "draft",
  "created_at": "2026-03-06T00:00:00Z",
  "modified_at": null
}
```

#### `GET /v1/incorporations`

List incorporations for the authenticated organization.

**Query params:** `organization_id` (required), `page`, `limit`, `sorting`

**Response:** `200 OK` — `ListResource[Incorporation]`

#### `GET /v1/incorporations/{id}`

Get a single incorporation with full details.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "organization_id": "uuid",
  "entity_type": "llc",
  "state": "DE",
  "company_name": "Acme Inc.",
  "company_name_alt_1": "Acme LLC",
  "company_name_alt_2": null,
  "management_type": "member_managed",
  "business_purpose": "Software development and consulting",
  "registered_agent": "standard",
  "status": "processing",
  "status_detail": "Filing submitted to Delaware Division of Corporations",
  "founders": [...],
  "principal_address": {...},
  "checkout_id": "uuid",
  "fileforms_order_id": "ff_ord_abc123",
  "filed_at": null,
  "created_at": "2026-03-06T00:00:00Z",
  "modified_at": "2026-03-06T01:00:00Z"
}
```

#### `PATCH /v1/incorporations/{id}`

Update a draft incorporation (only allowed in `draft` status).

**Request:** Partial update of any field from `IncorporationCreate`.

**Response:** `200 OK` — Updated `Incorporation`

#### `GET /v1/incorporations/{id}/documents`

List documents for an incorporation.

**Response:** `200 OK`
```json
{
  "items": [
    {
      "id": "uuid",
      "incorporation_id": "uuid",
      "document_type": "articles_of_organization",
      "file_name": "Articles_of_Organization_Acme_LLC.pdf",
      "file_path": "incorporations/uuid/articles_of_organization.pdf",
      "provider_document_id": "ff_doc_xyz789",
      "download_url": "https://...",
      "created_at": "2026-03-07T00:00:00Z"
    }
  ],
  "pagination": { "page": 1, "total_count": 1 }
}
```

#### `POST /v1/incorporations/{id}/checkout`

Initiate checkout for a draft incorporation.

**Response:** `201 Created`
```json
{
  "checkout_url": "https://checkout.spairehq.com/...",
  "checkout_id": "uuid"
}
```

### Error Responses

| Status | Error | When |
|--------|-------|------|
| 404 | `ResourceNotFound` | Incorporation not found or not accessible |
| 422 | `ValidationError` | Invalid input data |
| 409 | `IncorporationNotDraft` | Attempt to update non-draft incorporation |
| 409 | `IncorporationAlreadySubmitted` | Duplicate submission attempt |
| 502 | `FileFormsError` | FileForms API failure (background tasks retry) |

---

## 6. Database Schema

### `incorporations` Table

```sql
CREATE TABLE incorporations (
    -- Identity
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    modified_at             TIMESTAMPTZ,
    deleted_at              TIMESTAMPTZ,

    -- Ownership
    organization_id         UUID NOT NULL REFERENCES organizations(id),

    -- Company details
    entity_type             VARCHAR(20) NOT NULL,      -- 'llc', 'c_corp', 's_corp'
    state                   VARCHAR(2) NOT NULL,        -- US state code: 'DE', 'WY', etc.
    company_name            VARCHAR(255) NOT NULL,
    company_name_alt_1      VARCHAR(255),
    company_name_alt_2      VARCHAR(255),
    management_type         VARCHAR(30),                -- 'member_managed', 'manager_managed'
    business_purpose        TEXT,
    registered_agent        VARCHAR(20) DEFAULT 'standard',

    -- Founder/ownership data (stored as JSONB)
    founders                JSONB NOT NULL DEFAULT '[]',
    principal_address       JSONB,

    -- Payment
    checkout_id             UUID REFERENCES checkouts(id),

    -- FileForms provider IDs
    fileforms_user_id       VARCHAR(255),
    fileforms_company_id    VARCHAR(255),
    fileforms_order_id      VARCHAR(255),

    -- Status tracking
    status                  VARCHAR(20) NOT NULL DEFAULT 'draft',
    status_detail           TEXT,
    filed_at                TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    rejected_reason         TEXT
);

-- Indexes
CREATE INDEX ix_incorporations_organization_id ON incorporations(organization_id);
CREATE INDEX ix_incorporations_status ON incorporations(status);
CREATE INDEX ix_incorporations_fileforms_order_id ON incorporations(fileforms_order_id);
CREATE INDEX ix_incorporations_created_at ON incorporations(created_at);
CREATE INDEX ix_incorporations_deleted_at ON incorporations(deleted_at);
```

### `incorporation_documents` Table

```sql
CREATE TABLE incorporation_documents (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    modified_at             TIMESTAMPTZ,
    deleted_at              TIMESTAMPTZ,

    -- Parent
    incorporation_id        UUID NOT NULL REFERENCES incorporations(id),

    -- Document metadata
    document_type           VARCHAR(50) NOT NULL,
    file_name               VARCHAR(255) NOT NULL,

    -- S3 storage
    s3_bucket               VARCHAR(255) NOT NULL,
    s3_key                  VARCHAR(512) NOT NULL,
    file_size_bytes         BIGINT,
    mime_type               VARCHAR(100) DEFAULT 'application/pdf',

    -- Provider reference
    provider_document_id    VARCHAR(255) NOT NULL
);

-- Indexes
CREATE INDEX ix_incorporation_documents_incorporation_id ON incorporation_documents(incorporation_id);
CREATE INDEX ix_incorporation_documents_provider_document_id ON incorporation_documents(provider_document_id);
CREATE INDEX ix_incorporation_documents_created_at ON incorporation_documents(created_at);
CREATE INDEX ix_incorporation_documents_deleted_at ON incorporation_documents(deleted_at);
```

### Status Enum

```python
class IncorporationStatus(StrEnum):
    draft = "draft"                     # Initial state, form being filled
    pending_payment = "pending_payment" # Checkout created, awaiting payment
    submitted = "submitted"             # Paid, submitted to FileForms
    processing = "processing"           # FileForms has accepted, filing in progress
    completed = "completed"             # Formation complete, documents available
    failed = "failed"                   # Filing rejected or error
    cancelled = "cancelled"             # User cancelled before submission
```

### Entity Type Enum

```python
class EntityType(StrEnum):
    llc = "llc"
    c_corp = "c_corp"
    s_corp = "s_corp"
```

### SQLAlchemy Model

```python
# polar/models/incorporation.py

class Incorporation(RecordModel):
    __tablename__ = "incorporations"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )
    entity_type: Mapped[str] = mapped_column(String(20), nullable=False)
    state: Mapped[str] = mapped_column(String(2), nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_name_alt_1: Mapped[str | None] = mapped_column(String(255))
    company_name_alt_2: Mapped[str | None] = mapped_column(String(255))
    management_type: Mapped[str | None] = mapped_column(String(30))
    business_purpose: Mapped[str | None] = mapped_column(Text)
    registered_agent: Mapped[str] = mapped_column(String(20), default="standard")
    founders: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)
    principal_address: Mapped[dict | None] = mapped_column(JSONB)
    checkout_id: Mapped[UUID | None] = mapped_column(Uuid, ForeignKey("checkouts.id"))
    fileforms_user_id: Mapped[str | None] = mapped_column(String(255))
    fileforms_company_id: Mapped[str | None] = mapped_column(String(255))
    fileforms_order_id: Mapped[str | None] = mapped_column(String(255), index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", index=True)
    status_detail: Mapped[str | None] = mapped_column(Text)
    filed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    rejected_reason: Mapped[str | None] = mapped_column(Text)

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", lazy="raise")
    documents: Mapped[list["IncorporationDocument"]] = relationship(
        "IncorporationDocument", lazy="raise", back_populates="incorporation"
    )


class IncorporationDocument(RecordModel):
    __tablename__ = "incorporation_documents"

    incorporation_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("incorporations.id"), nullable=False, index=True
    )
    document_type: Mapped[str] = mapped_column(String(50), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    s3_bucket: Mapped[str] = mapped_column(String(255), nullable=False)
    s3_key: Mapped[str] = mapped_column(String(512), nullable=False)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    mime_type: Mapped[str] = mapped_column(String(100), default="application/pdf")
    provider_document_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Relationships
    incorporation: Mapped["Incorporation"] = relationship(
        "Incorporation", lazy="raise", back_populates="documents"
    )
```

---

## 7. Checkout Integration

### Flow

The incorporation checkout follows the existing Spaire checkout pattern but is triggered for a **fixed-price service product**, not a recurring subscription.

```
┌─────────┐     ┌──────────────┐     ┌──────────┐     ┌──────────────┐
│  Draft   │────►│ Create       │────►│ Payment  │────►│ Submit to    │
│  Incorp. │     │ Checkout     │     │ Confirmed│     │ FileForms    │
└─────────┘     └──────────────┘     └──────────┘     └──────────────┘
                                          │
                                    Stripe webhook
                                    triggers callback
```

### Implementation

**Step 1: Pre-create a "Company Formation" product in Spaire**

A one-time product should be created in the Spaire product catalog for each formation package (e.g., "LLC Formation — Delaware" at $399). This can be seeded via a data migration or created via the admin backoffice.

**Step 2: Trigger checkout from incorporation**

```python
# polar/incorporation/service.py

async def initiate_checkout(
    self,
    session: AsyncSession,
    auth_subject: AuthSubject[User],
    incorporation_id: UUID,
) -> Checkout:
    repository = IncorporationRepository.from_session(session)
    incorporation = await repository.get_by_id_and_org(
        incorporation_id, auth_subject
    )

    if incorporation is None:
        raise ResourceNotFound()
    if incorporation.status != IncorporationStatus.draft:
        raise IncorporationNotDraft(incorporation_id)

    # Look up the formation product for this entity_type + state
    product = await self._get_formation_product(
        session, incorporation.entity_type, incorporation.state
    )

    # Create a Spaire checkout session
    checkout = await checkout_service.create(
        session,
        auth_subject,
        CheckoutCreate(
            product_id=product.id,
            metadata={"incorporation_id": str(incorporation_id)},
        ),
    )

    # Update incorporation status
    incorporation.status = IncorporationStatus.pending_payment
    incorporation.checkout_id = checkout.id
    await repository.update(incorporation)

    return checkout
```

**Step 3: Handle payment confirmation**

The existing checkout/order flow in Spaire fires events when payment succeeds. We hook into this via a background task:

```python
# polar/incorporation/tasks.py

@actor(actor_name="incorporation.payment_confirmed", priority=TaskPriority.HIGH)
async def payment_confirmed(incorporation_id: UUID) -> None:
    async with AsyncSessionMaker() as session:
        service = IncorporationService()
        await service.submit_to_fileforms(session, incorporation_id)
```

**Where this orchestration lives:** The `IncorporationService.on_payment_confirmed()` method is called from the checkout/order payment success handler. We add a small hook in the order creation flow that checks if the checkout has `incorporation_id` metadata, and if so, enqueues the `incorporation.payment_confirmed` task.

### Minimal Touchpoint to Existing Code

The only change to existing code is a **single hook** in the order service's post-payment logic:

```python
# In the existing order service, after successful payment:
if checkout.metadata and "incorporation_id" in checkout.metadata:
    enqueue_job(
        "incorporation.payment_confirmed",
        incorporation_id=UUID(checkout.metadata["incorporation_id"]),
    )
```

This is a ~3-line addition to the existing order flow — surgical, not disruptive.

---

## 8. Provider Client

### `polar/incorporation/provider_client.py`

The provider client is an async HTTP client that wraps the FileForms REST API. It handles authentication, serialization, error handling, and retries.

```python
import httpx
import structlog
from polar.config import settings

log = structlog.get_logger()


class FileFormsError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail


class FileFormsClient:
    """Async client for the FileForms company formation API."""

    def __init__(self) -> None:
        self.base_url = settings.FILEFORMS_API_URL
        self.api_key = settings.FILEFORMS_API_KEY

    def _get_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _request(
        self, method: str, path: str, **kwargs
    ) -> dict:
        async with httpx.AsyncClient(
            base_url=self.base_url,
            headers=self._get_headers(),
            timeout=30.0,
        ) as client:
            response = await client.request(method, path, **kwargs)
            if response.status_code >= 400:
                raise FileFormsError(
                    status_code=response.status_code,
                    detail=response.text,
                )
            return response.json()

    async def create_user(
        self,
        *,
        email: str,
        first_name: str,
        last_name: str,
    ) -> dict:
        """Create a FileForms user account."""
        return await self._request("POST", "/users", json={
            "email": email,
            "firstName": first_name,
            "lastName": last_name,
        })

    async def create_company(
        self,
        *,
        user_id: str,
        company_name: str,
        entity_type: str,
        state: str,
        management_type: str | None = None,
        business_purpose: str | None = None,
        registered_agent: str = "standard",
        founders: list[dict] | None = None,
        principal_address: dict | None = None,
    ) -> dict:
        """Create a company record in FileForms."""
        payload = {
            "userId": user_id,
            "companyName": company_name,
            "entityType": entity_type,
            "state": state,
        }
        if management_type:
            payload["managementType"] = management_type
        if business_purpose:
            payload["businessPurpose"] = business_purpose
        if registered_agent:
            payload["registeredAgent"] = registered_agent
        if founders:
            payload["founders"] = founders
        if principal_address:
            payload["principalAddress"] = principal_address
        return await self._request("POST", "/companies", json=payload)

    async def create_order(
        self,
        *,
        company_id: str,
        services: list[str] | None = None,
    ) -> dict:
        """Submit a formation order to FileForms."""
        payload = {"companyId": company_id}
        if services:
            payload["services"] = services
        return await self._request("POST", "/orders", json=payload)

    async def get_company(self, company_id: str) -> dict:
        """Retrieve company details from FileForms."""
        return await self._request("GET", f"/companies/{company_id}")

    async def get_order(self, order_id: str) -> dict:
        """Retrieve order status from FileForms."""
        return await self._request("GET", f"/orders/{order_id}")

    async def get_document(self, document_id: str) -> bytes:
        """Download a document binary from FileForms."""
        async with httpx.AsyncClient(
            base_url=self.base_url,
            headers=self._get_headers(),
            timeout=60.0,
        ) as client:
            response = await client.get(f"/documents/{document_id}")
            if response.status_code >= 400:
                raise FileFormsError(
                    status_code=response.status_code,
                    detail=response.text,
                )
            return response.content


# Singleton
fileforms_client = FileFormsClient()
```

### Configuration Additions

Add to `polar/config.py` (do **not** modify — these will be environment-sourced):

```python
# FileForms
FILEFORMS_API_URL: str = "https://api.fileforms.dev"
FILEFORMS_API_KEY: str = ""
FILEFORMS_WEBHOOK_SECRET: str = ""
```

These are added to the `Settings` class and loaded from environment variables with `POLAR_` prefix.

### Key Design Decisions

1. **Frontend never calls FileForms** — all requests go through the Spaire API.
2. **Async httpx** — consistent with the existing async patterns in the codebase.
3. **Singleton** — matches the service pattern used throughout the codebase.
4. **Error mapping** — `FileFormsError` is caught in the service layer and mapped to appropriate Spaire errors.

---

## 9. Webhook Handling

### Inbound Webhook Endpoint

FileForms sends webhook events to a dedicated Spaire endpoint. This follows the pattern used by `integrations/chargeback_stop/` for inbound webhooks.

```python
# polar/incorporation/webhook_endpoints.py

router = APIRouter(prefix="/webhooks/fileforms", tags=["webhooks"])


@router.post("/", status_code=200)
async def handle_fileforms_webhook(
    request: Request,
    session: AsyncSession,
) -> dict:
    """Receive and process FileForms webhook events."""
    body = await request.body()

    # Verify webhook signature
    signature = request.headers.get("X-FileFormsApi-Signature", "")
    if not verify_webhook_signature(body, signature, settings.FILEFORMS_WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="Invalid signature")

    payload = await request.json()
    event_type = payload.get("event")

    if event_type == "filing.status_changed":
        await incorporation_service.handle_status_change(
            session,
            fileforms_order_id=payload["data"]["orderId"],
            new_status=payload["data"]["status"],
            detail=payload["data"].get("detail"),
        )

    elif event_type == "document.uploaded":
        await incorporation_service.handle_document_uploaded(
            session,
            fileforms_order_id=payload["data"]["orderId"],
            document_id=payload["data"]["documentId"],
            document_type=payload["data"].get("documentType", "unknown"),
            file_name=payload["data"].get("fileName", "document.pdf"),
        )

    return {"received": True}
```

### Webhook Event Handling in Service

```python
# polar/incorporation/service.py

async def handle_status_change(
    self,
    session: AsyncSession,
    *,
    fileforms_order_id: str,
    new_status: str,
    detail: str | None = None,
) -> None:
    repository = IncorporationRepository.from_session(session)
    incorporation = await repository.get_by_fileforms_order_id(fileforms_order_id)

    if incorporation is None:
        log.warning("Webhook for unknown order", fileforms_order_id=fileforms_order_id)
        return

    # Map FileForms status to Spaire status
    status_map = {
        "processing": IncorporationStatus.processing,
        "completed": IncorporationStatus.completed,
        "rejected": IncorporationStatus.failed,
        "filed": IncorporationStatus.processing,
    }

    new_spaire_status = status_map.get(new_status)
    if new_spaire_status:
        incorporation.status = new_spaire_status
        incorporation.status_detail = detail

        if new_spaire_status == IncorporationStatus.completed:
            incorporation.completed_at = utc_now()
        if new_status == "filed":
            incorporation.filed_at = utc_now()

        await repository.update(incorporation)


async def handle_document_uploaded(
    self,
    session: AsyncSession,
    *,
    fileforms_order_id: str,
    document_id: str,
    document_type: str,
    file_name: str,
) -> None:
    repository = IncorporationRepository.from_session(session)
    incorporation = await repository.get_by_fileforms_order_id(fileforms_order_id)

    if incorporation is None:
        log.warning("Document webhook for unknown order", fileforms_order_id=fileforms_order_id)
        return

    # Enqueue background download
    enqueue_job(
        "incorporation.download_document",
        incorporation_id=incorporation.id,
        provider_document_id=document_id,
        document_type=document_type,
        file_name=file_name,
    )
```

### Webhook Registration

The webhook router is registered in `polar/api.py`:

```python
from polar.incorporation.webhook_endpoints import router as fileforms_webhook_router
# ...
router.include_router(fileforms_webhook_router)  # /webhooks/fileforms
```

The webhook URL is configured in the FileForms partner dashboard to point to:
`https://api.spairehq.com/v1/webhooks/fileforms`

---

## 10. Document Storage

### Download and Store Flow

```python
# polar/incorporation/tasks.py

@actor(actor_name="incorporation.download_document", priority=TaskPriority.DEFAULT)
async def download_document(
    incorporation_id: UUID,
    provider_document_id: str,
    document_type: str,
    file_name: str,
) -> None:
    async with AsyncSessionMaker() as session:
        service = IncorporationService()
        await service.download_and_store_document(
            session,
            incorporation_id=incorporation_id,
            provider_document_id=provider_document_id,
            document_type=document_type,
            file_name=file_name,
        )
```

```python
# polar/incorporation/service.py

async def download_and_store_document(
    self,
    session: AsyncSession,
    *,
    incorporation_id: UUID,
    provider_document_id: str,
    document_type: str,
    file_name: str,
) -> IncorporationDocument:
    # 1. Download from FileForms
    content = await fileforms_client.get_document(provider_document_id)

    # 2. Upload to S3
    bucket = settings.S3_FILES_BUCKET_NAME
    s3_key = f"incorporations/{incorporation_id}/{document_type}/{file_name}"

    s3_service = S3_SERVICES.get(bucket)
    await s3_service.put_object(
        key=s3_key,
        body=content,
        content_type="application/pdf",
    )

    # 3. Create document record
    doc_repository = IncorporationDocumentRepository.from_session(session)
    document = await doc_repository.create(
        IncorporationDocument(
            incorporation_id=incorporation_id,
            document_type=document_type,
            file_name=file_name,
            s3_bucket=bucket,
            s3_key=s3_key,
            file_size_bytes=len(content),
            mime_type="application/pdf",
            provider_document_id=provider_document_id,
        )
    )

    return document
```

### Document Retrieval

Documents are served through presigned S3 URLs, following the existing file download pattern:

```python
# polar/incorporation/service.py

async def get_document_download_url(
    self,
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    incorporation_id: UUID,
    document_id: UUID,
) -> str:
    doc = await self._get_document(session, auth_subject, incorporation_id, document_id)

    s3_service = S3_SERVICES.get(doc.s3_bucket)
    url = await s3_service.generate_presigned_url(
        key=doc.s3_key,
        expires_in=settings.S3_FILES_PRESIGN_TTL,
    )
    return url
```

### S3 Bucket

Reuse the existing `polar-s3` bucket with a dedicated prefix (`incorporations/`). No new bucket needed.

**S3 key pattern:**
```
incorporations/{incorporation_id}/{document_type}/{file_name}
```

Example:
```
incorporations/550e8400-e29b-41d4-a716-446655440000/articles_of_organization/Articles_Acme_LLC.pdf
```

---

## 11. Frontend UX Plan

### Dashboard Integration

The incorporation wizard lives under the existing dashboard at:

```
/dashboard/[organization]/(header)/incorporate/
```

This follows the existing pattern for org-scoped dashboard pages (alongside `products/`, `customers/`, `sales/`, etc.).

### Route Structure

```
clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/incorporate/
├── page.tsx                    # Landing/list page
├── new/
│   └── page.tsx                # Multi-step wizard
├── [incorporationId]/
│   ├── page.tsx                # Status/detail view
│   └── documents/
│       └── page.tsx            # Documents view
```

### Multi-Step Wizard Flow

```
┌──────────────────────────────────────────────────┐
│              Start a Company                      │
│                                                   │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌───────────┐  │
│  │ Step 1 │ │ Step 2 │ │ Step 3 │ │  Step 4   │  │
│  │ Entity │►│Details │►│Founders│►│ Ownership │  │
│  │ Type   │ │        │ │        │ │           │  │
│  └────────┘ └────────┘ └────────┘ └───────────┘  │
│                                                   │
│  ┌────────┐ ┌────────┐                            │
│  │ Step 5 │ │ Step 6 │                            │
│  │ Review │►│Checkout│                            │
│  │        │ │        │                            │
│  └────────┘ └────────┘                            │
└──────────────────────────────────────────────────┘
```

#### Step 1 — Entity Type

- Select LLC, C-Corp, or S-Corp
- Brief description of each type
- Reuse: `RadioGroup` from `@spaire/ui`, `Card` component

#### Step 2 — Company Details

- Company name (primary + 2 alternatives)
- Formation state (dropdown of US states, default Delaware)
- Business purpose
- Management type (for LLCs)
- Reuse: `Input`, `Select`, `Textarea` from `@spaire/ui`

#### Step 3 — Founders

- Dynamic list of founders (add/remove)
- Each founder: name, email, title, address
- Reuse: `Form` (React Hook Form + Zod), `Input`, `Button`

#### Step 4 — Ownership

- Ownership percentage per founder (must sum to 100%)
- Reuse: `Input` with numeric validation, `Progress` bar

#### Step 5 — Review

- Summary of all entered data
- Edit links back to each step
- Reuse: `Card`, `Badge`, `Separator`

#### Step 6 — Checkout

- Redirect to Spaire Checkout (existing checkout flow)
- On success, redirect to incorporation status page
- Reuse: Entire existing checkout infrastructure

### Reusable Components

| Component | Source | Usage |
|-----------|--------|-------|
| `Input` | `@spaire/ui` | All text fields |
| `Select` | `@spaire/ui` | State selector, entity type |
| `Button` | `@spaire/ui` | Navigation, submit |
| `Card` | `@spaire/ui` | Step containers, review cards |
| `Form` | React Hook Form + Zod | Form state management |
| `Badge` | `@spaire/ui` | Status badges |
| `Progress` | `@spaire/ui` | Step progress indicator |
| `Tabs` | `@spaire/ui` | Step navigation |
| `DataTable` | existing | Document list |
| `CopyToClipboardInput` | existing | Document download links |

### Status Page

After submission, the incorporation detail page shows:

```
┌─────────────────────────────────────────┐
│  Acme LLC — Delaware LLC                │
│                                         │
│  Status: ● Processing                   │
│  Filed: March 6, 2026                   │
│  ────────────────────────────────────    │
│                                         │
│  ┌─── Timeline ─────────────────────┐   │
│  │ ✓ Draft created     Mar 6, 2026  │   │
│  │ ✓ Payment received  Mar 6, 2026  │   │
│  │ ✓ Filed with state  Mar 6, 2026  │   │
│  │ ○ Formation complete             │   │
│  └──────────────────────────────────┘   │
│                                         │
│  Documents (0)                          │
│  No documents yet. Documents will       │
│  appear here once formation completes.  │
└─────────────────────────────────────────┘
```

### Navigation

Add "Incorporate" to the dashboard sidebar navigation, after "Settings":

```tsx
// In the sidebar navigation config
{
  title: "Incorporate",
  href: `/dashboard/${organization.slug}/incorporate`,
  icon: Building2,  // from lucide-react
}
```

### Data Fetching

Use TanStack Query hooks (following existing patterns):

```typescript
// hooks/queries/incorporations.ts
export const useIncorporation = (id: string) =>
  useQuery({
    queryKey: ['incorporations', id],
    queryFn: () => api.incorporations.get(id),
  })

export const useIncorporations = (orgId: string) =>
  useQuery({
    queryKey: ['incorporations', 'list', orgId],
    queryFn: () => api.incorporations.list({ organization_id: orgId }),
  })

export const useCreateIncorporation = () =>
  useMutation({
    mutationFn: (data: IncorporationCreate) =>
      api.incorporations.create(data),
  })
```

---

## 12. Migration Strategy

### Principles

1. **Additive only** — no changes to existing tables, no breaking schema modifications.
2. **Feature-flagged** — the incorporation feature can be enabled/disabled per organization.
3. **Backward compatible** — no existing API contracts change.
4. **Independent module** — the `incorporation/` module has no impact on other modules if disabled.

### Database Migration

```python
# migrations/versions/2026_03_xx_add_incorporations.py

def upgrade() -> None:
    op.create_table(
        "incorporations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("entity_type", sa.String(20), nullable=False),
        sa.Column("state", sa.String(2), nullable=False),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("company_name_alt_1", sa.String(255)),
        sa.Column("company_name_alt_2", sa.String(255)),
        sa.Column("management_type", sa.String(30)),
        sa.Column("business_purpose", sa.Text()),
        sa.Column("registered_agent", sa.String(20), server_default="standard"),
        sa.Column("founders", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("principal_address", sa.JSON()),
        sa.Column("checkout_id", sa.Uuid(), sa.ForeignKey("checkouts.id")),
        sa.Column("fileforms_user_id", sa.String(255)),
        sa.Column("fileforms_company_id", sa.String(255)),
        sa.Column("fileforms_order_id", sa.String(255)),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("status_detail", sa.Text()),
        sa.Column("filed_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("rejected_reason", sa.Text()),
    )
    op.create_index("ix_incorporations_organization_id", "incorporations", ["organization_id"])
    op.create_index("ix_incorporations_status", "incorporations", ["status"])
    op.create_index("ix_incorporations_fileforms_order_id", "incorporations", ["fileforms_order_id"])
    op.create_index("ix_incorporations_created_at", "incorporations", ["created_at"])
    op.create_index("ix_incorporations_deleted_at", "incorporations", ["deleted_at"])

    op.create_table(
        "incorporation_documents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("incorporation_id", sa.Uuid(), sa.ForeignKey("incorporations.id"), nullable=False),
        sa.Column("document_type", sa.String(50), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("s3_bucket", sa.String(255), nullable=False),
        sa.Column("s3_key", sa.String(512), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger()),
        sa.Column("mime_type", sa.String(100), server_default="application/pdf"),
        sa.Column("provider_document_id", sa.String(255), nullable=False),
    )
    op.create_index("ix_incorporation_documents_incorporation_id", "incorporation_documents", ["incorporation_id"])
    op.create_index("ix_incorporation_documents_provider_document_id", "incorporation_documents", ["provider_document_id"])
    op.create_index("ix_incorporation_documents_created_at", "incorporation_documents", ["created_at"])
    op.create_index("ix_incorporation_documents_deleted_at", "incorporation_documents", ["deleted_at"])


def downgrade() -> None:
    op.drop_table("incorporation_documents")
    op.drop_table("incorporations")
```

### Touchpoints to Existing Code (Minimal)

| File | Change | Lines |
|------|--------|-------|
| `polar/api.py` | Import and register incorporation routers | +3 lines |
| `polar/models/__init__.py` | Import new models | +2 lines |
| `polar/config.py` | Add FileForms config settings | +3 lines |
| `polar/order/service.py` | Hook to enqueue incorporation task on payment | +5 lines |
| `polar/auth/scope.py` | Add `incorporations_read`, `incorporations_write` scopes | +2 lines |

**Total changes to existing code: ~15 lines across 5 files.** Everything else is new code in the new module.

---

## 13. Implementation Phases

### Phase 1 — Backend Scaffolding (3 days)

**Goal:** Module structure, database models, repository, basic CRUD endpoints.

- [ ] Create `polar/incorporation/` module with all files
- [ ] Define SQLAlchemy models (`Incorporation`, `IncorporationDocument`)
- [ ] Create Alembic migration
- [ ] Implement repository with auth-aware queries
- [ ] Implement basic service methods (create_draft, get, list, update)
- [ ] Define Pydantic schemas (create, read, update)
- [ ] Implement auth dependencies
- [ ] Register routes in `polar/api.py`
- [ ] Register models in `polar/models/__init__.py`
- [ ] Add sorting enum
- [ ] Write unit tests for service and repository

### Phase 2 — Provider Client (2 days)

**Goal:** FileForms API client abstraction with error handling.

- [ ] Implement `provider_client.py` with all API methods
- [ ] Add FileForms config to `polar/config.py`
- [ ] Write integration tests with mock HTTP responses
- [ ] Handle error mapping (FileFormsError → PolarError)
- [ ] Add structured logging for all API calls

### Phase 3 — Checkout Integration (2 days)

**Goal:** Incorporation payment via Spaire Checkout.

- [ ] Create formation products in Spaire (via migration or seed)
- [ ] Implement `initiate_checkout()` in service
- [ ] Add `POST /v1/incorporations/{id}/checkout` endpoint
- [ ] Add payment confirmation hook in order service
- [ ] Write tests for checkout flow

### Phase 4 — FileForms Submission Pipeline (2 days)

**Goal:** Background task pipeline for FileForms submission.

- [ ] Implement `submit_to_fileforms()` service method
- [ ] Create Dramatiq tasks: `incorporation.payment_confirmed`, `incorporation.submit_to_fileforms`
- [ ] Handle FileForms API call sequence (user → company → order)
- [ ] Implement retry logic for transient failures
- [ ] Update incorporation status at each step
- [ ] Write tests with mocked FileForms responses

### Phase 5 — Webhooks and Document Storage (3 days)

**Goal:** Inbound webhook processing, document download and S3 storage.

- [ ] Implement `webhook_endpoints.py` with signature verification
- [ ] Implement `handle_status_change()` in service
- [ ] Implement `handle_document_uploaded()` in service
- [ ] Implement `download_and_store_document()` background task
- [ ] S3 upload integration for documents
- [ ] Presigned URL generation for document downloads
- [ ] Register webhook router in `polar/api.py`
- [ ] Write tests for webhook handling
- [ ] Write tests for document storage flow

### Phase 6 — Frontend: Incorporation Wizard (4 days)

**Goal:** Multi-step wizard in the dashboard.

- [ ] Create route structure under `/dashboard/[organization]/(header)/incorporate/`
- [ ] Implement Step 1: Entity Type selection
- [ ] Implement Step 2: Company Details form
- [ ] Implement Step 3: Founders form (dynamic list)
- [ ] Implement Step 4: Ownership allocation
- [ ] Implement Step 5: Review summary
- [ ] Implement Step 6: Checkout redirect
- [ ] Create TanStack Query hooks
- [ ] Add Zod validation schemas
- [ ] Add sidebar navigation entry
- [ ] Responsive design with dark mode

### Phase 7 — Frontend: Status & Documents (2 days)

**Goal:** Status tracking and document viewing.

- [ ] Implement incorporation detail page with timeline
- [ ] Implement document list with download links
- [ ] Status badge component
- [ ] Auto-refresh via polling or SSE

### Phase 8 — Testing and Production Readiness (2 days)

**Goal:** End-to-end testing, error handling, monitoring.

- [ ] End-to-end test with FileForms sandbox
- [ ] Error boundary and fallback UI
- [ ] Structured logging and alerting
- [ ] Rate limiting on webhook endpoint
- [ ] Documentation for ops team

### Total: ~20 engineering days

---

## 14. Risk Analysis

### Edge Cases and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Company name conflict** | Filing rejected by state | Medium | Collect 2 alternative names. Show guidance on naming rules. Allow re-submission with new name. |
| **Filing rejection** | User stuck, needs refund | Low | `failed` status with `rejected_reason`. Email notification to user. Manual refund process via backoffice. |
| **Failed FileForms API call** | Submission not completed | Medium | Dramatiq retry with exponential backoff (up to 20 retries per WORKER_MAX_RETRIES). Idempotency via provider IDs. |
| **Duplicate submission** | Double charge, double filing | Low | Check `status != draft` before accepting checkout. Unique constraint on `fileforms_order_id`. |
| **Webhook delivery failure** | Status not updated | Medium | Implement periodic polling task (`incorporation.sync_status`) as fallback. Runs every 30 min for `submitted`/`processing` incorporations. |
| **Webhook replay/duplicate** | Double processing | Medium | Idempotent webhook handling — check if status already matches before updating. Check if document already exists before downloading. |
| **Document download failure** | Missing documents | Low | Retry via Dramatiq. Manual re-trigger via backoffice. |
| **S3 upload failure** | Document not stored | Low | Retry in background task. Document remains available via FileForms API as fallback. |
| **Payment succeeds but FileForms fails** | User paid but not filed | Low | `submitted` status indicates payment received. Background task retries. Alert on repeated failures. Manual intervention via backoffice. |
| **State-specific requirements** | Different states need different fields | Medium | Start with Delaware and Wyoming (most common). Expand state support incrementally. Entity type + state determines required fields. |
| **Partial wizard completion** | User abandons mid-form | High | Draft saved at each step. User can resume from where they left off. Drafts auto-expire after 30 days. |

### Security Considerations

1. **Webhook signature verification** — Mandatory. Reject unsigned requests.
2. **FileForms API key** — Stored as environment variable, never logged, never exposed to frontend.
3. **PII in founders data** — JSONB column contains personal information. Access controlled via org membership.
4. **Document access** — Presigned S3 URLs with TTL. Auth check before generating URL.
5. **Input validation** — All user input validated via Pydantic schemas. SQL injection prevention via SQLAlchemy ORM.

---

## 15. Engineering Effort

| Phase | Duration | Engineers | Notes |
|-------|----------|-----------|-------|
| Phase 1: Backend scaffolding | 3 days | 1 backend | Foundation work |
| Phase 2: Provider client | 2 days | 1 backend | FileForms integration |
| Phase 3: Checkout integration | 2 days | 1 backend | Payment flow |
| Phase 4: Submission pipeline | 2 days | 1 backend | Background tasks |
| Phase 5: Webhooks + documents | 3 days | 1 backend | Webhooks, S3 |
| Phase 6: Frontend wizard | 4 days | 1 frontend | Multi-step form |
| Phase 7: Frontend status/docs | 2 days | 1 frontend | Status + downloads |
| Phase 8: Testing + polish | 2 days | 1 fullstack | E2E, monitoring |
| **Total** | **20 days** | **1–2 engineers** | ~4 calendar weeks |

### Parallelization Opportunities

- Phases 1–2 can be done sequentially by one backend engineer.
- Phases 3–5 can be done sequentially by the same backend engineer.
- Phase 6 can start **in parallel** with Phase 3 once Phase 1 schemas are defined (frontend can work against mock API).
- Phase 7 can overlap with Phase 5.
- With 2 engineers (1 backend + 1 frontend), calendar time drops to ~3 weeks.

### Dependencies

| Dependency | Owner | Blocker? |
|------------|-------|----------|
| FileForms API key + sandbox access | Partnerships | Yes — needed before Phase 2 |
| FileForms webhook URL registered | Partnerships | Yes — needed before Phase 5 |
| Formation product pricing decisions | Product | Yes — needed before Phase 3 |
| Sidebar navigation approval | Design | No — can ship without |

---

## Appendix A: Configuration Additions

```python
# Added to polar/config.py Settings class:

# FileForms (Company Formation)
FILEFORMS_API_URL: str = "https://api.dev.fileforms.dev"
FILEFORMS_API_KEY: str = ""
FILEFORMS_WEBHOOK_SECRET: str = ""
```

Environment variables (added to `.env`):
```bash
POLAR_FILEFORMS_API_URL=https://api.dev.fileforms.dev
POLAR_FILEFORMS_API_KEY=ff_key_xxx
POLAR_FILEFORMS_WEBHOOK_SECRET=whsec_xxx
```

## Appendix B: Auth Scope Additions

```python
# Added to polar/auth/scope.py:

class Scope(StrEnum):
    # ... existing scopes ...
    incorporations_read = "incorporations:read"
    incorporations_write = "incorporations:write"
```

## Appendix C: API Router Registration

```python
# Added to polar/api.py:

from polar.incorporation.endpoints import router as incorporation_router
from polar.incorporation.webhook_endpoints import router as fileforms_webhook_router

# /incorporations
router.include_router(incorporation_router)
# /webhooks/fileforms
router.include_router(fileforms_webhook_router)
```

## Appendix D: Model Registration

```python
# Added to polar/models/__init__.py:

from polar.models.incorporation import Incorporation, IncorporationDocument
```
