# Spaire Dashboard Redesign Plan

**Date:** 2026-03-07
**Branch:** `claude/plan-dashboard-redesign-enW9o`
**Author:** Senior Product Design & Frontend Architecture Review
**Goal:** Transform the Polar-inherited dashboard into a distinctly Spaire UI — modeled after Stripe's dashboard philosophy — while preserving all existing functionality.

---

## Table of Contents

1. [Dashboard Information Architecture](#1-dashboard-information-architecture)
2. [Layout System](#2-layout-system)
3. [Page Design Patterns](#3-page-design-patterns)
4. [UI Component System](#4-ui-component-system)
5. [Product Section Design](#5-product-section-design)
6. [Migration Plan](#6-migration-plan)
7. [Visual Differentiation From Polar](#7-visual-differentiation-from-polar)

---

## 1. Dashboard Information Architecture

### Philosophy

Stripe's information architecture works because it treats each product as a **first-class domain**. Navigation is flat and scannable, not nested and hierarchical. Every top-level item is a product or functional area — not a feature. Spaire should adopt this same mental model.

### Proposed Sidebar Navigation Structure

```
SPAIRE
─────────────────────────────
  Overview                        /dashboard/[org]

  ── MONETIZATION ──
  Billing                         /dashboard/[org]/billing
    ├── Subscriptions             /dashboard/[org]/billing/subscriptions
    ├── Invoices                  /dashboard/[org]/billing/invoices
    └── Usage & Meters            /dashboard/[org]/billing/usage

  Checkout                        /dashboard/[org]/checkout
    ├── Sessions                  /dashboard/[org]/checkout/sessions
    └── Links                     /dashboard/[org]/checkout/links

  Products                        /dashboard/[org]/products
    ├── Catalog                   /dashboard/[org]/products/catalog
    ├── Prices                    /dashboard/[org]/products/prices
    ├── Benefits                  /dashboard/[org]/products/benefits
    └── Discounts                 /dashboard/[org]/products/discounts

  ── CUSTOMERS ──
  Customers                       /dashboard/[org]/customers
    ├── All Customers             /dashboard/[org]/customers
    ├── Subscriptions             /dashboard/[org]/customers/subscriptions
    └── Orders                   /dashboard/[org]/customers/orders

  ── REPORTING ──
  Analytics                       /dashboard/[org]/analytics
    ├── Revenue                   /dashboard/[org]/analytics/revenue
    ├── Customers                 /dashboard/[org]/analytics/customers
    └── Events                    /dashboard/[org]/analytics/events

  Finance                         /dashboard/[org]/finance
    ├── Balance                   /dashboard/[org]/finance/balance
    ├── Payouts                   /dashboard/[org]/finance/payouts
    └── Transactions              /dashboard/[org]/finance/transactions

  ── FOUNDER TOOLS ──
  Startup Stack                   /dashboard/[org]/startup-stack

  ── PLATFORM ──
  Developers                      /dashboard/[org]/developers
    ├── API Keys                  /dashboard/[org]/developers/api-keys
    ├── Webhooks                  /dashboard/[org]/developers/webhooks
    └── Integrations              /dashboard/[org]/developers/integrations

  Settings                        /dashboard/[org]/settings
    ├── General                   /dashboard/[org]/settings
    ├── Members                   /dashboard/[org]/settings/members
    ├── Compliance                /dashboard/[org]/settings/compliance
    └── Custom Fields             /dashboard/[org]/settings/custom-fields

─────────────────────────────
  [Avatar] Account               /dashboard/account/preferences
  [?] Documentation
```

### Key Structural Changes vs Current Polar Layout

| Current (Polar) | New (Spaire) |
|---|---|
| Catalog (products + checkout + benefits mixed) | Products, Checkout, Billing as separate top-level items |
| Revenue (sales page) | Merged into Billing + Customers domains |
| Finance (income + payouts) | Finance with Balance / Payouts / Transactions subtabs |
| Integrations (tutorial-style) | Developers section (API Keys, Webhooks, Integrations) |
| Startup Stack | Elevated to first-class **FOUNDER TOOLS** section (not removed) |
| No section grouping labels | Grouped sections: MONETIZATION / CUSTOMERS / REPORTING / FOUNDER TOOLS / PLATFORM |

### Navigation Route Changes (in `navigation.tsx`)

The current `generalRoutesList` + `organizationRoutesList` split should be collapsed into a single route definition function with **section group metadata**. Each route gets a `group` property:

```typescript
type RouteGroup = 'core' | 'monetization' | 'customers' | 'reporting' | 'founder-tools' | 'platform'

type Route = {
  readonly id: string
  readonly title: string
  readonly group: RouteGroup          // NEW
  readonly icon?: React.ReactElement
  readonly link: string
  readonly if: boolean | undefined
  readonly subs?: SubRoute[]
  // ...existing fields
}
```

---

## 2. Layout System

### Philosophy

Stripe's layout philosophy is: **sidebar + full-height content canvas**. The content area is never a "card inside a page" — it IS the page. Navigation is fixed, content scrolls within its own column. No nested cards for the outer wrapper.

### Current vs New Layout

**Current layout** (`DashboardLayout.tsx`):
```
[bg-gray-100 p-2]
  ├── [Sidebar — float left]
  └── [Content — rounded-2xl card bg-spaire-900 with border]
        ├── Page Title
        ├── SubNav tabs (only when sidebar collapsed)
        └── Content
```

**New layout (Stripe-style)**:
```
[bg-spaire-950 — full bleed]
  ├── [Sidebar — fixed left, no rounded corners, full height]
  │     ├── Logo (top)
  │     ├── Org switcher
  │     ├── Nav section groups with labels
  │     └── Account (bottom)
  └── [Content — full height flex column, no outer card]
        ├── [Page Header — sticky top, bg-spaire-950, border-b]
        │     ├── Breadcrumb / Page title
        │     ├── Page-level action buttons (right)
        │     └── Optional: horizontal subnav tabs
        └── [Page Body — scrollable, px-8 py-6]
              └── Content
```

### Sidebar Design

**Width:** 220px expanded, 60px icon-only collapsed
**Background:** `bg-spaire-950` (same as page — no visual separation via color)
**Right border:** `border-r border-spaire-800`
**No rounding on sidebar** — it is flush with the viewport
**Section group labels:** uppercase, `text-spaire-600 text-xs tracking-widest font-medium`
**Nav items:**
- Default: `text-spaire-400 hover:text-white hover:bg-spaire-800`
- Active: `text-white bg-spaire-800 font-medium`
- Active indicator: left `border-l-2 border-blue-500` (Stripe-style accent)

**No Framer Motion on individual nav items** — use CSS `transition-colors` only for performance.

### Page Header (sticky)

```tsx
// New: SpairePageHeader component
<header className="sticky top-0 z-10 flex h-14 items-center border-b border-spaire-800 bg-spaire-950 px-8">
  <div className="flex flex-1 items-center gap-3">
    <Breadcrumb />           {/* e.g. "Billing / Subscriptions" */}
    <h1 className="text-base font-semibold text-white">{title}</h1>
  </div>
  <div className="flex items-center gap-2">
    {/* Page-level actions: filters, export, create button */}
    {actions}
  </div>
</header>
```

Key differences from current:
- Title is in the **header bar**, not in the body as an `<h4>`
- Header is **sticky** (Stripe behavior)
- Actions (create button, filters) live in header right — not scattered in body

### SubSection Navigation (horizontal tabs)

When a section has sub-pages, horizontal tabs appear **below the sticky header**, not inside the header:

```tsx
<nav className="flex border-b border-spaire-800 px-8">
  {tabs.map(tab => (
    <Link key={tab.href} href={tab.href}
      className={cn(
        'flex h-10 items-center border-b-2 px-4 text-sm transition-colors',
        isActive ? 'border-blue-500 text-white' : 'border-transparent text-spaire-400 hover:text-white'
      )}
    />
  ))}
</nav>
```

This is the **Stripe pattern**: tabs underline, not pill/card style.

### Page Body

```tsx
<div className="flex flex-1 flex-col overflow-y-auto px-8 py-6">
  {children}
</div>
```

- No outer `rounded-2xl border` card wrapping the whole page
- No `md:p-2` padding on the root that creates the "card floating on gray" Polar look
- `overflow-y-auto` on the body div, not the document

### Removing the "Card on Gray Background" Pattern

This is the single most important visual change. Currently:

```tsx
// DashboardLayout.tsx — current
<div className="relative flex h-full w-full flex-col bg-white md:flex-row md:bg-gray-100 md:p-2 dark:bg-transparent">
```

and in DashboardBody:
```tsx
<div className="dark:md:bg-spaire-900 dark:border-spaire-800 ... rounded-2xl border ... md:border md:bg-white ...">
```

This creates the Polar "card inside a page" look. **Remove both.** The new layout has no outer padding on the root and no border-card wrapper on the content area.

---

## 3. Page Design Patterns

### Pattern A: Resource List Pages

**Examples:** Customers, Subscriptions, Invoices, Transactions

**Structure:**
```
[Sticky Page Header]
  Title: "Customers"
  Actions: [Search input] [Filter button] [+ New Customer]

[Subnav — if applicable]
  All | Active | Churned | At-risk

[Page Body]
  [Summary metric row — optional]
    ■ 2,847 total  ■ 143 new this month  ■ $84,200 MRR

  [Resource table]
    ┌─────────────────────────────────────────────────────────────┐
    │ ☐  Name        Email              Status      MRR     Date  │
    ├─────────────────────────────────────────────────────────────┤
    │ ☐  John Doe    john@example.com   Active    $49/mo  Mar 01  │
    └─────────────────────────────────────────────────────────────┘
    [pagination footer]
```

**Key rules:**
- Table is **full-width** — not inside a card
- Thin `border border-spaire-800` wraps the table
- Row hover: `hover:bg-spaire-800/50`
- Clickable rows navigate to detail page
- Status badges use colored dots, not pill backgrounds (Stripe style: `● Active`)

### Pattern B: Resource Detail Pages

**Examples:** Customer detail, Subscription detail, Invoice detail

**Structure:**
```
[Sticky Page Header]
  Title: "John Doe" + Status badge
  Actions: [Edit] [•••] [Cancel Subscription]

[Page Body — two-column]
  ┌──────────────────────────┐  ┌─────────────────────┐
  │  Main content (flex-2)   │  │  Side panel (flex-1) │
  │                          │  │                      │
  │  Timeline / Activity     │  │  Summary card        │
  │  Linked resources        │  │  Metadata fields     │
  │  Usage chart             │  │  Quick actions       │
  └──────────────────────────┘  └─────────────────────┘
```

- Side panel: `max-w-[360px]` — sticky, does not scroll with main
- Main: scrollable, contains event timeline, linked resources
- **No modal for detail pages** — navigate to a dedicated URL

### Pattern C: Analytics / Reporting Pages

**Structure:**
```
[Sticky Page Header]
  Title: "Analytics"
  Actions: [Date range picker] [Export]

[Subnav]
  Revenue | Customers | Events

[Page Body]
  [Metric grid — 4 columns]
    ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
    │  MRR     │ │  ARR     │ │  New Cus │ │  Churn   │
    │  $84,200 │ │  $1.01M  │ │   +143   │ │   2.1%   │
    │  +12.3%  │ │  +12.3%  │ │  +8.2%   │ │  -0.3%   │
    └──────────┘ └──────────┘ └──────────┘ └──────────┘

  [Main chart — full width, 320px height]

  [Two-column bottom]
    ┌────────────────────────┐ ┌────────────────────────┐
    │  Revenue breakdown     │ │  Top customers         │
    └────────────────────────┘ └────────────────────────┘
```

### Pattern D: Settings Pages

**Structure:**
```
[Sticky Page Header]
  Title: "Settings"

[Subnav]
  General | Members | Compliance | Custom Fields

[Page Body — single column, max-w-2xl]
  [Section card]
    Section title (text-sm font-medium text-spaire-400 uppercase tracking-wide)
    ──────────────────────────────────────────────
    Setting row: Label | Value | [Edit button]
    Setting row: Label | Value | [Toggle]
    Setting row: Label | Value | [Edit button]

  [Danger zone — red border card at bottom]
```

- Settings are **row-based**, not form-inside-a-card
- Each setting row has label on left, control on right (Stripe style)
- No submit button at the bottom — each field saves independently or has its own inline edit

### Pattern E: Creation Flows

**Examples:** Create Product, Create Checkout Link, Create Discount

**Structure:** Use a **right-side slide-over panel** (Sheet) for simple creation, or a dedicated page for complex flows.

**Simple creation (Sheet pattern):**
```
[Overlay: Sheet from right, w-[480px]]
  [Header] Create Product  [×]
  [Body — form]
    Name
    Description
    Price
    ...
  [Footer — sticky]
    [Cancel]  [Create Product]
```

**Complex creation (full-page wizard):**
```
[Dedicated route: /dashboard/[org]/products/new]
[Sticky header with step indicator]
  ○ Details → ○ Pricing → ○ Benefits → ○ Review
[Content area]
[Bottom nav: Back | Continue]
```

---

## 4. UI Component System

### 4.1 MetricCard

A compact card showing a single KPI metric.

```tsx
interface MetricCardProps {
  label: string
  value: string | number
  delta?: { value: string; direction: 'up' | 'down' | 'neutral' }
  prefix?: string   // e.g. "$"
  suffix?: string   // e.g. "/mo"
  loading?: boolean
}
```

**Behavior:**
- Background: `bg-spaire-900 border border-spaire-800`
- Delta positive: `text-green-400`; negative: `text-red-400`
- Skeleton loading state using `animate-pulse`
- No chart inside card (keep it lean, unlike some Polar cards)

### 4.2 ResourceTable

A full-featured sortable, filterable data table.

```tsx
interface ResourceTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  loading?: boolean
  onRowClick?: (row: T) => void
  emptyState?: React.ReactNode
  pagination?: PaginationState
}
```

**Behavior:**
- Built on `@tanstack/react-table` (already a dependency via shadcn patterns)
- Full-width, `border border-spaire-800 rounded-xl overflow-hidden`
- Sticky header row
- Row hover: `hover:bg-spaire-800 cursor-pointer`
- Column headers: sortable with `↑↓` chevrons
- Loading: skeleton rows (not spinner)
- Empty: centered empty state with illustration placeholder + CTA

### 4.3 StatusBadge

Minimal status indicator.

```tsx
type BadgeStatus = 'active' | 'inactive' | 'pending' | 'failed' | 'canceled' | 'trialing'

interface StatusBadgeProps {
  status: BadgeStatus
  label?: string   // defaults to capitalized status
}
```

**Behavior (Stripe dot pattern):**
```tsx
// Rendered as:
<span className="flex items-center gap-1.5 text-sm">
  <span className={cn('h-1.5 w-1.5 rounded-full', colorMap[status])} />
  {label}
</span>
```
- No pill/badge background — just a colored dot + text
- Colors: active=`bg-green-400`, pending=`bg-yellow-400`, failed=`bg-red-400`, canceled=`bg-spaire-500`

### 4.4 EventTimeline

An activity log showing a chronological feed of events.

```tsx
interface TimelineEvent {
  id: string
  type: string
  description: string
  timestamp: Date
  actor?: string
  metadata?: Record<string, string>
}
```

**Behavior:**
- Vertical line on left with circular event markers
- Events are expandable to show `metadata` as a key-value grid
- Types have distinct icons (MUI icons already available)
- Timestamp shown as relative (`2h ago`) with full datetime on hover

### 4.5 SidePanel

A right-aligned contextual panel for resource details.

```tsx
interface SidePanelProps {
  title: string
  children: React.ReactNode
  actions?: React.ReactNode
  sticky?: boolean
}
```

**Behavior:**
- `w-[360px] flex-shrink-0`
- `bg-spaire-900 border border-spaire-800 rounded-xl`
- Sticky within the page scroll context
- Used in detail pages for summary/metadata/actions

### 4.6 InlineEditField

A field that displays as text until clicked, then becomes an input.

```tsx
interface InlineEditFieldProps {
  label: string
  value: string
  onSave: (value: string) => Promise<void>
  inputType?: 'text' | 'email' | 'number' | 'textarea'
}
```

**Behavior:**
- Default: `text-white` + invisible edit pencil on row hover
- Click → transforms to input with Save/Cancel inline
- On save: optimistic update + mutation
- Stripe uses this pattern extensively in settings

### 4.7 ExpandablePanel / Accordion Section

Groups related settings or metadata into collapsible sections.

```tsx
interface ExpandablePanelProps {
  title: string
  badge?: string | number   // e.g. item count
  defaultOpen?: boolean
  children: React.ReactNode
}
```

**Behavior:**
- Chevron indicator, smooth height animation via CSS `grid-template-rows`
- `border-b border-spaire-800` between sections
- Used in detail page side panels and settings

### 4.8 PageHeader

The new sticky page header component (replaces DashboardBody title pattern).

```tsx
interface PageHeaderProps {
  title: string
  description?: string
  breadcrumb?: { label: string; href: string }[]
  actions?: React.ReactNode
  tabs?: { label: string; href: string }[]
}
```

### 4.9 FilterBar

A composable filter row for resource list pages.

```tsx
// Usage
<FilterBar>
  <SearchInput placeholder="Search customers..." />
  <FilterSelect label="Status" options={statusOptions} />
  <FilterSelect label="Plan" options={planOptions} />
  <DateRangePicker />
  <ExportButton />
</FilterBar>
```

**Behavior:**
- Horizontal flex row, `border-b border-spaire-800 py-3 px-8`
- Active filters shown as removable chips below the bar
- All state managed via Nuqs (URL query params — already in project)

### 4.10 EmptyState

Consistent empty state for all resource lists.

```tsx
interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}
```

---

## 5. Product Section Design

### 5.1 Overview (Home)

**Purpose:** Executive summary for the organization
**URL:** `/dashboard/[org]`

**Layout:**
```
[Page Header] Overview   Actions: [Date range]

[Metric row — 4 cards]
  MRR | ARR | Active Customers | Churn Rate

[Main chart — Revenue over time, 300px]

[Two-column]
  Recent Activity (event timeline)  |  Quick Actions
  - New subscription                 |  + Create product
  - Payment failed: John Doe         |  + Create checkout
  - Refund issued                    |  View payouts
```

**Stripe parallels:** Stripe's home shows a revenue chart + recent activity + quick links. Same philosophy here.

### 5.2 Billing

**Purpose:** Manage subscriptions, invoices, and usage-based billing
**URL:** `/dashboard/[org]/billing`
**Subnav:** Subscriptions | Invoices | Usage & Meters

**Subscriptions page:**
- Resource table: Customer, Plan, Status, MRR, Billing cycle, Next charge
- Filterable by status (active, trialing, past_due, canceled)
- Row click → subscription detail page (not modal)

**Subscription detail:**
```
[Header] Customer name — Plan name   [Status badge]  [Cancel] [Edit]

[Two-column]
  Main:                              Side panel:
  - Payment history (timeline)       - Subscription summary
  - Usage metrics (if metered)       - Customer link
  - Upcoming invoice preview         - Plan details
  - Events log                       - Billing dates
                                     - Quick actions
```

**Invoices page:**
- Resource table: Invoice #, Customer, Amount, Status, Date
- One-click download PDF
- Status: draft, open, paid, void, uncollectible

**Usage & Meters page:**
- List of meters: Name, Unit, Current period usage
- Click meter → usage chart for that meter
- Aggregated usage per customer table

### 5.3 Checkout

**Purpose:** Checkout sessions and shareable checkout links
**URL:** `/dashboard/[org]/checkout`
**Subnav:** Sessions | Links

**Sessions page:**
- Table: Session ID (truncated), Customer, Product, Amount, Status, Date
- Filter by: completed, abandoned, expired
- Abandoned session recovery insight (% abandoned this week)

**Links page:**
- Table: Link name, URL (copy button), Product, Conversions, Created
- Status badge: active / archived
- Quick action: copy link, open preview, archive

### 5.4 Products

**Purpose:** Product catalog, pricing, benefits, discounts
**URL:** `/dashboard/[org]/products`
**Subnav:** Catalog | Prices | Benefits | Discounts

**Catalog page:**
- Card grid (not table) — each product is a card: Name, Type, Price, Status
- Card has thumbnail/icon area, quick actions on hover
- "Create Product" button in page header

**Prices page:**
- Table showing all price configurations across all products
- Filterable by product, billing interval, type (one-time/recurring)

**Benefits page:**
- List of reusable benefit configurations
- Type badges: Digital Download, GitHub Access, Discord, Custom

**Discounts page:**
- Table: Code, Type (%), Amount off, Usage count, Expiry, Status

### 5.5 Customers

**Purpose:** CRM for all customers
**URL:** `/dashboard/[org]/customers`
**Subnav:** (none — single page with status filters)

**Customer list:**
- Table: Avatar+Name, Email, Status, Subscriptions, LTV, Joined
- Filters: status, plan, signup date range, country
- Search by name or email

**Customer detail:**
```
[Header] Avatar  Full Name  email@example.com  [Status]  [Actions: ▼]

[Two-column]
  Main (scrollable):                   Side panel (sticky):
  - Active subscriptions               - Customer summary
  - Order history                      - Contact info (inline edit)
  - Checkout sessions                  - Billing info
  - Event timeline                     - Metadata (key/value)
  - Custom field values                - Internal notes
```

### 5.6 Analytics

**Purpose:** Business intelligence and revenue analytics
**URL:** `/dashboard/[org]/analytics`
**Subnav:** Revenue | Customers | Events

**Revenue analytics:**
- Time series chart: MRR, ARR, New MRR, Expansion MRR, Churn MRR
- Chart type toggle: line / bar / area
- Breakdown by product / plan
- Date range: 7d / 30d / 90d / 1y / custom

**Customer analytics:**
- Cohort retention table (heatmap-style)
- Acquisition chart (new customers over time)
- Churn analysis (reasons, timing)

**Events:**
- Raw event stream table: Event name, Customer, Properties, Timestamp
- Filter by event type
- Used for usage/metering debugging

### 5.7 Finance

**Purpose:** Financial reporting and payouts
**URL:** `/dashboard/[org]/finance`
**Subnav:** Balance | Payouts | Transactions

**Balance page:**
- Available balance (large display number)
- Pending balance
- Next payout date
- Payout schedule settings

**Payouts page:**
- Table: Payout ID, Amount, Bank account (masked), Date, Status
- Row click → payout detail with transaction breakdown

**Transactions page:**
- Table: Transaction ID, Type, Amount, Customer, Date
- Types: charge, refund, adjustment, payout
- Stripe-style: total charges and refunds shown in header

### 5.8 Developers

**Purpose:** API access, webhooks, integrations
**URL:** `/dashboard/[org]/developers`
**Subnav:** API Keys | Webhooks | Integrations

**API Keys:**
- Table: Name, Key (masked, copy button), Created, Last used
- Live vs Test mode toggle (top of page)
- Generate new key button

**Webhooks:**
- Table: Endpoint URL, Events subscribed, Status, Last delivery
- Row click → webhook detail with delivery history + retry
- "Send test event" button

**Integrations:**
- Grid of integration cards (not list): Next.js, Python, React, Go, etc.
- Each card: Logo, name, description, "View docs" / "Install" CTA
- Category filter: SDKs | No-code | Platforms

### 5.9 Settings

**Purpose:** Organization configuration
**URL:** `/dashboard/[org]/settings`
**Subnav:** General | Members | Compliance | Custom Fields

**General settings:**
- Inline edit rows: Org name, Slug, Website URL, Support email
- Branding: Logo upload, brand color

**Members:**
- Table: Member name, Email, Role, Joined
- Invite member button
- Role dropdown in-row

**Compliance:**
- Legal entity information
- Tax configuration (VAT/GST)
- Supported countries
- MOR (Merchant of Record) settings

### 5.10 Startup Stack

**Purpose:** Curated toolkit of infrastructure and services for early-stage startups
**URL:** `/dashboard/[org]/startup-stack`
**Section group:** FOUNDER TOOLS
**Subnav:** (none — single curated page)

**Why this is a first-class section, not a marketing page:**

Startup Stack is Spaire's product moat. Every other section (Billing, Checkout, Finance) signals "payments tool." Startup Stack is the only section that signals "we understand what it takes to build a company." That distinction shapes the product's entire identity in the founder's mind.

A founder who sees `Startup Stack` in the sidebar on day one receives a different message than one who doesn't:
- Without it: "This is a billing admin."
- With it: "This platform is built for startups specifically."

**Page design:**

```
[Page Header] Startup Stack
  Subtitle: "Tools and services to help you build and scale faster"

[Category filter tabs]
  All | Infrastructure | Developer Tools | Banking | Legal | Marketing

[Tool card grid — 3 columns]
  ┌──────────────────────┐  ┌──────────────────────┐
  │  [Logo]              │  │  [Logo]              │
  │  Tool Name           │  │  Tool Name           │
  │  Short description   │  │  Short description   │
  │  Category tag        │  │  Category tag        │
  │  [Activate / Visit]  │  │  [Activate / Visit]  │
  └──────────────────────┘  └──────────────────────┘
```

**Card states:**
- Default: `bg-spaire-900 border border-spaire-800 hover:border-spaire-600`
- Activated/Connected: `border-blue-500/40 bg-blue-500/5` with a checkmark badge
- Featured/Partner: subtle `ring-1 ring-blue-500/20` treatment

**No tutorial-style layout.** The current Polar Startup Stack is a list of integrations with how-to steps. The Spaire version is a **marketplace card grid** — tools you discover and activate, not tutorials you read.

**What goes here vs Developers > Integrations:**
- `Startup Stack`: Third-party products for builders (Vercel, Resend, Lemon Squeezy alternatives, Clerk, etc.)
- `Developers > Integrations`: First-party SDK and API integration guides for Spaire itself

They serve different jobs. Startup Stack is "what else should I be using?" — Integrations is "how do I connect Spaire to my app?"

---

## 6. Migration Plan

### Guiding Principle

**Never break, always improve.** Migrate layout first, then pages one by one. Keep all existing functionality. Use feature-flag routing only if needed for staged rollout.

### Phase 0: Preparation (1–2 days)

**Tasks:**
1. Create new component files **without deleting old ones** yet
2. Add `group` property to `Route` type in `navigation.tsx`
3. Update CSS design tokens in `globals.css` for new layout colors

**Files to touch:**
- `clients/apps/web/src/components/Dashboard/navigation.tsx` — add `group` to Route type and all route definitions
- `clients/apps/web/src/styles/globals.css` — no changes needed (tokens already exist)

### Phase 1: New Layout Shell (2–3 days)

**Goal:** Replace `DashboardLayout.tsx` and `DashboardSidebar.tsx` with new Stripe-style versions. All pages continue to work.

**Step 1.1 — New Sidebar**

Create: `src/components/Layout/Dashboard/SpaireSidebar.tsx`

Key changes from current `DashboardSidebar.tsx`:
- Remove `rounded-2xl` and gap-based floating style
- Full-height flush sidebar with `border-r border-spaire-800`
- Add section group labels (`MONETIZATION`, `CUSTOMERS`, etc.)
- Active indicator: left border `border-l-2 border-blue-500` instead of background pill
- Remove org avatar + name from top (move to bottom)
- Logo stays top-left, smaller

**Step 1.2 — New Page Header**

Create: `src/components/Layout/Dashboard/SpairePageHeader.tsx`

This component replaces the inline title + header in `DashboardBody`.

**Step 1.3 — New Layout Wrapper**

Modify: `src/components/Layout/DashboardLayout.tsx`

Replace:
```tsx
// OLD
<div className="... bg-gray-100 md:p-2 dark:bg-transparent">
  <DashboardSidebar ... />
  <main>...</main>
</div>
```

With:
```tsx
// NEW
<div className="flex h-screen w-full overflow-hidden bg-spaire-950">
  <SpaireSidebar ... />
  <div className="flex flex-1 flex-col overflow-hidden">
    {/* children render their own SpairePageHeader */}
    <main className="flex-1 overflow-y-auto">
      {children}
    </main>
  </div>
</div>
```

**Step 1.4 — Modify DashboardBody**

Remove the outer `rounded-2xl border` card wrapper from `DashboardBody`. Change it to a simple padded container:

```tsx
// DashboardBody becomes a passthrough with padding only
export const DashboardBody = ({ children, className }: DashboardBodyProps) => (
  <div className={cn('px-8 py-6', className)}>
    {children}
  </div>
)
```

Title and header props on `DashboardBody` are **deprecated** — pages will use `SpairePageHeader` directly in their own layout or passed via the layout context.

### Phase 2: Navigation IA Restructure (1–2 days)

**Goal:** Reorganize navigation routes to match new IA.

**File:** `src/components/Dashboard/navigation.tsx`

Changes:
1. Add `group` field to all routes
2. Rename `generalRoutesList` + `organizationRoutesList` → single `spaireRoutesList`
3. Add new routes: `/billing`, `/billing/subscriptions`, `/billing/invoices`, `/billing/usage`, `/checkout/sessions`, `/checkout/links`, `/developers/api-keys`, `/developers/webhooks`, `/developers/integrations`
4. Map existing routes to new URLs with redirects in `next.config.mjs`

**Redirects to add in `next.config.mjs`:**
```js
{ source: '/dashboard/:org/sales', destination: '/dashboard/:org/billing/subscriptions' },
{ source: '/dashboard/:org/products', destination: '/dashboard/:org/products/catalog' },
{ source: '/dashboard/:org/integrations', destination: '/dashboard/:org/developers/integrations' },
{ source: '/dashboard/:org/finance/income', destination: '/dashboard/:org/finance/balance' },
```

### Phase 3: Page-by-Page Migration (1–2 weeks)

Migrate pages in priority order. For each page:
1. Add `<SpairePageHeader>` at top
2. Replace card-wrapped tables with full-width `<ResourceTable>`
3. Add `<FilterBar>` where appropriate
4. Add `<StatusBadge>` to replace text-only status fields

**Priority order:**

| Priority | Page | Effort |
|---|---|---|
| 1 | Overview / Home | Medium |
| 2 | Customers list | Low |
| 3 | Customer detail | High |
| 4 | Billing/Subscriptions | Medium |
| 5 | Products/Catalog | Medium |
| 6 | Analytics | Medium |
| 7 | Finance/Balance | Low |
| 8 | **Startup Stack** (redesign to card grid) | **Medium** |
| 9 | Developers | Low |
| 10 | Settings | Medium |
| 11 | Checkout | Low |

### Phase 4: New UI Components (Parallel with Phase 3)

Build and ship new components as they are needed:

```
src/components/UI/
├── MetricCard.tsx          (Phase 3, step 1)
├── ResourceTable.tsx       (Phase 3, step 2)
├── StatusBadge.tsx         (Phase 3, step 2)
├── EventTimeline.tsx       (Phase 3, step 3)
├── SidePanel.tsx           (Phase 3, step 3)
├── InlineEditField.tsx     (Phase 3, step 9)
├── FilterBar.tsx           (Phase 3, step 2)
├── PageHeader.tsx          (Phase 1)
└── EmptyState.tsx          (Phase 3, step 2)
```

### Phase 5: Remove Polar Residue (after Phase 3)

**Cleanup tasks:**
1. Delete old `DashboardSidebar.tsx` (after `SpaireSidebar.tsx` is confirmed working)
2. Remove `bg-gray-100 md:p-2` root wrapper pattern
3. Remove `contextView` prop from `DashboardBody` (replaced by `SidePanel` in pages)
4. Remove `SubNav` component from `DashboardLayout.tsx` (replaced by tab subnav in `SpairePageHeader`)
5. Remove MUI icons — replace with Lucide icons (already available via shadcn/radix ecosystem, avoids the MUI visual style that is distinctly Polar)
6. Audit all `polar-700`, `polar-800`, `polar-900`, `polar-950` class references and replace with `spaire-*`

### Phase 6: Polish Pass (2–3 days)

1. Verify all pages on mobile (sidebar → bottom sheet or hamburger)
2. Add keyboard navigation (already partially supported by Radix)
3. Ensure all loading states use skeleton patterns consistently
4. Audit all empty states for consistency
5. Check color contrast ratios meet WCAG AA

---

## 7. Visual Differentiation From Polar

### The Core Problem

Polar's dashboard is visually defined by these patterns:
1. **Gray padded container** wrapping a **floating rounded card** for page content
2. **Sidebar with rounded items and bg-fill active state**
3. **Title as large `<h4>` at the top of the content card**
4. **MUI icons** throughout navigation
5. **Tab subnav only appearing when sidebar is collapsed** (unusual, Polar-specific behavior)
6. **SubNav positioned on the right side of the header** (small modification already made — but still feels awkward)
7. **`ShadowBox` cards** inside pages as the primary content grouping primitive

### How the Redesign Eliminates Each Pattern

| Polar Pattern | What We're Replacing It With |
|---|---|
| `bg-gray-100 md:p-2` root → floating card | Full-bleed `bg-spaire-950` root, no outer card — content is flush |
| Rounded sidebar items with `bg` active fill | Flush sidebar with left `border-l-2` active indicator |
| `<h4>` title inside content area | Title in sticky `SpairePageHeader` bar outside scroll area |
| MUI icons in navigation | Lucide icons (different visual weight and style) |
| SubNav appearing only when sidebar collapsed | Permanent horizontal underline tabs below header |
| Right-side contextView panel via DashboardBody prop | Explicit `SidePanel` component positioned in the page layout |
| `ShadowBox` card grouping | Borderless sections with `border-b` dividers (Stripe rows pattern) |
| Org switcher in sidebar footer dropdown | Org switcher in sidebar header area with chevron |
| Logo + org name stacked in sidebar | Logo only top-left, org name inline with org switcher below |

### Stripe Patterns Being Adopted

| Stripe Pattern | Spaire Implementation |
|---|---|
| Full-bleed dark sidebar, no floating | `SpaireSidebar` flush with viewport |
| Sticky page header with breadcrumb | `SpairePageHeader` component |
| Underline tab navigation | Tab subnav with `border-b-2 border-blue-500` active state |
| Left border active indicator in sidebar | `border-l-2 border-blue-500` on active nav items |
| Status dot (not pill) badges | `StatusBadge` with colored dot + text |
| Full-width resource tables (no card wrapper) | `ResourceTable` component, full width |
| Inline edit fields in settings | `InlineEditField` component |
| Event timeline in resource details | `EventTimeline` component |
| Metric grid above charts | `MetricCard` in 4-column grid |
| FilterBar above resource tables | `FilterBar` component |

### Visual Identity Markers (Spaire-Specific)

These elements are unique to Spaire and not Stripe clones:

1. **Color:** `spaire-*` palette (the custom HSL dark mode colors) — not Stripe's gray-900/800
2. **Blue accent:** The `blue-500` oklch blue — more saturated than Stripe's muted blue
3. **Typography:** Geist Sans — Stripe uses an internal font; Geist is distinctively clean
4. **Logo treatment:** Spaire logo top-left in sidebar — immediately different from Polar's positioning
5. **Border style:** `border-spaire-800` borders — slightly warmer/bluer than pure gray

### Before/After Summary

**Before (Polar):**
- User sees: Gray page → white floating rounded card → large title → content inside card
- Navigation: Collapsible sidebar with pill-shaped active items and MUI icons
- Subnav: Only visible when sidebar collapses (confusing)

**After (Spaire):**
- User sees: Full dark canvas → sticky header bar → full-width content
- Navigation: Structured sidebar with section groups, left-border active indicator, Lucide icons
- Subnav: Always-visible underline tab row below header when section has subsections

The result: a user who has seen Polar will not recognize the shell. The layout structure, navigation anatomy, page chrome, and visual language are all different.

---

## Implementation Notes for Engineers

### Files to Create (New)

```
clients/apps/web/src/components/
├── Layout/Dashboard/
│   ├── SpaireSidebar.tsx           # New sidebar
│   └── SpairePageHeader.tsx        # New sticky page header
└── UI/
    ├── MetricCard.tsx
    ├── ResourceTable.tsx
    ├── StatusBadge.tsx
    ├── EventTimeline.tsx
    ├── SidePanel.tsx
    ├── InlineEditField.tsx
    ├── FilterBar.tsx
    ├── PageHeader.tsx
    └── EmptyState.tsx
```

### Files to Modify (Key)

```
clients/apps/web/src/
├── components/Layout/DashboardLayout.tsx    # Remove card wrapper, use new sidebar
├── components/Dashboard/navigation.tsx      # Add group, restructure routes
├── app/(main)/dashboard/[organization]/
│   └── (header)/layout.tsx                  # Update to use new layout components
└── next.config.mjs                          # Add URL redirects
```

### Files to Delete (After Phase 3)

```
clients/apps/web/src/components/Layout/Dashboard/
└── DashboardSidebar.tsx    # After SpaireSidebar.tsx ships
```

### Do Not Change

- `globals.css` — design tokens are already correct
- All page-level data fetching hooks — the redesign is layout/presentation only
- The `@spaire/client` API client — no backend changes needed
- Authentication and organization context providers

---

*End of Spaire Dashboard Redesign Plan*
