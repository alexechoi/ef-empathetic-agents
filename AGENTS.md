# ef-empathetic-agents

Empathetic Agents hackathon (EverSettled × ElevenLabs × Lovable).

## Layout

- `next-app/` — Next.js UI + trigger API. Talks to the agent service via the LangGraph SDK.
- `agent-service/` — One LangGraph service, two agents, shared state:
  - **orchestrator** (decision layer) — decides whether/how to reach out, produces a brief.
  - **caller** (call layer) — runs the ElevenLabs Conversational AI voice call.

## OpenAI client (hackathon gateway)

The event gateway speaks the OpenAI API. Only the **key** and **base URL** differ
from a normal OpenAI setup. Config lives in `agent-service/.env` (copy `.env.example`):

```
OPENAI_API_KEY=sk-...your-team-key...     # from organisers — NEVER commit
OPENAI_BASE_URL=https://4.231.223.10.nip.io
OPENAI_MODEL=gpt-5.4-mini                  # develop here; switch up only where it matters
```

Use the shared client instead of constructing a new one per call site:

```ts
import { getOpenAI, DEFAULT_MODEL } from "./lib/openai.js"; // in agent-service/src

const res = await getOpenAI().chat.completions.create({
  model: DEFAULT_MODEL,
  messages: [{ role: "user", content: "Hi" }],
});
```

`getOpenAI()` is a singleton pointed at `OPENAI_BASE_URL` with the team key. The
LangChain path (`ChatOpenAI` in the orchestrator) is configured against the same
base URL, so everything runs through the team budget.

### Models

`gpt-5.4-mini` (default), `gpt-5.4-nano`, `gpt-5.4`, `gpt-5.5`, `gpt-5.6-terra`,
`gpt-5.6-luna`, `gpt-5.6-sol`. Also `gpt-audio` (speech), `gpt-realtime-2.1` (live voice),
`gpt-5.3-codex` (Responses API only). `$50` hard budget per team — avoid runaway loops on
`gpt-5.5` / `gpt-5.6-sol` and long realtime sessions.

## Run it

```bash
# agent service (http://localhost:2024)
cd agent-service && npm run dev

# UI (http://localhost:3000) — set LANGGRAPH_API_URL if the port differs
cd next-app && npm run dev
```

Set `DRY_RUN=false` and the `ELEVENLABS_*` vars in `agent-service/.env` to place real calls.

## Conventions

- Centralised logging: `agent-service/src/lib/logger.ts` (pino). Always log errors.
- Add dependencies with `npm install`, never by hand-editing `package.json`.
- Never commit secrets. Don't use real personal/sensitive data — synthetic only.
