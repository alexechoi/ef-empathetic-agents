# SPEC — Moments UI (initial)

Proactive grief-support agent. The main screen is a **feed of moments** (calendar
events), each showing the agent's decision: **reach out / ask first / stay quiet**.
Not a chat. The demo payoff is a voice message from "Dad" playing inside a moment card.

**Hard constraint:** UI is built ONLY from:
- `components/ui/*` (shadcn primitives, already installed)
- `components/ai-elements/*` (AI Elements, already installed)
- Tailwind utilities + React primitives

No new UI libraries. No hand-rolled equivalents of anything that exists in
`ai-elements` (audio player, reasoning, confirmation, graph canvas).

**Verified component notes** (from reading the installed source — respect these):
- `confirmation.tsx` is AI-SDK-shaped: `<Confirmation>` requires `state` (a tool
  state string) and `approval` (`{ id }` or `{ id, approved }`), and renders
  nothing unless `approval` is truthy. Drive it with hand-made values:
  request = `state="approval-requested" approval={{ id: moment.id }}`;
  after a click = `state="output-available" approval={{ id, approved: true|false }}`
  (which switches to `ConfirmationAccepted`/`ConfirmationRejected`). Buttons are
  `ConfirmationActions` + `ConfirmationAction onClick`.
- `chain-of-thought.tsx` steps take `status?: "complete" | "active" | "pending"`
  plus `icon` (Lucide) and `className` — there is no blocked/skip status. Map
  planner semantics: done → `complete`, skipped → `pending`, blocked →
  `complete` + `className="text-destructive"` + a `ShieldAlert`-style icon.
- `audio-player.tsx` is a media-chrome compound; `AudioPlayerElement` takes the
  `src`. Works client-side with a static file. Use as designed.
- `persona.tsx` is a Rive/WebGL2 orb that fetches its asset from a **remote URL**
  and takes a voice state (`idle|listening|thinking|speaking|asleep`). It is the
  face of Dad's presence — use it as the primary visual, driven by playback
  state. Because the asset loads over venue wifi, wrap it in an
  `onLoadError`-guarded container that swaps to a shadcn `Avatar` so the demo
  never shows a dead box.
- `transcription.tsx` requires timed segments + render-prop children. Overkill for
  a static transcript — use a plain `<p className="text-muted-foreground">`.
- `canvas.tsx` wraps React Flow (`@xyflow/react`, installed). `node.tsx`/`edge.tsx`
  are custom node/edge **types**: register via `nodeTypes`/`edgeTypes` and feed
  standard React Flow `{ id, position, data }` objects. Do not build a graph by hand.

---

## UI architecture (modularity rules)

```
app/page.tsx                      # data in, layout out — ONLY place mock data is imported
app/memories/page.tsx             # graph screen (commit 3)
components/moments/
  moment-feed.tsx                 # list container; owns useMomentActions
  moment-card.tsx                 # shell: header, badge, deliberation; renders body via registry
  planner-trace.tsx               # run-level trace block at the top of the feed
  bodies/
    reach-out-body.tsx            # audio player + transcript
    ask-first-body.tsx            # confirmation → onApprove/onDecline callbacks
    stay-quiet-body.tsx           # (near-)empty on purpose
    held-back-body.tsx            # failed safety checks, visible care
  decision-registry.ts            # Record<Decision, { badge, label, Body }>
  use-moment-actions.ts           # all state transitions + playingMomentId live here
components/dad-panel/
  dad-panel.tsx                   # right-rail composition
  grounded-in.tsx                 # sources list for a moment
lib/moments.ts                    # types + mock data
```

Rules:
1. **Presentational bodies.** Body components receive a `Moment` (and callbacks)
   as props. They never import mock data, never own transition state.
2. **Transitions in one hook.** `use-moment-actions.ts` holds feed-level state
   (`Record<momentId, Decision>` overrides). Approve/decline mutate here only.
   Backend wiring later = replace this hook's internals, touch nothing else.
3. **Registry, not branches.** `moment-card.tsx` looks up
   `decision-registry.ts[moment.decision]` for badge variant, label, and Body.
   A new decision type = one new body file + one registry entry.
4. **Layout is fixed from commit 1.** The page lays down `feed + rail` slots on
   day one; later commits fill slots, never restructure.

---

## Backend contract (agent-service, now on main)

The service is Express + SQLite + a LangGraph planner
(`evaluateImportance → retrieveMemories → generateProposal → safetyValidator`).
Zod schemas in `agent-service/src/schemas.ts` are the **single source of truth**
— the UI copies those shapes, never invents parallel ones.

Endpoints the UI will consume (wiring is commit 4, not this spec's commits):
- `POST /plans/generate { userId }` → `{ plans: OutreachPlan[], trace: TraceStep[] }`
- `GET /plans?userId=` → `OutreachPlan[]`
- `GET /events?userId=`, `GET /memories?userId=`
- `POST /calls { planId }` → triggers the ElevenLabs call
- Seeded demo user: `demo-user` — **Alex** (user) + **Dad** (father).
  Consent flags on the profile: `proactiveCallsConsent: true`,
  `maxContactsPerWeek: 1`, `prohibitedTopics: ["medical diagnoses", "money problems"]`.
- Seeded calendar (mirror these in mock data so mock ≈ API):
  **Final job interview** (tomorrow), **Family Sunday lunch**, **Mum's birthday**.
  Seeded memories: 3 Dad voice notes (interview-eve pep talk, first-day pride,
  exam confidence), all `approvedForUse`, themes like `encouragement`.

Facts that constrain the UI (verified in code, don't re-derive):
- `generateProposal` emits a plan for **every** event — `toMoment(event, plan)`
  is always a pair; no planless events.
- `safetyValidator` resolves every `shouldContact` plan to `approved` or
  `blocked`. **`pending` only survives on no-contact plans** — it is not an
  "ask first" signal.
- `trace` is **run-level**: one `TraceStep` per graph node, no `eventId`/`planId`.
  It cannot be filtered per card.
- `safetyReport.checks` are named checks (`opted_in`, `outside_quiet_hours`,
  `within_frequency_limit`, `memories_approved`, `no_alive_claim`,
  `no_medical_legal_financial_advice`, `no_dependency_encouragement`,
  `no_emotional_certainty`, `offers_easy_decline`, …) with `passed` + `detail`.
- `openingMessage` always ends with a question offering an easy decline —
  transcript copy should read that way too.

## Data model (UI view-model over backend shapes)

A **moment** is the UI join of a `CalendarEvent` and its `OutreachPlan`.
`lib/moments.ts` keeps the view-model + a pure adapter, so mock data and
API data flow through the same function:

```ts
export type Decision = "reach_out" | "ask_first" | "stay_quiet" | "held_back";

// Mapping (in the adapter, not in components). The backend has no ask/sent
// distinction — consent is a UI state layered on top of approved plans:
//   plan.shouldContact === false                    -> "stay_quiet"
//   shouldContact && safetyStatus === "blocked"     -> "held_back"  (safety layer visible)
//   shouldContact && safetyStatus === "approved"    -> "ask_first"  (awaiting Alex's go-ahead)
//   "reach_out" = post-approval state — set by use-moment-actions after
//   Approve, or pre-set in mock for the already-delivered interview card.

export interface Moment {
  id: string;                 // plan id
  title: string;              // event.title
  when: string;               // formatted event.startsAt
  decision: Decision;
  reasoningSummary: string;   // plan.reasoningSummary
  steps: MomentStep[];        // per-card deliberation, DERIVED (see below)
  confidence?: number;        // plan.confidence
  purpose?: string;           // plan.purpose
  openingMessage?: string;    // plan.openingMessage — the transcript
  audioSrc?: string;          // pre-generated clip for demo playback
  memoryIds: string[];        // plan.selectedMemoryIds
  safetyReport?: SafetyReport; // only present on shouldContact plans
}

// The run trace has NO per-plan linkage, so per-card steps are derived from
// plan fields, mirroring the 4 graph nodes:
//   1. importance  — from reasoningSummary (+ confidence)
//   2. memories    — "N memories selected" from selectedMemoryIds
//   3. proposal    — purpose / "no contact proposed"
//   4. safety      — from safetyReport.status + failed check names
// MomentStep = { label, detail?, tone: "ok" | "muted" | "blocked" }.

// Memory, SafetyReport, TraceStep: copy types from agent-service/src/schemas.ts.

export function toMoment(event: CalendarEvent, plan: OutreachPlan): Moment
```

Mock mirrors the seed calendar: **Final job interview** (`reach_out`,
already-delivered card with audio), **Mum's birthday** (`ask_first`),
**Family Sunday lunch** (`held_back` — frequency limit: 1 contact/week already
used), plus a quiet weekday (`stay_quiet`). Memories in backend shape, matching
the 3 seeded voice notes. Synthetic only.

The `held_back` decision is one registry entry + one body file — proof the
registry pattern holds. Its body renders the failed `SafetyCheck` rows
(e.g. `within_frequency_limit: 1/1 this week`): the "note on care" judging
criterion made visible.

The **run-level trace** still gets rendered — once, not per card: a collapsed
"How the planner ran" block at the top of the feed (chain-of-thought compound,
one step per TraceStep, `ok/info → complete`, `skip → pending`, `blocked →
destructive-tinted complete`). Arrives with commit 2.

---

## Commit 1 — `feat(ui): Moments shell, layout slots, static feed` ✅ DONE

Shipped as `e20279d` (branch `worktree-noah+moments-ui`) and verified in the
browser. Built as specified below, with one known drift: `lib/moments.ts` still
uses the pre-merge shape (`reasoning: string[]`, `message{}`, 3 decisions).
**Commit 2 starts by migrating it to the view-model above** (adds `held_back`,
`steps`, seed-aligned events) — that migration is in-scope for commit 2.

- `app/page.tsx` — drop `SectionCards`, `ChartAreaInteractive`, `DataTable`,
  `data.json`. Inside the existing `SidebarProvider`/`SidebarInset`/`SiteHeader`
  shell, render the permanent two-slot layout:
  `<div className="flex gap-6"><MomentFeed … (flex-1, max-w-2xl mx-auto)/><aside className="hidden xl:block w-80">{/* rail slot */}</aside></div>`.
  Rail stays empty until commit 3.
- `components/app-sidebar.tsx` — nav: **Moments** (`/`), **Memories** (`/memories`),
  **Settings** (`#`). Rebrand; remove documents/secondary nav noise.
- `components/site-header.tsx` — "Moments" + today's date.
- `lib/moments.ts` — types + mock data.
- `components/moments/decision-registry.ts` — decision → `{ label, badgeVariant }`
  (Body slots stubbed as `null` until commit 2):
  `reach_out` → default "Reaching out" · `ask_first` → secondary "Asking first" ·
  `stay_quiet` → outline "Staying quiet".
- `components/moments/moment-feed.tsx` — `flex flex-col gap-4` of cards; takes
  `moments` as a prop.
- `components/moments/moment-card.tsx` — shadcn `Card`; header = title/`when` +
  registry badge; content = first reasoning line as one-line summary + body slot
  (null for now). `stay_quiet` cards render muted and compressed — restraint
  visible but calm.
- Delete unused: `section-cards.tsx`, `chart-area-interactive.tsx`,
  `data-table.tsx`, `app/data.json` (+ imports).

**Accept:** root shows sidebar + header + 3 badged cards in the feed slot; empty
rail at ≥xl doesn't shift the feed; build passes.

---

## Commit 2 — `feat(ui): decision bodies — reasoning, confirmation, voice playback`

- `lib/moments.ts` — **migrate first**: view-model shape (`steps`, `held_back`,
  backend-shaped `Memory`), `toMoment()` adapter, mock data mirroring the seed
  calendar (interview / Mum's birthday / Sunday lunch / quiet day).
- `components/moments/moment-card.tsx` — collapsible deliberation above the
  body slot: `chain-of-thought.tsx` compound, one `ChainOfThoughtStep` per
  derived `MomentStep` (tone `ok → complete`, `muted → pending`, `blocked →
  complete + text-destructive + shield icon`). Default collapsed; `defaultOpen`
  threaded for the demo.
- `components/moments/planner-trace.tsx` — the run-level trace as a collapsed
  "How the planner ran" block at the top of the feed (same chain-of-thought
  compound; mock `TraceStep[]` until wiring).
- `components/moments/bodies/reach-out-body.tsx` — `audio-player.tsx` compound
  (`AudioPlayer` + `AudioPlayerElement src` + `AudioPlayerControlBar` with
  play/seek/time) + `openingMessage` transcript as plain muted `<p>`.
- `components/moments/bodies/ask-first-body.tsx` — `confirmation.tsx` per the
  prop recipe in the component notes: request state until a button is clicked,
  then flip to accepted/rejected via `onApprove`/`onDecline` **props** (no state
  inside the body). Approve later maps to `POST /calls { planId }`.
- `components/moments/bodies/stay-quiet-body.tsx` — nothing beyond collapsed
  reasoning. Silence is the UI.
- `components/moments/bodies/held-back-body.tsx` — safety layer made visible:
  the failed `SafetyCheck` rows by name with their `detail`
  (e.g. `within_frequency_limit — Contacts this week: 1 / 1`) in muted
  destructive styling. No audio, no actions — the system chose care.
- `components/moments/use-moment-actions.ts` — feed-level overrides map +
  `playingMomentId`; approve flips a moment to `reach_out` (revealing the
  player), decline to `stay_quiet`. Cards stay dumb.
- `decision-registry.ts` — register all four bodies.
- `public/audio/interview.mp3` — pre-generated ElevenLabs clip checked in (never
  demo a live dependency; silent placeholder until the real render).

**Accept:** interview card plays audio; birthday Approve reveals a player,
Decline mutes the card; Sunday-lunch card shows named safety checks; deliberation
expands on every card; planner-trace block renders at the top; quiet day stays
quiet; build passes.

---

## Commit 3 — `feat(ui): Dad rail + Memories graph page`

- `components/dad-panel/dad-panel.tsx` — fills the commit-1 rail slot.
  **Primary: the `persona.tsx` orb** at the top of a `Card`, with name +
  "Voice ready" `Badge` below. Drive its state from playback: `"speaking"`
  while any moment's audio plays, `"thinking"` while a confirmation is pending,
  else `"idle"`. Playback state comes from `use-moment-actions.ts` (add
  `playingMomentId`), so the orb reacts to the feed without prop drilling
  through cards. Guard with `onLoadError` → swap to shadcn `Avatar` card so a
  failed Rive fetch never shows a dead box.
- `components/dad-panel/grounded-in.tsx` — `sources.tsx` compound
  (`SourcesTrigger count` + `Source` items with **custom children, no real
  hrefs**) listing the interview moment's memories: proves the message is
  grounded, not invented.
- `app/memories/page.tsx` — `canvas.tsx` (React Flow wrapper): register
  `node.tsx`/`edge.tsx` via `nodeTypes`/`edgeTypes`; nodes = memories
  (`NodeHeader`/`NodeTitle`/`NodeDescription` from `sourceType`/`summary`),
  theme nodes from `themes` ("encouragement", "interviews", "confidence")
  linked by edges. Static `{ id, position, data }` arrays derived from
  `lib/moments.ts`.
- `components/app-sidebar.tsx` — "Memories" already points at `/memories`.

**Accept:** rail shows the Persona orb + Dad card + grounded-in list beside the
feed at ≥xl (no layout shift from commit 1); orb switches to `"speaking"` while
audio plays and back to `"idle"` after; `/memories` renders ≥5 connected nodes;
navigation works both ways; Avatar fallback renders if the Rive asset is
unreachable.

---

## Commit 4 (future) — wiring, for orientation only

Not part of this spec's build, but the shape is now known:
- `page.tsx` fetches `GET /events` + `GET /plans?userId=demo-user`, maps through
  `toMoment()`.
- "Generate" action calls `POST /plans/generate` and re-renders the feed with
  the returned `trace`.
- `use-moment-actions.ts` approve → `POST /calls { planId }`; playback state
  unchanged.
- Everything else (bodies, registry, cards, panels) is untouched — that is the
  point of the architecture rules above.

## Out of scope

Live ElevenLabs calls from the UI, calendar ingestion, upload flow, auth.
