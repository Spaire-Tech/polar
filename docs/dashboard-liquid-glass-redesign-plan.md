# Dashboard Liquid Glass Redesign Plan

## Goal
Re-skin the current Polar dashboard into a brand-specific Apple-inspired liquid glass interface while keeping a black-first visual foundation.

## Design Principles
- Black canvas first: preserve dark backgrounds as the visual base.
- Glass surfaces second: apply semi-transparent layers and blur only to surfaces that need elevation.
- Motion with restraint: subtle ambient movement and hover transitions, no distracting animations.
- Keep hierarchy clear: typography and spacing must remain high-contrast and readable.

## Current Frontend Entry Points
- Global theming and Tailwind tokens: `clients/apps/web/src/styles/globals.css`.
- Dashboard shell structure: `clients/apps/web/src/components/Layout/DashboardLayout.tsx`.
- Sidebar and nav styling: `clients/apps/web/src/components/Layout/Dashboard/DashboardSidebar.tsx`.
- Main dashboard home content cards: `clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/(home)/DashboardPage.tsx`.

## Proposed Architecture Changes

### 1) Introduce glass design tokens in global styles
Add a dedicated token set for liquid glass behavior in `globals.css`:
- Surface colors for dark glass layers (`--glass-surface-*`).
- Border highlights (`--glass-border-*`).
- Shadow glows (`--glass-shadow-*`).
- Backdrop blur strengths (`--glass-blur-*`).
- Optional animated gradient variables for ambient background drift.

Also define reusable utility classes in `@layer components`, for example:
- `.glass-panel`
- `.glass-panel-strong`
- `.glass-stroke`
- `.glass-noise-overlay`

This avoids repeating long Tailwind class strings across dashboard components.

### 2) Add a dashboard-scoped visual wrapper
In `DashboardLayout.tsx`, create a dashboard background stack:
- Base pure black background layer.
- One or two low-opacity radial gradients for color bloom.
- Optional animated background movement (very slow, ~15-30s cycle).

Then wrap the existing content region with a dedicated container class (`dashboard-liquid-shell`) that keeps layout behavior unchanged while swapping style primitives.

### 3) Convert shell elements to glass components
Apply reusable glass utilities to:
- Main content container in `DashboardBody`.
- Optional context side panel in `DashboardBody`.
- Mobile header and sidebar container in `DashboardLayout.tsx` + `DashboardSidebar.tsx`.
- Search button and quick controls in sidebar.

Use stronger blur/elevation only on primary cards and nav surfaces; secondary areas should use lighter glass to avoid a cloudy UI.

### 4) Update dashboard cards and banners
In `DashboardPage.tsx`:
- Replace hard borders (`border-gray-200`, `dark:border-polar-*`) with glass stroke tokens.
- Shift card backgrounds from opaque white/polar to transparent tinted surfaces.
- Keep chart areas readable by preserving contrast and reducing excessive blur behind data.
- Convert the profile completion banner to a highlighted glass callout variant.

### 5) Optional SVG displacement filter for “liquid” feel
If desired, add a subtle SVG filter once in a root dashboard layout and apply it to hero-level components only.
- Keep displacement low to avoid text distortion.
- Never apply displacement directly to body copy or data-heavy tables.

### 6) Interaction and motion pass
Standardize transitions:
- Hover: slight brightness increase + border highlight.
- Active/focus: clear ring with high contrast.
- Enter animations: fade + tiny translate only (already partly present with framer-motion).

Respect accessibility preferences:
- Disable ambient movement under `prefers-reduced-motion`.
- Maintain WCAG contrast for text over translucent layers.

## Step-by-Step Delivery Plan

### Phase 0: Visual direction lock
- Capture 2-3 reference screenshots for “Apple-like” dark glass style.
- Decide your brand accent color and glow intensity.
- Define “no-go” constraints (e.g., no neon, no heavy blur on tables).

### Phase 1: Token and utility foundation
- Implement token variables and component-level utility classes in `globals.css`.
- Add one temporary test component/page to validate glass utilities quickly.

### Phase 2: Shell migration
- Update `DashboardLayout.tsx` and `DashboardSidebar.tsx` to use the new shell and glass utilities.
- Keep structure and routing untouched, only style and wrappers.

### Phase 3: Page and card migration
- Migrate `DashboardPage.tsx` and 2-3 high-traffic dashboard pages first.
- Create a checklist for card types (metric card, chart card, banner, table card).

### Phase 4: Consistency sweep
- Sweep remaining dashboard pages under `clients/apps/web/src/app/(main)/dashboard/[organization]/`.
- Replace duplicated class strings with standard utility classes.

### Phase 5: Polish and QA
- Validate contrast in dark mode at multiple brightness settings.
- Validate responsive behavior on mobile nav and collapsed sidebar.
- Test motion preferences and keyboard focus states.

## Tailwind Implementation Notes
- Yes, Tailwind is in use; keep implementation utility-first with shared custom classes for repeatability.
- Use arbitrary values sparingly and only when tokens cannot express the value.
- Prefer semantic class aliases (`glass-panel`) over repeated inline utility bundles.

## Risk Management
- Risk: Over-blur lowers legibility.
  - Mitigation: keep blur values moderate and use stronger text contrast.
- Risk: Too many animated layers hurt performance.
  - Mitigation: animate only background-position/opacity and avoid expensive transforms.
- Risk: Inconsistent card styles across many dashboard pages.
  - Mitigation: enforce utility class recipes and migrate by component type.

## Acceptance Criteria
- Dashboard maintains black base background throughout.
- Primary containers and cards consistently use glass tokens/utilities.
- Sidebar, top/mobile nav, and core dashboard pages share the same visual language.
- Text/readability and keyboard focus remain accessible.
- Reduced-motion mode disables ambient background animation.
