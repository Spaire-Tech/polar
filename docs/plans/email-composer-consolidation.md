# Email Composer Consolidation — Design Doc & Phased Plan

Status: Proposed
Owner: TBD
Related: audit of `clients/apps/web/src/app/(main)/dashboard/[organization]/email-marketing/_components/`

---

## 1. Problem

There are **two separate email composers** wired to the **same** `EmailBroadcast`
record, with **two incompatible document schemas** and **two different HTML
renderers**. A third renderer (the server's) mirrors only one of them.

| | "New broadcast" | "Edit broadcast" |
|---|---|---|
| Route | `/broadcasts/new` | `/broadcasts/[id]/edit` |
| Component | `composer/ComposerApp.tsx` | `screens/NewBroadcastScreen.tsx` + `blockEditor/` |
| `content_json` shape | `{ v: 'composer.v3', blocks… }` | `ContentDoc { version: 1, blocks… }` |
| Block types | `text, h1, h2, h3, quote, bullet, numbered, image, button, divider, file` | `heading, paragraph, eyebrow, subheading, badge, list, quote, columns, checklist, image, video, button…` |
| Text storage | raw `innerHTML` per block | plain `text` per block |
| Renderer | `composer/serializer.ts` | `blockEditor/render.ts` |
| Server mirror | ❌ none | ✅ `server/polar/email_broadcast/render.py` |

This split is the **root cause** of nearly every reported bug, including silent
data loss.

### 1.1 What users hit today

- **Data loss (Critical).** Create in "New" (`composer.v3`) → click "Edit" →
  `adoptContentJson` (`NewBroadcastScreen.tsx:85-100`) can't parse `composer.v3`
  (`isContentDoc` requires `version === 1` + its own block types,
  `blockEditor/types.ts:414-428`) → silently loads a 2‑line starter doc → next
  save overwrites the original. "New" also can't reopen its own drafts at all
  (`ComposerApp.tsx:163-196`).
- **Different/random fonts & sizes (Critical).** The two renderers disagree on
  every value (body 19px vs 14px, H1 34/800 vs 28/600, quotes/lists/buttons…
  `serializer.ts:16-32` vs `render.ts:9-19`). Whichever editor saved last wins;
  the server can't render `composer.v3` blocks at all and emits empty HTML
  (`render.py` dispatch + `service.py:330`). "Random sizes on random words" =
  raw contentEditable `innerHTML` is stored (`blocks.tsx:89-91`) and dumped
  unfiltered into the email (`serializer.ts:46`); pasted `<span style="…">`
  rides along. `sanitize.ts` preserves inline `style`/`<font>` and only runs on
  preview.
- **Selection formatting hits the whole block (Critical UX).** Heading/align/
  list-type are per-block fields (`changeType` → `{…b, type}` `blocks.tsx:357`).
  Inline marks use `document.execCommand` against the live selection with **no
  saved range** (`blocks.tsx:308-311`), so the link/color popovers lose the
  selection.
- **Video (Critical).** Upload stores a `blob:` URL that's never uploaded and is
  dropped by the renderer (`BlockEditor.tsx:982-984` + `render.ts:121-122`).
  Embed has no thumbnail UI and falls back to the page URL as the `<img src>`
  (`render.ts:123`) → broken image. Editor preview plays video, so it looks
  fine while authoring.
- **Fake/dead controls.** "Duplicate" is a toast-only no-op
  (`ComposerApp.tsx:617`). "Discard" doesn't delete the saved record
  (`:954-979`). "Saving…" is an 850ms timer with **no autosave**
  (`:233-237`); a real `useAutosave` hook exists but is unused. Reply-to and
  segment **excludes** are dropped before send (`:448`, `:439-442`).

Full finding list with severities is in §7.

---

## 2. Goals / Non‑goals

**Goals**
1. **One** document schema, **one** front-end renderer, kept in lockstep with the
   server renderer. Preview == sent, always.
2. **No silent data loss**, ever. Unknown/legacy content is preserved, never
   replaced by a starter doc.
3. Per-**selection** inline formatting that actually targets the selection.
4. Working media (image already works; make video real).
5. Honest controls — autosave, undo/redo, discard, duplicate either work or
   don't exist.

**Non-goals (this effort)**
- New block types beyond what exists.
- Visual redesign of the email template (separate track).
- Deliverability/sending-infra changes.

---

## 3. Key decision — the canonical editor

**Recommendation: make `blockEditor`'s `ContentDoc` the canonical schema and
`render.ts` the canonical front-end renderer (kept byte-parity with
`render.py`), and route BOTH "New" and "Edit" through one editor built on it.**

Rationale:
- The **server already mirrors `blockEditor`**. Aligning the client to the
  server eliminates the "server renders to empty / different" class of bugs.
- `ContentDoc` is a **structured** model (typed blocks, not raw `innerHTML`),
  which is the only sane base for per-selection marks and sanitization.
- `composer.v3` (`ComposerApp`) is the prettier shell but is the incompatible,
  lossy, `execCommand`-based one.

What to keep from `ComposerApp`: its **chrome/UX** (top bar, insert menu, send
flow, preview) — refit onto the canonical schema rather than thrown away. The
data model and renderer underneath get replaced; the nice UI can stay.

> Open decision for review: do we (a) refit `ComposerApp`'s UI onto `ContentDoc`,
> or (b) invest in `blockEditor`'s editor UI to match `ComposerApp`'s polish?
> Either way the schema/renderer answer is the same. §4 is written to be
> independent of this choice.

---

## 4. Phased plan

Each phase is independently shippable and ordered by risk reduction.

### Phase 0 — Stop the bleeding (safety, no schema change yet)
Small, urgent, low-risk patches that prevent loss and lies *before* the bigger
refactor lands.

1. **Data-loss guardrail.** In `adoptContentJson` (`NewBroadcastScreen.tsx:85`),
   when `content_json` is unrecognized: **do not** return `STARTER_DOC`. Instead
   keep the existing `content_html` read-only and surface a clear "this draft was
   made in an older editor" state, OR convert (see Phase 1 migration). Never let
   a save overwrite unparsed content.
2. **Sanitize on paste.** Add an `onPaste` handler to the editable surfaces that
   inserts `text/plain` (or a whitelisted set of marks), killing pasted
   `font-size`/`font`/`color`. Also strip inline `style`/`<font>` in
   `sanitize.ts` for the **save** path, not just preview.
3. **Remove the lies.** Either implement or remove: "Duplicate" no-op
   (`ComposerApp.tsx:617`), "Discard" that doesn't delete (`:954`), fake
   "Saving…" indicator (`:233`). Disable dead reply-to/excludes controls until
   Phase 4 wires them.

### Phase 1 — One schema, one renderer
1. Make `ContentDoc` the only persisted shape. Route "New" through the canonical
   editor so it stops writing `composer.v3`.
2. Delete `composer/serializer.ts` as a *save* path; all sends render via
   `render.ts`. Extend the existing parity test (`render.parity.test.ts`) to
   guarantee `render.ts` == `render.py` for every block type.
3. **Migration for existing `composer.v3` broadcasts.** One-time, lossless:
   - Map v3 blocks → `ContentDoc` blocks (`text→paragraph`, `h1/2/3→heading{level}`,
     `bullet/numbered→list`, `quote→quote`, `image/button/divider→same`,
     `file→?` decision needed). Strip inline styles into structural marks where
     possible; otherwise drop to clean text.
   - For anything unmappable, **freeze the already-rendered `content_html`** so
     the email still sends exactly as before; mark the doc "legacy, re-create to
     edit." Never blank it.
4. Add a `schema_version` check so a future unknown shape fails loud, not silent.

### Phase 2 — Real per-selection inline formatting
1. Replace `execCommand` + raw `innerHTML` with a structured inline model:
   text/heading/quote/list blocks hold an array of runs with marks
   (`bold/italic/link/color`), not HTML strings.
2. **Saved-selection** discipline: capture the `Range` on toolbar `mousedown`,
   restore before applying, so links/colors hit the selection.
3. Clear separation in the toolbar: **inline** marks act on the selection;
   **block** controls (heading level, alignment, list type) are visibly
   block-scoped.
4. Build vs buy: evaluate a constrained library (Lexical / TipTap / Slate) with
   an email-safe serializer vs a small custom runs model. Custom is less code to
   ship but more to maintain; a library gives correct selection handling for
   free. **Recommend a spike to compare** before committing.

### Phase 3 — Media
1. **Video upload**: reuse the image upload pipeline (`uploadImage` → S3/Mux) so
   `src` becomes a hosted URL; never persist `blob:`.
2. **Thumbnails**: auto-derive YouTube/Vimeo poster (`img.youtube.com/vi/<id>/…`);
   add a "set thumbnail" control for arbitrary embeds. Email output stays the
   email-safe poster-image-linking-to-video (no `<video>`/`<iframe>` in mail).
3. **Image error revert** (`ComposerApp.tsx:389`): on upload failure, clear the
   data-URL `src` instead of inlining base64 into the email.

### Phase 4 — UX correctness
1. Wire the existing **`useAutosave`** (debounced, race-safe) into the editor;
   delete the fake timer.
2. **Undo/redo** for block ops via `useDocHistory` (already present for B).
3. **Enter splits / Backspace merges** blocks in text editing.
4. Double-submit guard on Send/Schedule; remove hardcoded preview data
   (`preview.tsx:63-75`); delete dead `labels`/`customTags` state + CSS.
5. Wire **reply-to** and segment **excludes** into the real send payload (or
   remove the controls).

### Phase 5 — Tests & guardrails
- Round-trip test: author → save → reopen → byte-identical doc.
- Render parity test extended: TS `render.ts` == Python `render.py`, all blocks.
- Paste-sanitization unit tests (Word/Docs/HTML fixtures → clean output).
- Schema-guard test: unknown `content_json` preserves `content_html`, never
  starter-docs.

---

## 5. Migration & rollout

- Phase 0 ships immediately (pure safety).
- Phase 1 migration runs as a backfill + on-read converter; keep a feature flag
  to route "New" to the canonical editor so we can dark-launch.
- Old `composer.v3` drafts: converted where possible, otherwise send-frozen via
  existing `content_html`. **No record is ever blanked.**

## 6. Risks

- **Rich-text rebuild scope (Phase 2)** is the largest unknown — gate it behind
  the spike.
- **Migration fidelity** — some `composer.v3` inline styling won't map cleanly;
  acceptable fallback is frozen `content_html` + "re-create to edit."
- **Two UIs to reconcile** — decided in §3 open question; doesn't block Phases
  0–1.

---

## 7. Appendix — full finding list (severity · location · effect)

**Critical**
- Two schemas on one record → edit discards "New" content (`NewBroadcastScreen.tsx:85-100`; `blockEditor/types.ts:414-428`). Data loss.
- `ComposerApp` never hydrates an existing broadcast (`ComposerApp.tsx:163-196`). Drafts can't be reopened losslessly.
- Server renders `composer.v3` blocks to empty HTML (`render.py` dispatch; `service.py:330`).
- Dual renderers disagree on all type styles (`serializer.ts:16-32` vs `render.ts:9-19`). Different fonts/sizes on publish.
- Raw `innerHTML` stored + emitted unfiltered (`blocks.tsx:89-91`, `serializer.ts:46`); no paste sanitization. Random per-span sizes.
- Selection formatting via `execCommand`, no saved range (`blocks.tsx:308-311`); heading/align are per-block (`:357`). "Whole block changes."
- Video upload stores dropped `blob:` URL (`BlockEditor.tsx:982-984`, `render.ts:121-122`).
- "Duplicate" is a no-op toast (`ComposerApp.tsx:617`).
- "Discard" doesn't delete the saved broadcast (`ComposerApp.tsx:954-979`).

**Major**
- Embed video → page URL used as `<img src>`, broken image; no thumbnail UI (`render.ts:123`).
- Editor preview plays video; sent email can't (`BlockEditor.tsx:1012,1036`). WYSIWYG lies.
- Segment **excludes** dropped; `filter_rules` both branches `null` (`ComposerApp.tsx:439-442`).
- Reply-to always `null` (`ComposerApp.tsx:448`).
- Fake "Saving…" indicator, no autosave; `useAutosave` unused (`ComposerApp.tsx:233-237`).
- Enter doesn't split / Backspace doesn't merge text blocks (`blocks.tsx`, no `onKeyDown`).
- No undo/redo for block ops.
- Subject double-stored, can desync; absent from `content_json` (`ComposerApp.tsx:443-463`).
- `sanitize.ts` preserves inline `style`/`<font>`, preview-only (`sanitize.ts:26-33`).

**Minor**
- Image upload failure inlines base64 into the email (`ComposerApp.tsx:389-409`).
- "+" insert leaves placeholder on OS-dialog cancel (`ComposerApp.tsx:268`).
- Hardcoded preview data + dead action buttons (`preview.tsx:63-75`).
- Unused `labels`/`customTags` state + CSS; hidden `'Newsletter'` label shipped.
- No double-submit guard on Send/Schedule (`ComposerApp.tsx:566-592`).
- ColorPicker doesn't expand 3-digit hex (`ColorPicker.tsx:25`); color swatch always resets to black (`blocks.tsx:286`).
- Undo coalescing can swallow a step (`useDocHistory.ts:50`).
- Duplicated-block ID scheme differs from `muid()` (`ComposerApp.tsx:320`).
