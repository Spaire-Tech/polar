# Course Assistant — v2 design decisions

**Status: shelved / deferred.** The v1 implementation (AI-clone-of-instructor,
approval-gated, transcript-gated) is **hidden** behind the
`COURSE_ASSISTANT_UI_ENABLED` flag
(`clients/apps/web/src/components/Courses/assistant/flag.ts`). Code is intact,
nothing deleted. This note captures the agreed v2 direction so the decisions
aren't relitigated when we pick it back up. It's a decision record, not a spec.

## What v2 is

A course **teaching assistant (TA)** — *not* an AI clone of the instructor.

- **Source priority:** the course first; Claude's general subject knowledge as
  *labeled* backup. Claude is strong on most course subjects; refusing anything
  outside the literal transcript made v1 feel broken.
- **Persona:** neutral "Course Assistant." No voice cloning.
- **No approval gate. No transcript gate. Live immediately.**

## Core decisions

1. **Course-first, general-knowledge-as-backup, transparent which is which.**
   Answer from the course when it covers the question; otherwise general
   knowledge, said plainly ("the course doesn't cover this directly, but
   generally…"), and **never contradict/override what the course teaches.**
2. **TA persona — drop the voice card entirely.**
3. **Stateless.** No draft/serving snapshot, no `building/ready_for_review/live`
   state machine.
4. **Instant grounding from course metadata** — title, module names, lesson
   titles + descriptions, and any text lessons are available with zero Mux
   involvement. Transcripts are **silent enrichment, non-blocking.**
5. **Enrollment-gated for students** (unchanged); customer + member sessions.

## Two refinements (must-haves, not optional)

**A. Confidence scales with grounding — the day-zero paradox.**
On day zero the TA has metadata only, so it's *least* grounded exactly when it
launches — most likely to give the generic textbook answer that undercuts an
opinionated creator. The risk and the launch stack on the same day. Fix is
prompt-shaping, not infrastructure:
- *Metadata-only:* hedge, stay scoped, route to the relevant module ("the course
  covers this in Module 3 — want me to point you there?"). Do **not** answer
  substantively on *method*.
- *Once transcripts land* (it knows the instructor's actual position): answer
  with more authority.

**B. Strictness default must not be opt-in-by-spelunking.**
The creators who most need "course-only" strictness (proprietary, opinionated,
premium) are the least likely to find a buried toggle and the angriest if the TA
goes off-script. Fix: surface the choice in the **setup flow** as a one-tap
question ("Does your course teach a specific method the assistant should stick
to?") **or** infer a sensible default from course type. Protection is not
opt-in-by-hunting.

## Trust signal

Cite "from Lesson 3" for course-grounded answers; **no citation** for general
knowledge. Doubles as a visual cue of which mode the TA is in.

## Cost: stateless ≠ uncached

Going stateless kills the snapshot state machine — but **keep prompt caching**
on the course-context block (`cache_control: ephemeral`). Otherwise we pay full
input for the whole course on every message. It's an optimization, not a
snapshot; it reintroduces none of the approval complexity. Design it in from the
start, don't retrofit.

## What v2 deletes from v1

- Voice-card generation.
- Approval endpoint + draft/serving snapshot columns + status state machine.
- Sample-Q&A review screen.
- Transcript-as-hard-gate (the pipeline stays, as enrichment only).

## What v2 keeps

- Enrollment gate; SSE streaming; the cheap input guardrail (but now permissive
  — general knowledge is allowed); customer + member auth; the transcription
  pipeline (now non-blocking, fetched inline on the API path).
- The "what students are asking" insight surface is orthogonal — probably keep.

## Open / deferred

- Exact setup-flow UX for the strictness question (one-tap vs inferred).
- Per-task model choice (answers vs guardrail).
- Whether general-knowledge answers should still be lightly logged for the
  insight surface.

## How to re-enable

Flip `COURSE_ASSISTANT_UI_ENABLED` to `true`, then **build v2 fresh as a clean
stateless service** — do not patch v1. v1's complexity is the thing v2 exists to
remove.
