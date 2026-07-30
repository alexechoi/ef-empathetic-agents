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
- `confirmation.tsx`, `chain-of-thought.tsx`, `audio-player.tsx` are compound
  components; all work client-side with local state. Use as designed.
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
  moment-card.tsx                 # shell: header, badge, reasoning; renders body via registry
  bodies/
    reach-out-body.tsx            # audio player + transcript
    ask-first-body.tsx            # confirmation → onApprove/onDecline callbacks
    stay-quiet-body.tsx           # (near-)empty on purpose
  decision-registry.ts            # Record<Decision, { badge, label, Body }>
  use-moment-actions.ts           # all state transitions (approve/decline) live here
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

## Data model (UI-facing only — backend undefined, shape is throwaway)

`lib/moments.ts`:

```ts
export type Decision = "reach_out" | "ask_first" | "stay_quiet";

export interface Memory {
  id: string;
  kind: "voice_note" | "chat" | "story";
  title: string;        // "Voice note — before your uni interview, 2021"
  excerpt: string;
}

export interface Moment {
  id: string;
  title: string;        // "Job interview — Vercel"
  when: string;         // "Tomorrow, 9:00 AM"
  decision: Decision;
  reasoning: string[];  // rendered as chain-of-thought steps
  message?: {
    text: string;       // transcript
    audioSrc: string;   // /audio/interview.mp3 (pre-generated, in public/)
    memoryIds: string[];
  };
}
```

Mock: 3 moments — interview (`reach_out`), mum's birthday (`ask_first`),
empty Tuesday (`stay_quiet`) — plus ~5 dad `Memory` items. Synthetic only.

---

## Commit 1 — `feat(ui): Moments shell, layout slots, static feed`

Strip the analytics dashboard; keep the sidebar shell; lay down the permanent layout.

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

- `components/moments/moment-card.tsx` — add collapsible deliberation above the
  body slot: `chain-of-thought.tsx` compound (`ChainOfThought` +
  `ChainOfThoughtHeader` + `ChainOfThoughtStep` per `reasoning[]` entry).
  Default collapsed; `defaultOpen` prop threaded so the demo can pre-expand one card.
- `components/moments/bodies/reach-out-body.tsx` — `audio-player.tsx` compound
  (`AudioPlayer` + `AudioPlayerElement src` + `AudioPlayerControlBar` with
  play/seek/time) + transcript as plain muted `<p>`.
- `components/moments/bodies/ask-first-body.tsx` — `confirmation.tsx` compound:
  `ConfirmationRequest` ("Dad would usually call before this — want a message?")
  with `ConfirmationActions` wired to `onApprove`/`onDecline` **props** (no state
  inside).
- `components/moments/bodies/stay-quiet-body.tsx` — nothing beyond collapsed
  reasoning. Silence is the UI.
- `components/moments/use-moment-actions.ts` — feed-level overrides map;
  approve flips a moment to `reach_out` (revealing the player), decline to
  `stay_quiet`. Cards stay dumb.
- `decision-registry.ts` — register the three bodies.
- `public/audio/interview.mp3` — pre-generated ElevenLabs clip checked in (never
  demo a live dependency; silent placeholder until the real render).

**Accept:** interview card plays audio; birthday Approve reveals a player, Decline
mutes the card; reasoning expands/collapses everywhere; Tuesday stays quiet.

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
  (`NodeHeader`/`NodeTitle`/`NodeDescription` from kind/title), theme nodes
  ("interviews", "encouragement", "birthdays") linked by edges. Static
  `{ id, position, data }` arrays derived from `lib/moments.ts`.
- `components/app-sidebar.tsx` — "Memories" already points at `/memories`.

**Accept:** rail shows the Persona orb + Dad card + grounded-in list beside the
feed at ≥xl (no layout shift from commit 1); orb switches to `"speaking"` while
audio plays and back to `"idle"` after; `/memories` renders ≥5 connected nodes;
navigation works both ways; Avatar fallback renders if the Rive asset is
unreachable.

---

## Out of scope

Backend wiring (LangGraph SDK), live ElevenLabs calls, calendar ingestion, upload
flow. UI-first with mock data behind one hook + one import site, so wiring later
touches `use-moment-actions.ts` and `page.tsx` only.
