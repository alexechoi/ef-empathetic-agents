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

## ElevenLabs

```bash
npm run agent:status
npm run agent:push
```

To place a real call, set `DRY_RUN=false` and configure
`ELEVENLABS_AGENT_PHONE_NUMBER_ID` in `.env`.
