# Masterclass Architect — Build Plan

**Status:** Proposal
**Owner:** TBD
**Last updated:** 2026-07-27

## What it is

A new opening to the masterclass creation flow. Instead of asking a creator to
describe their masterclass from memory (title box, description box), we ask for
a link to their existing body of work — a YouTube channel to start. We read
what they've already made and come back with **three masterclasses they could
teach**, each laid out as a season of episodes, each with receipts (the videos
and comments that justify it), and each with an honest split: episodes that
already have source material vs. episodes still to film.

**One-sentence pitch:** it finds the masterclass hiding in the videos they've
already made, and tells them what's left to shoot.

## Vocabulary (decide once, use everywhere)

| Term | Meaning |
|---|---|
| Masterclass | The product a creator sells (today: "course") |
| Season | A chapter grouping inside a masterclass (today: "module") |
| Episode | A single lesson (today: "lesson", already "episode" in episodic mode) |
| Fast pass | The 10–20 second public-data analysis (outliers + comment demand) |
| Deep pass | The multi-minute analysis that produces the three proposals |
| Receipts | The evidence attached to every claim: video links, comment quotes, stats |

The AI's writing, the wizard copy, and the portal must all use the same three
words. The modules → seasons rename ships with this project.

## Design principles

1. **Evidence before advice.** Show them true things about their own channel
   (fast pass) before proposing anything. No conclusions until trust is earned.
2. **Receipts on everything.** Every proposal cites its videos and quotes its
   comments. A wrong guess with visible reasoning costs little; a wrong guess
   from a black box costs everything.
3. **Never a spinner.** Every wait is filled: the fast pass covers the resolve,
   the taste questions cover the deep pass, proposals stream in one at a time.
4. **Honest promises.** "7 of 11 episodes have source material" — never "half
   your course is already made." We hand back a map to their own footage, never
   the footage (it cannot be pulled from YouTube).
5. **The fork is a catch-all, not a fail state.** "I already know what I'm
   making" is a confident exit AND the graceful landing for every failure
   (bad link, tiny channel, unreadable source).
6. **Public data first.** Everything that can be built without asking anyone's
   permission gets built first. The permission-gated part (transcripts) is
   built only if Phase 0 proves it's needed.

---

## Phase 0 — Prove the magic before writing product code (~1–2 weeks)

The biggest risk is not technical. It's that the three proposals feel generic —
a course outline anyone could have written, wearing their thumbnails. Kill or
confirm that risk before building anything.

**The bake-off:**

1. Pick 10–15 real creator channels across sizes (50 videos → 1,000 videos)
   and niches (tutorial-shaped, vlog-shaped, talking-head-shaped).
2. Hand-run the pipeline twice per channel (scripts, not product code):
   - **Version A — public data only:** titles, descriptions, view/like counts,
     comment threads, the creator's own public replies to comments, channel
     about page. No permissions needed from anyone.
   - **Version B — public data + transcripts** (owner-provided or manually
     obtained for the test).
3. Generate three proposals from each version. Put them side by side.
4. Show creators (or honest proxies who know the channel) both sets, unlabeled.
   Score each proposal: *"Is this YOUR masterclass, or a template?"* and
   *"Would you start filming the missing episodes?"*

**Gate A — decisions this phase must produce:**

- **Is the magic real at all?** If neither version lands, stop and rethink the
  signal mix. (Cheapest possible place to learn this.)
- **Are transcripts worth it?** If Version A ≈ Version B, delete the entire
  OAuth/consent/verification/caption-rationing track from the plan. If B is
  clearly better, transcripts become a *quality upgrade shipped later*, never a
  launch blocker — launch on A regardless.
- Which niches/sizes work well, and where the floor is (minimum videos/comments
  for a confident read) — this defines the fork threshold in Phase 2.

**Deliverables:** the scoring results, the winning prompt/signal recipe, a
written go/no-go on transcripts, and the minimum-channel threshold.

---

## Phase 1 — The engine (~2–3 weeks, backend)

The analysis service, built as an asynchronous background job (the codebase
already has the worker/job pattern and an AI pipeline to model this on).

**1a. Channel reader (public API key only, no OAuth):**
- Resolve any pasted link/handle to a channel; fetch name, avatar, video count,
  earliest upload (feeds the instant-confirmation moment).
- Walk the uploads playlist for the full video list + statistics. Never use
  search calls (expensive quota); walk lists and **cache hard**.
- Pull comment threads and the creator's own replies for the candidate videos.
- Store **derived analysis, not raw API responses** (YouTube's terms impose
  ~30-day staleness rules on stored raw data; conclusions are ours).
- Respect quota as a budget: per-day accounting, backoff, and a queue so a
  burst of signups degrades to "your proposals will be ready shortly" rather
  than errors. Request a quota increase early — it's paperwork with a lead
  time, so file it in this phase even though launch fits inside default quota.

**1b. Fast pass (target: under 20 seconds, runs first, returns separately):**
- Outlier detection: each video scored against the median of its ~10
  neighboring uploads (controls for channel growth), not the all-time average.
- Comment-demand mining on top candidates: classify for "asked for
  longer/deeper/serious version," keep the actual quotes.
- Output: 3 overperformers with multipliers + the demand pattern with quoted
  receipts. Nothing about masterclasses.

**1c. Deep pass (target: under 4 minutes):**
- Subject-ownership analysis from titles, descriptions, and the creator's own
  replies (their voice in text — no permission needed). Transcripts plug in
  here later only if Gate A said they matter.
- The three-signal overlap (overperformance × comment demand × subject
  ownership) → three distinct proposal candidates, deliberately different
  angles, not three flavors of one idea.
- Per proposal: title, one-line promise, suggested structure (seasons/episodic
  — chosen by the AI from the material, not asked upfront), episode list, and
  the footage map: each episode marked "have material: [video links]" or "to
  film," with the receipts attached.
- Cheap model for extraction/classification at scale; strongest model for the
  final synthesis of the three proposals.

**1d. Failure taxonomy (feeds the fork):** unresolvable link, non-YouTube link,
below-threshold channel, comments disabled, quota exhausted. Each returns a
typed reason so the wizard can land it gracefully.

**Exit criteria:** given a channel URL, the service returns confirmation
< 2s, fast pass < 20s, three proposals < 4 min, at Phase-0 quality, for ~$1 or
less per channel all-in.

---

## Phase 2 — The wizard experience (~2–3 weeks, frontend; overlaps Phase 1)

Rebuild the opening of the existing masterclass wizard. Everything downstream
(trial, hero, lesson cards, portal preview, editor, video hosting) stays.

**The flow:**

1. **Intro** (existing).
2. **"Start with what you've already made."** One field: paste a link to your
   channel. Beneath it, quiet and small: **"I already know what I'm making →"**
   which drops into the current manual flow (structure → instructor → details).
   This link is also where every failure case lands, with a warm line —
   "we couldn't get a good read on that link — let's build it together" —
   never an error screen.
3. **Instant confirmation** (< 2 seconds): avatar, channel name, "214 videos
   going back to 2019." The moment they believe it's reading *them*.
4. **Fast pass** (10–20 seconds): evidence only. "This one did 4× your median.
   61 comments asking for a longer version," with real quotes. While it runs,
   ask the one optional question: **"Anything people keep asking you about?"**
   — its answer feeds the deep pass.
5. **Taste steps during the deep pass:** the topic-independent one-tap choices
   — hero layout, lesson-card style, trial (Free Preview / Episode Sample),
   price. Roughly the same duration as the analysis.
6. **Three proposals, streaming in as cards** as each one finishes (never a
   spinner if they beat the analysis). Each card: title, promise, season
   shape, episode count, "7 of 11 episodes have source material," receipts
   expandable underneath.
7. **Pick one** → covers offered **from the thumbnails of the mapped videos**
   (their own imagery), plus upload. → Portal preview → create.
8. Instructor step disappears as a form: bio is **pre-drafted** from the
   channel's public about page and how they talk, shown for edit/confirm.

**Also in this phase:**
- Modules → Seasons rename across wizard, editor, portal, and AI-generated copy.
- Remove the dead fields/steps this flow replaces (the hidden audience/
  differentiator wiring, the structure question as a standalone step).
- Analytics on every beat (see Metrics).

**Exit criteria:** a creator can go link → published-ready draft masterclass
without typing anything except (optionally) the "keep asking you" answer.

---

## Phase 3 — Private beta and Gate B (~2 weeks)

- 20–50 hand-picked creators through the real flow.
- Watch the funnel (below), read every generated proposal set by hand, log
  every fork-landing and its reason.
- Tune: outlier thresholds, proposal diversity, threshold for the fork,
  copy of the receipts.

**Gate B — go/no-go for general availability:** majority of beta creators pick
a proposal (rather than forking out), and picked proposals lead to more
published masterclasses than the current manual flow's baseline.

---

## Phase 4 — Placement and growth (after GA)

Two decisions deliberately deferred until the experience is proven:

1. **Move the hook before the paywall.** Today everything sits behind
   "pick a plan and pay." Because the fast pass needs no permissions and costs
   cents, it can run *before* the plan page — making the plan page "unlock
   your three masterclasses" instead of a toll booth. Ship as an A/B test
   against the current gate.
2. **The outreach engine.** The same public-only fast pass, packaged as a
   shareable report for creators who've never heard of the product. Same
   engine, marketing surface. Requires rate-limiting/abuse controls (anyone
   can paste anyone's channel — fine for public data, but budget it).

Also here: transcripts as a quality upgrade (if Gate A said they matter),
starting the Google verification paperwork well ahead; podcasts/newsletters as
additional sources (easier to read than YouTube, but weaker audience signals —
YouTube stays first).

---

## Metrics (instrumented from day one)

Funnel: link pasted → confirmed → fast pass viewed → question answered →
proposal picked (vs. forked, by reason) → draft created → **published** →
first sale. North star: **published masterclasses per hundred signups**,
against the current manual-flow baseline. Guardrails: analysis cost per
channel, time-to-proposals, fork rate by failure reason, quota consumption.

## Risks and answers

| Risk | Answer |
|---|---|
| Proposals feel generic | Phase 0 bake-off before any product code; receipts make quality visible; Gate A/B kill switches |
| Transcript permissions drag (consent flow, Google review, caption rationing) | Not on the launch path at all; only pursued if Phase 0 proves value |
| Unofficial scrapers as a shortcut | Never. Payments company. Public API + owner consent only |
| "Half your course exists" overpromise | Copy standard: "N of M episodes have source material," footage map links to their own videos |
| Small/quiet channels get confident nonsense | Phase-0-derived threshold routes them to the fork warmly |
| Quota/day limits under signup spikes | List-walking not search, hard caching, job queue with graceful "ready shortly," quota increase filed early |
| YouTube data-retention terms | Store derived conclusions, not raw responses |
| Deep pass finishes after taste steps | Proposals stream in one at a time; never a spinner |

## Open decisions

- Exact fork copy — recommended: **"I already know what I'm making"**.
- Whether the picked proposal feeds the existing outline generator as rich
  context (fastest) or replaces it (cleaner) — decide in Phase 2 from Phase 1
  output shape.
- Seasons wording in course-mode (a masterclass of "seasons" vs. keeping
  "chapters" for non-episodic) — decide with the rename.
- Beta cohort sourcing.

## Rough timeline

Weeks 1–2: Phase 0 → **Gate A**. Weeks 2–5: engine. Weeks 4–7: wizard.
Weeks 7–9: beta → **Gate B**. GA thereafter; placement A/B and outreach after
GA. Roughly two months to beta with one backend and one frontend engineer plus
whoever owns the prompts — the phases overlap on purpose, and Phase 0 needs no
engineers at all, so it starts now.
