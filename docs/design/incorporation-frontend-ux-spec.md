# Incorporation Frontend UX Specification

## Stripe Atlas-Inspired Company Formation Wizard

**Author:** Staff Engineering
**Date:** 2026-03-06
**Status:** Design Proposal
**Related:** [incorporation-feature-plan.md](./incorporation-feature-plan.md)

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Information Architecture](#2-information-architecture)
3. [Navigation Integration](#3-navigation-integration)
4. [Route Structure](#4-route-structure)
5. [Wizard Flow — Screen-by-Screen](#5-wizard-flow--screen-by-screen)
6. [Post-Submission Dashboard](#6-post-submission-dashboard)
7. [Component Architecture](#7-component-architecture)
8. [State Management](#8-state-management)
9. [Responsive & Dark Mode](#9-responsive--dark-mode)
10. [Animations & Transitions](#10-animations--transitions)
11. [ASCII Wireframes](#11-ascii-wireframes)

---

## 1. Design Philosophy

### Lessons from Stripe Atlas

Stripe Atlas succeeds because it:

1. **Feels like filling out one form, not six** — the stepper makes progress visible but doesn't overwhelm. Each screen has 2-4 fields max.
2. **Provides education inline** — hover tooltips and expandable "Why does this matter?" sections reduce anxiety about legal decisions.
3. **Defaults are smart** — Delaware is pre-selected, fiscal year defaults to December, today's date is pre-filled.
4. **Review is comprehensive** — before payment, you see everything in one scrollable summary.
5. **Post-submission is calm** — a timeline view shows exactly where you are, no guessing.

### Spaire Design Principles

We inherit Spaire's existing design system:

- **`DashboardBody`** as the page wrapper (consistent title, max-width, animation)
- **`rounded-2xl` cards** with `border-gray-200` / `dark:border-spaire-700`
- **`blue-500` primary actions** with `blue-600` hover
- **`@spaire/ui` atoms** — Button, Input, Select, Card, Tabs, Badge
- **React Hook Form + Zod** for validation
- **TanStack Query** for data fetching
- **Framer Motion** page transitions (already in DashboardBody)

### Key Difference from Atlas

Atlas is a standalone product. Ours lives **inside the dashboard** — so we get the sidebar, header, and org context for free. The wizard should feel like a natural extension of the dashboard, not a separate app.

---

## 2. Information Architecture

### User Journey Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        ENTRY POINTS                              │
│                                                                  │
│  Sidebar "Incorporate" → Landing Page                            │
│  Startup Stack CTA    → Landing Page                             │
│  Onboarding prompt    → Landing Page                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     LANDING PAGE                                 │
│                                                                  │
│  No incorporations? → Hero CTA: "Start Your Company"            │
│  Has draft?         → Resume banner + list                       │
│  Has active?        → Status cards + list                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Click "Start" or "Resume"
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WIZARD (5 steps)                               │
│                                                                  │
│  1. Entity Type    (LLC vs Corporation)                          │
│  2. Company Info   (name, state, details)                        │
│  3. People         (officers/founders)                           │
│  4. Addresses      (company + mailing)                           │
│  5. Review & Pay   (summary → checkout)                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Payment complete
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  STATUS DASHBOARD                                │
│                                                                  │
│  Timeline view (submitted → processing → filed → complete)      │
│  Document downloads when available                               │
│  Company details reference card                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Navigation Integration

### Sidebar Addition

Add "Incorporate" to the `generalRoutesList` in `navigation.tsx`, positioned after "Startup Stack" and before "Balance":

```tsx
// clients/apps/web/src/components/Dashboard/navigation.tsx

import BusinessOutlined from '@mui/icons-material/BusinessOutlined'

// In generalRoutesList, after startup-stack entry:
{
  id: 'incorporate',
  title: 'Incorporate',
  icon: <BusinessOutlined fontSize="inherit" />,
  link: `/dashboard/${org?.slug}/incorporate`,
  checkIsActive: (currentRoute: string): boolean => {
    return currentRoute.startsWith(`/dashboard/${org?.slug}/incorporate`)
  },
  if: true,
},
```

**Why `BusinessOutlined`?** It's from `@mui/icons-material` (already used throughout the sidebar) and visually represents a company/building — clear meaning for "incorporation." We use the outlined variant to match the other sidebar icons.

### Sidebar Order (after change)

```
Overview
Catalog
Customers
Analytics
Revenue
Integrations
Startup Stack
Incorporate          ← NEW
Balance
Settings
```

---

## 4. Route Structure

```
clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/incorporate/
├── page.tsx                           # Landing page (list + CTA)
├── layout.tsx                         # Optional: tab layout if needed later
├── new/
│   └── page.tsx                       # Wizard entry point
├── [incorporationId]/
│   └── page.tsx                       # Status/detail page
```

**Component files** (in `clients/apps/web/src/components/Incorporation/`):

```
components/Incorporation/
├── IncorporateLandingPage.tsx         # Landing page with hero/list
├── IncorporationWizard.tsx            # Main wizard orchestrator
├── steps/
│   ├── EntityTypeStep.tsx             # Step 1
│   ├── CompanyInfoStep.tsx            # Step 2
│   ├── PeopleStep.tsx                 # Step 3
│   ├── AddressStep.tsx                # Step 4
│   └── ReviewStep.tsx                 # Step 5
├── IncorporationStatusPage.tsx        # Post-submission detail
├── IncorporationTimeline.tsx          # Timeline component
├── IncorporationDocuments.tsx         # Document list
├── EntityTypeCard.tsx                 # Reusable entity selection card
├── OfficerFieldGroup.tsx             # Reusable officer form fields
└── StepIndicator.tsx                  # Progress stepper
```

---

## 5. Wizard Flow — Screen-by-Screen

### Overall Wizard Layout

The wizard uses `DashboardBody` with `wrapperClassName="max-w-(--breakpoint-md)!"` (same as product creation) and a custom step indicator at the top.

```
┌──────────────────────────────────────────────────────┐
│ DashboardBody title="Start a Company"                │
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │         Step Indicator (1 of 5)                  │ │
│ │  ● Entity Type  ○ Company  ○ People  ○ Address   │ │
│ │                                    ○ Review      │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │                                                  │ │
│ │              Step Content Area                   │ │
│ │         (changes per step, animated)             │ │
│ │                                                  │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│         [← Back]                    [Continue →]     │
└──────────────────────────────────────────────────────┘
```

### Step Indicator Design

A horizontal step indicator inspired by Stripe's minimal approach. Each step is a small circle connected by a line. Completed steps get a checkmark, current step is filled blue, future steps are gray outline.

```tsx
// StepIndicator.tsx
const steps = [
  { label: 'Entity Type', key: 'entity' },
  { label: 'Company', key: 'company' },
  { label: 'People', key: 'people' },
  { label: 'Address', key: 'address' },
  { label: 'Review', key: 'review' },
]
```

Visual states:
- **Completed:** Blue filled circle with white checkmark, blue connecting line
- **Current:** Blue filled circle with white dot, gray connecting line ahead
- **Future:** Gray outlined circle, gray connecting line
- Labels appear below circles on desktop, hidden on mobile (just circles)

---

### Step 1 — Entity Type

**Goal:** Choose LLC or Corporation. This is the most important decision, so it gets a full screen with educational content.

**Layout:** Two large selectable cards, side by side on desktop, stacked on mobile.

```
┌──────────────────────────────────────────────────────┐
│  What type of company do you want to form?           │
│                                                      │
│  ┌─────────────────────┐ ┌─────────────────────────┐ │
│  │ ○ LLC               │ │ ○ Corporation            │ │
│  │                     │ │                          │ │
│  │ Limited Liability   │ │ Best for startups        │ │
│  │ Company             │ │ seeking venture capital  │ │
│  │                     │ │                          │ │
│  │ Simpler structure,  │ │ Easier to issue stock,   │ │
│  │ pass-through taxes, │ │ preferred by investors,  │ │
│  │ flexible management │ │ clear governance         │ │
│  │                     │ │                          │ │
│  │ Best for:           │ │ Best for:                │ │
│  │ • Solo founders     │ │ • VC-backed startups     │ │
│  │ • Small teams       │ │ • Companies planning     │ │
│  │ • Consulting firms  │ │   to raise funding       │ │
│  │ • Freelancers       │ │ • Companies planning     │ │
│  │                     │ │   stock options           │ │
│  └─────────────────────┘ └─────────────────────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────────┐ │
│  │ ▸ Not sure? Here's a quick comparison            │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  [Sub-choice appears after selection:]               │
│                                                      │
│  If LLC selected:                                    │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Management structure                              │ │
│  │ ○ Member-Managed (recommended for most)           │ │
│  │ ○ Manager-Managed                                 │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  If Corporation selected:                            │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Tax election                                      │ │
│  │ ○ C Corporation (recommended for VC)              │ │
│  │ ○ S Corporation                                   │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│                                   [Continue →]       │
└──────────────────────────────────────────────────────┘
```

**Implementation notes:**
- Entity cards use `rounded-2xl border-2` with a blue ring (`ring-2 ring-blue-500`) when selected
- Sub-choice uses radio buttons from `@spaire/ui`
- "Not sure?" is a collapsible section using `<details>` or a custom accordion
- No "Back" button on step 1 (it's the first step)

**Fields:**
| Field | Type | Required | Default |
|-------|------|----------|---------|
| `entity_type` | `"LLC" \| "CORP"` | Yes | None |
| `structure_type` | `"MEMBER" \| "MANAGER"` | If LLC | "MEMBER" |
| `tax_election` | `"C Corporation" \| "S Corporation"` | If CORP | "C Corporation" |

---

### Step 2 — Company Info

**Goal:** Collect the company name, formation state, and basic details. Keep it to ~5 fields max.

```
┌──────────────────────────────────────────────────────┐
│  Tell us about your company                          │
│                                                      │
│  Company legal name *                                │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Acme Technologies LLC                            │ │
│  └──────────────────────────────────────────────────┘ │
│  This will be the official name filed with the state │
│                                                      │
│  Trade name / DBA (optional)                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │                                                  │ │
│  └──────────────────────────────────────────────────┘ │
│  A different name your company will do business as   │
│                                                      │
│  Formation state *                                   │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Delaware                                    ▾    │ │
│  └──────────────────────────────────────────────────┘ │
│  ⓘ Delaware is the most popular state for startups.  │
│    It has well-established corporate law and is       │
│    preferred by investors.                            │
│                                                      │
│  ┌─────────────────────┐ ┌─────────────────────────┐ │
│  │ Formation date *    │ │ Fiscal year end *        │ │
│  │ ┌─────────────────┐ │ │ ┌─────────────────────┐ │ │
│  │ │ March 6, 2026   │ │ │ │ December         ▾  │ │ │
│  │ └─────────────────┘ │ │ └─────────────────────┘ │ │
│  └─────────────────────┘ └─────────────────────────┘ │
│                                                      │
│  EIN (optional)                                      │
│  ┌──────────────────────────────────────────────────┐ │
│  │ XX-XXXXXXX                                       │ │
│  └──────────────────────────────────────────────────┘ │
│  If you already have an EIN. Most new companies      │
│  don't — we'll skip this.                            │
│                                                      │
│  [← Back]                          [Continue →]      │
└──────────────────────────────────────────────────────┘
```

**Implementation notes:**
- Formation date uses a date input, defaulting to today
- State selector is a searchable select with all 50 US states + DC
- EIN field uses an input mask (XX-XXXXXXX pattern)
- Helper text appears below each field in `text-sm text-gray-500 dark:text-spaire-400`
- Delaware info box uses a subtle blue-tinted background (`bg-blue-50 dark:bg-blue-900/10 rounded-xl p-3`)

**Fields:**
| Field | Type | Required | Default |
|-------|------|----------|---------|
| `legal_name` | string | Yes | "" |
| `trade_name` | string | No | "" |
| `formation_state` | US state code | Yes | "DE" |
| `formation_date` | date | Yes | today |
| `fiscal_end_month` | month name | Yes | "December" |
| `ein` | string (XX-XXXXXXX) | No | "" |

---

### Step 3 — People (Officers)

**Goal:** Add the company's officers/founders. Dynamic list with add/remove. This is the most complex step.

```
┌──────────────────────────────────────────────────────┐
│  Who's involved in the company?                      │
│                                                      │
│  Add the officers, directors, or members of your     │
│  company. At least one person is required.           │
│                                                      │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Person 1                              ★ Primary  │ │
│  │                                                  │ │
│  │ Type: ○ Individual  ○ Company                    │ │
│  │                                                  │
│  │ ┌──────────────┐ ┌────────────────────┐          │ │
│  │ │ First name * │ │ Last name *        │          │ │
│  │ │ ┌──────────┐ │ │ ┌────────────────┐ │          │ │
│  │ │ │ Jane     │ │ │ │ Smith          │ │          │ │
│  │ │ └──────────┘ │ │ └────────────────┘ │          │ │
│  │ └──────────────┘ └────────────────────┘          │ │
│  │                                                  │ │
│  │ Title *                                          │ │
│  │ ┌──────────────────────────────────────────────┐ │ │
│  │ │ CEO                                     ▾    │ │ │
│  │ └──────────────────────────────────────────────┘ │ │
│  │                                                  │ │
│  │ Address                                          │ │
│  │ ┌──────────────────────────────────────────────┐ │ │
│  │ │ Street address *                             │ │ │
│  │ └──────────────────────────────────────────────┘ │ │
│  │ ┌─────────────┐ ┌──────────┐ ┌───────────────┐ │ │
│  │ │ City *      │ │ State *  │ │ ZIP *         │ │ │
│  │ └─────────────┘ └──────────┘ └───────────────┘ │ │
│  │                                                  │ │
│  │                               [Remove Person]    │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  [+ Add another person]                              │
│                                                      │
│  [← Back]                          [Continue →]      │
└──────────────────────────────────────────────────────┘
```

**Implementation notes:**
- Each officer is a collapsible card (expanded by default when just added)
- The first officer is auto-marked as "Primary" (shown with a star badge)
- "Primary" can be reassigned by clicking on any officer's header
- Title field is a select with common options: CEO, CTO, Managing Member, Director, Secretary, Treasurer, Member
- When "Company" type is selected, first/last name fields change to a single "Company name" field
- "Remove" button is disabled when only 1 officer remains
- Uses React Hook Form's `useFieldArray` for dynamic officer list
- Each officer card uses `rounded-2xl border border-gray-200 dark:border-spaire-700 p-6`

**Fields per officer:**
| Field | Type | Required | Default |
|-------|------|----------|---------|
| `type` | `"PERSON" \| "COMPANY"` | Yes | "PERSON" |
| `first_name` | string | If PERSON | "" |
| `last_name` | string | If PERSON | "" |
| `company_name` | string | If COMPANY | "" |
| `title` | string | Yes | "" |
| `address_street` | string | Yes | "" |
| `address_city` | string | Yes | "" |
| `address_state` | US state code | Yes | "" |
| `address_zip` | string (5 digits) | Yes | "" |
| `is_primary` | boolean | — | first=true |

---

### Step 4 — Addresses

**Goal:** Company address and mailing address. Simple, clean, with a "same as above" shortcut.

```
┌──────────────────────────────────────────────────────┐
│  Company addresses                                   │
│                                                      │
│  Principal Office Address                            │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Street address *                                 │ │
│  │ ┌──────────────────────────────────────────────┐ │ │
│  │ │ 123 Startup Lane                             │ │ │
│  │ └──────────────────────────────────────────────┘ │ │
│  │                                                  │ │
│  │ ┌────────────────┐ ┌──────────┐ ┌─────────────┐ │ │
│  │ │ City *         │ │ State *  │ │ ZIP *       │ │ │
│  │ │ ┌────────────┐ │ │ ┌──────┐ │ │ ┌─────────┐ │ │ │
│  │ │ │ Wilmington │ │ │ │ DE   │ │ │ │ 19801   │ │ │ │
│  │ │ └────────────┘ │ │ └──────┘ │ │ └─────────┘ │ │ │
│  │ └────────────────┘ └──────────┘ └─────────────┘ │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  Mailing Address                                     │
│  ☑ Same as principal office address                  │
│  ┌──────────────────────────────────────────────────┐ │
│  │ (fields hidden when checkbox is checked)         │ │
│  │ Street, City, State, ZIP — same layout as above  │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Additional Services                               │ │
│  │                                                  │ │
│  │ ☑ Include Registered Agent ($149/year)            │ │
│  │   A registered agent receives legal documents     │ │
│  │   on behalf of your company. Required in most     │ │
│  │   states.                                         │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  [← Back]                          [Continue →]      │
└──────────────────────────────────────────────────────┘
```

**Implementation notes:**
- "Same as principal" checkbox copies values and disables mailing fields
- Registered Agent toggle is a standalone card with price callout
- State selector reuses the same searchable select from Step 2
- ZIP validates for 5-digit US ZIP codes

**Fields:**
| Field | Type | Required | Default |
|-------|------|----------|---------|
| `address_street` | string | Yes | "" |
| `address_city` | string | Yes | "" |
| `address_state` | US state code | Yes | "" |
| `address_zip` | string | Yes | "" |
| `mailing_same_as_principal` | boolean | — | true |
| `mailing_address_street` | string | If different | "" |
| `mailing_address_city` | string | If different | "" |
| `mailing_address_state` | string | If different | "" |
| `mailing_address_zip` | string | If different | "" |
| `include_registered_agent` | boolean | — | true |

---

### Step 5 — Review & Pay

**Goal:** Show everything before payment. Each section has an "Edit" link that goes back to the relevant step. A cost breakdown at the bottom leads to checkout.

```
┌──────────────────────────────────────────────────────┐
│  Review your application                             │
│                                                      │
│  Please review everything below before proceeding    │
│  to payment.                                         │
│                                                      │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Entity Type                           [Edit]     │ │
│  │ ─────────────────────────────────────────────    │ │
│  │ LLC — Member-Managed                             │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Company Details                       [Edit]     │ │
│  │ ─────────────────────────────────────────────    │ │
│  │ Legal name:      Acme Technologies LLC           │ │
│  │ State:           Delaware                        │ │
│  │ Formation date:  March 6, 2026                   │ │
│  │ Fiscal year end: December                        │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Officers                              [Edit]     │ │
│  │ ─────────────────────────────────────────────    │ │
│  │ ★ Jane Smith — CEO                              │ │
│  │   123 Startup Lane, Wilmington, DE 19801        │ │
│  │                                                  │ │
│  │   John Doe — CTO                                │ │
│  │   456 Tech Ave, San Francisco, CA 94105         │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Addresses                             [Edit]     │ │
│  │ ─────────────────────────────────────────────    │ │
│  │ Principal: 123 Startup Lane,                     │ │
│  │            Wilmington, DE 19801                  │ │
│  │ Mailing:   Same as principal                     │ │
│  │ Reg Agent: Included                              │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Cost Summary                                      │ │
│  │ ─────────────────────────────────────────────    │ │
│  │ LLC Formation (Delaware)           $399          │ │
│  │ Registered Agent (1 year)          $149          │ │
│  │ State filing fee                   $90           │ │
│  │ ─────────────────────────────────────────────    │ │
│  │ Total                              $638          │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  [← Back]                  [Proceed to Payment →]    │
│                                                      │
│  By proceeding, you agree to the                     │
│  Terms of Service and Incorporation Agreement.       │
└──────────────────────────────────────────────────────┘
```

**Implementation notes:**
- Each review section is a `rounded-2xl border` card with an "Edit" link (blue text, no underline)
- "Edit" navigates back to the specific step, preserving all form data
- Cost summary uses a subtle background (`bg-gray-50 dark:bg-spaire-800`)
- "Proceed to Payment" is a full-width blue button (`size="lg" fullWidth`)
- Legal links open in new tab
- The "Proceed to Payment" button:
  1. Creates the incorporation draft via `POST /v1/incorporations`
  2. Creates a checkout session via `POST /v1/incorporations/{id}/checkout`
  3. Redirects to the Spaire Checkout page
  4. On checkout success, redirects to `/dashboard/{org}/incorporate/{id}` (status page)

---

## 6. Post-Submission Dashboard

### Status Page

After payment, users see a calm, informative status page with a timeline and document section.

```
┌──────────────────────────────────────────────────────┐
│ DashboardBody title="Acme Technologies LLC"          │
│                                                      │
│ header=[Badge: "Processing" (yellow)]                │
│                                                      │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Formation Progress                                │ │
│  │                                                  │ │
│  │  ✓ Application submitted        Mar 6, 2026     │ │
│  │  │                                               │ │
│  │  ✓ Payment confirmed            Mar 6, 2026     │ │
│  │  │                                               │ │
│  │  ✓ Filed with Delaware           Mar 6, 2026     │ │
│  │  │                                               │ │
│  │  ◉ Awaiting state approval       In progress     │ │
│  │  │                                               │ │
│  │  ○ Formation complete                            │ │
│  │  │                                               │ │
│  │  ○ Documents available                           │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Company Details                                   │ │
│  │                                                  │ │
│  │ Entity Type     LLC — Member-Managed             │ │
│  │ State           Delaware                         │ │
│  │ Legal Name      Acme Technologies LLC            │ │
│  │ Formation Date  March 6, 2026                    │ │
│  │ Primary Officer Jane Smith (CEO)                 │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Documents                                         │ │
│  │                                                  │ │
│  │ No documents yet. Documents will appear here     │ │
│  │ once your formation is complete.                 │ │
│  │                                                  │ │
│  │ [When available:]                                │ │
│  │ 📄 Articles of Organization    PDF    [Download] │ │
│  │ 📄 Certificate of Formation    PDF    [Download] │ │
│  │ 📄 Operating Agreement         PDF    [Download] │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Status Badge Colors

| Status | Badge Variant | Color |
|--------|---------------|-------|
| `draft` | `secondary` | Gray |
| `submitted` | `blue` | Blue |
| `processing` | `warning` | Yellow/Amber |
| `filed` | `info` | Blue |
| `completed` | `success` | Green |
| `failed` | `destructive` | Red |
| `cancelled` | `secondary` | Gray |

### Timeline Component

The timeline is a vertical list with connecting lines:

```tsx
// IncorporationTimeline.tsx
interface TimelineEvent {
  label: string
  date?: string
  status: 'completed' | 'current' | 'upcoming'
}

// Visual: left-aligned dots connected by vertical lines
// Completed: blue dot with checkmark, blue line below
// Current: blue pulsing dot, dashed gray line below
// Upcoming: gray empty dot, gray line below
```

### Landing Page

```
┌──────────────────────────────────────────────────────┐
│ DashboardBody title="Incorporate"                    │
│                                                      │
│  [If no incorporations:]                             │
│  ┌──────────────────────────────────────────────────┐ │
│  │                                                  │ │
│  │        🏢                                       │ │
│  │                                                  │ │
│  │  Form your US company in minutes                 │ │
│  │                                                  │ │
│  │  Incorporate an LLC or Corporation directly      │ │
│  │  from your dashboard. We handle the paperwork,   │ │
│  │  you focus on building.                          │ │
│  │                                                  │ │
│  │  ✓ Delaware, Wyoming, and all 50 states         │ │
│  │  ✓ LLC or Corporation                           │ │
│  │  ✓ Registered agent included                    │ │
│  │  ✓ Formation documents delivered digitally      │ │
│  │                                                  │ │
│  │           [Start Your Company →]                 │ │
│  │                                                  │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  [If has incorporations:]                            │
│  ┌──────────────────────────────────────────────────┐ │
│  │ header=[Button: "New Incorporation"]              │ │
│  │                                                  │ │
│  │ Acme LLC          Delaware   ● Processing        │ │
│  │ Beta Corp         Wyoming    ● Completed         │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## 7. Component Architecture

### Wizard State Machine

The wizard uses a single React Hook Form instance across all steps. State persists in memory (and optionally in localStorage for draft recovery).

```tsx
// IncorporationWizard.tsx

const STEPS = ['entity', 'company', 'people', 'address', 'review'] as const
type Step = typeof STEPS[number]

const IncorporationWizard = ({ organization }: Props) => {
  const [currentStep, setCurrentStep] = useState<Step>('entity')

  const form = useForm<IncorporationFormData>({
    resolver: zodResolver(incorporationSchema),
    defaultValues: {
      entity_type: undefined,
      structure_type: 'MEMBER',
      tax_election: 'C Corporation',
      legal_name: '',
      trade_name: '',
      formation_state: 'DE',
      formation_date: new Date().toISOString().split('T')[0],
      fiscal_end_month: 'December',
      ein: '',
      officers: [{
        type: 'PERSON',
        first_name: '',
        last_name: '',
        title: '',
        address_street: '',
        address_city: '',
        address_state: '',
        address_zip: '',
        is_primary: true,
      }],
      address_street: '',
      address_city: '',
      address_state: '',
      address_zip: '',
      mailing_same_as_principal: true,
      mailing_address_street: '',
      mailing_address_city: '',
      mailing_address_state: '',
      mailing_address_zip: '',
      include_registered_agent: true,
    },
  })

  const goNext = () => {
    const idx = STEPS.indexOf(currentStep)
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1])
  }

  const goBack = () => {
    const idx = STEPS.indexOf(currentStep)
    if (idx > 0) setCurrentStep(STEPS[idx - 1])
  }

  const goToStep = (step: Step) => setCurrentStep(step)

  return (
    <DashboardBody
      title="Start a Company"
      wrapperClassName="max-w-(--breakpoint-md)!"
    >
      <Form {...form}>
        <StepIndicator steps={STEPS} current={currentStep} />

        <AnimatePresence mode="wait">
          {currentStep === 'entity' && <EntityTypeStep key="entity" />}
          {currentStep === 'company' && <CompanyInfoStep key="company" />}
          {currentStep === 'people' && <PeopleStep key="people" />}
          {currentStep === 'address' && <AddressStep key="address" />}
          {currentStep === 'review' && (
            <ReviewStep key="review" onEdit={goToStep} organization={organization} />
          )}
        </AnimatePresence>

        <WizardNavigation
          step={currentStep}
          onBack={goBack}
          onNext={goNext}
          isLastStep={currentStep === 'review'}
        />
      </Form>
    </DashboardBody>
  )
}
```

### Per-Step Validation

Each step validates only its own fields before allowing "Continue":

```tsx
// Step validation schemas
const entityStepSchema = z.object({
  entity_type: z.enum(['LLC', 'CORP']),
  structure_type: z.enum(['MEMBER', 'MANAGER']).optional(),
  tax_election: z.enum(['C Corporation', 'S Corporation']).optional(),
}).refine(
  (data) => {
    if (data.entity_type === 'LLC') return !!data.structure_type
    if (data.entity_type === 'CORP') return !!data.tax_election
    return true
  },
  { message: 'Please select a sub-type' }
)

const companyStepSchema = z.object({
  legal_name: z.string().min(1, 'Company name is required'),
  trade_name: z.string().optional(),
  formation_state: z.string().length(2, 'Select a state'),
  formation_date: z.string().min(1, 'Select a date'),
  fiscal_end_month: z.string().min(1, 'Select a month'),
  ein: z.string().regex(/^$|^\d{2}-\d{7}$/, 'EIN must be XX-XXXXXXX format').optional(),
})

const officerSchema = z.object({
  type: z.enum(['PERSON', 'COMPANY']),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company_name: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  address_street: z.string().min(1, 'Street is required'),
  address_city: z.string().min(1, 'City is required'),
  address_state: z.string().length(2, 'Select a state'),
  address_zip: z.string().regex(/^\d{5}$/, 'ZIP must be 5 digits'),
  is_primary: z.boolean(),
}).refine(
  (data) => {
    if (data.type === 'PERSON') return !!data.first_name && !!data.last_name
    return !!data.company_name
  },
  { message: 'Name is required' }
)

const peopleStepSchema = z.object({
  officers: z.array(officerSchema).min(1, 'At least one officer is required'),
})

const addressStepSchema = z.object({
  address_street: z.string().min(1, 'Street is required'),
  address_city: z.string().min(1, 'City is required'),
  address_state: z.string().length(2, 'Select a state'),
  address_zip: z.string().regex(/^\d{5}$/, 'ZIP must be 5 digits'),
  mailing_same_as_principal: z.boolean(),
  mailing_address_street: z.string().optional(),
  mailing_address_city: z.string().optional(),
  mailing_address_state: z.string().optional(),
  mailing_address_zip: z.string().optional(),
})
```

---

## 8. State Management

### Draft Persistence

Form state is saved to `localStorage` on every change (debounced 500ms). If the user navigates away and comes back, they see a "Resume your application" banner.

```tsx
const STORAGE_KEY = `incorporation-draft-${organization.id}`

// Save on change
useEffect(() => {
  const subscription = form.watch((data) => {
    debouncedSave(data)
  })
  return () => subscription.unsubscribe()
}, [form.watch])

// Load on mount
useEffect(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    form.reset(JSON.parse(saved))
  }
}, [])
```

### Server-Side Draft

After Step 2 (company info), we optionally save a server-side draft via `POST /v1/incorporations` with `status: "draft"`. This allows the landing page to show "Resume" for in-progress applications.

### TanStack Query Hooks

```tsx
// hooks/queries/incorporations.ts

export const useIncorporations = (orgId: string) =>
  useQuery({
    queryKey: ['incorporations', 'list', orgId],
    queryFn: () => api.incorporations.list({ organization_id: orgId }),
    enabled: !!orgId,
  })

export const useIncorporation = (id?: string) =>
  useQuery({
    queryKey: ['incorporations', id],
    queryFn: () => api.incorporations.get({ id: id! }),
    enabled: !!id,
    refetchInterval: (data) => {
      // Auto-refresh while in progress
      const status = data?.status
      if (status === 'submitted' || status === 'processing' || status === 'filed') {
        return 15_000 // 15 seconds
      }
      return false
    },
  })

export const useCreateIncorporation = (orgId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: IncorporationCreate) =>
      api.incorporations.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incorporations'] })
    },
  })
}

export const useIncorporationDocuments = (incorporationId?: string) =>
  useQuery({
    queryKey: ['incorporations', incorporationId, 'documents'],
    queryFn: () => api.incorporations.listDocuments({ id: incorporationId! }),
    enabled: !!incorporationId,
  })
```

---

## 9. Responsive & Dark Mode

### Mobile Adaptations

| Element | Desktop | Mobile |
|---------|---------|--------|
| Entity cards | Side by side | Stacked vertically |
| Step indicator labels | Visible | Hidden (circles only) |
| Form field pairs | 2 columns | Stacked |
| Officer cards | Full width | Full width (same) |
| Review sections | Cards | Cards (same) |
| Navigation buttons | Right-aligned | Full width, stacked |

### Dark Mode Colors

All components follow the Spaire dark mode pattern:

| Element | Light | Dark |
|---------|-------|------|
| Page background | white | `spaire-900` |
| Card background | white | `spaire-800` |
| Card border | `gray-200` | `spaire-700` |
| Primary text | `gray-900` | white |
| Secondary text | `gray-500` | `spaire-400` |
| Helper text | `gray-500` | `spaire-400` |
| Selected card ring | `blue-500` | `blue-500` |
| Info box background | `blue-50` | `blue-900/10` |

---

## 10. Animations & Transitions

### Step Transitions

Use Framer Motion's `AnimatePresence` for smooth step transitions:

```tsx
const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 100 : -100,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -100 : 100,
    opacity: 0,
  }),
}

// Wrap each step:
<motion.div
  custom={direction}
  variants={stepVariants}
  initial="enter"
  animate="center"
  exit="exit"
  transition={{ duration: 0.2, ease: 'easeInOut' }}
>
  {stepContent}
</motion.div>
```

### Micro-animations

- Entity card selection: scale(1.02) + border color transition (150ms)
- "Add person" button: new officer card slides down with `layout` animation
- Step indicator: completed step circle fills with a brief scale bounce
- Review sections: stagger children with 50ms delay

---

## 11. ASCII Wireframes

### Full Wizard — Desktop (1280px+)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ┌──────────┐                                                                    │
│ │          │  ┌──────────────────────────────────────────────────────────────┐   │
│ │ Overview │  │                                                              │   │
│ │ Catalog  │  │  Start a Company                                            │   │
│ │ Customer │  │                                                              │   │
│ │ Analytic │  │  ●───●───○───○───○                                          │   │
│ │ Revenue  │  │  Entity Company People Address Review                       │   │
│ │ Integrat │  │                                                              │   │
│ │ Startup  │  │  ┌─────────────────────┐  ┌─────────────────────────────┐   │   │
│ │ ■ Incorp │  │  │                     │  │                             │   │   │
│ │ Balance  │  │  │  ○ LLC              │  │  ○ Corporation              │   │   │
│ │ Settings │  │  │                     │  │                             │   │   │
│ │          │  │  │  Limited Liability   │  │  Best for startups seeking │   │   │
│ │          │  │  │  Company. Simpler    │  │  venture capital. Easier   │   │   │
│ │          │  │  │  structure, pass-    │  │  to issue stock, preferred │   │   │
│ │          │  │  │  through taxes.      │  │  by investors.             │   │   │
│ │          │  │  │                     │  │                             │   │   │
│ │          │  │  └─────────────────────┘  └─────────────────────────────┘   │   │
│ │          │  │                                                              │   │
│ │          │  │                                          [Continue →]        │   │
│ │          │  │                                                              │   │
│ │          │  └──────────────────────────────────────────────────────────────┘   │
│ └──────────┘                                                                    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Full Status Page — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ┌──────────┐                                                                    │
│ │          │  ┌──────────────────────────────────────────────────────────────┐   │
│ │ Overview │  │                                                              │   │
│ │ Catalog  │  │  Acme Technologies LLC            [Processing]              │   │
│ │ Customer │  │                                                              │   │
│ │ Analytic │  │  ┌────────────────────────────────────────────────────────┐  │   │
│ │ Revenue  │  │  │ Formation Progress                                     │  │   │
│ │ Integrat │  │  │                                                        │  │   │
│ │ Startup  │  │  │  ✓ Application submitted        Mar 6, 2026           │  │   │
│ │ ■ Incorp │  │  │  │                                                     │  │   │
│ │ Balance  │  │  │  ✓ Payment confirmed            Mar 6, 2026           │  │   │
│ │ Settings │  │  │  │                                                     │  │   │
│ │          │  │  │  ✓ Filed with Delaware           Mar 6, 2026           │  │   │
│ │          │  │  │  │                                                     │  │   │
│ │          │  │  │  ◉ Awaiting state approval       In progress           │  │   │
│ │          │  │  │  │                                                     │  │   │
│ │          │  │  │  ○ Formation complete                                  │  │   │
│ │          │  │  │  │                                                     │  │   │
│ │          │  │  │  ○ Documents available                                 │  │   │
│ │          │  │  └────────────────────────────────────────────────────────┘  │   │
│ │          │  │                                                              │   │
│ │          │  │  ┌────────────────────────────────────────────────────────┐  │   │
│ │          │  │  │ Company Details                                        │  │   │
│ │          │  │  │                                                        │  │   │
│ │          │  │  │ Entity    LLC — Member-Managed                         │  │   │
│ │          │  │  │ State     Delaware                                     │  │   │
│ │          │  │  │ Name      Acme Technologies LLC                        │  │   │
│ │          │  │  │ Officer   Jane Smith (CEO)                             │  │   │
│ │          │  │  └────────────────────────────────────────────────────────┘  │   │
│ │          │  │                                                              │   │
│ │          │  │  ┌────────────────────────────────────────────────────────┐  │   │
│ │          │  │  │ Documents                                              │  │   │
│ │          │  │  │                                                        │  │   │
│ │          │  │  │ No documents yet.                                      │  │   │
│ │          │  │  └────────────────────────────────────────────────────────┘  │   │
│ │          │  │                                                              │   │
│ │          │  └──────────────────────────────────────────────────────────────┘   │
│ └──────────┘                                                                    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Mobile Wizard — Step 1 (375px)

```
┌───────────────────────────┐
│ ☰  Spaire       👤       │
├───────────────────────────┤
│                           │
│ Start a Company           │
│                           │
│ ●──●──○──○──○             │
│                           │
│ What type of company?     │
│                           │
│ ┌───────────────────────┐ │
│ │ ○ LLC                 │ │
│ │                       │ │
│ │ Limited Liability     │ │
│ │ Company. Simpler      │ │
│ │ structure, pass-      │ │
│ │ through taxes.        │ │
│ └───────────────────────┘ │
│                           │
│ ┌───────────────────────┐ │
│ │ ○ Corporation         │ │
│ │                       │ │
│ │ Best for startups     │ │
│ │ seeking venture       │ │
│ │ capital.              │ │
│ └───────────────────────┘ │
│                           │
│ ┌───────────────────────┐ │
│ │     Continue →        │ │
│ └───────────────────────┘ │
│                           │
└───────────────────────────┘
```

---

## Appendix: File Inventory

### New Files to Create

```
clients/apps/web/src/
├── app/(main)/dashboard/[organization]/(header)/incorporate/
│   ├── page.tsx
│   ├── new/
│   │   └── page.tsx
│   └── [incorporationId]/
│       └── page.tsx
├── components/Incorporation/
│   ├── IncorporateLandingPage.tsx
│   ├── IncorporationWizard.tsx
│   ├── steps/
│   │   ├── EntityTypeStep.tsx
│   │   ├── CompanyInfoStep.tsx
│   │   ├── PeopleStep.tsx
│   │   ├── AddressStep.tsx
│   │   └── ReviewStep.tsx
│   ├── IncorporationStatusPage.tsx
│   ├── IncorporationTimeline.tsx
│   ├── IncorporationDocuments.tsx
│   ├── EntityTypeCard.tsx
│   ├── OfficerFieldGroup.tsx
│   ├── StepIndicator.tsx
│   └── constants.ts                  # US states, months, titles, etc.
└── hooks/queries/
    └── incorporations.ts             # TanStack Query hooks
```

### Existing Files to Modify

| File | Change |
|------|--------|
| `components/Dashboard/navigation.tsx` | Add "Incorporate" route to `generalRoutesList` |

**Total: ~17 new files, 1 modified file.**
