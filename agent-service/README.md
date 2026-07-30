# Agent service API

Base URL: `http://localhost:2024`

Start the service:

```bash
cd agent-service
npm run dev
```

The local database is seeded automatically with `demo-user`, three approved
memories, and three calendar events.

## Health

```bash
curl http://localhost:2024/health
```

## Profile

```bash
curl http://localhost:2024/users/demo-user
```

Create or update:

```bash
curl -X POST http://localhost:2024/users \
  -H 'content-type: application/json' \
  -d '{
    "id": "demo-user",
    "userName": "Alex",
    "lovedOneName": "Dad",
    "relationship": "father",
    "phoneNumber": "+441234567890",
    "timeZone": "Europe/London",
    "quietHours": { "start": "20:00", "end": "08:00" },
    "maxContactsPerWeek": 1,
    "proactiveCallsConsent": true,
    "voiceCloningConsent": false,
    "interactionStyle": "warm and gentle",
    "prohibitedTopics": ["medical diagnoses"],
    "enabledEventTypes": ["job_interview", "family_tradition"]
  }'
```

## Memories

List:

```bash
curl 'http://localhost:2024/memories?userId=demo-user'
```

Ingest pasted text:

```bash
curl -X POST http://localhost:2024/memories/ingest \
  -H 'content-type: application/json' \
  -d '{
    "userId": "demo-user",
    "sourceType": "chat",
    "text": "Dad always said: you have done the work, now go show them."
  }'
```

Upload audio:

```bash
curl -X POST http://localhost:2024/memories/upload \
  -F 'userId=demo-user' \
  -F 'audio=@./voice-note.mp3'
```

If gateway transcription is unavailable, send a transcript instead:

```bash
curl -X POST http://localhost:2024/memories/upload \
  -F 'userId=demo-user' \
  -F 'transcript=Big day tomorrow. Be yourself and breathe.'
```

Approve a memory:

```bash
curl -X PATCH http://localhost:2024/memories/MEMORY_ID \
  -H 'content-type: application/json' \
  -d '{ "approvedForUse": true }'
```

Derived knowledge graph (SQLite remains the source of truth):

```bash
curl 'http://localhost:2024/memories/graph?userId=demo-user'
```

The response is `{ "nodes": [], "edges": [] }`. Node types are `memory`,
`person`, `theme`, and `event`; edge types are `MENTIONS`, `HAS_THEME`, and
`RELATES_TO`. Graph metadata never contains voice-note transcripts.

## Calendar events

List:

```bash
curl 'http://localhost:2024/events?userId=demo-user'
```

Create or update:

```bash
curl -X POST http://localhost:2024/events \
  -H 'content-type: application/json' \
  -d '{
    "userId": "demo-user",
    "events": [{
      "id": "interview-1",
      "title": "Final job interview",
      "description": "Final round",
      "startsAt": "2026-07-31T10:00:00.000Z",
      "endsAt": "2026-07-31T11:00:00.000Z",
      "attendees": ["Alex"],
      "location": "Onsite"
    }]
  }'
```

## Outreach plans

Generate and persist plans:

```bash
curl -X POST http://localhost:2024/plans/generate \
  -H 'content-type: application/json' \
  -d '{ "userId": "demo-user" }'
```

Response shape:

```json
{
  "plans": [
    {
      "id": "plan-id",
      "eventId": "evt-interview",
      "shouldContact": true,
      "selectedMemoryIds": ["mem-interview-eve"],
      "openingMessage": "Hi Alex...",
      "safetyStatus": "approved",
      "safetyReport": { "status": "approved", "checks": [] }
    }
  ],
  "trace": [
    {
      "step": "evaluate_importance",
      "label": "Evaluated event importance",
      "status": "ok"
    }
  ]
}
```

Stream planner progress live:

```bash
curl -N -X POST http://localhost:2024/plans/generate/stream \
  -H 'content-type: application/json' \
  -d '{ "userId": "demo-user" }'
```

Named events arrive in this order:

- `started`
- `trace` after each LangGraph node
- `event_decision` for each calendar event, including importance, call/no-call,
  selected memory IDs, concise reasoning, safety status, and failed guardrails
- `plans`
- `complete`

List persisted plans:

```bash
curl 'http://localhost:2024/plans?userId=demo-user'
```

## Calls

Trigger an approved plan:

```bash
curl -X POST http://localhost:2024/calls/trigger \
  -H 'content-type: application/json' \
  -d '{
    "planId": "PLAN_ID",
    "phoneNumber": "+441234567890"
  }'
```

`phoneNumber` is optional and defaults to the user's stored number. With
`DRY_RUN=true`, the response is simulated but still persisted.

Stream caller preflight and initiation:

```bash
curl -N -X POST http://localhost:2024/calls/trigger/stream \
  -H 'content-type: application/json' \
  -d '{ "planId": "PLAN_ID", "phoneNumber": "+441234567890" }'
```

This emits `trace` events for plan loading, the safety re-check, restricted
context construction, ElevenLabs initiation, and call persistence. `call_context`
contains only the event, purpose, selected memory IDs, and concise reasoning.
The final `result` event contains the `conversationId`.

For a real active call, monitor sanitized ElevenLabs events:

```bash
curl -N http://localhost:2024/calls/CONVERSATION_ID/stream
```

This can emit `user_transcript`, `agent_response`, `agent_response_part`,
`reasoning_summary`, `correction`, `tool`, and `call_ended`. It never forwards
audio, prompts, tool payloads, dynamic variables, secrets, or hidden
chain-of-thought. Monitoring is unavailable for dry-run conversations. The
default low-latency `gemini-2.5-flash-lite` configuration disables optional
provider reasoning summaries; deterministic planner/caller decision traces and
live transcript/response events remain available.

List calls:

```bash
curl 'http://localhost:2024/calls?userId=demo-user'
```

ElevenLabs webhook:

```bash
curl -X POST http://localhost:2024/calls/webhook \
  -H 'content-type: application/json' \
  -H 'x-webhook-secret: YOUR_SECRET' \
  -d '{
    "conversation_id": "CONVERSATION_ID",
    "transcript": "user: Yes\nagent: Here is the memory..."
  }'
```

## Frontend streaming

POST-based SSE is consumed with `fetch()` rather than `EventSource`:

```ts
async function streamPost(
  path: string,
  body: unknown,
  onEvent: (event: string, data: unknown) => void,
) {
  const response = await fetch(`http://localhost:2024${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) throw new Error("Stream failed");

  const reader = response.body
    .pipeThrough(new TextDecoderStream())
    .getReader();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const event = frame.match(/^event: (.+)$/m)?.[1];
      const data = frame.match(/^data: (.+)$/m)?.[1];
      if (event && data) onEvent(event, JSON.parse(data));
    }
  }
}

await streamPost(
  "/plans/generate/stream",
  { userId: "demo-user" },
  (event, data) => appendWorkflowEvent(event, data),
);
```

After the caller stream returns a real `conversationId`, live call monitoring
uses the browser's standard `EventSource`:

```ts
const monitor = new EventSource(
  `http://localhost:2024/calls/${conversationId}/stream`,
);
monitor.addEventListener("user_transcript", addTranscriptTurn);
monitor.addEventListener("agent_response", addTranscriptTurn);
monitor.addEventListener("reasoning_summary", addReasoningSummary);
monitor.addEventListener("complete", () => monitor.close());
```

## ElevenLabs

```bash
npm run agent:status
npm run agent:push
```

To place a real call, set `DRY_RUN=false` and configure
`ELEVENLABS_AGENT_PHONE_NUMBER_ID` in `.env`.
